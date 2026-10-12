"""GitHub Actions 版 LLM 結構化（提示詞 v2b，與 box 版相同）。
- 提供者鏈：見 providers.py（Groq → OpenRouter → Cerebras → Mistral，沒設 key 的跳過；每日額度用盡自動換下一家）。
- checkpoint：PRICE_DATA_DIR/llm.jsonl（逐行追加；已完成的網址不重送）。
- 只有 Groq gpt-oss-120b 的結果可進自動核准；其他家的結果 model 欄位記成 '<provider>:<model>'，final.py 會標 llm_fallback_model。
- 之後 Groq 有額度時，會把「只有備援模型結果」的頁面用 120b 重做一次（LLM_UPGRADE_FALLBACK=0 可關閉）。
- 環境變數：LLM_FIRST（優先處理的工具 id，逗號分隔）、LLM_LIMIT（本次最多處理幾頁）、LLM_DEADLINE（epoch 秒，到了就停，留時間存檔）。
- 執行結束會寫 llm_run.json（今天每家用了幾頁、停用原因），供 summary.py 寫 Actions 摘要。"""
import json,os,time,sys
from common import *
from prompt import SYS,PROMPT_VERSION
from providers import build_chain,call_page,ProviderDown,PageError,PRIMARY_MODEL

FIRST=[x for x in os.environ.get('LLM_FIRST','').split(',') if x]
LIMIT=int(os.environ.get('LLM_LIMIT','0') or 0)
DEADLINE=float(os.environ.get('LLM_DEADLINE') or 0)
UPGRADE=os.environ.get('LLM_UPGRADE_FALLBACK','1')!='0'
SC=f'{BASE}/scrape.jsonl'; OUT=os.environ.get('LLM_OUT',f'{BASE}/llm.jsonl'); RUN=f'{BASE}/llm_run.json'

def is_primary_row(r): return r.get('llm_status')=='ok' and r.get('model',PRIMARY_MODEL)==PRIMARY_MODEL and r.get('provider','groq')=='groq'
def load_best():
    """每個網址取最好的結果：120b ok > 其他 ok > skipped > error"""
    best={}
    if not os.path.exists(OUT): return best
    rank=lambda r:(3 if is_primary_row(r) else 2 if r.get('llm_status')=='ok' else 1 if r.get('llm_status')!='error' else 0)
    for l in open(OUT):
        try: r=json.loads(l)
        except Exception: continue
        if r['url'] not in best or rank(r)>=rank(best[r['url']]): best[r['url']]=r
    return best

def main():
    chain,skipped=build_chain()
    run=dict(started=time.strftime('%Y-%m-%d %H:%M:%S %z'),providers_order=[p.name for p in chain],skipped_no_key=skipped,per_provider={},stopped_reason=None,pages_done=0,upgraded=0,errors=0)
    def save_run():
        run['per_provider']={p.name:dict(model=p.label,primary=p.is_primary,down=p.down,**p.stats) for p in chain}
        run['finished']=time.strftime('%Y-%m-%d %H:%M:%S %z')
        json.dump(run,open(RUN,'w'),ensure_ascii=False,indent=1)
    if skipped: print('沒有設定金鑰、略過：',', '.join(skipped),flush=True)
    if not chain:
        run['stopped_reason']='沒有任何 LLM 金鑰（請到 GitHub Secrets 設定 GROQ_API_KEY 等）'; save_run(); print(run['stopped_reason']); return 0
    tl=tools(); IDX={t['id']:i for i,t in enumerate(tl)}
    def order(u):
        ids=u['tool_ids']
        f=min([FIRST.index(i) for i in ids if i in FIRST] or [10**6])
        return (f,min([IDX[i] for i in ids if i in IDX] or [10**6]))
    best=load_best(); n=0; tried_now=set(); consec_err={p.name:0 for p in chain}
    while True:
        if DEADLINE and time.time()>DEADLINE: run['stopped_reason']='到達本次時間上限（下次自動接續）'; break
        if LIMIT and n>=LIMIT: run['stopped_reason']=f'達到 LLM_LIMIT={LIMIT}'; break
        live=[p for p in chain if not p.down]
        if not live: run['stopped_reason']='所有已設定的提供者今天額度都用完了（明天自動接續）'; break
        rows={}
        for l in open(SC):
            try: r=json.loads(l); rows[r['url']]=r
            except Exception: pass
        scraped=sorted([r for r in rows.values() if r['status']=='scraped' and r['url'] not in tried_now],key=order)
        pending=[r for r in scraped if r['url'] not in best or best[r['url']].get('llm_status')=='error']
        upgrade=[r for r in scraped if UPGRADE and r['url'] in best and best[r['url']].get('llm_status')=='ok' and not is_primary_row(best[r['url']])]
        pv=live[0]; job=None
        if pending: job=pending[0]
        elif upgrade and pv.is_primary: job=upgrade[0]
        if job is None:
            run['stopped_reason']='全部頁面都已處理完成' if not upgrade else '剩下的只有「備援模型結果待 120b 重做」，但今天 Groq 已不可用'; break
        url=job['url']; sec=open(f"{BASE}/text/{uhash(url)}.sec.txt").read() if os.path.exists(f"{BASE}/text/{uhash(url)}.sec.txt") else ''
        if len(sec)<20: out=dict(url=url,llm_status='skipped_empty')
        else:
            prompt=f"Product page: {url}\n<<<PAGE_TEXT_BEGIN>>>\n{sec}\n<<<PAGE_TEXT_END>>>"
            out=None
            for p in [q for q in chain if not q.down]:
                if job in upgrade and not p.is_primary: break   # 重做只用主要模型
                try:
                    obj,usage,att,fin=call_page(p,SYS,prompt)
                    out=dict(url=url,llm_status='ok',model=p.label,provider=p.name,prompt_version=PROMPT_VERSION,result=obj,usage=usage,attempts=att,finish=fin)
                    p.stats['ok']+=1; consec_err[p.name]=0; break
                except ProviderDown as e:
                    p.down=str(e); print('停用',p.name,'：',e,flush=True); continue
                except PageError as e:
                    p.stats['errors']+=1; consec_err[p.name]+=1
                    out=dict(url=url,llm_status='error',provider=p.name,model=p.label,error=str(e)[:300])
                    if consec_err[p.name]>=5: p.down=f'{p.name} 連續 5 頁失敗：{e}'; print('停用',p.name,flush=True)
                    break
            if out is None: continue   # 所有家都停用了，回到迴圈開頭結束
        out['tool_ids']=job['tool_ids']; out['ts']=time.strftime('%Y-%m-%dT%H:%M:%S%z')
        open(OUT,'a').write(json.dumps(out,ensure_ascii=False)+'\n')
        tried_now.add(url)
        if out['llm_status']=='error':
            run['errors']+=1
            if url not in best: best[url]=out
        else:
            if job in upgrade: run['upgraded']+=1
            best[url]=out
        n+=1; run['pages_done']=n
        print(n,out['llm_status'],out.get('model'),url,(out.get('usage') or {}).get('total_tokens'),flush=True)
        if n%5==0: save_run()
    save_run(); print('LLM 結束：',run['stopped_reason'],json.dumps(run['per_provider'],ensure_ascii=False),flush=True)
    return 0
if __name__=='__main__': sys.exit(main())
