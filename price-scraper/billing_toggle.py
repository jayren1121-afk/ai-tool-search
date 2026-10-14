"""計費模式切換（月繳/年繳）擷取。scrape.py 在每個價格頁使用：
1. 先記錄預設畫面的文字。
2. 找出「看起來像計費切換」的元素（button、role=tab/switch/radio、checkbox/radio 開關、label、短文字可點元素），
   文字必須像 Monthly/Yearly/Annual/Billed yearly/月繳/年繳/按月/按年…；
   一律不點：會跳頁的連結(<a href>)、註冊/購買/結帳/試用/聯絡業務等按鈕、表單送出按鈕。
3. 逐一點擊（期間攔截所有整頁跳轉與彈出視窗），文字有變就再記錄一份，加上段落標記：
   === 計費模式: 月繳 (monthly) ===
4. 有時間上限（預設 20 秒、最多 8 次點擊）；最後嘗試點回預設狀態。找不到切換元素 → 只回傳預設文字（跟以前一樣）。"""
import re,time
SCRAPE_VERSION='v3-billing-toggle'
MONTH=re.compile(r'\bmonth(ly)?\b|\bper month\b|\bbilled monthly\b|\bpay monthly\b|月繳|按月|月付|每月|月額|月払い|monatlich|mensuel',re.I)
YEAR=re.compile(r'\b(year(ly)?|annual(ly)?|billed (yearly|annually))\b|\bper year\b|年繳|按年|年付|每年|年額|年払い|jährlich|annuel',re.I)
DANGER=re.compile(r'sign ?up|log ?in|sign ?in|register|get started|start (free|now|trial|your)|try (it )?(free|now)|trial|buy|pay\b|purchase|checkout|check out|subscribe|upgrade|order|pay now|add to cart|contact|talk to|book a demo|request|download|install|join|continue|註冊|登入|購買|結帳|訂閱|試用|立即|聯絡|下載',re.I)
JS_FIND=r"""(args)=>{
 const [monthSrc,yearSrc,dangerSrc]=args; const M=new RegExp(monthSrc,'i'),Y=new RegExp(yearSrc,'i'),D=new RegExp(dangerSrc,'i');
 const out=[]; const seen=new Set(); 
 const vis=e=>{const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
 const txt=e=>((e.getAttribute('aria-label')||'')+' '+(e.innerText||e.textContent||'')).replace(/\s+/g,' ').trim();
 const navLink=e=>{const a=e.closest('a[href]'); if(!a) return false; const h=(a.getAttribute('href')||'').trim(); return !(h===''||h.startsWith('#')||h.toLowerCase().startsWith('javascript:'));};
 const sel='button,[role=tab],[role=switch],[role=radio],[role=button],[role=option],input[type=checkbox],input[type=radio],label,[aria-pressed],[aria-checked],[aria-selected],li,span,div';
 for(const e of document.querySelectorAll(sel)){
  if(seen.has(e)||!vis(e)) continue;
  let t=txt(e); let kind=e.getAttribute('role')||e.tagName.toLowerCase();
  if(e.tagName==='INPUT'){ const l=(e.id&&document.querySelector('label[for="'+CSS.escape(e.id)+'"]'))||e.closest('label'); let lt=l?txt(l):''; 
     if(!lt){ const p=e.parentElement&&e.parentElement.parentElement; lt=p?txt(p):''; } t=lt; kind='input-'+e.type; }
  if(kind==='switch'||kind==='input-checkbox'){ if(!t||t.length>80){ const p=e.parentElement&&e.parentElement.parentElement; t=p?txt(p):t; } }
  if(!t||t.length>(kind==='switch'||kind==='input-checkbox'?80:40)) continue;
  const m=M.test(t), y=Y.test(t); if(!m&&!y) continue;
  if(D.test(t)) continue; if(navLink(e)) continue;
  if(e.tagName==='BUTTON' && e.closest('form') && (e.getAttribute('type')||'submit')==='submit') continue;
  if(e.matches('button[type=submit],input[type=submit]')) continue;
  if(['li','span','div'].includes(kind)){ const s=getComputedStyle(e); if(s.cursor!=='pointer' && !e.onclick && !e.hasAttribute('tabindex')) continue;
     if(e.querySelector('button,[role=tab],[role=switch],input,a[href]')) continue; }
  if(e.tagName==='LABEL' && e.querySelector('a[href]')) continue;
  const on=e.getAttribute('aria-selected')==='true'||e.getAttribute('aria-checked')==='true'||e.getAttribute('aria-pressed')==='true'||e.checked===true||/\b(active|selected|is-active|current)\b/i.test(e.className||'');
  out.push({el:e,text:t.slice(0,80),kind,month:m,year:y,on}); seen.add(e);
  if(out.length>=60) break;
 }
 // 只取最內層：包含其他候選的父元素略過（例如整個 tablist）
 const fin=out.filter(c=>!out.some(o=>o!==c&&c.el.contains(o.el))).slice(0,12);
 fin.forEach((c,i)=>{c.el.setAttribute('data-pt-idx',String(i)); c.idx=i; delete c.el;});
 return fin;}"""
