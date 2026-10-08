# AI 工具搜尋網站（Next.js + Supabase + Groq / Gemini / OpenRouter）

## 功能
- 搜尋 `ai_tools`：全文搜尋 `search_tsv` + 中文 `ilike` 後備（名稱、描述、子分類），可依分類與計價篩選。
- 「診斷」按鈕：桌面版右側滑出面板、手機版底部抽屜；先顯示資料庫資料，再載入 AI 診斷。
- `/api/diagnose`（僅伺服器端）：7 天內有快取則直接回傳；否則抓取官網首頁與價格頁文字，連同資料庫紀錄交給 LLM（預設 Groq，JSON 輸出並驗證欄位）；主要供應商失敗時自動改用其他已設定金鑰的供應商，以 service role 寫入 `diagnoses`。每 IP 每分鐘 10 次限流。

## 環境變數
| 變數 | 位置 | 取得方式 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 公開 | Supabase 專案 → Project Settings → API（或 Data API）→ Project URL，例如 `https://xxxx.supabase.co`（不要加 `/rest/v1`；程式會自動去除空白、結尾 `/` 與 `/rest/v1`） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開 | 同頁 → API Keys → `anon` public（或新版 Publishable key） |
| `SUPABASE_SERVICE_ROLE_KEY` | **僅伺服器** | 同頁 → `service_role` secret（或新版 Secret key）。絕不可加 `NEXT_PUBLIC_` 前綴或提交到 Git |
| `LLM_PROVIDER` | 伺服器 | `groq`（預設）、`gemini` 或 `openrouter` |
| `GROQ_API_KEY` | **僅伺服器** | 見下方「申請 Groq 金鑰」 |
| `GROQ_MODEL` | 伺服器 | 選填，預設 `openai/gpt-oss-120b`；可改 `openai/gpt-oss-20b`（更快）或 `qwen/qwen3.8-27b`（預覽，中文較佳） |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | **僅伺服器** | 選填。https://aistudio.google.com → Get API key；模型預設 `gemini-2.5-flash` |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | **僅伺服器** | 選填。https://openrouter.ai/keys；模型預設 `google/gemma-4-31b-it:free` |

### 申請 Groq 金鑰（免費）
1. 前往 https://console.groq.com/keys ，用 Google / GitHub / Email 註冊登入。
2. 點 **Create API Key**，命名後複製金鑰（只會顯示一次）。
3. 在 Vercel → 專案 → **Settings → Environment Variables** 新增 `GROQ_API_KEY`（以及 `LLM_PROVIDER=groq`），然後到 **Deployments** 對最新部署按 **Redeploy**。

免費額度（2026-10-08 查 Groq 文件）：`openai/gpt-oss-120b` 約每分鐘 30 次請求、8K tokens、每日 1K 次請求。因此每頁只送約 6000 字元且以約 1800 tokens 為上限；同一分鐘內連續診斷多個工具可能遇到 429，稍候再試即可（7 天內的結果會快取）。

### 備援機制
`LLM_PROVIDER` 指定的供應商優先；若失敗（額度用完、逾時、輸出格式錯誤），會依序改用其他**有設定金鑰**的供應商。只設定 `GROQ_API_KEY` 也能正常運作。

## 本機開發
```bash
npm install
cp .env.example .env.local   # 填入上述值
npm run dev                  # http://localhost:3000
```
前提：已在 Supabase SQL Editor 執行 `supabase_setup.sql`。

## 部署到 Vercel
### 方式 A：從 GitHub 匯入
1. 將此資料夾推到 GitHub 新儲存庫（`.env.local` 已被 `.gitignore` 排除）。
2. 登入 https://vercel.com → **Add New… → Project** → 選擇該儲存庫 → Import。
3. Framework 會自動偵測為 Next.js；展開 **Environment Variables**，加入上表變數（至少 Supabase 3 個 + `GROQ_API_KEY`）。
4. 按 **Deploy**。之後每次 push 到 main 會自動重新部署。

### 方式 B：Vercel CLI
```bash
npm i -g vercel
vercel login
vercel link                       # 建立/連結專案
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add LLM_PROVIDER production
vercel env add GROQ_API_KEY production
vercel env add GROQ_MODEL production      # 選填
vercel --prod
```
修改環境變數後需重新部署才會生效。

