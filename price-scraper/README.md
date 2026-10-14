# 價格資料每日自動更新：安裝說明（GitHub Actions）

這套程式會**每天台灣時間晚上 8:27** 在 GitHub 上自動執行：

1. 到各 AI 工具的官網價格頁抓取內容（會先看網站的 robots.txt，網站不允許就跳過）
2. 用 AI 把價格整理成表格（月付/年付分開、原價與促銷價分開、保留方案名稱；每筆都附**來源網址、擷取日期、官網原文**，程式會核對原文，AI 自己編的數字會被丟掉）
3. 產生報告與 SQL 檔，存到專案裡一個叫 **price-data** 的分支

> **不會**改你的網站、**不會**改資料庫、**不會**觸發網站正式部署。價格要不要上線，一樣由你看過報告後自己決定。

需要你做的事只有一次性的安裝（約 15 分鐘）。之後換 API 金鑰也只要在 GitHub 網頁上改一個欄位。

---

## 你會拿到的檔案

把 `price-actions.zip` 下載到電腦，**按右鍵 → 解壓縮**，會看到：

```
price-scraper/                      ← 整個資料夾要上傳
.github/workflows/price-update.yml  ← 排程設定（要用「建立新檔案」的方式放上去，見步驟 2）
vercel.json                         ← 用來取代專案裡原本的 vercel.json（見步驟 3）
```

> 注意：`.github` 這個資料夾名稱是「點」開頭，Mac 和 Windows 預設會**把它藏起來**，你可能看不到，這是正常的。步驟 2 會教你不用找它也能完成。

以下所有步驟都在瀏覽器打開你的專案頁面進行：
**https://github.com/jayren1121-afk/ai-tool-search**

---

## 步驟 1：上傳 price-scraper 資料夾

1. 打開專案頁面，確認左上角的分支按鈕顯示 **main**。
2. 按右上方的 **Add file**（加入檔案）→ 選 **Upload files**（上傳檔案）。
3. 打開電腦裡解壓縮後的資料夾，把 **整個 `price-scraper` 資料夾**用滑鼠拖進網頁中間的框框裡。
   - 一定要拖「資料夾」，不要只拖裡面的檔案，這樣 GitHub 才會保留 `price-scraper/` 這層資料夾。
   - 等到網頁列出所有檔案（共 16 個，包含 `seed/checkpoint-seed.tar.gz`、`tests/test_chain.py`）。
4. 拉到頁面最下面，「Commit changes」那一區保持選 **Commit directly to the main branch**，按綠色的 **Commit changes**。
5. 完成後，在專案首頁應該看得到一個 `price-scraper` 資料夾。

> 上傳到 main 時，Vercel 會照平常那樣重新部署一次網站。這次只是多一個資料夾，網站內容完全不變，不用擔心。

## 步驟 2：建立排程檔（.github/workflows/price-update.yml）

1. 回到專案首頁，按 **Add file** → **Create new file**（建立新檔案）。
2. 在上方「Name your file...」的檔名欄，**一個字一個字輸入**：
   ```
   .github/workflows/price-update.yml
   ```
   打到 `/` 時，GitHub 會自動把前面那段變成資料夾，這是正常的。打完後檔名欄前面應該顯示 `ai-tool-search / .github / workflows /`，檔名欄裡是 `price-update.yml`。
3. 在電腦上用「記事本」（Windows）或「文字編輯」（Mac）打開解壓縮後的 `price-update.yml`。
   - 如果看不到 `.github` 資料夾：Mac 在 Finder 按 `Command + Shift + .（句點）` 就會顯示；Windows 在檔案總管上方「檢視」→ 勾選「隱藏的項目」。
4. 全選（Ctrl+A / Command+A）→ 複製 → 貼到 GitHub 網頁的大編輯框。
5. 按右上角綠色 **Commit changes...** → 再按一次 **Commit changes**。

## 步驟 3：更新 vercel.json（避免 Vercel 幫 price-data 分支部署）

