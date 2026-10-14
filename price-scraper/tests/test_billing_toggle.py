"""離線測試月繳/年繳切換擷取（本機假價格頁，含 JS 切換、開關、會跳頁的連結/按鈕）。
用法：python3 tests/test_billing_toggle.py   （需要 playwright + chromium）"""
import os,sys,threading,functools,json,re
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
HERE=os.path.dirname(os.path.abspath(__file__)); CODE=os.path.dirname(HERE); sys.path.insert(0,CODE)
os.environ.setdefault('PRICE_DATA_DIR',os.path.join('/tmp','billing_toggle_test_data'))
from billing_toggle import capture_billing_states,body_text

import common
fails=[]
def check(c,msg): print(('PASS ' if c else 'FAIL ')+msg); (None if c else fails.append(msg))
class Q(SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=os.path.join(HERE,'fixtures')))
threading.Thread(target=srv.serve_forever,daemon=True).start(); B=f'http://127.0.0.1:{srv.server_address[1]}'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br=p.chromium.launch(headless=True,args=['--no-sandbox']); ctx=br.new_context()
    def run(name):
        pg=ctx.new_page(); pg.goto(f'{B}/{name}'); t0=body_text(pg)
        txt,info=capture_billing_states(pg,t0,settle=0.3); url=pg.url; pg.close(); return t0,txt,info,url
    # 1) 分頁切換（預設年繳）
    t0,txt,info,url=run('billing_toggle.html')
    print('  toggles:',info['toggles'],'states:',info['states'],info['note'])
    check('=== 計費模式: 預設畫面 (default)＝年繳 (yearly) ===' in txt,'預設畫面標記為年繳')
    check('=== 計費模式: 月繳 (monthly) ===' in txt,'有月繳段落')
    m=txt.split('=== 計費模式: 月繳 (monthly) ===')[1]; d=txt.split('=== 計費模式: 月繳 (monthly) ===')[0]
    check('$12 /month' in m and '$10 /month' in d,'月繳段落是 $12、預設(年繳)段落是 $10')
    check(info['states']==['monthly'],f"只點了月繳一個狀態：{info['states']}")
    check(url.endswith('billing_toggle.html'),'沒有跳到其他頁面')
    check(not any(re.search(r'sign up|trial|pay yearly',t,re.I) for t in info['toggles']),f"沒有把註冊/試用/付款按鈕當成切換：{info['toggles']}")
    check('OTHER PAGE' not in txt,'沒有點到會跳頁的連結/按鈕')
    # 2) checkbox 開關（中文月繳/年繳）
    t0,txt,info,url=run('billing_switch.html')
    print('  toggles:',info['toggles'],'states:',info['states'])
    check('NT$390' in txt and 'NT$300' in txt and '=== 計費模式: 切換後 (toggled) ===' in txt,'開關：兩種價格都抓到，切換後有標記')
    # 3) 沒有切換 → 文字完全不變
    t0,txt,info,url=run('no_toggle.html')
    check(txt==t0 and not info['states'],f"沒有切換元素：文字不變（toggles={info['toggles']}）")
    # 3b) 看起來像切換、但其實會跳頁/開新視窗 → 被攔截，頁面不變
    t0,txt,info,url=run('nav_toggle.html')
    check(url.endswith('nav_toggle.html') and 'OTHER PAGE' not in txt and len(ctx.pages)==0,f"跳頁/彈窗被攔截：{info['note']} url={url} pages={len(ctx.pages)} other={'OTHER PAGE' in txt}")
    br.close()
# 3c) scrape.py 整合：舊版抓取的頁面每次最多重抓 RESCRAPE_PER_RUN 個；新紀錄有版本、文字指紋與計費狀態
import tempfile,subprocess,hashlib
D=tempfile.mkdtemp(); os.makedirs(D+'/text')
U1=f'{B}/billing_toggle.html'; U2=f'{B}/no_toggle.html'; U3=f'{B}/billing_switch.html'
json.dump([dict(id='t1',pricing_url=U1),dict(id='t2',pricing_url=U2),dict(id='t3',pricing_url=U3)],open(D+'/tools.json','w'))
h=lambda u:hashlib.sha1(u.encode()).hexdigest()[:12]
for u in (U1,U2):
    open(D+'/scrape.jsonl','a').write(json.dumps(dict(url=u,tool_ids=['x'],status='scraped',fetched_at='2026-10-01T00:00:00+08:00'))+'\n')
    open(f'{D}/text/{h(u)}.sec.txt','w').write('old text'); open(f'{D}/text/{h(u)}.txt','w').write('old text')