## 注意事項
- 限流為單一伺服器實例的記憶體計數，Vercel 多實例下並非全域；正式環境建議改用 Upstash Redis 或 Vercel KV。
- 抓取官網的網址僅來自資料庫，不接受使用者輸入的網址。
- 部分網站以 JavaScript 渲染或阻擋機器人，抓取內容可能不完整，AI 會標示「未確認」。
- `/api/diagnose` 設定 `maxDuration = 60`；Vercel Hobby 方案上限依方案而定。
- 建議 Node.js 22 以上（supabase-js 對 Node 20 已提示棄用）。

## 只更新部分檔案（GitHub 網頁上傳）
在 GitHub 儲存庫頁面 → **Add file → Upload files**，把變更的檔案拖曳到對應資料夾（保持相同路徑）後 Commit，Vercel 會自動重新部署。新增環境變數後記得 Redeploy。

## 安全與防濫用（v3，皆為選填）
未設定下列變數時網站照常運作，只是改用較寬鬆的預設行為。

| 變數 | 用途 | 未設定時 |
|---|---|---|
| `ALLOWED_ORIGINS` | 只接受來自這些網址的 `/api/diagnose`、`/api/report` 請求（逗號分隔） | 只允許 `https://ai-tool-search.vercel.app`（加上 Vercel 自動提供的部署網址；本機開發另允許 localhost） |
| `DIAGNOSE_DAILY_CAP` | 全站每日呼叫 LLM 上限（快取命中不計） | 800 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 全域限流：每 IP 每分鐘 10 次、每日 100 次；回報每 IP 每 10 分鐘 5 次、每日 20 次 | 改用單一伺服器記憶體計數（Vercel 多實例時不精確） |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | 每個瀏覽器工作階段第一次診斷前做人機驗證（通過後 2 小時內免驗證） | 不做人機驗證 |
| `IP_HASH_SALT` | 回報、投票、評論資料中 IP 雜湊的鹽 | 使用 service role key 末段作為鹽 |

> 若使用自訂網域，務必把它加入 `ALLOWED_ORIGINS`，否則診斷會回傳「來源不被允許」。

### 取得 Upstash Redis 金鑰（免費方案即可）
1. 前往 https://console.upstash.com 註冊登入。
2. **Redis → Create Database**，名稱隨意，Region 選離 Vercel 部署區域近的（如 `ap-northeast-1` 東京或 `us-east-1`），方案選 Free。
3. 建好後在資料庫頁面的 **REST API** 區塊複製 `UPSTASH_REDIS_REST_URL` 與 `UPSTASH_REDIS_REST_TOKEN`（不要用 Read-only token）。
4. 也可在 Vercel → 專案 → **Storage / Marketplace** 直接連結 Upstash，會自動寫入這兩個變數。

### 取得 Cloudflare Turnstile 金鑰（免費）
1. 前往 https://dash.cloudflare.com 註冊登入（不需要把網域放在 Cloudflare）。
2. 左側選 **Turnstile → Add widget**。
3. Widget name 隨意；**Hostname** 加入 `ai-tool-search.vercel.app`（以及自訂網域、`localhost` 若要本機測試）。
4. Widget Mode 選 **Managed**（多數使用者會自動通過）。
5. 建立後複製 **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`、**Secret Key** → `TURNSTILE_SECRET_KEY`。
6. `NEXT_PUBLIC_` 變數會在建置時寫入前端，新增後**必須 Redeploy**。

### 重新診斷限制
「重新診斷」只有在最新一筆診斷超過 24 小時時才會呼叫 AI；否則直接回傳快取並顯示提示。一般查詢使用 7 天內的快取。

### 診斷可信度機制
- 提示詞要求 AI 只陳述官網文字中明確寫出的事實；網頁文字以分隔符號包住並視為不可信資料（忽略其中的指令與自我宣傳）。
- 每個欄位（價位、方案、是否套殼、底層模型、摘要）附信心等級與原文引用；伺服器會檢查引用是否真的出現在抓取到的網頁中，找不到就降為「低可信」，套殼與底層模型改為「無法確認」。
- 網頁文字過少時會顯示資料品質提醒。舊版快取診斷（沒有這些欄位）仍可正常顯示。

### 回報錯誤（需執行資料庫遷移）
面板中的「回報錯誤」會寫入 `reports` 資料表。請在 Supabase → **SQL Editor** 貼上並執行 `supabase_migration_002.sql`（可重複執行）。此表啟用 RLS 且沒有公開 policy，只有伺服器端（service role）能讀寫；可在 Supabase → **Table Editor → reports** 查看回報。

## SEO（v4）
- 每個工具有獨立頁面 `/tools/{id}`、每個分類有 `/category/{slug}`，由伺服器端渲染並快取 1 天（ISR）；建置時不需連線 Supabase，頁面於第一次被造訪時產生。
- 自動產生 `/sitemap.xml`（首頁、24 個分類、所有工具，`lastModified` 取自 `updated_at`；Supabase 無法連線時改用內建的靜態工具清單）與 `/robots.txt`（允許全部、禁止 `/api/`）。
- 頁面包含標題、描述、canonical、OpenGraph／Twitter 卡片（圖片為 `public/logo.png`）、JSON-LD（SoftwareApplication、BreadcrumbList、ItemList）。
- 新增環境變數 `NEXT_PUBLIC_SITE_URL`（選填，預設 `https://ai-tool-search.vercel.app`）。若改用自訂網域，請設定此變數並 Redeploy；它也會自動加入 `ALLOWED_ORIGINS`。
- 部署後到 Google Search Console → **Sitemap** 提交 `https://ai-tool-search.vercel.app/sitemap.xml`。驗證檔 `public/google67eec0c3b8944098.html` 請勿刪除。
- 更新資料庫後，工具頁最多 1 天後自動更新。

