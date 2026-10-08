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
| `IP_HASH_SALT` | 回報資料中 IP 雜湊的鹽 | 使用 service role key 末段作為鹽 |

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
