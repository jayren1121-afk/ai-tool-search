-- 核准「沒有任何旗標」的快照（reviewed=true）。預設不要直接執行：請先看 price_snapshots_review_list.md 並抽查幾筆。
-- 條件：v2 提示詞 + gpt-oss-120b、無價格變動>50%、無方案名稱差異、無促銷價、非共用價格頁、非美元以外幣別、所有價格數字都在證據原文內。
begin;
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'grammarly' and fetched_at = '2026-10-14T12:12:30+08:00'::timestamptz;  -- Grammarly
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'granola' and fetched_at = '2026-10-15T12:11:14+08:00'::timestamptz;  -- Granola
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'remove-bg' and fetched_at = '2026-10-15T12:11:29+08:00'::timestamptz;  -- remove.bg
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'pitch' and fetched_at = '2026-10-15T12:11:49+08:00'::timestamptz;  -- Pitch
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'n8n' and fetched_at = '2026-10-16T12:11:11+08:00'::timestamptz;  -- n8n
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'dify' and fetched_at = '2026-10-16T12:11:18+08:00'::timestamptz;  -- Dify
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'deepl' and fetched_at = '2026-10-16T12:11:20+08:00'::timestamptz;  -- DeepL
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'spline' and fetched_at = '2026-10-16T12:12:01+08:00'::timestamptz;  -- Spline
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'hedra' and fetched_at = '2026-10-12T13:29:33+08:00'::timestamptz;  -- Hedra
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'llamaindex' and fetched_at = '2026-10-12T13:29:41+08:00'::timestamptz;  -- LlamaIndex
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'plus-ai' and fetched_at = '2026-10-12T13:30:02+08:00'::timestamptz;  -- Plus AI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'stable-audio' and fetched_at = '2026-10-12T13:32:27+08:00'::timestamptz;  -- Stable Audio
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'apollo' and fetched_at = '2026-10-12T13:32:38+08:00'::timestamptz;  -- Apollo.io
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'sourcegraph-cody' and fetched_at = '2026-10-12T13:33:23+08:00'::timestamptz;  -- Sourcegraph Amp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'prezi-ai' and fetched_at = '2026-10-12T13:33:54+08:00'::timestamptz;  -- Prezi
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'gumloop' and fetched_at = '2026-10-12T13:34:22+08:00'::timestamptz;  -- Gumloop
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'undermind' and fetched_at = '2026-10-12T13:34:27+08:00'::timestamptz;  -- Undermind
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'rodin' and fetched_at = '2026-10-12T13:35:08+08:00'::timestamptz;  -- Hyper3D Rodin
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'lumen5' and fetched_at = '2026-10-12T13:35:08+08:00'::timestamptz;  -- Lumen5
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'visily' and fetched_at = '2026-10-12T13:36:14+08:00'::timestamptz;  -- Visily
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'final-round' and fetched_at = '2026-10-12T13:36:40+08:00'::timestamptz;  -- Final Round AI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'botpress' and fetched_at = '2026-10-12T13:36:56+08:00'::timestamptz;  -- Botpress
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'ramp' and fetched_at = '2026-10-12T13:37:31+08:00'::timestamptz;  -- Ramp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'recraft' and fetched_at = '2026-10-12T13:37:46+08:00'::timestamptz;  -- Recraft
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'zed' and fetched_at = '2026-10-12T13:37:52+08:00'::timestamptz;  -- Zed
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'heidi' and fetched_at = '2026-10-12T13:38:24+08:00'::timestamptz;  -- Heidi Health
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'cleo' and fetched_at = '2026-10-12T13:38:33+08:00'::timestamptz;  -- Cleo
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'lm-studio' and fetched_at = '2026-10-12T13:38:40+08:00'::timestamptz;  -- LM Studio
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'crisp' and fetched_at = '2026-10-12T13:39:36+08:00'::timestamptz;  -- Crisp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'logoai' and fetched_at = '2026-10-12T13:40:24+08:00'::timestamptz;  -- LogoAI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'quadratic' and fetched_at = '2026-10-12T13:40:54+08:00'::timestamptz;  -- Quadratic
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'autogpt' and fetched_at = '2026-10-12T13:41:24+08:00'::timestamptz;  -- AutoGPT
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'power-automate' and fetched_at = '2026-10-12T13:25:51+08:00'::timestamptz;  -- Power Automate
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'copysmith' and fetched_at = '2026-10-12T13:42:30+08:00'::timestamptz;  -- Ocoya
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'vanna' and fetched_at = '2026-10-12T13:42:30+08:00'::timestamptz;  -- Vanna AI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'factory' and fetched_at = '2026-10-12T13:43:10+08:00'::timestamptz;  -- Factory
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'cartesia' and fetched_at = '2026-10-12T13:43:14+08:00'::timestamptz;  -- Cartesia
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'shortwave' and fetched_at = '2026-10-12T13:43:16+08:00'::timestamptz;  -- Shortwave
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'gptzero' and fetched_at = '2026-10-12T13:43:24+08:00'::timestamptz;  -- GPTZero
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'augment' and fetched_at = '2026-10-12T13:43:28+08:00'::timestamptz;  -- Augment Code
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'displayr' and fetched_at = '2026-10-12T13:43:52+08:00'::timestamptz;  -- Displayr
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'hootsuite-owlywriter' and fetched_at = '2026-10-12T13:44:06+08:00'::timestamptz;  -- Hootsuite
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'mutable' and fetched_at = '2026-10-12T13:44:38+08:00'::timestamptz;  -- Pieces
commit;
