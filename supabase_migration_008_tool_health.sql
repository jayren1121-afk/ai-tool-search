-- supabase_migration_008_tool_health.sql — 官網健康檢查（v14）
-- 需先執行 supabase_migration_005.sql（需要 ai_tools.status 與 job_runs）。可重複執行（idempotent）。
-- 1) 新表 tool_health：每個工具一列，記錄官網最近一次連線檢查的結果（不用 AI，只做 HTTP 連線檢查）。
-- 2) RLS：匿名／登入訪客只能讀「對應工具為 published」的列，而且只能讀 tool_id、status、last_checked_at 三個欄位
--    （原因、轉址目的地、人工備註等內部欄位不公開）。寫入只有 service_role（伺服器）。
begin;

create table if not exists public.tool_health (
  tool_id text primary key references public.ai_tools(id) on delete cascade,
  status text not null default 'unknown' check (status in ('live', 'down', 'unknown')),
  last_checked_at timestamptz,
  last_ok_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_failure_at timestamptz,            -- 最近一次「計入連續失敗」的時間（同一天不重複計算）
  last_http_status integer,
  last_final_url text,
  detail text,                            -- 簡短原因（後台顯示）
  needs_review boolean not null default false,
  reviewed_note text,                     -- 後台人工標記時的備註
  reviewed_at timestamptz,
  review_signature text,                  -- 人工「確認正常」時的狀況簽章；同一狀況之後不再丟回清單
  check_signature text,                   -- 最近一次檢查發現的待確認狀況簽章（thin / redirect:網域 / parked:網域）
  manual_down boolean not null default false, -- 人工「確認異常」：鎖定為異常，直到自動檢查看到恢復
  snoozed_until timestamptz               -- 後台「略過」：到期前不在清單顯示（不影響前台狀態）
);

create index if not exists tool_health_checked_idx on public.tool_health (last_checked_at nulls first);
create index if not exists tool_health_review_idx on public.tool_health (needs_review, status) where needs_review or status = 'down';

alter table public.tool_health enable row level security;

-- 權限：訪客只能對三個公開欄位做 select；其餘欄位與寫入都只有 service_role
revoke all on table public.tool_health from anon, authenticated;
grant select (tool_id, status, last_checked_at) on public.tool_health to anon, authenticated;
grant all on table public.tool_health to service_role;

-- RLS：只公開「已上架工具」的列（子查詢會套用 ai_tools 的 RLS，只看得到 published）
drop policy if exists "tool_health public read" on public.tool_health;
create policy "tool_health public read" on public.tool_health for select to anon, authenticated
  using (exists (select 1 from public.ai_tools t where t.id = tool_health.tool_id));
-- 不建立 insert / update / delete 的 policy：只有 service_role（會略過 RLS）能寫入

commit;

-- 讓 Supabase API 重新載入資料表結構（新表的關聯查詢 tool_health(...) 才找得到）
notify pgrst, 'reload schema';

-- 檢查：
-- select count(*) from public.tool_health;                          -- 剛執行完是 0；排程跑過後會逐步增加
-- select status, count(*) from public.tool_health group by 1;
