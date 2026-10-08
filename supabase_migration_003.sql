-- 003：讚/倒讚、瀏覽數、熱度、使用者評論（可重複執行）
-- 所有寫入只透過伺服器端 service role；公開只可讀取彙總統計與「可見」評論的安全欄位。
begin;

-- ========== 讚 / 倒讚 ==========
create table if not exists public.tool_votes (
  id bigint generated always as identity primary key,
  tool_id text not null references public.ai_tools(id) on delete cascade,
  voter_hash text not null,
  ip_hash text,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tool_id, voter_hash)
);
create index if not exists tool_votes_tool_ip_idx on public.tool_votes (tool_id, ip_hash);

-- 彙總表（讚、倒讚、Wilson 好評分數、評論數、平均星等），由觸發器維護，公開可讀
create table if not exists public.tool_vote_stats (
  tool_id text primary key references public.ai_tools(id) on delete cascade,
  up integer not null default 0,
  down integer not null default 0,
  score double precision not null default 0,   -- Wilson 下界（0–1），用於「好評優先」排序
  review_count integer not null default 0,
  rating_avg numeric(3,2),
  updated_at timestamptz not null default now()
);
create index if not exists tool_vote_stats_score_idx on public.tool_vote_stats (score desc);

-- ========== 每日瀏覽數 ==========
create table if not exists public.tool_views (
  tool_id text not null references public.ai_tools(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  views integer not null default 0,
  primary key (tool_id, day)
);

-- ========== 熱度快取 ==========
create table if not exists public.tool_stats (
  tool_id text primary key references public.ai_tools(id) on delete cascade,
  heat_score integer,
  breakdown jsonb not null default '{}'::jsonb,
  github_repo text,
  github_stars integer,
  hn_mentions_90d integer,
  views_30d integer,
  diagnoses_30d integer,
  refreshed_at timestamptz not null default now()
);

-- ========== 使用者評論 ==========
create table if not exists public.tool_reviews (
  id bigint generated always as identity primary key,
  tool_id text not null references public.ai_tools(id) on delete cascade,
  voter_hash text not null,
  ip_hash text,
  rating smallint not null check (rating between 1 and 5),
  content text not null check (char_length(content) between 10 and 500),
  use_case text check (use_case is null or char_length(use_case) <= 100),
  helpful_count integer not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tool_id, voter_hash)
);
create index if not exists tool_reviews_tool_idx on public.tool_reviews (tool_id, status, created_at desc);

create table if not exists public.review_helpful (
  review_id bigint not null references public.tool_reviews(id) on delete cascade,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  primary key (review_id, voter_hash)
);

-- ========== 觸發器：維護彙總 ==========
create or replace function public.refresh_tool_vote_stats(p_tool text)
returns void language plpgsql security definer set search_path = public as $$
declare u int; d int; n int; p float8; z float8 := 1.96; s float8; rc int; ra numeric;
begin
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1) into u, d from tool_votes where tool_id = p_tool;
  n := u + d;
  if n = 0 then s := 0; else
    p := u::float8 / n;
    s := (p + z*z/(2*n) - z*sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n);
  end if;
  select count(*), round(avg(rating)::numeric, 2) into rc, ra from tool_reviews where tool_id = p_tool and status = 'visible';
  insert into tool_vote_stats (tool_id, up, down, score, review_count, rating_avg, updated_at)
  values (p_tool, u, d, s, rc, ra, now())
  on conflict (tool_id) do update set up = excluded.up, down = excluded.down, score = excluded.score,
    review_count = excluded.review_count, rating_avg = excluded.rating_avg, updated_at = now();
end $$;

create or replace function public.trg_refresh_tool_vote_stats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform refresh_tool_vote_stats(old.tool_id); return old; end if;
  perform refresh_tool_vote_stats(new.tool_id);
  if tg_op = 'UPDATE' and old.tool_id <> new.tool_id then perform refresh_tool_vote_stats(old.tool_id); end if;
  return new;
end $$;

drop trigger if exists tool_votes_stats on public.tool_votes;
create trigger tool_votes_stats after insert or update or delete on public.tool_votes
  for each row execute function public.trg_refresh_tool_vote_stats();
drop trigger if exists tool_reviews_stats on public.tool_reviews;
create trigger tool_reviews_stats after insert or update of rating, status, tool_id or delete on public.tool_reviews
  for each row execute function public.trg_refresh_tool_vote_stats();

create or replace function public.trg_review_helpful_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid bigint := coalesce(new.review_id, old.review_id);
begin
  update tool_reviews set helpful_count = (select count(*) from review_helpful where review_id = rid) where id = rid;
  return coalesce(new, old);
end $$;
drop trigger if exists review_helpful_count on public.review_helpful;
create trigger review_helpful_count after insert or delete on public.review_helpful
  for each row execute function public.trg_review_helpful_count();

-- 瀏覽數 +1（只給 service role 呼叫）
create or replace function public.increment_tool_view(p_tool text)
returns void language sql security definer set search_path = public as $$
  insert into tool_views (tool_id, day, views) values (p_tool, (now() at time zone 'utc')::date, 1)
  on conflict (tool_id, day) do update set views = tool_views.views + 1;
$$;

-- 觸發器函式不需直接呼叫權限
revoke all on function public.refresh_tool_vote_stats(text) from public, anon, authenticated;
revoke all on function public.trg_refresh_tool_vote_stats() from public, anon, authenticated;
revoke all on function public.trg_review_helpful_count() from public, anon, authenticated;
revoke all on function public.increment_tool_view(text) from public, anon, authenticated;
do $$ begin
  if exists (select from pg_roles where rolname = 'service_role') then
    grant execute on function public.increment_tool_view(text) to service_role;
  end if;
end $$;

-- ========== RLS 與權限 ==========
alter table public.tool_votes enable row level security;
alter table public.tool_vote_stats enable row level security;
alter table public.tool_views enable row level security;
alter table public.tool_stats enable row level security;
alter table public.tool_reviews enable row level security;
alter table public.review_helpful enable row level security;

revoke all on table public.tool_votes, public.tool_views, public.review_helpful, public.tool_reviews,
  public.tool_vote_stats, public.tool_stats from anon, authenticated;

-- 公開可讀：彙總統計、熱度
grant select on public.tool_vote_stats, public.tool_stats to anon, authenticated;
drop policy if exists "tool_vote_stats public read" on public.tool_vote_stats;
create policy "tool_vote_stats public read" on public.tool_vote_stats for select to anon, authenticated using (true);
drop policy if exists "tool_stats public read" on public.tool_stats;
create policy "tool_stats public read" on public.tool_stats for select to anon, authenticated using (true);

-- 公開可讀：可見評論的安全欄位（不含 voter_hash / ip_hash）
grant select (id, tool_id, rating, content, use_case, helpful_count, created_at, updated_at) on public.tool_reviews to anon, authenticated;
drop policy if exists "tool_reviews visible read" on public.tool_reviews;
create policy "tool_reviews visible read" on public.tool_reviews for select to anon, authenticated using (status = 'visible');

-- 讓既有工具也有一筆彙總（0 票），方便排序
insert into public.tool_vote_stats (tool_id) select id from public.ai_tools on conflict do nothing;

commit;