1. 在專案首頁點檔案 **vercel.json**。
2. 按右上角的**鉛筆圖示**（Edit this file）。
3. 把裡面原本的內容**全部刪掉**，換成 zip 裡 `vercel.json` 的內容（用記事本打開、全選、複製、貼上）。新內容如下（原本的兩個排程 `discover`、`health` 都保留了，只多了最後的 `git` 那段）：
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "crons": [
       { "path": "/api/cron/discover", "schedule": "17 2 * * *" },
       { "path": "/api/cron/health", "schedule": "41 3 * * *" }
     ],
     "git": {
       "deploymentEnabled": {
         "price-data": false
       }
     }
   }
   ```
4. 按 **Commit changes...** → **Commit changes**。

> 另外，程式在 price-data 分支裡也會自動放一個「關閉部署」的 vercel.json，雙重保險。

## 步驟 4：放入 API 金鑰（Secrets）

金鑰放在 GitHub 的「保險箱」裡，別人看不到，程式執行時才會讀取。**不要**把金鑰貼在任何檔案裡。

1. 在專案頁面上方點 **Settings**（設定，齒輪圖示；如果沒看到，點上方列最右邊的「⋯」）。
2. 左邊選單往下找到 **Secrets and variables** → 點 **Actions**。
3. 在 **Secrets** 分頁，按綠色 **New repository secret**。
4. 第一個：
   - **Name**：`GROQ_API_KEY`（請完全照打，英文大寫、底線）
   - **Secret**：貼上你的 Groq 金鑰（以 `gsk_` 開頭；到 https://console.groq.com/keys 建立）
   - 按 **Add secret**
5. 再按一次 **New repository secret**，第二個：
   - **Name**：`OPENROUTER_API_KEY`
   - **Secret**：貼上 OpenRouter 金鑰（以 `sk-or-` 開頭；到 https://openrouter.ai/settings/keys 登入後按 Create Key）
   - 按 **Add secret**
6. **OpenRouter 必做的一個設定**：打開 https://openrouter.ai/settings/privacy ，確認允許使用免費模型（有些免費模型的提供者會記錄輸入內容；我們送出去的只是公開的官網價格頁文字，沒有個人資料）。如果沒有開，免費模型會回「找不到可用的端點」。

（選填）以後想多加備援的 AI 公司，一樣在這裡新增：`GEMINI_API_KEY`（Google Gemini 免費方案）、`CEREBRAS_API_KEY`、`MISTRAL_API_KEY`。**有設定才會用，沒設定會自動跳過**，不會出錯。

## 步驟 5：手動執行一次測試

1. 點專案上方的 **Actions** 分頁。
   - 如果看到「Workflows aren't being run on this repository」之類的提示，按綠色按鈕 **I understand my workflows, go ahead and enable them**。
2. 左邊點 **價格資料每日更新**。
3. 右邊會出現一條灰色提示和 **Run workflow** 按鈕，點它：
   - 分支保持 **main**
   - 「本次最多整理幾頁」：第一次測試建議填 **3**（很快跑完，大約 5 分鐘）
   - 「開始新一輪」：**不要勾**
   - 按綠色 **Run workflow**
4. 幾秒後列表會出現一筆新的執行（黃色圓圈＝執行中）。綠色勾勾＝成功；紅色叉叉＝失敗（見下方「常見問題」）。
5. 測試成功後就不用再管了，之後每天晚上 8:27 會自動執行（不限制頁數）。也可以隨時再按 Run workflow（頁數留空白）立刻跑一次。

## 步驟 6：去哪裡看結果

**看今天的進度（最簡單）**
Actions → 點某一次執行 → 頁面往下捲，會看到中文摘要：
- 價格頁已抓幾個、剩幾個
- AI 整理已完成幾頁、剩幾頁
- 今天用了哪幾家 AI（Groq / OpenRouter …），哪一家額度用完了

**看完整的報告與 SQL 檔**
1. 回到專案首頁（Code 分頁），點左上角的分支按鈕 **main** → 在選單裡選 **price-data**。
2. 這個分支裡的檔案：
   - `progress.md`：最新進度（同上面的摘要）
   - `report.md`：完整報告（GitHub 會自動排版，直接點開就能讀）
   - `price_snapshots_review_list.md`：需要人工看的清單
   - `price_snapshots_import.sql`：匯入用（匯入後一律是「未核准」，不會公開）
   - `price_snapshots_approve_safe.sql`：可批次核准的清單（只含沒有任何警示、而且是用主要模型 Groq gpt-oss-120b 整理的）
   - `scrape.jsonl`、`llm.jsonl`、`text/`：進度存檔，**請不要刪改**（刪掉會從頭重跑）
3. 要下載某個檔案：點開檔案 → 右上角的下載圖示（Download raw file）。

這些 SQL 要不要到 Supabase 執行、什麼時候執行，跟以前一樣由你決定。

## 日後更換金鑰

1. **Settings** → **Secrets and variables** → **Actions**。
2. 在 Secrets 清單找到要換的那一個（例如 `GROQ_API_KEY`），按右邊的**鉛筆圖示**。
3. 在框框裡貼上新金鑰 → 按 **Update secret**。
4. 完成。下一次執行就會用新金鑰（GitHub 不會顯示舊金鑰內容，這是正常的）。
5. 想暫停某一家：直接把那個 secret 刪掉（垃圾桶圖示），程式會自動跳過那一家。

## AI 提供者的順序（自動切換）

1. **Groq**（`openai/gpt-oss-120b`，主要模型）：免費額度大約每天 95 頁。
2. Groq 當天額度用完時，自動換 **OpenRouter 免費模型**。預設模型：**`nvidia/nemotron-3-super-120b-a12b:free`**（2026-10-12 查 OpenRouter 免費模型清單挑選：1200 億參數、可讀 26 萬字元等級的長文、支援 JSON 格式輸出）。OpenRouter 免費模型沒有儲值時每天約 50 次。
3. 之後有設定 `GEMINI_API_KEY`、`CEREBRAS_API_KEY`、`MISTRAL_API_KEY` 的話，再依序使用。

規則：
- 不是 Groq gpt-oss-120b 整理的結果，會標記 **llm_fallback_model**，**不會**放進可批次核准清單，只能人工看。
- 之後 Groq 有額度時，程式會自動把這些頁面再用 120b 重做一次，重做成功就可以正常進核准流程。
- 某一家金鑰錯了、額度用完了，摘要裡會寫原因，程式會自動換下一家，不會整個停掉。

**想換 OpenRouter 模型**（例如預設模型被下架）：
Settings → Secrets and variables → Actions → 上方切到 **Variables** 分頁 → **New repository variable** → Name 填 `OPENROUTER_MODEL`，Value 填模型名稱（例如 `google/gemma-4-31b-it:free`）→ Add variable。
可用的免費模型可以在 https://openrouter.ai/models?max_price=0 查到（名稱結尾通常是 `:free`）。如果設定的模型不存在，程式也會自動從免費清單挑一個可用的。

## 月繳/年繳切換（update24）

很多價格頁一打開只顯示一種計費（常常是比較便宜的年繳），要按「Monthly / Yearly」、「月繳 / 年繳」才看得到另一種價格。
現在抓取程式會：
1. 先存下打開時的畫面文字；
2. 找出看起來像「計費切換」的按鈕、分頁、開關（文字像 Monthly、Yearly、Annual、Billed yearly、月繳、年繳、按月、按年…）；
3. 一個一個點，畫面有變就再存一份，前面加上標記，例如 `=== 計費模式: 月繳 (monthly) ===`；
4. **不會點**：會跳到別頁的連結、註冊／登入／購買／結帳／試用／聯絡業務等按鈕；點擊期間會攔下所有換頁與彈出視窗；每頁最多 20 秒、8 次點擊；
5. 頁面沒有切換 → 跟以前完全一樣。

AI 整理（提示詞 v2c）會把月繳價格放 `price_monthly`、年繳的「每月約當」放 `price_yearly_per_month`、年繳總價放 `price_yearly_total`，不會混在一起；引文一樣必須是頁面上的原文。
如果 AI 把年繳段落的數字當成月繳，會被標記 `billing_section_mismatch`，要人工看。

**舊頁面怎麼重抓？** 每天的排程會自動把「舊版程式抓的頁面」重抓一些（預設每次 15 個，可在 Variables 設 `RESCRAPE_PER_RUN`；設 0 就不重抓）。
重抓後文字有變的頁面會自動重新請 AI 整理（用文字指紋比對）；整理好之前，舊結果會標記 `stale_text`，不會自動上線。
想一次全部重抓：Run workflow 時勾選「開始新一輪」（new round），但會用掉比較多 AI 額度、要好幾天才整理完。
要關掉切換功能：Variables 設 `BILLING_TOGGLE` = `0`。

## 關於 Vercel 預覽部署

- 程式只會把資料推到 **price-data** 分支，不會推到 main，所以**不會觸發網站正式部署**。
- Vercel 預設會替「每一個分支」做預覽部署。我們用了兩層方式關掉 price-data 的部署：(1) 步驟 3 的 main vercel.json；(2) price-data 分支自己的 vercel.json 也關閉部署。
- 確認方法：到 Vercel 網站 → 你的專案 → **Deployments**，如果沒看到 `price-data` 的部署，就是成功。
- 萬一還是看到 price-data 的部署（通常會顯示失敗/取消，因為那個分支沒有網站程式），**可以直接忽略**，不影響正式網站。想完全關掉，可以再加一層：Vercel 專案 → **Settings** → **Git** → **Ignored Build Step**，選 Custom，貼上：
  ```
  if [ "$VERCEL_GIT_COMMIT_REF" = "price-data" ]; then exit 0; else exit 1; fi
  ```
  然後 Save。（意思是：price-data 分支一律不部署，其他分支照常。）

## 什麼時候要「開始新一輪」

現在的進度會一直接續，已抓過、已整理過的頁面不會重做（只會處理新的或還沒完成的）。
價格會變，建議**每月一次**手動重新整理全部：
Actions → 價格資料每日更新 → Run workflow → 勾選「**開始新一輪**」→ Run workflow。
舊資料會被移到 price-data 分支的 `archive/日期/` 資料夾保存。全部重新整理大約需要 3～4 天（受免費額度限制），期間每天自動接續。

## 常見問題

| 狀況 | 怎麼辦 |
|---|---|
| 摘要寫「沒有任何 LLM 金鑰」 | 步驟 4 的名稱打錯（要完全是 `GROQ_API_KEY`、`OPENROUTER_API_KEY`），或放到了 Variables 而不是 Secrets |
| 摘要寫「金鑰無效」 | 金鑰過期或貼錯，照「日後更換金鑰」換新的 |
| 摘要寫「今天額度都用完了」 | 正常，明天會自動接續 |
| 紅色叉叉，訊息有「存檔失敗」或 `403` / `Permission denied` | Settings → Actions → General → 最下面 **Workflow permissions** 選 **Read and write permissions** → Save，再按 Run workflow |
| 收到 GitHub 信說排程被停用 | 公開專案 60 天沒有任何改動時，GitHub 會自動停用排程。到 Actions → 價格資料每日更新 → 按 **Enable workflow** 即可 |
| 想暫停每天自動執行 | Actions → 價格資料每日更新 → 右上「⋯」→ **Disable workflow**（之後同一位置可 Enable） |

---

## 給維護人員的技術備註

- **方案**：checkpoint 與輸出提交到 orphan 分支 `price-data`（只有資料、沒有網站程式）。workflow `permissions: contents: write`；第一次執行若分支不存在，會用 `price-scraper/seed/checkpoint-seed.tar.gz` 自動建立。`concurrency: price-update` 避免兩次執行同時寫入。commit 訊息帶 `[skip ci]`（只擋 GitHub Actions，擋不了 Vercel，所以另外用 vercel.json `git.deploymentEnabled`）。
- **初始資料快照**：2026-10-12 12:56:17（UTC+8）從 box `/workspace/price-pilot/full` 複製（scrape.jsonl 378 網址全部抓完；llm.jsonl 234/297 頁已用 120b v2b 完成；llm_v1.jsonl 供未完成頁沿用舊結果並標 old_prompt；text/ 712 檔）。快照後 box 上仍在跑的程序新完成的頁面不在 seed 裡，Actions 會再處理一次（約十幾頁的額度）。
- ⚠️ **box 上的排程/程序要停掉**（run_monthly.sh 與 llm.py），否則兩邊會用同一把 Groq 金鑰搶每日額度、重複處理。若想把 box 上更新的進度帶過去，要在**第一次執行 Actions 之前**重新打包 seed。
- 時間控制：job 150 分鐘、主要步驟 130 分鐘；抓取最多 70 分鐘、AI 整理在開始後 115 分鐘自動停止，剩餘時間存檔；存檔步驟 `if: always()`，就算前面失敗也會保存已完成的進度。
- 資料集：`price-scraper/ai_tools.json` 是 2026-10-08 版本的靜態複本；資料集更新時要一併替換此檔（新工具的價格頁會在下次執行時自動抓）。
- 離線測試：`python3 price-scraper/tests/test_chain.py <資料複本資料夾>`（本機假伺服器模擬 429/404/金鑰錯誤，不用真金鑰）。
- 可調的 Variables：`OPENROUTER_MODEL`、`GEMINI_MODEL`（預設 gemini-3.8-flash）、`CEREBRAS_MODEL`（預設 gpt-oss-120b）、`MISTRAL_MODEL`（預設 mistral-small-latest）、`LLM_PROVIDERS`（預設 `groq,openrouter,gemini,cerebras,mistral`）。
