# 全部工具價格擷取報告（第二階段，只寫 staging）

- 產生時間：2026-10-12 14:30（UTC+8）；資料集 500 個工具，其中 382 個有 pricing_url（378 個不同網址，共用同頁者只抓一次）。
- 抓取：Playwright + 系統 Chrome 無頭；UA `jAytalPriceBot/1.0 (+https://www.jaytaimark.com)`；3 個 worker（不同網域並行）、同網域序列且間隔 ≥3.2 秒；每個網址只載入 1 次、逾時 30 秒、載入後等待價格出現（最多再輪詢約 12 秒）。
- robots：讀取失敗/403/逾時 → robots_unknown 跳過；禁止 → robots_disallowed；驗證頁/captcha/登入牆 → blocked，不重試。
- LLM（v2，新提示詞 v2b＋新後處理）：Groq `openai/gpt-oss-120b`，送入『價格區段』（含價格的段落＋上下文，≤約 4500 字元）。方案以 name_quote（方案名）＋price_quote（含價格與計費文字）各自逐字驗證且須彼此靠近；月付/年付折算/年付總額/原價(list_price)/不明週期(price_unclear) 分欄；程式後處理檢查標籤式名稱、名稱缺失、月年矛盾、價格 0 或 >2000/月、非訂閱金額、月/年切換不明等並旗標。
- 尚未用 v2 重跑的頁面沿用 v1 結果，但一律帶 `old_prompt` 旗標、不進批次核准清單；非 120b 模型的結果會帶 `llm_fallback_model`（本輪沒有）。

## 1. 各 status 數量（以工具計）
| status | 數量 | 說明 |
|---|---|---|
| pending_llm | 257 | 已抓取、LLM 尚未處理 |
| no_pricing_url | 118 | 資料集沒有 pricing_url，略過 |
| no_price_found | 56 | 頁面渲染後找不到價格（或 LLM 的價格未通過驗證） |
| ok | 34 | LLM 結構化後有已驗證的價格 |
| blocked | 19 | 403/驗證頁/登入牆，跳過 |
| robots_unknown | 8 | robots.txt 讀不到（403/逾時等），保守跳過 |
| robots_disallowed | 5 | robots.txt 禁止 |
| llm_error | 2 | LLM 呼叫失敗 |
| error | 1 | 載入失敗（逾時、網路/HTTP2 錯誤等） |

- **成功拿到價格（ok）：34 / 382 個有 pricing_url 的工具 = 8.9%**（佔全部 500 個工具 6.8%）。
- 排除『合規跳過』（robots/blocked）後：34/350 = 9.7%。

