-- supabase_migration_012_suggestion_publish.sql — 核准建議時寫入目錄（第四階段）
-- 需先執行 supabase_migration_011_tool_suggestions.sql。可重複執行（idempotent）。
-- 請在 Supabase → SQL Editor 整份貼上並執行。
--
-- tool_id：核准後新目錄列的 id。draft：寫入前給管理員看的草稿。
-- 沒有這兩欄時，伺服器仍可把錯誤寫進既有的 note，但無法暫存草稿。
--
-- 2026-10-30 起，public 新表不會自動 GRANT。這張表是 011 建的，這裡再明確授權一次，
-- 變更前與變更後都適用：anon／authenticated／PUBLIC 沒有權限，service_role 有全部權限。
-- 不要另外 GRANT 給 anon 或 authenticated。沒有任何 RLS policy。
begin;

alter table public.tool_suggestions add column if not exists tool_id text;
alter table public.tool_suggestions add column if not exists draft jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tool_suggestions_tool_id_fkey') then
    alter table public.tool_suggestions
      add constraint tool_suggestions_tool_id_fkey
      foreign key (tool_id) references public.ai_tools(id) on delete set null;
  end if;
end $$;

revoke all privileges on table public.tool_suggestions from public, anon, authenticated;
grant all privileges on table public.tool_suggestions to service_role;

commit;

notify pgrst, 'reload schema';

-- 檢查：
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'tool_suggestions' and column_name in ('tool_id', 'draft');
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'tool_suggestions' order by 1, 2;
-- 應有 service_role。不應有 anon 或 authenticated。
