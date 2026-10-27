-- supabase_migration_011_tool_suggestions.sql — 站外搜尋結果「建議給管理員」（第三階段）
-- 不依賴 008／009／010。可重複執行（idempotent）。
-- 請在 Supabase → SQL Editor 整份貼上並執行。執行完到 Vercel 重新部署（若環境變數沒改，不必改鑰匙）。
--
-- 這張表只給伺服器（service role）讀寫：
--   * 匿名與登入訪客沒有任何 GRANT，也沒有 RLS policy，所以不能讀、不能直接插入。
--   * 瀏覽器的「+」只打到本站 /api/suggestions，由伺服器驗過簽章後才寫入。
-- 核准（approved）在這一階段只改狀態並留下備註，不會新增 ai_tools。自動加入目錄是第四階段。
--
-- 2026-10-30 起，Supabase 不再自動把 public 新表 GRANT 給 anon／authenticated／service_role。
-- 這份 SQL 兩種專案都適用：
--   * 變更前：建表會自動授權給三個角色（含 truncate／references／trigger，Postgres 17 還有 maintain）。
--     下面先 REVOKE 掉 anon、authenticated 與 PUBLIC，再明確 GRANT 給 service_role。
--   * 變更後：建表不會自動授權。同一段 GRANT 讓 Data API 的 service_role 仍然能讀寫。
-- 不要另外 GRANT 給 anon 或 authenticated。
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

-- 權限放在交易最後，蓋過建表當下的預設授權。不建立任何 policy。
revoke all privileges on table public.tool_suggestions from public, anon, authenticated;
grant all privileges on table public.tool_suggestions to service_role;

commit;

notify pgrst, 'reload schema';

-- 檢查：
-- select status, count(*) from public.tool_suggestions group by 1;
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'tool_suggestions'
-- order by grantee, privilege_type;
-- 應只有 service_role（以及表格擁有者）。不應出現 anon 或 authenticated。
-- 以 anon key 呼叫 /rest/v1/tool_suggestions 應是 401／403 或 42501 permission denied。
