import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { firstTime } from "./security";
import { distinctHost } from "./textutil";
import type { AltRow, Heat, HeatPart, Review, VoteStats } from "./types";

const env = (k: string) => (process.env[k] || "").trim();
const db = () => supabaseAdmin();
const DAY = 86400_000;

export async function getStats(toolId: string): Promise<VoteStats | null> {
  const { data, error } = await db().from("tool_vote_stats").select("tool_id,up,down,score,review_count,rating_avg").eq("tool_id", toolId).maybeSingle();
  if (error) throw error;
  return (data as VoteStats) ?? { tool_id: toolId, up: 0, down: 0, score: 0, review_count: 0, rating_avg: null };
}
export async function getStatsMany(ids: string[]): Promise<Record<string, VoteStats>> {
  if (!ids.length) return {};
  const { data, error } = await db().from("tool_vote_stats").select("tool_id,up,down,score,review_count,rating_avg").in("tool_id", ids);
  if (error) throw error;
  return Object.fromEntries((data as VoteStats[]).map((s) => [s.tool_id, s]));
}
export async function getMyVotes(ids: string[], voter: string | null): Promise<Record<string, number>> {
  if (!voter || !ids.length) return {};
  const { data } = await db().from("tool_votes").select("tool_id,vote").eq("voter_hash", voter).in("tool_id", ids);
  return Object.fromEntries((data ?? []).map((r: { tool_id: string; vote: number }) => [r.tool_id, r.vote]));
}

export async function getReviews(toolId: string, sort: "new" | "helpful", voter: string | null, limit = 20): Promise<Review[]> {
  let q = db().from("tool_reviews").select("id,rating,content,use_case,helpful_count,created_at,updated_at,voter_hash").eq("tool_id", toolId).eq("status", "visible");
  q = sort === "helpful" ? q.order("helpful_count", { ascending: false }).order("created_at", { ascending: false }) : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as (Review & { voter_hash: string })[];
  let helped = new Set<number>();
  if (voter && rows.length) {
    const { data: h } = await db().from("review_helpful").select("review_id").eq("voter_hash", voter).in("review_id", rows.map((r) => r.id));
    helped = new Set((h ?? []).map((x: { review_id: number }) => x.review_id));
  }
  return rows.map(({ voter_hash, ...r }) => ({ ...r, mine: !!voter && voter_hash === voter, helped: helped.has(r.id) }));
}
export async function getMyReview(toolId: string, voter: string | null) {
  if (!voter) return null;
  const { data } = await db().from("tool_reviews").select("rating,content,use_case").eq("tool_id", toolId).eq("voter_hash", voter).maybeSingle();
  return data ?? null;
}

/* ---------- 替代方案 ---------- */
type AltSrc = { id: string; name: string; category: string; subcategory: string | null; tags: string[] | null; pricing_model: string | null; free_tier: string | null; is_wrapper: string | null; underlying_models: string | null; paid_plans: { price_usd_month: number | null; notes: string | null }[] | null; confidence: string | null };
const trustedMin = (t: AltSrc) => {
  if (t.confidence !== "high" && t.confidence !== "medium") return null;
  const p = (t.paid_plans || []).filter((x) => typeof x.price_usd_month === "number" && x.price_usd_month > 0 && !/需人工確認|未於官網即時確認/.test(x.notes ?? "")).map((x) => x.price_usd_month as number);
  return p.length ? Math.min(...p) : null;
};
export async function pickAlternatives(toolId: string, n = 3): Promise<{ self: AltRow | null; alts: AltRow[] }> {
  const cols = "id,name,category,subcategory,tags,pricing_model,free_tier,is_wrapper,underlying_models,paid_plans,confidence";
  const { data: me } = await db().from("ai_tools").select(cols).eq("id", toolId).maybeSingle();
  if (!me) return { self: null, alts: [] };
  const { data: same } = await db().from("ai_tools").select(cols).eq("category", (me as AltSrc).category).neq("id", toolId).limit(200);
  const list = (same ?? []) as AltSrc[];
  let stats: Record<string, VoteStats> = {};
  try { stats = await getStatsMany([toolId, ...list.map((t) => t.id)]); } catch { /* 003 未執行時略過 */ }
  const m = me as AltSrc; const myTags = new Set((m.tags || []).filter((t) => t !== m.category));
  const scored = list.map((t) => {
    const s = stats[t.id];
    let score = 0;
    if (m.subcategory && t.subcategory === m.subcategory) score += 3;
    score += (t.tags || []).filter((x) => myTags.has(x)).length;
    score += (s?.score ?? 0) * 3 + Math.min(1, ((s?.up ?? 0) + (s?.down ?? 0)) / 50);
    if (t.confidence === "high") score += 0.5; else if (t.confidence === "medium") score += 0.25;
    return { t, score };
  }).sort((a, b) => b.score - a.score).slice(0, n);
  const row = (t: AltSrc): AltRow => ({ id: t.id, name: t.name, subcategory: t.subcategory, pricing_model: t.pricing_model, free_tier: t.free_tier, is_wrapper: t.is_wrapper, underlying_models: t.underlying_models, min_price: trustedMin(t), up: stats[t.id]?.up ?? 0, down: stats[t.id]?.down ?? 0 });
  return { self: row(m), alts: scored.map((x) => row(x.t)) };
}