def label(c):
    if c['kind'] in ('switch','input-checkbox') and c['month'] and c['year']: return ('切換後','toggled')
    if c['year'] and not c['month']: return ('年繳','yearly')
    if c['month'] and not c['year']: return ('月繳','monthly')
    t=c['text'].lower()   # 兩個都有，例如 "Yearly (save 20% vs monthly)"：看哪個在前面
    mi=MONTH.search(t).start(); yi=YEAR.search(t).start()
    return ('月繳','monthly') if mi<yi else ('年繳','yearly')
def marker(zh,en,extra=''): return f'=== 計費模式: {zh} ({en}){extra} ==='
def body_text(pg): return pg.evaluate("document.body?document.body.innerText:''") or ''
def capture_billing_states(pg,default_text,time_limit=20.0,max_clicks=8,settle=1.2,log=None):
    """回傳 (合併文字, info)。沒有切換元素時合併文字＝default_text（完全不變）。"""
    info=dict(toggles=[],states=[],clicks=0,note='')
    t0=time.time()
    try: cands=pg.evaluate(JS_FIND,[MONTH.pattern,YEAR.pattern,DANGER.pattern])
    except Exception as e: info['note']=f'找切換元素失敗 {type(e).__name__}'; return default_text,info
    if not cands: return default_text,info
    info['toggles']=[f"{c['kind']}:{c['text'][:40]}" for c in cands]
    start_url=pg.url.split('#')[0]
    blocked=[0]
    def guard(route):
        rq=route.request
        if rq.is_navigation_request() and rq.frame==pg.main_frame: blocked[0]+=1; return route.fulfill(status=204,body='')   # 204＝瀏覽器留在原頁
        return route.continue_()
    def popup(p):
        try: p.close()
        except Exception: pass
    pg.route('**/*',guard); pg.on('popup',popup)
    try: pg.evaluate("()=>{window.open=()=>null; if(window.navigation) navigation.addEventListener('navigate',e=>{if(!e.hashChange&&e.cancelable) e.preventDefault();});}")
    except Exception: pass
    dflt=[c for c in cands if c['on'] and c['kind'] not in ('switch','input-checkbox')]
    dl=label(dflt[0]) if dflt else None
    sections=[(marker('預設畫面','default',f'＝{dl[0]} ({dl[1]})' if dl else ''),default_text)]
    seen={default_text.strip()}; count={}
    try:
        for c in cands:
            if info['clicks']>=max_clicks or time.time()-t0>time_limit: info['note']+='；到達切換時間/次數上限'; break
            if c['on'] and c['kind'] not in ('switch','input-checkbox'): continue   # 已是目前狀態
            loc=pg.locator(f'[data-pt-idx="{c["idx"]}"]')
            try:
                loc.first.click(timeout=3000,no_wait_after=True); info['clicks']+=1
            except Exception as e:
                if log: log(f'點擊失敗 {c["text"][:30]}: {type(e).__name__}')
                continue
            time.sleep(settle)
            if pg.url.split('#')[0]!=start_url: info['note']+='；點擊後網址改變，停止切換'; break
            try: txt=body_text(pg)
            except Exception: info['note']+='；點擊後頁面重新載入，停止切換'; break
            if txt.strip() in seen: continue
            seen.add(txt.strip()); zh,en=label(c); k=(zh,en); count[k]=count.get(k,0)+1
            sections.append((marker(zh,en,f' #{count[k]}' if count[k]>1 else ''),txt)); info['states'].append(en)
            if c['kind'] in ('switch','input-checkbox'):   # 開關：再點一次恢復
                try: loc.first.click(timeout=3000,no_wait_after=True); info['clicks']+=1; time.sleep(0.5)
                except Exception: pass
        if dflt and info['states']:   # 點回預設狀態
            try: pg.locator(f'[data-pt-idx="{dflt[0]["idx"]}"]').first.click(timeout=3000,no_wait_after=True)
            except Exception: pass
    finally:
        try: pg.unroute('**/*',guard)
        except Exception: pass
    if blocked[0]: info['note']+=f'；攔截了 {blocked[0]} 次跳頁'
    info['secs']=round(time.time()-t0,1)
    if len(sections)==1: return default_text,info
    return '\n\n'.join(f'{m}\n{t}' for m,t in sections),info
