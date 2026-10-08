-- 002：使用者錯誤回報表（可重複執行）
-- 只允許伺服器端以 service role 寫入／讀取；不建立任何公開 policy。
begin;

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  tool_id text not null references public.ai_tools(id) on delete cascade,
  diagnosis_id bigint references public.diagnoses(id) on delete set null,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now(),
  ip_hash text
);

create index if not exists reports_tool_idx on public.reports (tool_id, created_at desc);
create index if not exists reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;
-- 確保匿名／登入角色無任何直接權限（service role 會略過 RLS）
revoke all on table public.reports from anon, authenticated;

commit;
