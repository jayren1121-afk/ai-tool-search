import json,re,collections,os,statistics
from datetime import datetime
from common import *
res=json.load(open(f'{BASE}/results.json'))
def rl(p):
    d={}
    if not os.path.exists(p): return d
    for l in open(p):
        try: r=json.loads(l); d[r['url']]=r
        except: pass
    return d
SC=rl(f'{BASE}/scrape.jsonl'); LL=rl(f'{BASE}/llm.jsonl'); LLv1=rl(f'{BASE}/llm_v1.jsonl'); LLd=rl(f'{BASE}/llm_v2a_discarded.jsonl'); LLe=rl(f'{BASE}/llm_eval20b.jsonl')
cnt=collections.Counter(r['status'] for r in res)
att=[r for r in res if r['status']!='no_pricing_url']
ok=[r for r in res if r['status']=='ok']
tok=sum(l.get('usage',{}).get('total_tokens',0) for l in LL.values()); ptok=sum(l.get('usage',{}).get('prompt_tokens',0) for l in LL.values())
calls=sum(l.get('attempts',1) for l in LL.values() if l['llm_status']=='ok')
rl429=0
for f in ('llm.log','llm.log.1'):
    if os.path.exists(f'{BASE}/{f}'):
        for m in re.finditer(r"'rl429': (\d+)",open(f'{BASE}/{f}').read()): pass
logs=open(f'{BASE}/llm.log').read()
rl_runs=[int(x) for x in re.findall(r"'rl429': (\d+)",logs)]
secs=[s['secs'] for s in SC.values() if s.get('secs')]
ts=sorted(s['fetched_at'] for s in SC.values() if s.get('fetched_at'))
vs=collections.Counter()
for r in res:
    if not str(r.get('prompt_version','')).startswith('v2'): continue
    for k,v in (r.get('verify_stats') or {}).items(): vs[k]+=v
uniq_urls=len({r['source_url'] for r in att})
L=[f"# 全部工具價格擷取報告（第二階段，只寫 staging）\n",
f"- 產生時間：{datetime.now().astimezone().strftime('%Y-%m-%d %H:%M')}（UTC+8）；資料集 {len(res)} 個工具，其中 {len(att)} 個有 pricing_url（{uniq_urls} 個不同網址，共用同頁者只抓一次）。",
"- 抓取：Playwright + 系統 Chrome 無頭；UA `jAytalPriceBot/1.0 (+https://www.jaytaimark.com)`；3 個 worker（不同網域並行）、同網域序列且間隔 ≥3.2 秒；每個網址只載入 1 次、逾時 30 秒、載入後等待價格出現（最多再輪詢約 12 秒）。",
"- robots：讀取失敗/403/逾時 → robots_unknown 跳過；禁止 → robots_disallowed；驗證頁/captcha/登入牆 → blocked，不重試。",
"- LLM（v2，新提示詞 v2b＋新後處理）：Groq `openai/gpt-oss-120b`，送入『價格區段』（含價格的段落＋上下文，≤約 4500 字元）。方案以 name_quote（方案名）＋price_quote（含價格與計費文字）各自逐字驗證且須彼此靠近；月付/年付折算/年付總額/原價(list_price)/不明週期(price_unclear) 分欄；程式後處理檢查標籤式名稱、名稱缺失、月年矛盾、價格 0 或 >2000/月、非訂閱金額、月/年切換不明等並旗標。",
"- 尚未用 v2 重跑的頁面沿用 v1 結果，但一律帶 `old_prompt` 旗標、不進批次核准清單；非 120b 模型的結果會帶 `llm_fallback_model`（本輪沒有）。\n",
"## 1. 各 status 數量（以工具計）\n| status | 數量 | 說明 |\n|---|---|---|"]
desc={'ok':'LLM 結構化後有已驗證的價格','no_price_found':'頁面渲染後找不到價格（或 LLM 的價格未通過驗證）','blocked':'403/驗證頁/登入牆，跳過','robots_disallowed':'robots.txt 禁止','robots_unknown':'robots.txt 讀不到（403/逾時等），保守跳過','error':'載入失敗（逾時、網路/HTTP2 錯誤等）','no_pricing_url':'資料集沒有 pricing_url，略過','llm_error':'LLM 呼叫失敗','pending_llm':'已抓取、LLM 尚未處理','pending_scrape':'尚未抓取'}
for k,v in cnt.most_common(): L.append(f"| {k} | {v} | {desc.get(k,'')} |")
L.append(f"\n- **成功拿到價格（ok）：{len(ok)} / {len(att)} 個有 pricing_url 的工具 = {len(ok)/max(1,len(att))*100:.1f}%**（佔全部 {len(res)} 個工具 {len(ok)/len(res)*100:.1f}%）。")
reach=[r for r in att if r['status'] not in('robots_disallowed','robots_unknown','blocked')]
L.append(f"- 排除『合規跳過』（robots/blocked）後：{len(ok)}/{len(reach)} = {len(ok)/max(1,len(reach))*100:.1f}%。")
run={}
if os.path.exists(f'{BASE}/llm_run.json'):
    try: run=json.load(open(f'{BASE}/llm_run.json'))
    except Exception: run={}
