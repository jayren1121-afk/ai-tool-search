"""寫中文進度到 GitHub Actions 摘要（GITHUB_STEP_SUMMARY；本機執行時印到螢幕），並更新 PRICE_DATA_DIR/progress.md。"""
import json,os,collections,time
from common import *
def rl(p):
    d={}
    if os.path.exists(p):
        for l in open(p):
            try: r=json.loads(l); d[r['url']]=r
            except Exception: pass
    return d
SC=rl(f'{BASE}/scrape.jsonl')
LL={}
if os.path.exists(f'{BASE}/llm.jsonl'):
    for l in open(f'{BASE}/llm.jsonl'):
        try: r=json.loads(l)
        except Exception: continue
        prim=r.get('llm_status')=='ok' and r.get('model','openai/gpt-oss-120b')=='openai/gpt-oss-120b' and r.get('provider','groq')=='groq'
        k=(2 if prim else 1 if r.get('llm_status')=='ok' else 0)
        if r['url'] not in LL or k>=LL[r['url']][0]: LL[r['url']]=(k,r)
urls=set()
for t in tools():
    if t.get('pricing_url'): urls.add(t['pricing_url'])
scraped_any=[u for u in urls if u in SC]
need_llm=[u for u in urls if u in SC and SC[u]['status']=='scraped']
prim=[u for u in need_llm if u in LL and LL[u][0]==2]
fb=[u for u in need_llm if u in LL and LL[u][0]==1]
left=[u for u in need_llm if u not in LL or LL[u][0]==0]
run={}
if os.path.exists(f'{BASE}/llm_run.json'):
    try: run=json.load(open(f'{BASE}/llm_run.json'))
    except Exception: pass
res=[]
if os.path.exists(f'{BASE}/results.json'):
    try: res=json.load(open(f'{BASE}/results.json'))
    except Exception: pass
st=collections.Counter(r.get('status') for r in res)
auto=sum(1 for r in res if (r.get('diff_flag') or {}).get('auto_approvable') and r.get('llm_provider','groq')=='groq')
today=time.strftime('%Y-%m-%d %H:%M')
used=[f"{k}（{v.get('model')}）成功 {v.get('ok',0)} 頁"+(f"，已停用：{v['down'][:120]}" if v.get('down') else '') for k,v in (run.get('per_provider') or {}).items() if v.get('calls') or v.get('down')]
L=[f"## 價格資料更新進度（{today} 台灣時間）",
"",
f"- 價格頁抓取：已抓 **{len(scraped_any)} / {len(urls)}** 個網址（剩 {len(urls)-len(scraped_any)} 個）",
f"- AI 整理（需要整理的 {len(need_llm)} 頁）：**已完成 {len(prim)+len(fb)} 頁，剩 {len(left)} 頁**",
f"  - 其中用主要模型 Groq gpt-oss-120b：{len(prim)} 頁；用備援模型（需人工看、Groq 有額度時會自動重做）：{len(fb)} 頁",
f"- 今天這次處理了 {run.get('pages_done',0)} 頁（其中 {run.get('upgraded',0)} 頁是把備援結果改用 120b 重做），失敗 {run.get('errors',0)} 頁（下次會再試）",
f"- 今天用了哪幾家：{'；'.join(used) if used else '沒有呼叫任何 AI（可能已全部完成或沒有設定金鑰）'}",
f"- 備援順序（有設定金鑰的）：{' → '.join(run.get('providers_order') or []) or '無'}",
f"- 沒設定金鑰所以跳過：{', '.join(run.get('skipped_no_key') or []) or '無'}",
f"- 停止原因：{run.get('stopped_reason') or '—'}",
f"- 目前結果：可直接匯入的價格 {st.get('ok',0)} 個工具；其中可批次核准 {auto} 個；其餘需人工看",
"",
"結果檔案在 **price-data** 分支：report.md、price_snapshots_import.sql、price_snapshots_approve_safe.sql、price_snapshots_review_list.md。",
"（這些檔案不會自動上線，也不會改動網站或資料庫。）"]
txt='\n'.join(L)+'\n'
open(f'{BASE}/progress.md','w').write(txt)
p=os.environ.get('GITHUB_STEP_SUMMARY')
if p: open(p,'a').write(txt)
print(txt)