## 社群功能（v5）：讚／倒讚、網路口碑、熱度、評論、替代方案

### 1. 執行資料庫遷移（必要）
到 Supabase → **SQL Editor** 貼上並執行 `supabase_migration_003.sql`（可重複執行；需先執行過 `supabase_setup.sql`，`002` 建議也已執行）。會建立：

| 資料表 | 用途 | 公開讀取 |
|---|---|---|
| `tool_votes` | 每位訪客對每個工具一票（👍=1／👎=-1，可更改或取消） | ❌（含 `voter_hash`，僅伺服器） |
| `tool_vote_stats` | 彙總：讚、倒讚、Wilson 好評分數、評論數、平均評分（由觸發器自動更新） | ✅ |
| `tool_views` | 每日瀏覽次數 | ❌ |
| `tool_stats` | 熱度指標快取（每工具每天最多更新一次） | ✅ |
| `tool_reviews` | 使用者評論（1–5 星、10–500 字、使用情境） | ✅ 僅 `status = 'visible'` 的列，且只開放非敏感欄位（不含 `voter_hash`、`ip_hash`） |
| `review_helpful` | 「有幫助」紀錄（每人每則一次） | ❌ |

所有新表都啟用 RLS；寫入一律由伺服器 API 以 service role 執行，前端不會拿到 service role key。

**未執行遷移時**：網站照常運作，只是不顯示讚數、評論、熱度，投票／評論 API 回傳「功能尚未啟用」；AI 診斷照常（含口碑摘要）。

### 2. 新增環境變數（全部選填）
| 變數 | 用途 | 未設定時 |
|---|---|---|
| `VOTER_SECRET` | 簽署匿名訪客 ID（httpOnly cookie `vid`）；投票者身分 = 簽章 cookie + IP 雜湊 | 依序改用 `IP_HASH_SALT`、service role key |
| `TAVILY_API_KEY` | 網路口碑加入 PTT、Dcard、Mobile01、Product Hunt、Threads、Reddit 的搜尋結果 | 只用 Hacker News（與 Reddit，若未被封鎖） |
| `BRAVE_SEARCH_API_KEY` | 同上（Tavily 未設定時才使用） | 同上 |
| `REDDIT_DISABLED` | 設為 `1` 停用 Reddit | 會嘗試 Reddit 公開 JSON |
| `GITHUB_TOKEN` | 熱度指標查詢 GitHub Stars（避免匿名額度被限流） | 匿名查詢，失敗時 Stars 顯示「無法確認」不計分 |

新增後到 Vercel → Settings → Environment Variables 填入並 **Redeploy**。

#### 取得 Tavily 金鑰（免費每月 1,000 credits，不需信用卡）
1. 前往 https://app.tavily.com 註冊登入。
2. 在 Dashboard 的 **API Keys** 複製預設金鑰（`tvly-` 開頭）→ `TAVILY_API_KEY`。
3. 每次診斷最多用 1 次基本搜尋（1 credit）；有 7 天快取，一般用量不會超過免費額度。

