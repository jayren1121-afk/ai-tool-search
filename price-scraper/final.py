import json,re,os,collections,statistics
from datetime import datetime
from common import *
T=tools(); TM={t['id']:t for t in T}
def load(p):
    d={}
    if os.path.exists(p):
        for l in open(p):
            try: r=json.loads(l); d[r['url']]=r
            except: pass
    return d
def load_llm(p):
    # 同一網址有多筆時取最好的：Groq 120b ok > 其他模型 ok > 其他 > error（避免較新的錯誤行蓋掉成功結果）
    d={}
    def rank(r): return (3 if r.get('llm_status')=='ok' and r.get('model','openai/gpt-oss-120b')=='openai/gpt-oss-120b' and r.get('provider','groq')=='groq' else 2 if r.get('llm_status')=='ok' else 0 if r.get('llm_status')=='error' else 1)
    if os.path.exists(p):
        for l in open(p):
            try: r=json.loads(l)
            except: continue
            if r['url'] not in d or rank(r)>=rank(d[r['url']]): d[r['url']]=r
    return d
SC=load(f'{BASE}/scrape.jsonl'); LL2=load_llm(f'{BASE}/llm.jsonl'); LL1=load(f'{BASE}/llm_v1.jsonl')  # v2（新提示詞）優先；沒處理到的網址沿用 v1 並標 old_prompt
Z=re.compile('[\u200b-\u200f\u2060\ufeff]')
def nrm(s): return re.sub(r'\s+',' ',Z.sub('',(s or '').replace('\xa0',' ').replace('\u2009',' ').replace('\u200a',' '))).strip()
def num(v):
    if isinstance(v,bool) or v is None: return None
    if isinstance(v,(int,float)): return float(v) if v>=0 else None
    if isinstance(v,str):
        m=re.fullmatch(r'\s*[^\d]{0,4}(\d[\d,]*(?:\.\d+)?)\s*',v)
        return float(m.group(1).replace(',','')) if m else None
    return None
def forms(n):
    f={f"{n:g}"}
    if n==int(n): f|={f"{int(n)}",f"{int(n):,}",f"{n:.2f}",f"{n:,.2f}"}
    else: f|={f"{n:.2f}",f"{n:,.2f}"}
    return f
def num_in(s,n):
    for c in forms(n):
        if re.search(r'(?<![\d,.])'+re.escape(c)+r'(?!\d|[.,]\d)',s): return True
    return False
SEG=re.compile(r'\s*(?:\.\.\.|…|---)\s*')
def qcheck(raw,N):
    """quote 驗證：空白正規化後須逐字出現在渲染文字；模型用 ... 或 --- 串接多段時，每一段都必須逐字出現。回傳 (quote,位置) 或 (None,-1)"""
    q=nrm(raw)
    if len(q)<2: return None,-1
    if q in N: return q,N.find(q)
    segs=[nrm(x) for x in SEG.split(q) if nrm(x)]
    if len(segs)>=2 and all(len(x)>=2 and x in N for x in segs) and max(map(len,segs))>=3: return ' … '.join(segs),N.find(segs[0])
    # 退而求其次：模型常漏掉兩行中間的『Select Plan』之類文字。把引文依換行拆成片段，每個片段都要逐字出現、順序一致且彼此相距 400 字內
    parts=[nrm(x) for x in re.split(r'\n',str(raw or '')) if nrm(x)]
    if len(parts)>=2:
        pos=-1;first=-1;ok=True
        for x in parts:
            i=N.find(x,pos+1) if pos>=0 else N.find(x)
            if i<0 or (pos>=0 and i-pos>400): ok=False;break
            pos=i+len(x)-1
            if first<0: first=i
        if ok and max(map(len,parts))>=3: return ' … '.join(parts),first
    return None,-1
