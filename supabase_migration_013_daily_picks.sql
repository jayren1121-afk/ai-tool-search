-- supabase_migration_013_daily_picks.sql — 每日推薦（Daily picks）
-- 可重複執行。請在 Supabase → SQL Editor 整份貼上並執行。
-- 公開（anon/authenticated）只能 SELECT status = 'approved' 的列；寫入只經伺服器 service role。
begin;

create table if not exists public.daily_picks (
  id uuid primary key default gen_random_uuid(),
  pick_date date not null,
  tool_id text not null references public.ai_tools(id) on delete cascade,
  category text not null,
  pros_zh text not null default '',
  cons_zh text not null default '',
  pros_en text not null default '',
  cons_en text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (pick_date, tool_id)
);
create index if not exists daily_picks_date_status on public.daily_picks (pick_date, status);
-- 同一天已核准的兩筆不可同分類
create unique index if not exists daily_picks_one_approved_per_cat on public.daily_picks (pick_date, category) where status = 'approved';

alter table public.daily_picks enable row level security;
revoke all on public.daily_picks from anon, authenticated, public;
grant select on public.daily_picks to anon, authenticated;
grant all on public.daily_picks to service_role;

drop policy if exists "daily_picks public read approved" on public.daily_picks;
create policy "daily_picks public read approved" on public.daily_picks
  for select to anon, authenticated using (status = 'approved');

commit;
