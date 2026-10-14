# 全部工具價格擷取報告（第二階段，只寫 staging）

- 產生時間：2026-10-14 12:50（UTC+8）；資料集 500 個工具，其中 382 個有 pricing_url（378 個不同網址，共用同頁者只抓一次）。
- 抓取：Playwright + 系統 Chrome 無頭；UA `jAytalPriceBot/1.0 (+https://www.jaytaimark.com)`；3 個 worker（不同網域並行）、同網域序列且間隔 ≥3.2 秒；每個網址只載入 1 次、逾時 30 秒、載入後等待價格出現（最多再輪詢約 12 秒）。
- robots：讀取失敗/403/逾時 → robots_unknown 跳過；禁止 → robots_disallowed；驗證頁/captcha/登入牆 → blocked，不重試。
- LLM（v2，新提示詞 v2b＋新後處理）：Groq `openai/gpt-oss-120b`，送入『價格區段』（含價格的段落＋上下文，≤約 4500 字元）。方案以 name_quote（方案名）＋price_quote（含價格與計費文字）各自逐字驗證且須彼此靠近；月付/年付折算/年付總額/原價(list_price)/不明週期(price_unclear) 分欄；程式後處理檢查標籤式名稱、名稱缺失、月年矛盾、價格 0 或 >2000/月、非訂閱金額、月/年切換不明等並旗標。
- 尚未用 v2 重跑的頁面沿用 v1 結果，但一律帶 `old_prompt` 旗標、不進批次核准清單；非 120b 模型的結果會帶 `llm_fallback_model`（本輪沒有）。

## 1. 各 status 數量（以工具計）
| status | 數量 | 說明 |
|---|---|---|
| ok | 260 | LLM 結構化後有已驗證的價格 |
| no_pricing_url | 118 | 資料集沒有 pricing_url，略過 |
| no_price_found | 89 | 頁面渲染後找不到價格（或 LLM 的價格未通過驗證） |
| blocked | 19 | 403/驗證頁/登入牆，跳過 |
| robots_unknown | 8 | robots.txt 讀不到（403/逾時等），保守跳過 |
| robots_disallowed | 5 | robots.txt 禁止 |
| error | 1 | 載入失敗（逾時、網路/HTTP2 錯誤等） |

- **成功拿到價格（ok）：260 / 382 個有 pricing_url 的工具 = 68.1%**（佔全部 500 個工具 52.0%）。
- 排除『合規跳過』（robots/blocked）後：260/350 = 74.3%。