/* ---------- 熱度 ---------- */
const GH_SKIP = new Set(["features", "sponsors", "login", "about", "orgs", "topics", "marketplace", "enterprise", "pricing", "apps", "settings", "collections", "site", "security", "customer-stories", "readme", "join", "contact", "team", "pulls", "issues", "explore", "github", "new", "solutions", "resources", "signup", "trending"]);
export function detectGithubRepo(url: string, html: string): string | null {
  const counts = new Map<string, number>();
  const add = (o: string, r: string) => {
    r = r.replace(/\.git$/, "").replace(/[).,"'#?].*$/, "");
    if (!o || !r || GH_SKIP.has(o.toLowerCase()) || r.length > 100) return;
    const k = `${o}/${r}`; counts.set(k, (counts.get(k) || 0) + 1);
  };
  const direct = url.match(/^https?:\/\/github\.com\/([\w-]+)\/([\w.-]+)/i);
  if (direct && !GH_SKIP.has(direct[1].toLowerCase())) return `${direct[1]}/${direct[2].replace(/\.git$/, "")}`;
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?github\.com\/([\w-]+)\/([\w.-]+)/gi)) add(m[1], m[2]);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
async function githubStars(repo: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "jAytal-ai-tool-search", ...(env("GITHUB_TOKEN") ? { Authorization: `Bearer ${env("GITHUB_TOKEN")}` } : {}) },
      signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.stargazers_count === "number" ? j.stargazers_count : null;
  } catch { return null; }
}
async function hnCount(url: string): Promise<number | null> {
  const host = distinctHost(url); if (!host) return null;
  try {
    const since = Math.floor(Date.now() / 1000) - 90 * 86400;
    const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`"${host}"`)}&tags=(story,comment)&numericFilters=created_at_i>${since}&hitsPerPage=0`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    const j = await r.json(); return typeof j.nbHits === "number" ? j.nbHits : null;
  } catch { return null; }
}
const lg = (x: number | null) => Math.log10(1 + Math.max(0, x ?? 0));

export async function getHeat(toolId: string): Promise<Heat | null> {
  const { data, error } = await db().from("tool_stats").select("heat_score,breakdown,github_repo,github_stars,hn_mentions_90d,views_30d,diagnoses_30d,refreshed_at").eq("tool_id", toolId).maybeSingle();
  if (error) throw error;
  return (data as Heat) ?? null;
}

/** 以真實資料計算熱度；每個工具每天最多刷新一次 */
export async function refreshHeat(tool: { id: string; url: string }, opts: { html?: string; hnMentions?: number | null } = {}): Promise<Heat | null> {
  const cur = await getHeat(tool.id).catch(() => undefined);
  if (cur === undefined) return null; // 資料表不存在
  if (cur && Date.now() - new Date(cur.refreshed_at).getTime() < DAY) return cur;
  if (!(await firstTime(`heat:${tool.id}:${new Date().toISOString().slice(0, 10)}`, 86400 + 600))) return cur;

  const since30 = new Date(Date.now() - 30 * DAY);
  const [views, diags, stats] = await Promise.all([
    db().from("tool_views").select("views").eq("tool_id", tool.id).gte("day", since30.toISOString().slice(0, 10)),
    db().from("diagnoses").select("id", { count: "exact", head: true }).eq("tool_id", tool.id).gte("created_at", since30.toISOString()),
    getStats(tool.id).catch(() => null),
  ]);
  const views30 = views.error ? null : (views.data ?? []).reduce((a: number, r: { views: number }) => a + r.views, 0);
  const diag30 = diags.error ? null : diags.count ?? 0;
  let html = opts.html;
  if (html === undefined) {
    try { const r = await fetch(tool.url, { headers: { "User-Agent": "Mozilla/5.0 AIToolSearchBot" }, signal: AbortSignal.timeout(8000) }); html = r.ok ? (await r.text()).slice(0, 800_000) : ""; } catch { html = ""; }
  }
  const repo = detectGithubRepo(tool.url, html || "");
  const [stars, hn] = await Promise.all([repo ? githubStars(repo) : Promise.resolve(null), opts.hnMentions !== undefined ? Promise.resolve(opts.hnMentions) : hnCount(tool.url)]);
  const votes = stats ? stats.up + stats.down : null;
  const parts: HeatPart[] = [
    { label: "站內瀏覽（30 天）", value: views30, points: Math.round(lg(views30) * 10) },
    { label: "站內投票數", value: votes, points: Math.round(lg(votes) * 15) },
    { label: "站內評論數", value: stats?.review_count ?? null, points: Math.round(lg(stats?.review_count ?? null) * 10) },
    { label: "AI 診斷次數（30 天）", value: diag30, points: Math.round(lg(diag30) * 8) },
    { label: "Hacker News 提及（90 天，以官網網域比對）", value: hn, points: Math.round(lg(hn) * 15), ...(distinctHost(tool.url) ? {} : { note: "官網為共用網域，無法比對" }) },
    { label: "GitHub Stars", value: stars, points: Math.round(lg(stars) * 8), note: repo ? `自動偵測：${repo}` : html ? "官網未發現 GitHub 專案" : "無法讀取官網，未偵測 GitHub 專案" },
  ];
  const score = Math.min(100, parts.reduce((a, p) => a + p.points, 0));
  const row = { tool_id: tool.id, heat_score: score, breakdown: { parts }, github_repo: repo, github_stars: stars, hn_mentions_90d: hn, views_30d: views30, diagnoses_30d: diag30, refreshed_at: new Date().toISOString() };
  const { error } = await db().from("tool_stats").upsert(row);
  if (error) { console.error("tool_stats upsert", error); return null; }
  const { tool_id: _t, ...heat } = row;
  return heat as Heat;
}
