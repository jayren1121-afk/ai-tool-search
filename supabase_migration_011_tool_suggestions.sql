-- supabase_migration_011_tool_suggestions.sql — 站外搜尋結果「建議給管理員」（第三階段）
-- 不依賴 008／009／010。可重複執行（idempotent）。
-- 請在 Supabase → SQL Editor 整份貼上並執行。執行完到 Vercel 重新部署（若環境變數沒改，不必改鑰匙）。
--
-- 這張表只給伺服器（service role）讀寫：
--   * 匿名與登入訪客沒有任何權限，也沒有 RLS policy，所以不能讀、不能直接插入。
--   * 瀏覽器的「+」只打到本站 /api/suggestions，由伺服器驗過簽章後才寫入。
-- 核准（approved）在這一階段只改狀態並留下備註，不會新增 ai_tools。自動加入目錄是第四階段。
begin;

create table if not exists public.tool_suggestions (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null,
  query text not null,
  sub_need text,
  domain_key text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submit_count integer not null default 1 check (submit_count >= 1),
  ip_hash text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同一個網域同時只能有一筆待審核。重複建議時由伺服器把 submit_count 加一，不另開一列。
create unique index if not exists tool_suggestions_pending_domain_idx
  on public.tool_suggestions (domain_key) where status = 'pending';
create index if not exists tool_suggestions_pending_updated_idx
  on public.tool_suggestions (updated_at desc) where status = 'pending';

alter table public.tool_suggestions enable row level security;
revoke all on table public.tool_suggestions from anon, authenticated;
grant all on table public.tool_suggestions to service_role;
-- 不建立任何 policy：anon / authenticated 無法讀寫；service_role 會略過 RLS。

commit;

notify pgrst, 'reload schema';

-- 檢查：
-- select status, count(*) from public.tool_suggestions group by 1;
-- 以 anon key 查這張表應失敗（permission denied 或 0 列且無法寫入）。
