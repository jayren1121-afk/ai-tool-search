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
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'llamaindex' and fetched_at = '2026-10-17T12:10:55+08:00'::timestamptz;  -- LlamaIndex
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'paperpal' and fetched_at = '2026-10-17T12:11:02+08:00'::timestamptz;  -- Paperpal
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'plus-ai' and fetched_at = '2026-10-17T12:11:28+08:00'::timestamptz;  -- Plus AI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'research-rabbit' and fetched_at = '2026-10-19T12:12:28+08:00'::timestamptz;  -- ResearchRabbit
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'wordtune' and fetched_at = '2026-10-19T12:12:36+08:00'::timestamptz;  -- Wordtune
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'stable-audio' and fetched_at = '2026-10-20T12:11:23+08:00'::timestamptz;  -- Stable Audio
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'apollo' and fetched_at = '2026-10-20T12:11:32+08:00'::timestamptz;  -- Apollo.io
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'freed' and fetched_at = '2026-10-20T12:11:39+08:00'::timestamptz;  -- Freed
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'sourcegraph-cody' and fetched_at = '2026-10-21T12:11:41+08:00'::timestamptz;  -- Sourcegraph Amp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'gumloop' and fetched_at = '2026-10-22T12:11:03+08:00'::timestamptz;  -- Gumloop
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'visily' and fetched_at = '2026-10-24T12:10:33+08:00'::timestamptz;  -- Visily
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'krisp' and fetched_at = '2026-10-24T12:10:50+08:00'::timestamptz;  -- Krisp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'tavily' and fetched_at = '2026-10-24T12:10:59+08:00'::timestamptz;  -- Tavily
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'final-round' and fetched_at = '2026-10-24T12:11:05+08:00'::timestamptz;  -- Final Round AI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'botpress' and fetched_at = '2026-10-25T12:10:42+08:00'::timestamptz;  -- Botpress
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'soundful' and fetched_at = '2026-10-25T12:10:56+08:00'::timestamptz;  -- Soundful
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'ramp' and fetched_at = '2026-10-25T12:11:27+08:00'::timestamptz;  -- Ramp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'recraft' and fetched_at = '2026-10-26T12:13:08+08:00'::timestamptz;  -- Recraft
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'zed' and fetched_at = '2026-10-26T12:13:16+08:00'::timestamptz;  -- Zed
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'cleo' and fetched_at = '2026-10-27T12:11:58+08:00'::timestamptz;  -- Cleo
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'formula-bot' and fetched_at = '2026-10-27T12:12:00+08:00'::timestamptz;  -- Formula Bot
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'lm-studio' and fetched_at = '2026-10-27T12:12:04+08:00'::timestamptz;  -- LM Studio
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'crisp' and fetched_at = '2026-10-28T12:09:43+08:00'::timestamptz;  -- Crisp
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'sheetai' and fetched_at = '2026-10-28T12:10:21+08:00'::timestamptz;  -- SheetAI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'logoai' and fetched_at = '2026-10-29T12:09:42+08:00'::timestamptz;  -- LogoAI
update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = 'xmind-ai' and fetched_at = '2026-10-29T12:10:25+08:00'::timestamptz;  -- Xmind
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
