## 價格資料更新進度（2026-10-14 12:50 台灣時間）

- 價格頁抓取：已抓 **378 / 378** 個網址（剩 0 個）
- 月繳/年繳切換：新版已抓到切換的頁面 21 個；舊版抓取、還要慢慢重抓的頁面 293 個（每天最多 15 個）
- AI 整理（需要整理的 296 頁）：**已完成 296 頁，剩 0 頁**
  - 其中用主要模型 Groq gpt-oss-120b：232 頁；用備援模型（也已自動上線；Groq 有額度時會自動用 120b 重做並更新）：64 頁
- 今天這次處理了 76 頁（其中 11 頁是把備援結果改用 120b 重做），失敗 0 頁（下次會再試）
- 今天用了哪幾家：groq（openai/gpt-oss-120b）成功 75 頁，已停用：groq 每日額度用盡（429）：{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01m4cpekmn；openrouter（openrouter:nvidia/nemotron-3-super-120b-a12b:free）成功 1 頁
- 備援順序（有設定金鑰的）：groq → openrouter → gemini
- 沒設定金鑰所以跳過：cerebras, mistral
- 停止原因：剩下的只有「備援模型結果待 120b 重做」，但今天 Groq 已不可用
- 目前結果：有價格的工具 260 個（全部自動上線；其中沒有任何疑點的 33 個），不對的可到 /admin「價格」區塊拒絕

結果檔案在 **price-data** 分支：report.md、price_snapshots_import.sql、price_snapshots_approve_safe.sql、price_snapshots_review_list.md。
（這些檔案不會自動上線，也不會改動網站或資料庫。）