LABELS={'recommended','most popular','popular','best value','best seller','new','save','sale','featured','best for you','limited time','free trial','current plan','most flexible'}
FREEISH=re.compile(r'free|community|basic|starter|hobby|personal|open|trial|lite|individual',re.I)
NONSUB=re.compile(r'list price|inference|per\s*(?:1m|million|token|1,?000)|saves?\s*\$|\bapi\b.*\bcredits?|of usage',re.I)
def check_plan(out,q):
    iss=[]
    nm=out['name']
    if nm is None: iss.append('name_missing')
    else:
        if nm.strip().lower() in LABELS or re.fullmatch(r'(?i)(save|get)\s.*|\d+%.*',nm.strip()): iss.append('label_name')
        if nm.lower() not in q.lower(): iss.append('name_not_in_quote')
    m,y,yt,u=out['price_monthly'],out['price_yearly_per_month'],out['price_yearly_total'],out['price_unclear']
    if m is not None and y is not None and y>m*1.001: iss.append('yearly_gt_monthly')
    if y is not None and yt is not None and abs(yt-12*y)/max(yt,1)>0.08: iss.append('yearly_total_mismatch')
    vals=[v for v in (m,y,yt,u) if v is not None]
    if any(v==0 for v in vals) and not (nm and FREEISH.search(nm)): iss.append('zero_price')
    if any(v for v in (m,y,u) if v and v>2000) or (yt and yt>24000): iss.append('abnormal_price')
    if u is not None: iss.append('price_unclear')
    if NONSUB.search(q) or NONSUB.search(out.get('billing_note') or ''): iss.append('non_subscription_hint')
    return iss
def verify(res,txt):
    """回傳 (extracted, stats)。驗證失敗的欄位丟棄；再套用規則檢查，問題記在 plan['issues']。"""
    N=nrm(txt); st=collections.Counter()
    plans=[]
    for p in (res.get('plans') or [])[:10]:
        if not isinstance(p,dict) or not (p.get('name') is None or isinstance(p.get('name'),str)): st['plan_bad']+=1; continue
        st['plans_total']+=1
        if 'price_quote' in p:   # v2b：name_quote + price_quote 各自逐字驗證，且須彼此靠近
            pq,ppos=qcheck(p.get('price_quote'),N)
            if pq is None: st['plan_dropped_quote']+=1; continue
            nq=None; nfar=False
            if p.get('name') and p.get('name_quote'):
                nq,npos=qcheck(p.get('name_quote'),N)
                if nq is None: st['name_quote_unverified']+=1
                else:
                    occ=[m.start() for m in re.finditer(re.escape(nq.split(' … ')[0]),N)]
                    before=[ppos-o for o in occ if 0<=ppos-o<=300]; near_any=[abs(ppos-o) for o in occ]
                    if not before and (not near_any or min(near_any)>150): nfar=True
            q=pq if (nq is None or nq.lower() in pq.lower()) else f"{nq} … {pq}"
            pos=ppos
        else:
            q,pos=qcheck(p.get('evidence_quote'),N); nfar=False
            if q is None: st['plan_dropped_quote']+=1; continue
        near=N[max(0,pos-80):pos+len(q)+200]
        out=dict(name=(p['name'] or None) and p['name'][:80],currency=(p.get('currency') if isinstance(p.get('currency'),str) else None),is_promo=bool(p.get('is_promo')),
                 billing_note=p.get('billing_note') if isinstance(p.get('billing_note'),str) else None,evidence_quote=q,quote_verified=True,price_check={})
        for f in ('price_monthly','price_yearly_per_month','price_yearly_total','price_unclear','list_price','regular_price_monthly'):
            n=num(p.get(f))
            if n is None: out[f]=None; continue
            if num_in(q,n): out[f]=n; out['price_check'][f]='in_quote'
            elif num_in(near,n): out[f]=n; out['price_check'][f]='near_quote'; st['price_near_quote']+=1
            else: out[f]=None; st['price_dropped_unverified']+=1
        u=p.get('list_price_unit'); out['list_price_unit']=u if u in('month','year') else None
        if out.get('list_price') is None and out.get('regular_price_monthly') is not None: out['list_price']=out['regular_price_monthly']; out['list_price_unit']='month'
        out['regular_price_monthly']=out['list_price'] if out['list_price_unit']=='month' else None
        out['issues']=check_plan(out,q)
        if re.search(r'\bmonthly\b.{0,60}\b(yearly|annual(ly)?)\b|\b(yearly|annual(ly)?)\b.{0,60}\bmonthly\b',N[:6000],re.I|re.S) and out['price_monthly'] is not None and out['price_monthly']>0 and not re.search(r'billed monthly|month[- ]to[- ]month|monthly billing|billed \$?[\d.]+/month',near,re.I):
            out['issues'].append('period_ambiguous_toggle')   # 頁面有月/年切換，無法確定顯示的是哪一種
        if 'non_subscription_hint' in out['issues']: out['list_price']=None; out['list_price_unit']=None; out['regular_price_monthly']=None
        if nfar and 'name_not_in_quote' not in out['issues']: out['issues'].append('name_far_from_price')
        if 'price_quote' in p and p.get('name') and not nq and 'name_not_in_quote' not in out['issues']: out['issues'].append('name_not_in_quote')
        for i in out['issues']: st['issue_'+i]+=1
        plans.append(out)
    ft=res.get('free_tier'); free=None
    if isinstance(ft,dict) and ft.get('available') is not None:
        q,_p=qcheck(ft.get('evidence_quote'),N)
        if q is not None: free=dict(available=bool(ft['available']),limits=ft.get('limits') if isinstance(ft.get('limits'),str) else None,evidence_quote=q,quote_verified=True)
        else: st['free_dropped_quote']+=1
    ex=dict(plans=plans,free_tier=free,price_summary=res.get('price_summary') if isinstance(res.get('price_summary'),str) else None,
            display_region_note=res.get('display_region_note') if isinstance(res.get('display_region_note'),str) else None)
    return ex,st