env=dict(os.environ,PRICE_DATA_DIR=D,AI_TOOLS_DATASET=D+'/tools.json',RESCRAPE_PER_RUN='1',SCRAPE_WORKERS='1')
out=subprocess.run([sys.executable,'scrape.py'],cwd=CODE,env=env,capture_output=True,text=True,timeout=300).stdout
recs={}
for l in open(D+'/scrape.jsonl'): r=json.loads(l); recs[r['url']]=r
r1=recs[U1]
check(r1.get('scrape_version')=='v3-billing-toggle' and r1.get('billing_states')==['monthly'] and r1.get('sec_hash') and r1.get('prev_sec_hash') and r1['sec_hash']!=r1['prev_sec_hash'],f"舊頁面重抓：有版本/指紋/月繳狀態 {r1.get('note')}")
check(recs[U2].get('scrape_version') is None,'每次最多重抓 1 個：第 2 個舊頁面留到下次')
check(recs[U3].get('scrape_version')=='v3-billing-toggle','新網址照常抓取')
check('計費模式: 月繳 (monthly)' in open(f'{D}/text/{h(U1)}.sec.txt').read(),'sec.txt 含段落標記')
# 4) price_section 保留段落標記
sample='=== 計費模式: 預設畫面 (default)＝年繳 (yearly) ===\nPro\n$10 /month\nbilled annually\n\n=== 計費模式: 月繳 (monthly) ===\nPro\n$12 /month\nbilled monthly'
sec=common.price_section(sample)
check(sec.count('=== 計費模式')==2 and '$12' in sec and '$10' in sec,'price_section 保留兩個段落與價格')
N=common.norm(sample)
check(common.billing_sections(N,'$12 /month')=={'monthly'} and common.billing_sections(N,'$10 /month')=={'yearly'},'引文所在段落判斷正確')
# 4b) final.verify：月繳/年繳各自從自己的段落取值；放錯段落會被標記
os.environ['PRICE_DATA_DIR']=os.environ['PRICE_DATA_DIR']; import final
ok={'plans':[{'name':'Pro','price_monthly':12,'price_yearly_per_month':10,'billing_note':'monthly $12; yearly $10 billed annually','currency':'USD','is_promo':False,'name_quote':'Pro','price_quote':'Pro\n$12 /month\nbilled monthly'}],'free_tier':None}
ex,st=final.verify(ok,sample); pl=ex['plans'][0]
check(pl['price_monthly']==12 and pl['price_yearly_per_month']==10 and 'billing_section_mismatch' not in pl['issues'] and 'period_ambiguous_toggle' not in pl['issues'],f"月繳 12、年繳 10 都保留且沒有錯誤旗標：{pl['issues']} {pl['price_check']}")
bad={'plans':[{'name':'Pro','price_monthly':10,'currency':'USD','is_promo':False,'name_quote':'Pro','price_quote':'$10 /month\nbilled annually'}],'free_tier':None}
ex,st=final.verify(bad,sample)
check('billing_section_mismatch' in ex['plans'][0]['issues'],'把年繳段落的價格當月繳 → 標記 billing_section_mismatch')
# 5) 文字指紋：重抓後文字變了 → 舊 LLM 結果不新鮮
check(common.fresh({},{'sec_hash':'b','prev_sec_hash':'a'}) is False,'重抓後文字改變 → 舊結果要重做')
check(common.fresh({},{'sec_hash':'a','prev_sec_hash':'a'}) is True,'重抓後文字沒變 → 不重做')
check(common.fresh({'sec_hash':'a'},{'sec_hash':'a'}) and not common.fresh({'sec_hash':'a'},{'sec_hash':'b'}),'有指紋時比對指紋')
check(common.fresh({},{}) is True,'舊版抓取（沒指紋）→ 視為新鮮（跟以前一樣）')
print('\n'.join(['','全部通過' if not fails else f'{len(fails)} 項失敗：{fails}']))
sys.exit(1 if fails else 0)
