-- supabase_migration_005.sql — 每日自動發現新工具（待審核）、/admin 審核、「最新上架」排序（v10）
-- 需先執行 supabase_setup.sql 與 002、003、004。可重複執行（idempotent）。
-- 1) ai_tools 新增 status（published | pending | rejected）、released_at、released_source、added_at、discovery_source、discovery_url
--    既有 498 筆維持 published。
-- 2) RLS：匿名只能讀 status = 'published' 的工具；待審核／已拒絕只有伺服器（service_role）讀寫。
--    其他公開可讀的關聯表（診斷快取、投票統計、熱度、評論）也只顯示「已上架工具」的資料。
-- 3) job_runs：排程執行紀錄（只有 service_role 可讀寫）。
-- 4) released_at 索引（「最新上架」排序）。
begin;

-- ========== 1) 新欄位 ==========
alter table public.ai_tools add column if not exists status text not null default 'published';
alter table public.ai_tools add column if not exists released_at date;
alter table public.ai_tools add column if not exists released_source text;
alter table public.ai_tools add column if not exists added_at timestamptz default now();
alter table public.ai_tools add column if not exists discovery_source text;
alter table public.ai_tools add column if not exists discovery_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_tools_status_check' and conrelid = 'public.ai_tools'::regclass) then
    alter table public.ai_tools add constraint ai_tools_status_check check (status in ('published', 'pending', 'rejected'));
  end if;
end $$;

-- 既有工具：加入本站的時間以原本的 created_at 為準（只調整非自動發現的資料）
update public.ai_tools set added_at = created_at where discovery_source is null and added_at is distinct from created_at;

-- ========== 4) 索引 ==========
-- 「最新上架」排序：RLS 會自動加上 status = 'published'，因此以 status 為前綴
create index if not exists ai_tools_released_idx on public.ai_tools (status, released_at desc nulls last, name);
create index if not exists ai_tools_status_idx on public.ai_tools (status, added_at desc);

-- ========== 2) RLS：匿名只讀已上架 ==========
alter table public.ai_tools enable row level security;
drop policy if exists "ai_tools public read" on public.ai_tools;
create policy "ai_tools public read" on public.ai_tools for select to anon, authenticated using (status = 'published');

-- 關聯表：只公開「已上架工具」的資料（子查詢會套用 ai_tools 的 RLS）
drop policy if exists "diagnoses public read" on public.diagnoses;
create policy "diagnoses public read" on public.diagnoses for select to anon, authenticated
  using (exists (select 1 from public.ai_tools t where t.id = diagnoses.tool_id));

do $$
begin
  if to_regclass('public.tool_vote_stats') is not null then
    drop policy if exists "tool_vote_stats public read" on public.tool_vote_stats;
    create policy "tool_vote_stats public read" on public.tool_vote_stats for select to anon, authenticated
      using (exists (select 1 from public.ai_tools t where t.id = tool_vote_stats.tool_id));
  end if;
  if to_regclass('public.tool_stats') is not null then
    drop policy if exists "tool_stats public read" on public.tool_stats;
    create policy "tool_stats public read" on public.tool_stats for select to anon, authenticated
      using (exists (select 1 from public.ai_tools t where t.id = tool_stats.tool_id));
  end if;
  if to_regclass('public.tool_reviews') is not null then
    drop policy if exists "tool_reviews visible read" on public.tool_reviews;
    create policy "tool_reviews visible read" on public.tool_reviews for select to anon, authenticated
      using (status = 'visible' and exists (select 1 from public.ai_tools t where t.id = tool_reviews.tool_id));
  end if;
end $$;

-- ========== 3) 排程紀錄 ==========
create table if not exists public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,                       -- 'discover'（每日自動發現）、'admin_login_fail'（後台登入失敗紀錄）
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,                    -- discover：added | none | error | skipped；登入失敗：fail
  message text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists job_runs_job_idx on public.job_runs (job, started_at desc);
alter table public.job_runs enable row level security;
revoke all on table public.job_runs from anon, authenticated;
-- 不建立任何 policy：只有 service_role（伺服器）可讀寫

commit;

-- 檢查：
-- select status, count(*) from public.ai_tools group by 1;           -- 應為 published 498
-- select * from public.job_runs order by started_at desc limit 5;