def pnorm(s): return re.sub(r'[^a-z0-9]+','',(s or '').lower())
def diff(tool,ex):
    flags=[];det=[]
    old=[p for p in (tool.get('paid_plans') or []) if isinstance(p,dict) and p.get('name')]
    new=[p for p in ex['plans']]
    def match(a,b): a,b=pnorm(a),pnorm(b); return bool(a and b and (a in b or b in a))
    if old and new:
        missing=[o['name'] for o in old if not any(match(o['name'],(n['name'] or '')) for n in new)]
        if len(missing)/len(old)>0.5: flags.append('name_diff'); det.append(f"資料集方案 {[o['name'] for o in old]} vs 新 {[(n['name'] or '') for n in new]}")
        for o in old:
            op=o.get('price_usd_month')
            if not isinstance(op,(int,float)) or op<=0: continue
            for n in new:
                if match(o['name'],(n['name'] or '')) and n['currency'] in ('USD',None) and not n['is_promo']:
                    cands=[v for v in (n['price_monthly'],n['price_yearly_per_month'],n.get('price_unclear')) if v]
                    if not cands: continue
                    best=min(cands,key=lambda v:abs(v-op))
                    if abs(best-op)/op>0.5: flags.append('price_change'); det.append(f"{o['name']}: 資料集 ${op}/月 → 官網 ${best}"); break
    if any(n['currency'] not in ('USD',None) for n in new): flags.append('non_usd')
    if any(n['is_promo'] for n in new): flags.append('has_promo')
    if any('near_quote' in n['price_check'].values() for n in new): flags.append('price_near_quote')
    return sorted(set(flags)),det
