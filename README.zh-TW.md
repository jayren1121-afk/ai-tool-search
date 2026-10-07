# AI 工具搜尋網站（Next.js + Supabase + Gemini）

## 功能
- 搜尋 `ai_tools`：全文搜尋 `search_tsv` + 中文 `ilike` 後備（名稱、描述、子分類），可依分類與計價篩選。
- 「診斷」按鈕：桌面版右側滑出面板、手機版底部抽屜；先顯示資料庫資料，再載入 Gemini 診斷。
- `/api/diagnose`（僅伺服器端）：7 天內有快取則直接回傳；否則抓取官網首頁與價格頁文字，連同資料庫紀錄交給 Gemini（JSON 結構化輸出），以 service role 寫入 `diagnoses`。每 IP 每分鐘 10 次限流。

## 環境變數
| 變數 | 位置 | 取得方式 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 公開 | Supabase 專案 → Project Settings → API（或 Data API）→ Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開 | 同頁 → API Keys → `anon` public（或新版 Publishable key） |
| `SUPABASE_SERVICE_ROLE_KEY` | **僅伺服器** | 同頁 → `service_role` secret（或新版 Secret key）。絕不可加 `NEXT_PUBLIC_` 前綴或提交到 Git |
| `GEMINI_API_KEY` | **僅伺服器** | https://aistudio.google.com → Get API key → Create API key |
| `GEMINI_MODEL` | 伺服器 | 選填，預設 `gemini-2.5-flash` |

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
3. Framework 會自動偵測為 Next.js；展開 **Environment Variables**，逐一加入上表 5 個變數。
4. 按 **Deploy**。之後每次 push 到 main 會自動重新部署。

### 方式 B：Vercel CLI
```bash
npm i -g vercel
vercel login
vercel link                       # 建立/連結專案
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_MODEL production
vercel --prod
```
修改環境變數後需重新部署才會生效。

## 注意事項
- 限流為單一伺服器實例的記憶體計數，Vercel 多實例下並非全域；正式環境建議改用 Upstash Redis 或 Vercel KV。
- 抓取官網的網址僅來自資料庫，不接受使用者輸入的網址。
- 部分網站以 JavaScript 渲染或阻擋機器人，抓取內容可能不完整，Gemini 會標示「未確認」。
- `/api/diagnose` 設定 `maxDuration = 60`；Vercel Hobby 方案上限依方案而定。
- 建議 Node.js 22 以上（supabase-js 對 Node 20 已提示棄用）。
