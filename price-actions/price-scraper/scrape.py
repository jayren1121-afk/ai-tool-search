import json,re,time,sys,os,threading,queue,urllib.request,urllib.robotparser,urllib.error
from urllib.parse import urlparse
from datetime import datetime
from collections import OrderedDict
from playwright.sync_api import sync_playwright
from common import *
# GitHub Actions 版：瀏覽器路徑可設定（未設定＝用 playwright install 安裝的 chromium）；SCRAPE_DEADLINE（epoch 秒）到了就停止，下次接續
CHROME=os.environ.get('CHROME_PATH') or None
DEADLINE=float(os.environ.get('SCRAPE_DEADLINE') or 0)
WORKERS=int(os.environ.get('SCRAPE_WORKERS') or 3)
OUT=f'{BASE}/scrape.jsonl'
BLOCK=re.compile(r'just a moment|verify (?:you are|that you are) human|checking your browser|captcha|attention required|access denied|are you a robot|unusual traffic|enable javascript and cookies|request blocked|cf-chl',re.I)
LOGIN=re.compile(r'\b(log ?in|sign ?in)\b',re.I)
done={}
if os.path.exists(OUT):
    for l in open(OUT):
        try: r=json.loads(l); done[r['url']]=r
        except: pass
tl=tools()
urls=OrderedDict()
for t in tl:
    if t.get('pricing_url'): urls.setdefault(t['pricing_url'],[]).append(t['id'])
groups=OrderedDict()
for u in urls: groups.setdefault(urlparse(u).netloc,[]).append(u)
lock=threading.Lock(); robots_cache={}
def robots(origin,url):
    host=urlparse(origin).netloc
    with lock:
        ent=robots_cache.get(host)
    if ent is None:
        try:
            req=urllib.request.Request(origin+"/robots.txt",headers={"User-Agent":UA})
            txt=urllib.request.urlopen(req,timeout=15).read().decode('utf-8','replace')
            rp=urllib.robotparser.RobotFileParser(); rp.parse(txt.splitlines()); ent=('ok',rp,'')
        except urllib.error.HTTPError as e:
            if e.code in (404,410): ent=('none',None,'robots.txt 404（無規則，視為允許）')
            else: ent=('unknown',None,f'robots.txt HTTP {e.code}')
        except Exception as e: ent=('unknown',None,f'robots.txt 讀取失敗 {type(e).__name__}')
        with lock: robots_cache[host]=ent
    kind,rp,why=ent
    if kind=='unknown': return 'robots_unknown',why
    if kind=='none': return 'ok',why
    if not rp.can_fetch("*",origin+"/"): return 'robots_disallowed','robots.txt 對 * 禁止 /'
    if not rp.can_fetch("*",url) or not rp.can_fetch("jAytalPriceBot",url): return 'robots_disallowed','robots.txt 禁止價格頁路徑'
    return 'ok','robots 允許'
def save(r):
    with lock:
        open(OUT,'a').write(json.dumps(r,ensure_ascii=False)+'\n'); done[r['url']]=r
def do(url,ctx,tid):
    t0=time.time(); r=dict(url=url,tool_ids=urls[url],status=None,fetched_at=None,note='',text_len=0)
    try:
        u=urlparse(url); origin=f"{u.scheme}://{u.netloc}"
        st,why=robots(origin,url); r['note']=why
        if st!='ok': r['status']=st; return r
        pg=ctx.new_page(); jsons=[]
        r['fetched_at']=datetime.now().astimezone().isoformat(timespec='seconds')
        try:
            resp=pg.goto(url,timeout=30000,wait_until='load')
            r['http_status']=resp.status if resp else None
            try: pg.wait_for_load_state('networkidle',timeout=8000)
            except Exception: r['note']+='；networkidle 未達'
            time.sleep(4)
            txt=pg.evaluate("document.body?document.body.innerText:''") or ''
            polls=0
            while not AMT.search(txt) and polls<6 and len(txt)>300:
                time.sleep(2); polls+=1
                txt=pg.evaluate("document.body?document.body.innerText:''") or ''
            if polls: r['note']+=f'；價格未出現，額外輪詢 {polls*2}s'
            r['final_url']=pg.url
        finally:
            pg.close()
        fu=urlparse(r['final_url'])
        if fu.netloc!=u.netloc:
            st2,why2=robots(f"{fu.scheme}://{fu.netloc}",r['final_url'])
            if st2!='ok': r['status']=st2; r['note']+=f'；重新導向到 {fu.netloc}：{why2}，丟棄內容'; return r
            r['note']+=f'；重新導向到 {fu.netloc}'
        r['text_len']=len(txt)
        open(f'{BASE}/text/{uhash(url)}.txt','w').write(txt)
        sec=price_section(txt); r['section_len']=len(sec)
        open(f'{BASE}/text/{uhash(url)}.sec.txt','w').write(sec)
        hs=r.get('http_status')
        if hs in (401,403,429,503) or BLOCK.search(txt[:800]) or (len(txt)<800 and BLOCK.search(txt)):
            r['status']='blocked'; r['note']+=f'；HTTP {hs} 或驗證頁，不重試'
        elif len(txt)<1500 and LOGIN.search(txt) and not AMT.search(txt):
            r['status']='blocked'; r['note']+='；疑似登入牆'
        elif not AMT.search(txt):
            r['status']='no_price_found'
        else: r['status']='scraped'
    except Exception as e:
        r['status']='error'; r['note']+=f'；{type(e).__name__}: {str(e)[:150]}'
    finally:
        r['secs']=round(time.time()-t0,1)
    return r
todo_n=sum(1 for u in urls if u not in done)
print('待抓取網址：',todo_n,'（已完成',len(done),'）',flush=True)
if todo_n==0:
    print('SCRAPE DONE（沒有新網址）',flush=True); sys.exit(0)
gq=queue.Queue()
for h,us in groups.items(): gq.put((h,us))
cnt=[0]
def worker(k):
    with sync_playwright() as p:
        br=p.chromium.launch(**({"executable_path":CHROME} if CHROME else {}),headless=True,args=["--no-sandbox"])
        ctx=br.new_context(user_agent=UA,viewport={'width':1366,'height':900},locale='en-US')
        while True:
            try: h,us=gq.get_nowait()
            except queue.Empty: break
            last=0
            for u in us:
                if u in done: continue
                if DEADLINE and time.time()>DEADLINE: print('到達時間上限，停止抓取（下次接續）',flush=True); break
                w=3.2-(time.time()-last)
                if w>0: time.sleep(w)
                r=do(u,ctx,k); last=time.time()
                save(r); cnt[0]+=1
                print(k,cnt[0],r['status'],u,r.get('secs'),flush=True)
        br.close()
ts=[threading.Thread(target=worker,args=(i,)) for i in range(WORKERS)]
for t in ts: t.start(); time.sleep(1)
for t in ts: t.join()
left=sum(1 for u in urls if u not in done)
print('SCRAPE DONE' if not left else f'SCRAPE PAUSED，剩 {left} 個網址',flush=True)