## 1b. 本次執行的 LLM 提供者
- groq（openai/gpt-oss-120b）：本次呼叫 2 次、成功 2 頁、token 4,902；停用原因：groq 每日額度用盡（429）：{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01m4cpekmnez7s57xjy0dnkkqv` service tier `on_demand` on tokens per 
- openrouter（openrouter:nvidia/nemotron-3-super-120b-a12b:free）：本次呼叫 52 次、成功 35 頁、token 329,290；停用原因：openrouter 每日額度用盡（429）：{"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"headers":{"X-R
- 未設定金鑰而略過：cerebras, mistral
- 停止原因：所有已設定的提供者今天額度都用完了（明天自動接續）
- 累計使用備援模型（非 Groq 120b，帶 llm_fallback_model、不進自動核准）的頁面：35（{'openrouter:nvidia/nemotron-3-super-120b-a12b:free': 35}）；Groq 有額度時會自動用 120b 重做。

## 2. 效能與 Groq 用量
- 抓取：平均每個網址 9.5 秒（中位數 7.5）；首筆 2026-10-12T13:24:50+08:00 → 末筆 2026-10-12T13:44:46+08:00。
- Groq v2：成功處理 37 / 296 個頁面（120b），token 184,164；另有被丟棄的第一版 v2a 試跑 0 頁（0 token，引文格式不合）、20b 僅供驗證提示詞的 0 頁（0 token，不進 results.json）；v1 全量（舊提示詞）共 0 token。
- 限流：每分鐘 8K token 以送出前節流避開；**120b 每日 token 額度（200,000，漏桶式連續回補，約 2.3 token/秒 ≈ 每小時 8.3K）是瓶頸**——v1 全量與本輪驗證已耗盡，之後每小時只能再處理約 4 個頁面（每頁約 2,100 token）。TPD 型 429 皆依 retry-after 等待或停止，沒有降級成 20b 當正式資料。
- 驗證統計（僅 v2 處理的 plan）：{'plans_total': 121, 'price_near_quote': 10, 'issue_price_unclear': 4, 'issue_name_far_from_price': 7, 'plan_dropped_quote': 18, 'issue_name_missing': 3, 'issue_period_ambiguous_toggle': 36, 'free_dropped_quote': 4, 'price_dropped_unverified': 3, 'issue_non_subscription_hint': 3}

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
| pika | llm_error | robots 允許；LLM：ValueError: empty content |
| otter | llm_error | robots 允許；networkidle 未達；LLM：ValueError: empty content |
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
deepseek, character-ai, dall-e, stable-diffusion, flux, kling, canva, relevance-ai, hirevue, bloomberg-gpt, doubao, crewai, gong, hebbia, spellbook, zhipu-chatglm, flowise, textio, akkio, yuanbao, outreach, marketmuse, obviously-ai, clipchamp, hypotenuse, lexis-ai, galileo-stitch, cline, voicemod, writer, ironclad, ada-health, lex, artisan, voiceflow, vtube-studio, profound, leena-ai, clipdrop, andi, seamless-ai, gptexcel, brandmark, seo-ai-yoast, qodo, datarails, deepmotion, moises, gorgias, mode, merlin, sider, penpot, hume, clockwise, gradescope

## 4b. 處理進度（因 120b 每日額度）
- 已用 v2 新規則處理：34 個工具的 ok 結果（頁面 37/296）；**尚未重跑、沿用 v1 結果（帶 old_prompt、不可批次核准）：0 個工具**。
- 續跑：GitHub Actions「價格資料每日更新」每天台灣時間 20:27 自動執行並接續進度（也可在 Actions 頁面手動 Run workflow）。
- 時間估計：每頁約 2,100 token，額度約 200K/天 → 每天約 95 頁；剩 259 頁約需 2.7 天（升級 Groq Dev Tier 後約 1–2 小時）。批次：第 1 天約 95 頁（資料集前段：chatbot、search、image、video、audio、music、coding 前段…）、第 2 天約 95 頁、第 3 天其餘。

## 5. 需人工覆核（32 筆；可批次核准的無旗標 0 筆）
旗標：price_change＝與資料集舊價差>50%；name_diff＝方案名稱與舊資料多數不同；shared_page＝多個工具共用同一價格頁；has_promo＝含促銷價；non_usd＝非美元；price_near_quote＝價格不在引用句內而在附近；dropped_fields＝有欄位因證據驗證失敗被丟棄。

| id | 旗標 | 細節 | 來源 |
|---|---|---|---|
| claude | has_promo, name_diff, name_far_from_price, price_near_quote, price_unclear, shared_page | 資料集方案 ['Pro', 'Max', 'Plus', 'Premium', 'Scale'] vs 新 ['Free', 'Pro', 'Max 5x', 'Enterprise']; 與 ['claude-code'] 共用同一價格頁，結果複製自同一次擷取; Max 5x: price_unclear, name_far_from_price | https://claude.com/pricing |
| gemini | dropped_fields, name_far_from_price, price_change, shared_page | Pro: 資料集 $199.99/月 → 官網 $19.99; 與 ['veo'] 共用同一價格頁，結果複製自同一次擷取; YouTube Premium Lite plan: name_far_from_price | https://gemini.google/subscriptions/ |
| copilot-microsoft | llm_fallback_model, name_diff, name_missing | 資料集方案 ['Microsoft 365 Personal/Family 含 Copilot'] vs 新 ['', '', '']; None: name_missing; None: name_missing; None: name_missing; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.microsoft.com/microsoft-365/copilot |
| perplexity | has_promo, llm_fallback_model, name_diff | 資料集方案 ['Pro', 'Max'] vs 新 ['Advanced answers and top AI models', 'Unlimited usage and top performance']; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.perplexity.ai/pro |
| midjourney | has_promo, llm_fallback_model, period_ambiguous_toggle | Basic: period_ambiguous_toggle; Standard: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Mega: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://docs.midjourney.com/hc/en-us/articles/27870484040333 |
| krea | dropped_fields, llm_fallback_model, period_ambiguous_toggle, price_change | Max: 資料集 $21.0/月 → 官網 $63.0; Pro: period_ambiguous_toggle; Max: period_ambiguous_toggle; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.krea.ai/pricing |
| runway | has_promo, llm_fallback_model, period_ambiguous_toggle | Standard: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Max: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://runwayml.com/pricing |
| veo | dropped_fields, name_far_from_price, price_change, shared_page | Pro: 資料集 $199.99/月 → 官網 $19.99; 與 ['gemini'] 共用同一價格頁，結果複製自同一次擷取; YouTube Premium Lite plan: name_far_from_price | https://gemini.google/subscriptions/ |
| luma | llm_fallback_model, period_ambiguous_toggle | Plus: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Ultra: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://lumalabs.ai/dream-machine/pricing |
| synthesia | has_promo, llm_fallback_model, price_near_quote | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.synthesia.io/pricing |
| heygen | llm_fallback_model, name_diff, period_ambiguous_toggle | 資料集方案 ['Creator', 'Advanced', 'Business', 'Plus', 'Pro'] vs 新 ['Free', 'Creator', 'Pro']; Creator: period_ambiguous_toggle; Pro: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super | https://www.heygen.com/pricing |
| descript | llm_fallback_model, name_far_from_price, period_ambiguous_toggle, price_unclear | Hobbyist: period_ambiguous_toggle; Creator: period_ambiguous_toggle, name_far_from_price; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.descript.com/pricing |
| elevenlabs | dropped_fields, has_promo, llm_fallback_model, period_ambiguous_toggle, price_near_quote | Starter: period_ambiguous_toggle; Creator: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Scale: period_ambiguous_toggle; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemot | https://elevenlabs.io/pricing |
| suno | dropped_fields, llm_fallback_model, name_far_from_price, period_ambiguous_toggle | Pro: period_ambiguous_toggle, name_far_from_price; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://suno.com/pricing |
| github-copilot | llm_fallback_model, price_change | Pro: 資料集 $10.0/月 → 官網 $39.0; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://github.com/features/copilot/plans |
| cursor | dropped_fields, llm_fallback_model, name_diff, period_ambiguous_toggle | 資料集方案 ['Pro'] vs 新 ['Individual', 'Teams']; Individual: period_ambiguous_toggle; Teams: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://cursor.com/pricing |
| windsurf | dropped_fields, llm_fallback_model, price_change | Team: 資料集 $40.0/月 → 官網 $80.0; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://windsurf.com/pricing |
| claude-code | has_promo, name_diff, name_far_from_price, price_near_quote, price_unclear, shared_page | 資料集方案 ['Scale', 'Pro', 'Max', 'Plus', 'Premium'] vs 新 ['Free', 'Pro', 'Max 5x', 'Enterprise']; 與 ['claude'] 共用同一價格頁，結果複製自同一次擷取; Max 5x: price_unclear, name_far_from_price | https://claude.com/pricing |
| replit | dropped_fields, has_promo, llm_fallback_model, price_near_quote | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://replit.com/pricing |
| lovable | llm_fallback_model, period_ambiguous_toggle | Pro: period_ambiguous_toggle; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://lovable.dev/pricing |
| v0 | has_promo, llm_fallback_model, name_diff | 資料集方案 ['Team'] vs 新 ['Free', 'Plus', 'Business']; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://v0.app/pricing |
| grammarly | llm_fallback_model, price_unclear | Pro: price_unclear; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.grammarly.com/plans |
| jasper | dropped_fields, llm_fallback_model, name_diff | 資料集方案 ['Team'] vs 新 ['Pro']; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.jasper.ai/pricing |
| writesonic | dropped_fields, has_promo, llm_fallback_model, non_subscription_hint | STARTER: non_subscription_hint; BASIC: non_subscription_hint; GROWTH: non_subscription_hint; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://writesonic.com/pricing |
| notion-ai | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Plus: period_ambiguous_toggle; Business: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.notion.com/pricing |
| microsoft-365-copilot | llm_fallback_model, name_diff, period_ambiguous_toggle | 資料集方案 ['Business add-on'] vs 新 ['Microsoft 365 Copilot', 'Microsoft 365 Copilot']; Microsoft 365 Copilot: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.microsoft.com/microsoft-365/copilot/enterprise |
| gemini-workspace | dropped_fields, has_promo, llm_fallback_model | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://workspace.google.com/pricing |
| figma-ai | dropped_fields, llm_fallback_model, name_far_from_price, price_change | Professional: 資料集 $16.0/月 → 官網 $55.0; Professional: name_far_from_price; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.figma.com/pricing/ |
| zapier-ai | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Professional: period_ambiguous_toggle; Team: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://zapier.com/pricing |
| deepl | dropped_fields, llm_fallback_model | 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.deepl.com/pro |
| veed | dropped_fields, llm_fallback_model, period_ambiguous_toggle | Creator: period_ambiguous_toggle; Pro: period_ambiguous_toggle; Studio: period_ambiguous_toggle; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://www.veed.io/pricing |
| codeium | dropped_fields, llm_fallback_model, price_change | Team: 資料集 $40.0/月 → 官網 $80.0; 使用非 120b 模型 openrouter:nvidia/nemotron-3-super-120b-a12b:free，不納入批次核准 | https://codeium.com/pricing |

旗標統計：{'has_promo': 11, 'name_diff': 9, 'name_far_from_price': 7, 'price_near_quote': 5, 'price_unclear': 4, 'shared_page': 4, 'dropped_fields': 17, 'price_change': 7, 'llm_fallback_model': 30, 'name_missing': 1, 'period_ambiguous_toggle': 14, 'non_subscription_hint': 1}
