import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TipSnapshot } from "./price-tip";
import type { SearchTool } from "./search-intent";

export type CatalogRow = SearchTool & {
  released_at?: string | null;
  released_source?: string | null;
  is_wrapper?: string | null;
  underlying_models?: string | null;
  company?: string | null;
  country?: string | null;
  confidence?: string | null;
  last_verified?: string | null;
  source_urls?: string[];
  key_features: string[];
  paid_plans: { name: string; price_usd_month: number | null; notes: string | null }[];
  tool_vote_stats?: { up: number; down: number; score: number } | { up: number; down: number; score: number }[] | null;
  tool_health?: { status: string; last_checked_at: string | null; moved_type?: string | null; moved_to?: string | null } | { status: string; last_checked_at: string | null; moved_type?: string | null; moved_to?: string | null }[] | null;
};

const BASE = "id,name,url,category,subcategory,description_zh,key_features,pricing_model,free_tier,paid_plans,pricing_url,is_wrapper,underlying_models,company,country,confidence,last_verified,source_urls,tags";
const TTL = 5 * 60 * 1000;

let cache: { at: number; rows: CatalogRow[]; snaps: Map<string, TipSnapshot> } | null = null;

const env = (k: string) => (process.env[k] || "").trim();

async function rest(query: string): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const base = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!base || !key) return { ok: false, message: "supabase-unconfigured" };
  const r = await fetch(`${base}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return { ok: false, message: await r.text() };
  return { ok: true, data: await r.json() };
}

async function selectTools(): Promise<CatalogRow[]> {
  const extras = [
    { key: "en", col: ",description_en,key_features_en" },
    { key: "rel", col: ",released_at,released_source" },
    { key: "health", col: ",tool_health(status,last_checked_at,moved_type,moved_to)" },
    { key: "votes", col: ",tool_vote_stats(up,down,score)" },
  ];
  const on = new Set(extras.map((e) => e.key));
  let status = true;
  let last = "catalog";
  for (let i = 0; i < 8; i++) {
    const cols = BASE + extras.filter((e) => on.has(e.key)).map((e) => e.col).join("");
    const filter = status ? "&status=eq.published" : "";
    const res = await rest(`ai_tools?select=${cols}${filter}&limit=1000`);
    if (res.ok) return (res.data as CatalogRow[]) || [];
    last = res.message;
    if (res.message === "supabase-unconfigured") throw new Error("supabase-unconfigured");
    if (status && /status/.test(res.message)) { status = false; continue; }
    if (on.has("rel") && /released/.test(res.message)) { on.delete("rel"); continue; }
    if (on.has("health") && /tool_health|moved_/.test(res.message)) { on.delete("health"); continue; }
    if (on.has("en") && /description_en|key_features_en/.test(res.message)) { on.delete("en"); continue; }
    if (on.has("votes") && /tool_vote|vote/.test(res.message)) { on.delete("votes"); continue; }
    if (on.has("en") || on.has("rel") || on.has("health") || on.has("votes") || status) {
      // 未知錯誤時先拿掉選填欄位再試一次
      if (on.size) { on.clear(); continue; }
      if (status) { status = false; continue; }
    }
    break;
  }
  throw new Error(last.slice(0, 240));
}

async function selectSnaps(): Promise<Map<string, TipSnapshot>> {
  const map = new Map<string, TipSnapshot>();
  const res = await rest("price_snapshots?select=tool_id,plans,free_tier,source_url,fetched_at&reviewed=eq.true&status=eq.ok&order=fetched_at.desc&limit=1000");
  if (!res.ok) return map;
  for (const row of res.data as { tool_id?: string; plans?: TipSnapshot["plans"]; free_tier?: TipSnapshot["free_tier"]; source_url?: string; fetched_at?: string }[]) {
    if (!row.tool_id || map.has(row.tool_id)) continue;
    map.set(row.tool_id, { plans: row.plans, free_tier: row.free_tier, source_url: row.source_url, fetched_at: row.fetched_at });
  }
  return map;
}

async function fileCatalog(): Promise<CatalogRow[]> {
  const raw = await readFile(path.join(process.cwd(), "price-scraper/ai_tools.json"), "utf8");
  const rows = JSON.parse(raw) as Record<string, unknown>[];
  return rows.map((t) => ({
    id: String(t.id || ""),
    name: String(t.name || ""),
    url: String(t.url || ""),
    category: String(t.category || ""),
    subcategory: (t.subcategory as string | null) ?? null,
    description_zh: (t.description_zh as string | null) ?? null,
    description_en: (t.description_en as string | null) ?? null,
    key_features: Array.isArray(t.key_features) ? t.key_features as string[] : [],
    key_features_en: Array.isArray(t.key_features_en) ? t.key_features_en as string[] : [],
    tags: Array.isArray(t.tags) ? t.tags as string[] : [],
    pricing_model: (t.pricing_model as string | null) ?? null,
    free_tier: (t.free_tier as string | null) ?? null,
    paid_plans: Array.isArray(t.paid_plans) ? t.paid_plans as CatalogRow["paid_plans"] : [],
    pricing_url: (t.pricing_url as string | null) ?? null,
    is_wrapper: t.is_wrapper == null ? null : String(t.is_wrapper),
    underlying_models: (t.underlying_models as string | null) ?? null,
    company: (t.company as string | null) ?? null,
    country: (t.country as string | null) ?? null,
    confidence: (t.confidence as string | null) ?? null,
    last_verified: (t.last_verified as string | null) ?? null,
    source_urls: Array.isArray(t.source_urls) ? t.source_urls as string[] : [],
  }));
}

/** 已上架工具與已核准價格快照。沒有 Supabase 的本機開發才改讀目錄檔，正式環境不走這條。 */
export async function loadSearchCatalog(): Promise<{ rows: CatalogRow[]; snaps: Map<string, TipSnapshot> }> {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const configured = !!(env("NEXT_PUBLIC_SUPABASE_URL") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw new Error("supabase-unconfigured");
    const rows = await fileCatalog();
    cache = { at: Date.now(), rows, snaps: new Map() };
    return cache;
  }
  const [rows, snaps] = await Promise.all([selectTools(), selectSnaps()]);
  cache = { at: Date.now(), rows, snaps };
  return cache;
}
