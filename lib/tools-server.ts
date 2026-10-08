import "server-only";
import { supabaseUrl } from "./supabase-url";
import type { Tool } from "./types";
import type { Locale } from "./i18n";

export const REVALIDATE = 86400;
export type ToolFull = Tool & { updated_at?: string | null; platforms?: string[] | null };
export type ToolLite = Pick<Tool, "id" | "name" | "category" | "description_zh" | "pricing_model"> & { updated_at?: string | null; description_en?: string | null };

const LITE = "id,name,category,description_zh,pricing_model,updated_at";
const FULL = "id,name,url,category,subcategory,description_zh,key_features,pricing_model,free_tier,paid_plans,pricing_url,is_wrapper,underlying_models,company,country,confidence,last_verified,source_urls,platforms,updated_at";

export const supabaseConfigured = () => !!(supabaseUrl() && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim());

/** 以 PostgREST 讀取（anon key，受 RLS 保護），走 Next.js 快取；網路錯誤會丟出例外 */
async function rest<T>(query: string, revalidate = REVALIDATE): Promise<T> {
  if (!supabaseConfigured()) throw new Error("Supabase 未設定");
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const r = await fetch(`${supabaseUrl()}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    next: { revalidate, tags: ["ai_tools"] },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw Object.assign(new Error(`Supabase HTTP ${r.status}`), { status: r.status });
  return r.json() as Promise<T>;
}

/** 找不到回傳 null；連線失敗丟出例外（避免把暫時性錯誤快取成 404） */
/** 英文頁面先嘗試含英文欄位的查詢；欄位尚未建立（HTTP 400，未執行 migration 004）時退回原查詢 */
async function withEn<T>(locale: Locale, en: () => Promise<T>, base: () => Promise<T>): Promise<T> {
  if (locale !== "en") return base();
  try { return await en(); }
  catch (e) { if ((e as { status?: number }).status === 400) return base(); throw e; }
}

export async function getTool(id: string, locale: Locale = "zh"): Promise<ToolFull | null> {
  const q = (cols: string) => rest<ToolFull[]>(`ai_tools?select=${cols}&id=eq.${encodeURIComponent(id)}&limit=1`);
  const rows = await withEn(locale, () => q(`${FULL},description_en,key_features_en`), () => q(FULL));
  return rows[0] ?? null;
}

export async function getToolsByCategory(cat: string, limit = 200, locale: Locale = "zh"): Promise<ToolLite[]> {
  const q = (cols: string) => rest<ToolLite[]>(`ai_tools?select=${cols}&category=eq.${encodeURIComponent(cat)}&order=name.asc&limit=${limit}`);
  return withEn(locale, () => q(`${LITE},description_en`), () => q(LITE));
}

/** sitemap 用；失敗時回傳 null 由呼叫端改用靜態清單 */
export async function getAllToolsLite(): Promise<ToolLite[] | null> {
  try { return await rest<ToolLite[]>(`ai_tools?select=${LITE}&order=id.asc&limit=1000`); }
  catch (e) { console.warn("getAllToolsLite fallback:", (e as Error).message); return null; }
}

export type PublicStats = { tool_id: string; up: number; down: number; review_count: number; rating_avg: number | null };
/** 公開彙總統計（anon 可讀）；資料表不存在或連線失敗時回傳空物件 */
export async function getPublicStats(ids: string[], revalidate = 3600): Promise<Record<string, PublicStats>> {
  if (!ids.length) return {};
  try {
    const list = ids.map((i) => `"${i}"`).join(",");
    const rows = await rest<PublicStats[]>(`tool_vote_stats?select=tool_id,up,down,review_count,rating_avg&tool_id=in.(${encodeURIComponent(list)})`, revalidate);
    return Object.fromEntries(rows.map((r) => [r.tool_id, r]));
  } catch { return {}; }
}
