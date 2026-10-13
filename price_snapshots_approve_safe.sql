-- 核准「沒有任何旗標」的快照（reviewed=true）。預設不要直接執行：請先看 price_snapshots_review_list.md 並抽查幾筆。
-- 條件：v2 提示詞 + gpt-oss-120b、無價格變動>50%、無方案名稱差異、無促銷價、非共用價格頁、非美元以外幣別、所有價格數字都在證據原文內。
begin;
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'granola' and fetched_at = '2026-10-12T13:28:03+08:00'::timestamptz;  -- Granola
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'remove-bg' and fetched_at = '2026-10-12T13:28:10+08:00'::timestamptz;  -- remove.bg
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'pitch' and fetched_at = '2026-10-12T13:28:31+08:00'::timestamptz;  -- Pitch
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'n8n' and fetched_at = '2026-10-12T13:28:40+08:00'::timestamptz;  -- n8n
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'dify' and fetched_at = '2026-10-12T13:28:47+08:00'::timestamptz;  -- Dify
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'hedra' and fetched_at = '2026-10-12T13:29:33+08:00'::timestamptz;  -- Hedra
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'llamaindex' and fetched_at = '2026-10-12T13:29:41+08:00'::timestamptz;  -- LlamaIndex
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'plus-ai' and fetched_at = '2026-10-12T13:30:02+08:00'::timestamptz;  -- Plus AI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'stable-audio' and fetched_at = '2026-10-12T13:32:27+08:00'::timestamptz;  -- Stable Audio
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'apollo' and fetched_at = '2026-10-12T13:32:38+08:00'::timestamptz;  -- Apollo.io
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'sourcegraph-cody' and fetched_at = '2026-10-12T13:33:23+08:00'::timestamptz;  -- Sourcegraph Amp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'prezi-ai' and fetched_at = '2026-10-12T13:33:54+08:00'::timestamptz;  -- Prezi
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'gumloop' and fetched_at = '2026-10-12T13:34:22+08:00'::timestamptz;  -- Gumloop
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'undermind' and fetched_at = '2026-10-12T13:34:27+08:00'::timestamptz;  -- Undermind
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'lumen5' and fetched_at = '2026-10-12T13:35:08+08:00'::timestamptz;  -- Lumen5
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'visily' and fetched_at = '2026-10-12T13:36:14+08:00'::timestamptz;  -- Visily
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'final-round' and fetched_at = '2026-10-12T13:36:40+08:00'::timestamptz;  -- Final Round AI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'botpress' and fetched_at = '2026-10-12T13:36:56+08:00'::timestamptz;  -- Botpress
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'lm-studio' and fetched_at = '2026-10-12T13:38:40+08:00'::timestamptz;  -- LM Studio
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'power-automate' and fetched_at = '2026-10-12T13:25:51+08:00'::timestamptz;  -- Power Automate
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'hootsuite-owlywriter' and fetched_at = '2026-10-12T13:44:06+08:00'::timestamptz;  -- Hootsuite
commit;
