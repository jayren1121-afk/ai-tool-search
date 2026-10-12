## 價格資料更新進度（2026-10-12 14:30 台灣時間）

- 價格頁抓取：已抓 **378 / 378** 個網址（剩 0 個）
- AI 整理（需要整理的 296 頁）：**已完成 37 頁，剩 259 頁**
  - 其中用主要模型 Groq gpt-oss-120b：2 頁；用備援模型（需人工看、Groq 有額度時會自動重做）：35 頁
- 今天這次處理了 39 頁（其中 0 頁是把備援結果改用 120b 重做），失敗 2 頁（下次會再試）
- 今天用了哪幾家：groq（openai/gpt-oss-120b）成功 2 頁，已停用：groq 每日額度用盡（429）：{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01m4cpekmn；openrouter（openrouter:nvidia/nemotron-3-super-120b-a12b:free）成功 35 頁，已停用：openrouter 每日額度用盡（429）：{"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free
- 沒設定金鑰所以跳過：cerebras, mistral
- 停止原因：所有已設定的提供者今天額度都用完了（明天自動接續）
- 目前結果：可直接匯入的價格 34 個工具；其中可批次核准 0 個；其餘需人工看

結果檔案在 **price-data** 分支：report.md、price_snapshots_import.sql、price_snapshots_approve_safe.sql、price_snapshots_review_list.md。
（這些檔案不會自動上線，也不會改動網站或資料庫。）
