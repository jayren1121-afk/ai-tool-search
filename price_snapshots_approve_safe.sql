-- 核准「沒有任何旗標」的快照（reviewed=true）。預設不要直接執行：請先看 price_snapshots_review_list.md 並抽查幾筆。
-- 條件：v2 提示詞 + gpt-oss-120b、無價格變動>50%、無方案名稱差異、無促銷價、非共用價格頁、非美元以外幣別、所有價格數字都在證據原文內。
begin;
commit;