def build():
    results=[]; llm_tokens=0; urlmeta={}
    byurl=collections.defaultdict(list)
    for t in T:
        if t.get('pricing_url'): byurl[t['pricing_url']].append(t['id'])
    for t in T:
        r=dict(id=t['id'],name=t['name'],status=None,source_url=t.get('pricing_url'),fetched_at=None,note='')
        u=t.get('pricing_url')
        if not u: r.update(status='no_pricing_url',note='資料集沒有 pricing_url，略過（不猜網址）'); results.append(r); continue
        s=SC.get(u)
        if not s: r.update(status='pending_scrape',note='尚未抓取'); results.append(r); continue
        r['fetched_at']=s.get('fetched_at'); r['rendered_text_len']=s.get('text_len'); r['note']=s.get('note','')
        others=[i for i in byurl[u] if i!=t['id']]
        if others: r['shared_page_with']=others
        if s['status']=='blocked' and '疑似登入牆' in s.get('note','') and 'login' not in s.get('note','').split('重新導向到')[-1][:20] and not re.search(r'HTTP (401|403|429|503)',s.get('note','')):
            r['status']='no_price_found'; r['note']+='（啟發式『疑似登入牆』：頁面很短、含登入連結、無價格；未確認是登入牆，歸為 no_price_found）'; results.append(r); continue
        if s['status']!='scraped': r['status']=s['status']; results.append(r); continue
        l=LL2.get(u); legacy=False
        if not l or l.get('llm_status')=='error':
            l1=LL1.get(u)
            if l1 and l1.get('llm_status')=='ok': l=l1; legacy=True
        if not l: r.update(status='pending_llm',note=r['note']+'；LLM 尚未處理'); results.append(r); continue
        if l['llm_status']!='ok': r.update(status='llm_error',note=r['note']+f"；LLM：{l.get('error') or l['llm_status']}"); results.append(r); continue
        txt=open(f'{BASE}/text/{uhash(u)}.txt').read()
        ex,st=verify(l['result'],txt)
        r['extracted']=ex; r['verify_stats']=dict(st)
        priced=[p for p in ex['plans'] if any((p[f] or 0)>0 for f in('price_monthly','price_yearly_per_month','price_yearly_total','price_unclear'))]
        r['status']='ok' if priced else 'no_price_found'
        r['evidence']=[dict(evidence_quote=p['evidence_quote'],plan=p['name'],source_url=u,fetched_at=s.get('fetched_at')) for p in priced]
        if ex['free_tier']: r['evidence'].append(dict(evidence_quote=ex['free_tier']['evidence_quote'],plan='free_tier',source_url=u,fetched_at=s.get('fetched_at')))
        flags,det=diff(t,ex) if priced else ([],[])
        if others: flags=sorted(set(flags+['shared_page'])); det.append(f"與 {others} 共用同一價格頁，結果複製自同一次擷取")
        if st.get('plan_dropped_quote') or st.get('price_dropped_unverified'): flags=sorted(set(flags+['dropped_fields'])); 
        r['llm_model']=l.get('model','openai/gpt-oss-120b'); r['llm_provider']=l.get('provider','groq'); r['prompt_version']='v1' if legacy else l.get('prompt_version','v2')
        if legacy: flags=sorted(set(flags+['old_prompt'])); det.append('尚未用新提示詞重跑（沿用舊結果，每日額度不足留待續跑）')
        for pl in ex['plans']:
            if legacy: pl['issues']=[i for i in pl.get('issues',[]) if i not in ('name_not_in_quote','period_ambiguous_toggle','name_far_from_price')]  # v1 沒有 name_quote，這幾項新規則不適用
            for i in pl.get('issues',[]): flags=sorted(set(flags+[i]))
        for pl in priced:
            if pl.get('issues'): det.append(f"{pl['name']}: "+', '.join(pl['issues']))
        if r['llm_model']!='openai/gpt-oss-120b' or r['llm_provider']!='groq': flags=sorted(set(flags+['llm_fallback_model'])); det.append('使用非 120b 模型 '+r['llm_model']+'，不納入批次核准')
        needs=any(f not in ('old_prompt','llm_fallback_model') for f in flags)
        r['diff_flag']=dict(flags=flags,needs_review=needs,details=det,auto_approvable=bool(priced) and not flags)
        r['price_note']=f"價格來源：官網價格頁（{u}），{(s.get('fetched_at') or '')[:10]} 擷取" if priced else ''
        results.append(r)
        llm_tokens+=0
    return results
if __name__=='__main__':
    res=build()
    json.dump(res,open(f'{BASE}/results.json','w'),ensure_ascii=False,indent=1)
    print(collections.Counter(r['status'] for r in res))