## 1b. 本次執行的 LLM 提供者
- groq（openai/gpt-oss-120b）：本次呼叫 75 次、成功 75 頁、token 192,929；停用原因：groq 每日額度用盡（429）：{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01m4cpekmnez7s57xjy0dnkkqv` service tier `on_demand` on tokens per 
- openrouter（openrouter:nvidia/nemotron-3-super-120b-a12b:free）：本次呼叫 1 次、成功 1 頁、token 7,611
- gemini（gemini:gemini-3.8-flash）：本次呼叫 0 次、成功 0 頁、token 0
- 未設定金鑰而略過：cerebras, mistral
- 停止原因：剩下的只有「備援模型結果待 120b 重做」，但今天 Groq 已不可用
- 累計使用備援模型（非 Groq 120b，帶 llm_fallback_model、不進自動核准）的頁面：64（{'openrouter:nvidia/nemotron-3-super-120b-a12b:free': 64}）；Groq 有額度時會自動用 120b 重做。

## 2. 效能與 Groq 用量
- 抓取：平均每個網址 9.9 秒（中位數 7.6）；首筆 2026-10-12T13:24:50+08:00 → 末筆 2026-10-14T12:12:52+08:00。
- Groq v2：成功處理 296 / 296 個頁面（120b），token 834,210；另有被丟棄的第一版 v2a 試跑 0 頁（0 token，引文格式不合）、20b 僅供驗證提示詞的 0 頁（0 token，不進 results.json）；v1 全量（舊提示詞）共 0 token。
- 限流：每分鐘 8K token 以送出前節流避開；**120b 每日 token 額度（200,000，漏桶式連續回補，約 2.3 token/秒 ≈ 每小時 8.3K）是瓶頸**——v1 全量與本輪驗證已耗盡，之後每小時只能再處理約 4 個頁面（每頁約 2,100 token）。TPD 型 429 皆依 retry-after 等待或停止，沒有降級成 20b 當正式資料。
- 驗證統計（僅 v2 處理的 plan）：{'plans_total': 900, 'price_near_quote': 139, 'issue_period_ambiguous_toggle': 269, 'issue_name_far_from_price': 20, 'issue_name_missing': 70, 'plan_dropped_quote': 95, 'price_other_section': 29, 'free_dropped_quote': 22, 'issue_yearly_gt_monthly': 8, 'price_dropped_unverified': 40, 'issue_price_unclear': 23, 'issue_non_subscription_hint': 10, 'issue_zero_price': 5, 'issue_name_not_in_quote': 1, 'issue_yearly_total_mismatch': 1, 'issue_abnormal_price': 1, 'issue_label_name': 1}

## 3. 被跳過 / 失敗的工具與原因
| id | status | 原因 |
|---|---|---|
| chatgpt | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| poe | robots_disallowed | robots.txt 對 * 禁止 / |
| scispace | blocked | robots 允許；價格未出現，額外輪詢 12s；HTTP 403 或驗證頁，不重試 |
| leonardo | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| ideogram | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| adobe-firefly | blocked | robots 允許；HTTP 403 或驗證頁，不重試 |
| sora | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| openai-codex | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| tabnine | robots_unknown | robots.txt HTTP 502 |
| quillbot | robots_unknown | robots.txt HTTP 403 |
| looka | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| gamma | robots_unknown | robots.txt HTTP 403 |
| make | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| chatgpt-agent | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| powerbi-copilot | blocked | robots.txt 404（無規則，視為允許）；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| tableau-ai | robots_unknown | robots.txt HTTP 403 |
| nightcafe | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| ernie | robots_disallowed | robots 允許；重新導向到 wenxin.baidu.com：robots.txt 對 * 禁止 /，丟棄內容 |
| ada | robots_unknown | robots.txt HTTP 403 |
| framer-ai | robots_unknown | robots.txt 讀取失敗 URLError |
| scite | blocked | robots 允許；價格未出現，額外輪詢 12s；HTTP 403 或驗證頁，不重試 |
| dreamstudio | robots_disallowed | robots 允許；重新導向到 auth.stability.ai：robots.txt 對 * 禁止 /，丟棄內容 |
| danelfin | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| seowriting | robots_disallowed | robots.txt 對 * 禁止 / |
| genspark | blocked | robots 允許；重新導向到 login.genspark.ai；疑似登入牆 |
| salesforce-agentforce | blocked | robots 允許；HTTP 403 或驗證頁，不重試 |
| manychat | blocked | robots 允許；networkidle 未達；HTTP 403 或驗證頁，不重試 |
| operator-skyvern | blocked | robots 允許；HTTP 200 或驗證頁，不重試 |
| curipod | error | robots 允許；TimeoutError: Page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "https://curipod.com/pricing", waiting until "load" |
| pipedrive-ai | blocked | robots 允許；價格未出現，額外輪詢 12s；HTTP 403 或驗證頁，不重試 |
| dante-ai | robots_disallowed | robots.txt 對 * 禁止 / |
| tengr | robots_unknown | robots.txt HTTP 307 |
| copyleaks | robots_unknown | robots.txt HTTP 403 |

- 無 pricing_url 略過（118）：meta-ai, qwen, kimi, huggingchat, phind, notebooklm, felo, playground, civitai, hailuo, capcut, whisper, adobe-podcast, udio, mem, chatpdf, tome, manus, pi, bing-image-creator, tldv, hubspot-breeze, harvey, abridge, papago, intercom-fin, khroma, semantic-scholar, casetext, nuance-dax, eightfold, reverso, zendesk-ai, gemini-code-assist, beatoven, autogen, nabla, rogo, tensor-art, microsoft-designer, gemini-cli, luma-genie, duolingo-max, luminance, loudly, langflow, donotpay, tickeron, sierra, continue, kaedim, vidnoz, clickup-brain, photomath, lavender, slidesgo, unbabel, decagon, asana-ai, stocknews-finchat, lexica, monday-ai, brainly, 11x, legora, k-health, elevenlabs-dubbing, snowflake-cortex, aider, coda-ai, brave-leo, studyfetch, woebot, splash, novelai, miro-ai, timekettle, wix-ai, blockade-labs, wondershare-filmora, brisk, suki, move-ai, haiper, facefusion, reflect, mureka, multion, viz-ai, librechat, kore-ai, agentgpt, speak, open-webui, interior-ai, pixverse, metaso, praktika, hemingway, chorus, jan, roomgpt, storm, elsa, typeface, dreamina, microsoft-copilot-studio, turnitin, moonvalley, adcreative, chatsonic, starryai, replika, langsmith, quizgecko, janitor-ai, deep-dream-generator, nomi

## 4. no_price_found（渲染後沒有價格 / 驗證不過）
deepseek, character-ai, you-com, dall-e, stable-diffusion, flux, pika, kling, murf, canva, relevance-ai, google-translate, rask, hostinger-ai, hirevue, bloomberg-gpt, doubao, crewai, gong, hebbia, spellbook, paradox, zhipu-chatglm, flowise, connected-papers, textio, akkio, yuanbao, kapwing, outreach, marketmuse, obviously-ai, cohere, clipchamp, hypotenuse, lexis-ai, datarobot, groq, galileo-stitch, cline, voicemod, exa, writer, ironclad, ada-health, databricks, together-ai, landr, bardeen, mindmeister, openrouter, browser-use, lex, artisan, looker-gemini, voiceflow, vtube-studio, auphonic, profound, leena-ai, clipdrop, tunee, andi, seamless-ai, interprefy, gptexcel, crisp, brandmark, seo-ai-yoast, vic-ai, qodo, datarails, deepmotion, moises, gorgias, rokoko, mode, assemblyai, merlin, deepgram, predis, sider, penpot, hume, pencil, blackbox, clockwise, gradescope, retell

## 4b. 處理進度（因 120b 每日額度）
- 已用 v2 新規則處理：260 個工具的 ok 結果（頁面 296/296）；**尚未重跑、沿用 v1 結果（帶 old_prompt、不可批次核准）：0 個工具**。
- 續跑：GitHub Actions「價格資料每日更新」每天台灣時間 20:27 自動執行並接續進度（也可在 Actions 頁面手動 Run workflow）。
- 時間估計：每頁約 2,100 token，額度約 200K/天 → 每天約 95 頁；剩 0 頁約需 0.0 天（升級 Groq Dev Tier 後約 1–2 小時）。批次：第 1 天約 95 頁（資料集前段：chatbot、search、image、video、audio、music、coding 前段…）、第 2 天約 95 頁、第 3 天其餘。

## 5. 需人工覆核（224 筆；可批次核准的無旗標 33 筆）
旗標：price_change＝與資料集舊價差>50%；name_diff＝方案名稱與舊資料多數不同；shared_page＝多個工具共用同一價格頁；has_promo＝含促銷價；non_usd＝非美元；price_near_quote＝價格不在引用句內而在附近；dropped_fields＝有欄位因證據驗證失敗被丟棄。

| id | 旗標 | 細節 | 來源 |
|---|---|---|---|
| claude | has_promo, name_diff, period_ambiguous_toggle, price_near_quote, shared_page | 資料集方案 ['Pro', 'Max', 'Plus', 'Premium', 'Scale'] vs 新 ['Free', 'Pro', 'Max', 'Enterprise']; 與 ['claude-code'] 共用同一價格頁，結果複製自同一次擷取; Max: period_ambiguous_toggle | https://claude.com/pricing |
| gemini | name_far_from_price, price_change, shared_page | Pro: 資料集 $199.99/月 → 官網 $19.99; 與 ['veo'] 共用同一價格頁，結果複製自同一次擷取; YouTube Premium Lite: name_far_from_price | https://gemini.google/subscriptions/ |
| copilot-microsoft | llm_fallback_model, name_diff, name_missing | 資料集方案 ['Microsoft 365 Personal/Family 含 Copilot'] vs 新 ['', '', '']; None: name_missing; None: name_missing; None: name_missing; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.microsoft.com/microsoft-365/copilot |
| grok | name_diff, name_missing | 資料集方案 ['SuperGrok'] vs 新 ['', 'Heavy']; None: name_missing | https://grok.com/plans |
| mistral-le-chat | has_promo |  | https://mistral.ai/pricing |
| perplexity | has_promo, llm_fallback_model, name_diff | 資料集方案 ['Pro', 'Max'] vs 新 ['Advanced answers and top AI models', 'Unlimited usage and top performance']; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.perplexity.ai/pro |
| consensus | period_ambiguous_toggle, price_near_quote | Pro: period_ambiguous_toggle; Deep: period_ambiguous_toggle | https://consensus.app/pricing |
| elicit | dropped_fields, has_promo |  | https://elicit.com/pricing |
| midjourney | has_promo, llm_fallback_model, period_ambiguous_toggle | Basic: period_ambiguous_toggle; Standard: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Mega: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://docs.midjourney.com/hc/en-us/articles/27870484040333 |
| krea | price_change | Max: 資料集 $21.0/月 → 官網 $63.0 | https://www.krea.ai/pricing |
| runway | has_promo, yearly_gt_monthly | Standard: yearly_gt_monthly; Pro: yearly_gt_monthly; Max: yearly_gt_monthly | https://runwayml.com/pricing |
| veo | name_far_from_price, price_change, shared_page | Pro: 資料集 $199.99/月 → 官網 $19.99; 與 ['gemini'] 共用同一價格頁，結果複製自同一次擷取; YouTube Premium Lite: name_far_from_price | https://gemini.google/subscriptions/ |
| luma | period_ambiguous_toggle | Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Ultra: period_ambiguous_toggle | https://lumalabs.ai/dream-machine/pricing |
| synthesia | has_promo, yearly_gt_monthly | Starter: yearly_gt_monthly | https://www.synthesia.io/pricing |
| heygen | has_promo, name_diff, period_ambiguous_toggle | 資料集方案 ['Creator', 'Advanced', 'Business', 'Plus', 'Pro'] vs 新 ['Free', 'Creator', 'Pro']; Creator: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://www.heygen.com/pricing |
| descript | name_far_from_price | Creator: name_far_from_price | https://www.descript.com/pricing |
| opus-clip | dropped_fields, has_promo |  | https://www.opus.pro/pricing |
| elevenlabs | has_promo, price_near_quote |  | https://elevenlabs.io/pricing |
| otter | dropped_fields, has_promo |  | https://otter.ai/pricing |
| fireflies | has_promo, price_near_quote |  | https://fireflies.ai/pricing |
| suno | has_promo |  | https://suno.com/pricing |
| aiva | has_promo, non_usd |  | https://www.aiva.ai/pricing |
| soundraw | name_missing, period_ambiguous_toggle | None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle | https://soundraw.io/pricing |
| github-copilot | price_change | Pro: 資料集 $10.0/月 → 官網 $39.0 | https://github.com/features/copilot/plans |
| cursor | dropped_fields, name_diff | 資料集方案 ['Pro'] vs 新 ['Free', 'Plus', 'Premium', 'Super', 'Teams', 'Enterprise'] | https://cursor.com/pricing |
| windsurf | dropped_fields, llm_fallback_model, price_change | Team: 資料集 $40.0/月 → 官網 $80.0; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://windsurf.com/pricing |
| claude-code | has_promo, name_diff, period_ambiguous_toggle, price_near_quote, shared_page | 資料集方案 ['Scale', 'Pro', 'Max', 'Plus', 'Premium'] vs 新 ['Free', 'Pro', 'Max', 'Enterprise']; 與 ['claude'] 共用同一價格頁，結果複製自同一次擷取; Max: period_ambiguous_toggle | https://claude.com/pricing |
| replit | has_promo |  | https://replit.com/pricing |
| lovable | has_promo |  | https://lovable.dev/pricing |
| bolt | dropped_fields, name_diff | 資料集方案 ['Unlimited', 'Teams'] vs 新 ['Free', 'Pro'] | https://bolt.new/pricing |
| v0 | has_promo, llm_fallback_model, name_diff | 資料集方案 ['Team'] vs 新 ['Free', 'Plus', 'Business']; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://v0.app/pricing |
| devin | price_change | Team: 資料集 $40.0/月 → 官網 $80.0 | https://devin.ai/pricing |
| codeium-jetbrains-ai | dropped_fields |  | https://www.jetbrains.com/ai-ides/buy/ |
| grammarly | llm_fallback_model, price_unclear | Pro: price_unclear; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.grammarly.com/plans |
| jasper | name_diff, price_near_quote | 資料集方案 ['Team'] vs 新 ['Pro'] | https://www.jasper.ai/pricing |
| writesonic | dropped_fields, has_promo, llm_fallback_model, non_subscription_hint | STARTER: non_subscription_hint; BASIC: non_subscription_hint; GROWTH: non_subscription_hint; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://writesonic.com/pricing |
| surfer | name_far_from_price | Discovery: name_far_from_price; Create or Optimize 10 Documents: name_far_from_price | https://surferseo.com/pricing |
| sudowrite | name_diff, name_missing | 資料集方案 ['Free', 'Hobby', 'Professional', 'Max'] vs 新 ['', '', '']; None: name_missing; None: name_missing; None: name_missing | https://www.sudowrite.com/pricing |
| notion-ai | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Plus: period_ambiguous_toggle; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.notion.com/pricing |
| microsoft-365-copilot | llm_fallback_model, name_diff, period_ambiguous_toggle | 資料集方案 ['Business add-on'] vs 新 ['Microsoft 365 Copilot', 'Microsoft 365 Copilot']; Microsoft 365 Copilot: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.microsoft.com/microsoft-365/copilot/enterprise |
| gemini-workspace | dropped_fields, has_promo, llm_fallback_model | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://workspace.google.com/pricing |
| motion | name_missing, period_ambiguous_toggle | Pro AI: period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle | https://www.usemotion.com/pricing |
| reclaim | period_ambiguous_toggle | Starter: period_ambiguous_toggle; Business: period_ambiguous_toggle; Enterprise: period_ambiguous_toggle | https://reclaim.ai/pricing |
| figma-ai | dropped_fields, llm_fallback_model, name_far_from_price, price_change | Professional: 資料集 $16.0/月 → 官網 $55.0; Professional: name_far_from_price; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.figma.com/pricing/ |
| photoroom | has_promo, price_near_quote |  | https://www.photoroom.com/pricing |
| uizard | dropped_fields, has_promo |  | https://uizard.io/pricing/ |
| magnific | has_promo, price_near_quote |  | https://magnific.ai/pricing |
| beautiful-ai | dropped_fields, name_missing, price_unclear | None: name_missing, price_unclear | https://www.beautiful.ai/pricing |
| napkin | period_ambiguous_toggle | PLUS: period_ambiguous_toggle; PRO: period_ambiguous_toggle | https://www.napkin.ai/pricing |
| zapier-ai | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Professional: period_ambiguous_toggle; Team: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://zapier.com/pricing |
| langchain | period_ambiguous_toggle, zero_price | Plus: period_ambiguous_toggle | https://www.langchain.com/pricing |
| deepl | dropped_fields, llm_fallback_model | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.deepl.com/pro |
| immersive-translate | has_promo, name_far_from_price, name_not_in_quote, price_near_quote | Team: name_not_in_quote; Pro: name_far_from_price | https://immersivetranslate.com/pricing |
| julius | period_ambiguous_toggle | Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Max: period_ambiguous_toggle; Business: period_ambiguous_toggle | https://julius.ai/pricing |
| hex | dropped_fields |  | https://hex.tech/pricing |
| rows | dropped_fields, name_diff, period_ambiguous_toggle | 資料集方案 ['Scale'] vs 新 ['Free', 'Plus', 'Pro']; Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://rows.com/pricing |
| chatbase | name_diff, name_missing, period_ambiguous_toggle | 資料集方案 ['Free', 'Basic', 'Advanced', 'Hobby', 'Standard'] vs 新 ['', '', '']; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguo | https://www.chatbase.co/pricing |
| vizcom | name_far_from_price, name_missing, period_ambiguous_toggle, zero_price | Professional: period_ambiguous_toggle | https://www.vizcom.ai/pricing |
| spline | has_promo, period_ambiguous_toggle | Hobby: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Max: period_ambiguous_toggle | https://spline.design/pricing |
| invideo | has_promo, price_near_quote |  | https://invideo.io/pricing |
| speechify | period_ambiguous_toggle | PREMIUM: period_ambiguous_toggle | https://speechify.com/pricing |
| mubert | has_promo |  | https://mubert.com/pricing |
| liner | has_promo, period_ambiguous_toggle, price_near_quote | Team: period_ambiguous_toggle | https://liner.com/pricing |
| paperpal | period_ambiguous_toggle, price_change, price_near_quote | Pro: 資料集 $59.0/月 → 官網 $29.0; Prime: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://paperpal.com/pricing |
| originality | has_promo, name_diff, non_subscription_hint, period_ambiguous_toggle | 資料集方案 ['Pro', 'Team', 'Basic'] vs 新 ['Pro', 'Enterprise']; Pro: non_subscription_hint, period_ambiguous_toggle; Enterprise: non_subscription_hint, period_ambiguous_toggle | https://originality.ai/pricing |
| semrush | has_promo, name_diff, name_missing, price_near_quote | 資料集方案 ['Pro'] vs 新 ['', '', '', '']; None: name_missing; None: name_missing; None: name_missing; None: name_missing | https://www.semrush.com/pricing |
| typeform-ai | period_ambiguous_toggle | Talent: period_ambiguous_toggle | https://www.typeform.com/pricing |
| amazon-q | dropped_fields |  | https://aws.amazon.com/q/developer/pricing |
| meshy | has_promo |  | https://www.meshy.ai/pricing |
| pictory | has_promo |  | https://pictory.ai/pricing |
| d-id | has_promo, period_ambiguous_toggle, price_near_quote | Lite: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Advanced: period_ambiguous_toggle | https://www.d-id.com/pricing |
| fathom | name_far_from_price, period_ambiguous_toggle | Team: period_ambiguous_toggle; Business: period_ambiguous_toggle; Premium: period_ambiguous_toggle | https://fathom.video/pricing |
| boomy | has_promo, price_near_quote |  | https://boomy.com/pricing |
| jenni | period_ambiguous_toggle | Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://jenni.ai/pricing |
| undetectable | has_promo, name_missing, period_ambiguous_toggle, price_near_quote | None: name_missing; None: name_missing; None: name_missing; None: name_missing, period_ambiguous_toggle | https://undetectable.ai/pricing |
| ahrefs | name_diff | 資料集方案 ['Teams', 'Basic', 'Growth', 'Scale', 'Unlimited'] vs 新 ['Lite', 'Standard', 'Advanced', 'Enterprise', 'Brand Radar AI'] | https://ahrefs.com/pricing |
| slidesai | period_ambiguous_toggle, price_near_quote | Pro: period_ambiguous_toggle; Premium: period_ambiguous_toggle | https://www.slidesai.io/pricing |
| tableau-gpt | name_diff, name_missing | 資料集方案 ['Unlimited'] vs 新 ['']; None: name_missing | https://www.thoughtspot.com/pricing |
| openart | has_promo, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Wonder: period_ambiguous_toggle | https://openart.ai/pricing |
| designs-ai | has_promo |  | https://designs.ai/pricing |
| tripo | dropped_fields, period_ambiguous_toggle, price_change, price_near_quote, yearly_total_mismatch | Pro: 資料集 $0.16/月 → 官網 $20.0; Max: 資料集 $0.09/月 → 官網 $90.0; Team: yearly_total_mismatch, period_ambiguous_toggle | https://www.tripo3d.ai/pricing |
| fliki | has_promo, price_near_quote |  | https://fliki.ai/pricing |
| colossyan | dropped_fields |  | https://www.colossyan.com/pricing |
| resemble | dropped_fields, zero_price |  | https://www.resemble.ai/pricing |
| read-ai | has_promo, name_missing | None: name_missing; None: name_missing; None: name_missing | https://www.read.ai/pricing |
| research-rabbit | period_ambiguous_toggle | ResearchRabbit+: period_ambiguous_toggle | https://www.researchrabbit.ai/pricing |
| khanmigo | has_promo, name_diff, name_missing | 資料集方案 ['Free'] vs 新 ['', '']; None: name_missing; None: name_missing | https://www.khanmigo.ai/pricing |
| wordtune | has_promo |  | https://www.wordtune.com/pricing |
| clay | dropped_fields, period_ambiguous_toggle, price_near_quote | Launch: period_ambiguous_toggle; Growth: period_ambiguous_toggle | https://www.clay.com/pricing |
| frase | has_promo, name_far_from_price, period_ambiguous_toggle | Enterprise: name_far_from_price; BASIC: period_ambiguous_toggle; PRO: period_ambiguous_toggle | https://www.frase.io/pricing |
| decktopus | dropped_fields, has_promo, price_near_quote, price_unclear | Pro: price_unclear | https://www.decktopus.com/pricing |
| smartcat | abnormal_price | Anticipate: abnormal_price | https://www.smartcat.com/pricing |
| polymer | has_promo, period_ambiguous_toggle, price_near_quote | Starter: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Teams: period_ambiguous_toggle | https://www.polymersearch.com/pricing |
| veed | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Creator: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Studio: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.veed.io/pricing |
| elai | period_ambiguous_toggle | Creator: period_ambiguous_toggle; Team: period_ambiguous_toggle | https://elai.io/pricing |
| wellsaid | has_promo |  | https://wellsaidlabs.com/pricing |
| avoma | name_diff | 資料集方案 ['Teams'] vs 新 ['Startup', 'Organization', 'Enterprise'] | https://www.avoma.com/pricing |
| rytr | period_ambiguous_toggle | Unlimited: period_ambiguous_toggle; Premium: period_ambiguous_toggle | https://rytr.me/pricing |
| clearscope | name_diff | 資料集方案 ['Advanced'] vs 新 ['ESSENTIALS', 'BUSINESS'] | https://www.clearscope.io/pricing |
| freed | period_ambiguous_toggle | Starter: period_ambiguous_toggle; Core: period_ambiguous_toggle; Premier: period_ambiguous_toggle | https://www.getfreed.ai/pricing |
| presentations-ai | dropped_fields, price_change | Pro: 資料集 $50.0/月 → 官網 $20.0 | https://www.presentations.ai/pricing |
| lokalise-ai | name_diff, name_missing | 資料集方案 ['Teams'] vs 新 ['Explorer', '', '']; None: name_missing; None: name_missing | https://lokalise.com/pricing |
| tidio | period_ambiguous_toggle | Starter: period_ambiguous_toggle; Growth: period_ambiguous_toggle; Plus: period_ambiguous_toggle | https://www.tidio.com/pricing |
| seaart | price_unclear | SVIP: price_unclear | https://www.seaart.ai/pricing |
| tavus | dropped_fields, name_diff | 資料集方案 ['Plus', 'Max', 'Teams', 'Basic', 'Growth'] vs 新 ['Starter', 'Builder', 'Growth', 'Business'] | https://www.tavus.io/pricing |
| taskade | period_ambiguous_toggle | Pro: period_ambiguous_toggle; Business: period_ambiguous_toggle; Max: period_ambiguous_toggle; Enterprise: period_ambiguous_toggle | https://www.taskade.com/pricing |
| anyword | dropped_fields, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Data-Driven: period_ambiguous_toggle; Business: period_ambiguous_toggle | https://www.anyword.com/pricing |
| teal | name_missing, price_unclear | None: name_missing, price_unclear; None: name_missing, price_unclear; None: name_missing, price_unclear | https://www.tealhq.com/pricing |
| crowdin | name_far_from_price, price_near_quote |  | https://crowdin.com/pricing |
| relume | dropped_fields, price_change, price_near_quote | Pro: 資料集 $40.0/月 → 官網 $14.0 | https://www.relume.io/pricing |
| listnr | name_diff, period_ambiguous_toggle, price_near_quote | 資料集方案 ['Teams'] vs 新 ['Free', 'Individual', 'Solo', 'Agency']; Individual: period_ambiguous_toggle; Solo: period_ambiguous_toggle; Agency: period_ambiguous_toggle | https://www.listnr.ai/pricing |
| musicfy | dropped_fields, has_promo, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Professional: period_ambiguous_toggle; Studio: period_ambiguous_toggle | https://musicfy.lol/pricing |
| neuronwriter | name_diff, name_missing, period_ambiguous_toggle | 資料集方案 ['Business', 'Team'] vs 新 ['Bronze', '', '', '', '']; Bronze: period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missin | https://neuronwriter.com/pricing |
| glass-health | period_ambiguous_toggle | Starter: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Max: period_ambiguous_toggle | https://glass.health/pricing |
| kickresume | period_ambiguous_toggle, price_near_quote, price_unclear | Quarterly: price_unclear; Monthly: period_ambiguous_toggle | https://www.kickresume.com/pricing |
| getimg | dropped_fields, has_promo, period_ambiguous_toggle, price_near_quote | Entry: period_ambiguous_toggle; Core: period_ambiguous_toggle; Plus: period_ambiguous_toggle; Ultra: period_ambiguous_toggle | https://getimg.ai/pricing |
| deepbrain | period_ambiguous_toggle | Personal: period_ambiguous_toggle; Team: period_ambiguous_toggle | https://www.deepbrain.io/pricing |
| riffusion | has_promo, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Plus: period_ambiguous_toggle; Member: period_ambiguous_toggle | https://www.riffusion.com/pricing |
| lindy | dropped_fields, price_change | Team: 資料集 $29.99/月 → 官網 $49.99 | https://www.lindy.ai/pricing |
| regie | has_promo, period_ambiguous_toggle, yearly_gt_monthly | Pro: yearly_gt_monthly, period_ambiguous_toggle; Team: yearly_gt_monthly, period_ambiguous_toggle | https://www.regie.ai/pricing |
| koala | period_ambiguous_toggle | Starter: period_ambiguous_toggle; Professional: period_ambiguous_toggle; Boost: period_ambiguous_toggle; Growth: period_ambiguous_toggle; Elite: period_ambiguous_toggle; Advanced: period_ambiguous_tog | https://koala.sh/pricing |
| rezi | price_unclear | Lifetime Plan: price_unclear | https://www.rezi.ai/pricing |
| chronicle | period_ambiguous_toggle | Pro: period_ambiguous_toggle; Plus: period_ambiguous_toggle; Max: period_ambiguous_toggle | https://chroniclehq.com/pricing |
| lara | dropped_fields |  | https://laratranslate.com/pricing |
| roo-code | name_diff | 資料集方案 ['Free'] vs 新 ['11–50 users', '51–100 users'] | https://roocode.com/pricing |
| polycam | price_near_quote |  | https://poly.cam/pricing |
| vidyo | price_near_quote |  | https://quso.ai/pricing |
| argil | dropped_fields, name_missing, period_ambiguous_toggle | None: name_missing, period_ambiguous_toggle | https://www.argil.ai/pricing |
| krisp | period_ambiguous_toggle | Core: period_ambiguous_toggle; Advanced: period_ambiguous_toggle | https://krisp.ai/pricing |
| tavily | name_missing | None: name_missing | https://www.tavily.com/pricing |
| hyperwrite | has_promo |  | https://www.hyperwriteai.com/pricing |
| brex-ai | name_diff, name_missing, zero_price | 資料集方案 ['Advanced'] vs 新 ['', '']; None: name_missing | https://www.brex.com/pricing |
| durable | period_ambiguous_toggle | Launch: period_ambiguous_toggle; Grow: period_ambiguous_toggle | https://durable.com/pricing |
| masterpiece-x | has_promo, name_diff, name_missing, price_near_quote, price_unclear | 資料集方案 ['Free'] vs 新 ['', '', '', '']; None: name_missing; None: name_missing; None: name_missing; None: name_missing, price_unclear | https://www.masterpiecex.com/pricing |
| submagic | has_promo |  | https://www.submagic.co/pricing |
| cleanvoice | llm_fallback_model, period_ambiguous_toggle | 10 Hours: period_ambiguous_toggle; 30 Hours: period_ambiguous_toggle; 100 Hours: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://cleanvoice.ai/pricing |
| soundful | dropped_fields, llm_fallback_model, name_missing | None: name_missing; None: name_missing; None: name_missing; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://soundful.com/pricing |
| alli-ai | llm_fallback_model, period_ambiguous_toggle | Business: period_ambiguous_toggle; Agency: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.alliai.com/pricing |
| genie-ai | llm_fallback_model, name_diff, name_missing | 資料集方案 ['Pro', 'Business', 'Team'] vs 新 ['Pro', '']; None: name_missing; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.genieai.co/pricing |
| juicebox | llm_fallback_model, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Growth: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://juicebox.ai/pricing |
| ramp | dropped_fields, llm_fallback_model | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://ramp.com/pricing |
| whimsical | period_ambiguous_toggle | PRO: period_ambiguous_toggle; BUSINESS: period_ambiguous_toggle | https://whimsical.com/pricing |
| heygen-translate | has_promo, llm_fallback_model, non_subscription_hint | Lite: non_subscription_hint; Basic: non_subscription_hint; Premium: non_subscription_hint; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://maestra.ai/pricing |
| ollama | period_ambiguous_toggle | Pro: period_ambiguous_toggle; Team: period_ambiguous_toggle | https://ollama.com/pricing |
| recraft | llm_fallback_model, price_unclear | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.recraft.ai/pricing |
| 10web | has_promo, llm_fallback_model, price_near_quote | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://10web.io/pricing |
| zed | llm_fallback_model, price_unclear | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://zed.dev/pricing |
| sloyd | has_promo, llm_fallback_model, period_ambiguous_toggle, zero_price | Sloyd Plus: period_ambiguous_toggle; Sloyd Pro: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.sloyd.ai/pricing |
| captions | dropped_fields, llm_fallback_model, name_diff, period_ambiguous_toggle | 資料集方案 ['Studio'] vs 新 ['Max', 'Frontier']; Max: period_ambiguous_toggle; Frontier: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.captions.ai/pricing |
| evernote-ai | period_ambiguous_toggle, price_near_quote | Starter: period_ambiguous_toggle; Advanced: period_ambiguous_toggle; Flexible: period_ambiguous_toggle | https://evernote.com/pricing |
| kagi | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Professional: period_ambiguous_toggle; Ultimate: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://kagi.com/pricing |
| magicschool | dropped_fields, has_promo, llm_fallback_model, name_far_from_price, price_unclear | PLUS: name_far_from_price; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.magicschool.ai/pricing |
| formula-bot | dropped_fields, has_promo, llm_fallback_model, name_far_from_price, price_near_quote | BUSINESS: name_far_from_price; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.formulabot.com/pricing |
| kiro | dropped_fields, llm_fallback_model, price_change | Pro: 資料集 $20.0/月 → 官網 $40.0; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://kiro.dev/pricing |
| akool | llm_fallback_model, name_far_from_price, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Pro Max: period_ambiguous_toggle; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次 | https://akool.com/pricing |
| podcastle | dropped_fields, llm_fallback_model, period_ambiguous_toggle, price_near_quote | Pro: period_ambiguous_toggle; Teams: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://podcastle.ai/pricing |
| obsidian-copilot | llm_fallback_model, price_unclear | Catalyst: price_unclear; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://obsidian.md/pricing |
| novelcrafter | llm_fallback_model, period_ambiguous_toggle | Scribe: period_ambiguous_toggle; Hobbyist: period_ambiguous_toggle; Artisan: period_ambiguous_toggle; Specialist: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free | https://www.novelcrafter.com/pricing |
| lattice-ai | dropped_fields, llm_fallback_model, name_far_from_price | Grow: name_far_from_price; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://lattice.com/pricing |
| docyt | period_ambiguous_toggle | Accounting Suite: period_ambiguous_toggle; Catch-Up Accounting: period_ambiguous_toggle | https://docyt.com/pricing |
| eraser | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Starter: period_ambiguous_toggle; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.eraser.io/pricing |
| typingmind | has_promo, llm_fallback_model, name_far_from_price, price_unclear | Standard: price_unclear; Extended: price_unclear, name_far_from_price; Premium: price_unclear; Bulk license: price_unclear; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.typingmind.com/pricing |
| picsart-ai | has_promo, period_ambiguous_toggle | Ultra: period_ambiguous_toggle | https://picsart.com/pricing |
| trae | llm_fallback_model, period_ambiguous_toggle | Lite: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Pro+: period_ambiguous_toggle; Ultra: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.trae.ai/pricing |
| riverside | dropped_fields, has_promo, period_ambiguous_toggle | Pro: period_ambiguous_toggle; Grow: period_ambiguous_toggle; Webinar: period_ambiguous_toggle | https://riverside.fm/pricing |
| komo | llm_fallback_model, name_missing, price_unclear | None: name_missing; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://komo.ai/pricing |
| shortlyai | llm_fallback_model, price_change | Premium: 資料集 $36.0/月 → 官網 $10.0; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://prowritingaid.com/pricing |
| instantly | llm_fallback_model, name_diff, period_ambiguous_toggle, price_change | 資料集方案 ['Starter', 'Growth', 'Premium', 'Scale', 'Supersonic'] vs 新 ['Growth', 'Hypergrowth', 'Light Speed']; Growth: 資料集 $47.0/月 → 官網 $97.0; Growth: period_ambiguous_toggle; Hypergrowth: period_ambigu | https://instantly.ai/pricing |
| mapify | dropped_fields, has_promo, llm_fallback_model, period_ambiguous_toggle | Basic: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Unlimited: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://mapify.so/pricing |
| sheetai | llm_fallback_model, name_diff, period_ambiguous_toggle | 資料集方案 ['Free'] vs 新 ['Starter', 'Pro', 'Pro Yearly']; Starter: period_ambiguous_toggle; Pro: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.sheetai.app/pricing |
| fotor | name_missing, period_ambiguous_toggle, price_near_quote | None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing,  | https://www.fotor.com/pricing |
| logoai | llm_fallback_model, price_unclear | 7-Day Trial: price_unclear; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.logoai.com/pricing |
| vidu | has_promo, llm_fallback_model, period_ambiguous_toggle, price_near_quote | Standard: period_ambiguous_toggle; Premium: period_ambiguous_toggle; Ultimate: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.vidu.com/pricing |
| synthesys | llm_fallback_model, period_ambiguous_toggle, price_change | Starter: 資料集 $59.0/月 → 官網 $29.0; Pro: 資料集 $119.0/月 → 官網 $59.0; Starter: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Agency: period_ambiguous_toggle; Max: period_ambiguous_toggle; 使用非 120b 模 | https://synthesys.io/pricing |
| lalal | llm_fallback_model, period_ambiguous_toggle, price_near_quote | Lite: period_ambiguous_toggle; Pro: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.lalal.ai/pricing |
| heptabase | llm_fallback_model, period_ambiguous_toggle, price_change | Premium: 資料集 $17.99/月 → 官網 $53.99; Pro: period_ambiguous_toggle; Premium: period_ambiguous_toggle; Premium+: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批 | https://heptabase.com/pricing |
| iask | llm_fallback_model, name_diff | 資料集方案 ['Unlimited'] vs 新 ['iAsk Free', 'iAsk Pro']; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://iask.ai/pricing |
| languagetool | has_promo, name_far_from_price, name_missing, price_near_quote | None: name_missing; None: name_missing; None: name_missing; For Teams: name_far_from_price | https://languagetool.org/pricing |
| smartlead | llm_fallback_model, name_diff, period_ambiguous_toggle, price_change | 資料集方案 ['Basic', 'Pro', 'Unlimited', 'Premium', 'Free'] vs 新 ['Base', 'Pro', 'Unlimited Smart', 'Unlimited Prime']; Unlimited: 資料集 $174.0/月 → 官網 $315.0; Base: period_ambiguous_toggle; Pro: period_ambig | https://www.smartlead.ai/pricing |
| xmind-ai | period_ambiguous_toggle | Pro: period_ambiguous_toggle; Premium: period_ambiguous_toggle | https://xmind.com/pricing |
| landbot | dropped_fields, has_promo, period_ambiguous_toggle | Professional WA: period_ambiguous_toggle | https://landbot.io/pricing |
| pixlr | period_ambiguous_toggle, price_change | Ultra: 資料集 $24.99/月 → 官網 $49.99; Plus: period_ambiguous_toggle; Premium: period_ambiguous_toggle; Ultra: period_ambiguous_toggle; Ultra MAX: period_ambiguous_toggle | https://pixlr.com/pricing |
| coderabbit | dropped_fields, period_ambiguous_toggle | Essentials: period_ambiguous_toggle; Team: period_ambiguous_toggle; Advanced: period_ambiguous_toggle | https://www.coderabbit.ai/pricing |
| tana | has_promo |  | https://tana.inc/pricing |
| beautiful-tables | period_ambiguous_toggle, price_near_quote | Starter: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://www.visme.co/pricing |
| deepnote | has_promo |  | https://deepnote.com/pricing |
| greptile | name_diff | 資料集方案 ['Unlimited', 'Free'] vs 新 ['Pro', 'Enterprise'] | https://www.greptile.com/pricing |
| genmo | period_ambiguous_toggle | Lite: period_ambiguous_toggle; Standard: period_ambiguous_toggle | https://www.genmo.ai/pricing |
| rev | dropped_fields, period_ambiguous_toggle, price_near_quote | Essentials: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://www.rev.com/pricing |
| craft | dropped_fields, has_promo, price_near_quote |  | https://www.craft.do/pricing |
| uipath | dropped_fields, name_diff | 資料集方案 ['Free'] vs 新 ['Basic'] | https://www.uipath.com/pricing |
| monica | has_promo, period_ambiguous_toggle, price_near_quote | Ultra: period_ambiguous_toggle; Max: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://monica.im/pricing |
| vectorizer | name_missing | None: name_missing | https://vectorizer.ai/pricing |
| scenario | name_diff, period_ambiguous_toggle | 資料集方案 ['Starter', 'Free', 'Teams'] vs 新 ['Starter', 'Pro', 'Max']; Starter: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Max: period_ambiguous_toggle | https://www.scenario.com/pricing |
| ltx-studio | dropped_fields, has_promo, period_ambiguous_toggle, price_near_quote | Lite: period_ambiguous_toggle; Standard: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://ltx.studio/pricing |
| saner | period_ambiguous_toggle | Standard: period_ambiguous_toggle; Starter: period_ambiguous_toggle | https://www.saner.ai/pricing |
| mathgpt | dropped_fields, price_unclear | Basic: price_unclear; Prime: price_unclear | https://www.mathgptpro.com/pricing |
| jotform-ai | dropped_fields |  | https://www.jotform.com/ai/agents/pricing |
| patterned | period_ambiguous_toggle | Standard: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Business: period_ambiguous_toggle | https://www.patterned.ai/pricing |
| warp | dropped_fields, period_ambiguous_toggle, price_change | Business: 資料集 $20.0/月 → 官網 $50.0; Build: period_ambiguous_toggle; Max: period_ambiguous_toggle; Business: period_ambiguous_toggle | https://www.warp.dev/pricing |
| higgsfield | has_promo, price_near_quote |  | https://higgsfield.ai/pricing |
| superhuman | has_promo |  | https://superhuman.com/pricing |
| ai2sql | dropped_fields, has_promo, period_ambiguous_toggle, price_unclear | Pro: period_ambiguous_toggle; Team: period_ambiguous_toggle; Lifetime: price_unclear | https://www.ai2sql.io/pricing |
| imagine-art | dropped_fields, period_ambiguous_toggle | Basic: period_ambiguous_toggle; Ultimate: period_ambiguous_toggle; Creator: period_ambiguous_toggle | https://www.imagine.art/pricing |
| fontjoy | has_promo, name_missing, period_ambiguous_toggle, price_near_quote | Pro: period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle; None: name_missing, period_ambiguous_toggle | https://www.kittl.com/pricing |
| activepieces | dropped_fields, period_ambiguous_toggle | Plus: period_ambiguous_toggle; Team: period_ambiguous_toggle | https://www.activepieces.com/pricing |
| wan | has_promo, llm_fallback_model, price_near_quote, yearly_gt_monthly | Pro: yearly_gt_monthly; Premium: yearly_gt_monthly; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://wan.video/pricing |
| spark-mail | has_promo, name_diff, period_ambiguous_toggle, price_near_quote | 資料集方案 ['Teams'] vs 新 ['Plus', 'Pro']; Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://sparkmailapp.com/pricing |
| pipedream | dropped_fields, name_diff, period_ambiguous_toggle | 資料集方案 ['Team', 'Plus'] vs 新 ['Free', 'Startup']; Startup: period_ambiguous_toggle | https://pipedream.com/pricing |
| artbreeder | name_missing | None: name_missing; None: name_missing; None: name_missing | https://www.artbreeder.com/pricing |
| leonardo-motion | has_promo |  | https://www.clipfly.ai/pricing |
| vapi | name_diff | 資料集方案 ['Teams'] vs 新 ['Core', 'Pro'] | https://vapi.ai/pricing |
| browse-ai | price_change, price_near_quote | Personal: 資料集 $48.0/月 → 官網 $19.0 | https://www.browse.ai/pricing |
| codeium | dropped_fields, llm_fallback_model, price_change | Team: 資料集 $40.0/月 → 官網 $80.0; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://codeium.com/pricing |
| vmake | period_ambiguous_toggle | Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle | https://vmake.ai/pricing |
| bland | name_diff | 資料集方案 ['Plus'] vs 新 ['Build'] | https://www.bland.ai/pricing |
| sunsama | dropped_fields, name_diff, name_missing | 資料集方案 ['Free', 'Unlimited'] vs 新 ['', '']; None: name_missing; None: name_missing | https://www.sunsama.com/pricing |
| dust | has_promo, period_ambiguous_toggle, price_near_quote | Pro: period_ambiguous_toggle; Max: period_ambiguous_toggle | https://dust.tt/pricing |
| buffer-ai | period_ambiguous_toggle, price_near_quote | Essentials: period_ambiguous_toggle; Team: period_ambiguous_toggle | https://buffer.com/pricing |
| firecrawl | dropped_fields, name_far_from_price |  | https://www.firecrawl.dev/pricing |
| comfyui | has_promo, name_far_from_price, period_ambiguous_toggle, price_near_quote | Standard: period_ambiguous_toggle, name_far_from_price; Creator: period_ambiguous_toggle, name_far_from_price; Pro: period_ambiguous_toggle; Team: period_ambiguous_toggle | https://www.comfy.org/pricing |
| akiflow | dropped_fields |  | https://akiflow.com/pricing |
| mem0 | dropped_fields, label_name, name_diff | 資料集方案 ['Scale', 'Pro', 'Starter', 'Hobby'] vs 新 ['Starter', 'Popular']; Popular: label_name | https://mem0.ai/pricing |
| coursebox | dropped_fields, period_ambiguous_toggle, price_near_quote | Creator: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Pro + LMS: period_ambiguous_toggle | https://www.coursebox.ai/pricing |

旗標統計：{'has_promo': 78, 'name_diff': 43, 'period_ambiguous_toggle': 106, 'price_near_quote': 52, 'shared_page': 4, 'name_far_from_price': 18, 'price_change': 22, 'llm_fallback_model': 55, 'name_missing': 29, 'dropped_fields': 64, 'yearly_gt_monthly': 4, 'non_usd': 1, 'price_unclear': 17, 'non_subscription_hint': 3, 'zero_price': 5, 'name_not_in_quote': 1, 'yearly_total_mismatch': 1, 'abnormal_price': 1, 'label_name': 1}