#### 取得 Brave Search API 金鑰（擇一即可）
1. 前往 https://api-dashboard.search.brave.com 註冊，選 **Search** 方案（需綁信用卡做防詐驗證；每月有 $5 免費額度，約 1,000 次搜尋）。
2. 建議在帳單設定把每月上限設為 $5 以免超額扣款；依 Brave 條款，使用免費額度需在網站標示使用 Brave Search API。
3. **API Keys → Add API key**，複製到 `BRAVE_SEARCH_API_KEY`。

#### 取得 GitHub Token（免費）
1. 登入 GitHub → https://github.com/settings/personal-access-tokens → **Generate new token**（Fine-grained）。
2. Repository access 選 **Public repositories (read-only)**，不需勾選任何權限；設定到期日。
3. 複製 token → `GITHUB_TOKEN`。

### 3. 功能說明
- **讚／倒讚**：首頁卡片、分類頁、工具頁顯示 👍、👎 與「% 好評」；首頁可選「好評優先」排序（依 Wilson 下界分數，票數少時不會因 1 票就排第一）。在診斷面板或工具頁點擊即時更新（樂觀更新，失敗自動還原）；再點一次同一按鈕可取消。限流：每 IP 每分鐘 20 次、每日 300 次；同一 IP 對同一工具最多 5 位不同訪客投票；有設定 Turnstile 時會先做人機驗證（與診斷共用 2 小時通行證）。
- **網路口碑摘要**：診斷時從 Hacker News（Algolia API，近一年留言）、Reddit（公開 JSON）以及 Tavily／Brave（若有設定）抓取最多約 900 tokens 的討論片段，AI 只能根據這些片段整理「常見稱讚／常見抱怨／整體風評」，每一點都必須引用片段編號，伺服器會換成實際來源連結；沒有引用或引用不存在的項目會被刪除。片段少於 2 則時顯示「尚無足夠討論資料」。
- **熱度指標**：只使用真實資料，每項分數 = log10(1 + 數值) × 權重，總分上限 100：站內瀏覽（30 天）×10、站內投票數 ×15、站內評論數 ×10、AI 診斷次數（30 天）×8、Hacker News 提及（90 天，以官網網域精確比對）×15、GitHub Stars ×8（自動從官網連結偵測 GitHub 專案）。面板會顯示每項數值、得分與更新時間，每工具每天最多更新一次。這是**相對指標**，不代表實際流量。**不使用 Google Trends**：Google Trends 沒有官方公開 API，非官方爬取不穩定且違反服務條款，因此未納入。
- **使用者評論**：工具頁與診斷面板的「評論」分頁，可依「最新／最有幫助」排序，顯示平均評分。每位訪客每個工具一則（可編輯），10–500 字、最多 1 個連結；過濾垃圾字詞、重複字元與重複內容。限流：每 IP 每 10 分鐘 5 則、每日 20 則；有設定 Turnstile 時需人機驗證。
- **隱藏評論**：Supabase → **Table Editor → tool_reviews**，把該列 `status` 改為 `hidden` 即可（平均評分與評論數會自動重算）；改回 `visible` 即恢復。編輯評論不會改變其 `status`。
- **替代方案比較**：從同分類挑 2–3 個工具（優先同子分類、標籤重疊、好評較高者），比較表的價格、免費方案、是否套殼、好評率都來自本站資料庫（價格只採用高／中可信度的方案），AI 只根據這些資料寫一段簡短比較。
- **診斷面板分頁**：口碑／熱度／評論／替代方案／官網最新資訊。每次診斷只呼叫 1 次 LLM（官網文字、口碑片段、替代方案資料合併在同一個提示中，約 3–4K tokens 輸入 + 最多 2.6K 輸出，符合 Groq 免費每分鐘 8K tokens），結果快取 7 天。舊版快取診斷仍可顯示，口碑分頁會提示「重新診斷」以取得口碑摘要。