fb=collections.Counter(l.get('model') for l in LL.values() if l.get('llm_status')=='ok' and (l.get('provider','groq')!='groq' or l.get('model')!='openai/gpt-oss-120b'))
L.append("\n## 1b. 本次執行的 LLM 提供者\n"+(''.join(f"- {k}（{v.get('model')}）：本次呼叫 {v.get('calls',0)} 次、成功 {v.get('ok',0)} 頁、token {v.get('tokens',0):,}"+(f"；停用原因：{v['down']}" if v.get('down') else '')+"\n" for k,v in (run.get('per_provider') or {}).items()) or '- （本次沒有 LLM 執行紀錄）\n')
  +(f"- 未設定金鑰而略過：{', '.join(run.get('skipped_no_key') or [])}\n" if run.get('skipped_no_key') else '')
  +f"- 停止原因：{run.get('stopped_reason') or '—'}\n"
  +f"- 累計使用備援模型（非 Groq 120b，帶 llm_fallback_model、不進自動核准）的頁面：{sum(fb.values())}（{dict(fb)}）；Groq 有額度時會自動用 120b 重做。")
L.append("\n## 2. 效能與 Groq 用量\n"+f"- 抓取：平均每個網址 {(statistics.mean(secs) if secs else 0):.1f} 秒（中位數 {(statistics.median(secs) if secs else 0):.1f}）；首筆 {ts[0] if ts else ''} → 末筆 {ts[-1] if ts else ''}。")
def tk(d): return sum(l.get('usage',{}).get('total_tokens',0) for l in d.values())
v2done=len([1 for l in LL.values() if l['llm_status']=='ok'])
scr=len([1 for x in SC.values() if x['status']=='scraped'])
L.append(f"- Groq v2：成功處理 {v2done} / {scr} 個頁面（120b），token {tk(LL):,}；另有被丟棄的第一版 v2a 試跑 {len(LLd)} 頁（{tk(LLd):,} token，引文格式不合）、20b 僅供驗證提示詞的 {len(LLe)} 頁（{tk(LLe):,} token，不進 results.json）；v1 全量（舊提示詞）共 {tk(LLv1):,} token。")
L.append("- 限流：每分鐘 8K token 以送出前節流避開；**120b 每日 token 額度（200,000，漏桶式連續回補，約 2.3 token/秒 ≈ 每小時 8.3K）是瓶頸**——v1 全量與本輪驗證已耗盡，之後每小時只能再處理約 4 個頁面（每頁約 2,100 token）。TPD 型 429 皆依 retry-after 等待或停止，沒有降級成 20b 當正式資料。")
L.append(f"- 驗證統計（僅 v2 處理的 plan）：{dict(vs)}")
L.append("\n## 3. 被跳過 / 失敗的工具與原因\n| id | status | 原因 |\n|---|---|---|")
for r in res:
    if r['status'] in('robots_disallowed','robots_unknown','blocked','error','llm_error'):
        L.append(f"| {r['id']} | {r['status']} | {(r.get('note') or '')[:140].replace('|','/')} |")
nop=[r['id'] for r in res if r['status']=='no_pricing_url']
L.append(f"\n- 無 pricing_url 略過（{len(nop)}）：{', '.join(nop)}")
L.append("\n## 4. no_price_found（渲染後沒有價格 / 驗證不過）\n"+', '.join(r['id'] for r in res if r['status']=='no_price_found'))
v2ok=[r for r in ok if str(r.get('prompt_version','')).startswith('v2')]; legacy=[r for r in ok if r not in v2ok]
L.append(f"\n## 4b. 處理進度（因 120b 每日額度）\n- 已用 v2 新規則處理：{len(v2ok)} 個工具的 ok 結果（頁面 {v2done}/{scr}）；**尚未重跑、沿用 v1 結果（帶 old_prompt、不可批次核准）：{len(legacy)} 個工具**。\n- 續跑：GitHub Actions「價格資料每日更新」每天台灣時間 20:27 自動執行並接續進度（也可在 Actions 頁面手動 Run workflow）。\n- 時間估計：每頁約 2,100 token，額度約 200K/天 → 每天約 95 頁；剩 {scr-v2done} 頁約需 {(scr-v2done)/95:.1f} 天（升級 Groq Dev Tier 後約 1–2 小時）。批次：第 1 天約 95 頁（資料集前段：chatbot、search、image、video、audio、music、coding 前段…）、第 2 天約 95 頁、第 3 天其餘。")
rv=[r for r in ok if r['diff_flag']['needs_review']]
auto=[r for r in ok if r['diff_flag']['auto_approvable']]
L.append(f"\n## 5. 需人工覆核（{len(rv)} 筆；可批次核准的無旗標 {len(auto)} 筆）\n旗標：price_change＝與資料集舊價差>50%；name_diff＝方案名稱與舊資料多數不同；shared_page＝多個工具共用同一價格頁；has_promo＝含促銷價；non_usd＝非美元；price_near_quote＝價格不在引用句內而在附近；dropped_fields＝有欄位因證據驗證失敗被丟棄。\n")
L.append("| id | 旗標 | 細節 | 來源 |\n|---|---|---|---|")
for r in rv: L.append(f"| {r['id']} | {', '.join(r['diff_flag']['flags'])} | {'; '.join(r['diff_flag']['details'])[:200].replace('|','/')} | {r['source_url']} |")
fc=collections.Counter(f for r in ok for f in r['diff_flag']['flags'])
L.append(f"\n旗標統計：{dict(fc)}")
if os.path.exists(f'{BASE}/review_samples_v2.md'):
    L.append("\n## 6. 準確度抽查（v2 vs v1）\n"+'\n'.join(open(f'{BASE}/review_samples_v2.md').read().split('\n\n')[1:2])+"\n詳見 review_samples_v2.md（v1：review_samples_v1.md）。")
open(f'{BASE}/report.md','w').write("\n".join(L)+"\n")
print("\n".join(L[:30]))