### 4. 限制與注意事項
- Reddit 經常封鎖雲端主機（含 Vercel）的請求，此時口碑來源會顯示「Reddit（無法存取，可能被封鎖）」；可設 `REDDIT_DISABLED=1` 省去等待，或改用 Tavily／Brave。
- 名稱為常見英文字的工具（如 Gamma、Cursor、Whisper）可能抓到同名但無關的討論；程式會要求名稱附近出現網域或 AI 相關語境，AI 也被要求忽略無關片段，但仍可能有誤差。
- 官網為共用網域（如 github.com、huggingface.co）時，Hacker News 提及數無法以網域比對，顯示「無法確認」不計分；GitHub 專案偵測為自動推測，可能抓錯。
- 未設定 Upstash 時，限流為單一伺服器實例的記憶體計數。
- 匿名訪客以 cookie + IP 識別，清除 cookie 或換網路即可再投一票；IP 上限只能降低、無法完全防止刷票。

## 英文版（v6）：/en 路徑、hreflang、自動導向

中文版維持預設，**所有既有中文網址不變**（已提交給 Google 的網址不受影響）。英文版放在 `/en` 底下：

| 中文（預設） | 英文 |
| --- | --- |
| `/` | `/en` |
| `/tools/{id}` | `/en/tools/{id}` |
| `/category/{slug}` | `/en/category/{slug}` |

### 1. 執行資料庫遷移（建議）

在 Supabase → SQL Editor 依序執行（皆可重複執行）：

1. `supabase_migration_003.sql`（v5 社群功能，若尚未執行）
2. `supabase_migration_004.sql`（v6 英文版）

004 會：
- 在 `ai_tools` 新增 `description_en`、`key_features_en`，並填入 498 筆英文描述（只填空白欄位，不會覆蓋你之後手動修改的英文內容）。
- 重建全文搜尋欄位 `search_tsv`，納入英文描述（英文搜尋可搜到描述內容）。
- 在 `diagnoses` 新增 `locale` 欄位（`zh`／`en`，舊資料一律視為 `zh`），AI 診斷快取依語言分開。

檢查：`select count(description_en), count(*) from ai_tools;` 應為 498 / 498。

**尚未執行 004 也能運作**：英文頁會改用「{name} is an AI tool in the {category} category.」的通用描述、不顯示功能清單；英文 AI 診斷仍可使用，但不會寫入快取（每次都重新產生，會消耗較多 LLM 額度與次數限制），中文診斷照舊使用既有快取。

### 2. 功能說明

- **語言切換**：每頁標題列右側有「English／中文」切換，連到對應頁面，並記住選擇（cookie `lang`，一年）。
- **首次自動導向**：只有在「首頁 `/`」、且訪客**第一次**來（沒有 `lang` cookie）、瀏覽器語言（Accept-Language）**不含中文**時，才 307 導向 `/en`，並記住 `lang=en`。
  - 搜尋引擎爬蟲、連結預覽機器人、沒有 User-Agent 的請求**一律不導向**（Googlebot 永遠看到中文首頁）。
  - 工具頁、分類頁、`/api`、靜態檔、Google 驗證檔、`sitemap.xml`、`robots.txt` 都不會導向。
  - 選過「中文」的訪客（`lang=zh`）不會再被導向。
  - 由根目錄的 `proxy.ts` 處理（Next.js 16 的 middleware 新名稱）。
- **SEO**：每組中英文頁面都有 `hreflang`（`zh-Hant-TW`、`en`、`x-default` → 中文）、各自的 canonical、OpenGraph locale（`zh_TW`／`en_US`）、JSON-LD `inLanguage`，`<html lang>` 也會依語言切換。`sitemap.xml` 同時列出中英文網址（各含 alternates，共約 1,046 個網址）。
- **英文 AI 診斷**：在英文頁按「Live AI Diagnosis」會要求 LLM 以英文輸出，快取依語言分開。
- **翻譯方式**：介面文字、分類名稱與介紹在 `lib/i18n.ts`；子分類、免費額度、底層模型等資料欄位以對照表翻譯（`lib/i18n-data.ts`），查無對應時顯示原文。

### 3. 之後新增工具時

在 `ai_tools` 填入 `description_en`（英文一句話描述）與 `key_features_en`（JSON 陣列）即可；留空時英文頁會自動使用通用描述。新的子分類／免費額度文字若不在對照表內，英文頁會顯示中文原文，可在 `lib/i18n-data.ts` 補上。

### 4. Google Search Console

部署後重新提交 `https://ai-tool-search.vercel.app/sitemap.xml` 即可，英文網址會從 sitemap 與 hreflang 被發現；不需要另外驗證。
