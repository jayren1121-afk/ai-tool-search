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
  // 推出日期欄位需 migration 005；尚未執行（HTTP 400）時退回不含該欄位的查詢。待審核工具由 RLS 隱藏（anon 只讀得到 published）
  const rows = await withRel((rel) => withEn(locale, () => q(`${FULL}${rel},description_en,key_features_en`), () => q(`${FULL}${rel}`)));
  return rows[0] ?? null;
}
async function withRel<T>(run: (rel: string) => Promise<T>): Promise<T> {
  try { return await run(",released_at,released_source"); }
  catch (e) { if ((e as { status?: number }).status === 400) return run(""); throw e; }
}

export async function getToolsByCategory(cat: string, limit = 200, locale: Locale = "zh"): Promise<ToolLite[]> {
  const q = (cols: string) => rest<ToolLite[]>(`ai_tools?select=${cols}&category=eq.${encodeURIComponent(cat)}&order=name.asc&limit=${limit}`);
  return withEn(locale, () => q(`${LITE},description_en`), () => q(LITE));
}

/** sitemap 用；失敗時回傳 null 由呼叫端改用靜態清單 */
export async function getAllToolsLite(): Promise<ToolLite[] | null> {
  // RLS 已讓 anon 只讀得到 published；這裡再明確加上過濾（migration 005 未執行時欄位不存在 → HTTP 400 → 退回原查詢）
  try {
    try { return await rest<ToolLite[]>(`ai_tools?select=${LITE}&status=eq.published&order=id.asc&limit=1000`); }
    catch (e) { if ((e as { status?: number }).status === 400) return await rest<ToolLite[]>(`ai_tools?select=${LITE}&order=id.asc&limit=1000`); throw e; }
  }
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

/** 官網檢查／轉址提示的快取秒數：短一點，後台改了之後最慢 5 分鐘內各頁就會更新（後台儲存時另外會立刻清除工具頁與分類頁快取） */
export const HEALTH_REVALIDATE = 300;
const isClientErr = (e: unknown) => { const st = (e as { status?: number })?.status; return typeof st === "number" && st >= 400 && st < 500; };
export type ToolHealthPublic = { status: string; last_checked_at: string | null; moved_type?: string | null; moved_to?: string | null };
/** 官網連線檢查結果（v14，anon 只能讀已上架工具的 status 與 last_checked_at）；資料表不存在、沒有資料或任何錯誤一律回傳 null（頁面照常顯示，只是不顯示標籤） */
export async function getToolHealth(id: string): Promise<ToolHealthPublic | null> {
  const q = (cols: string) => rest<ToolHealthPublic[]>(`tool_health?select=${cols}&tool_id=eq.${encodeURIComponent(id)}&limit=1`, HEALTH_REVALIDATE);
  try {
    // 先嘗試含「已轉址／已改名」欄位（migration 009）；只有欄位不存在／沒有權限（HTTP 4xx）才退回舊欄位，暫時性錯誤不會悄悄丟掉轉址提示
    try { return (await q("status,last_checked_at,moved_type,moved_to"))[0] ?? null; }
    catch (e) { if (!isClientErr(e)) throw e; return (await q("status,last_checked_at"))[0] ?? null; }
  } catch { return null; }
}

type HealthEmbedRow = { id: string; tool_health?: ToolHealthPublic | ToolHealthPublic[] | null };
/** 分類頁／相關工具用：一次取得某分類（依名稱排序、前 limit 筆）所有工具的健康資料，回傳 { 工具 id: 健康資料 }。
 *  用 ai_tools 關聯嵌入查詢（單一請求、網址很短，不會有 in.() 太長的問題）；快取 5 分鐘（HEALTH_REVALIDATE），
 *  查詢條件與 getToolsByCategory 一致，所以同一個分類的工具頁與分類頁共用同一份快取。
 *  含轉址欄位的查詢失敗時退回舊欄位；仍失敗一律回傳空物件（頁面照常顯示，只是不顯示標籤）。 */
export async function getHealthByCategory(cat: string, limit = 200, revalidate = HEALTH_REVALIDATE): Promise<Record<string, ToolHealthPublic>> {
  const q = (cols: string) => rest<HealthEmbedRow[]>(`ai_tools?select=id,tool_health(${cols})&category=eq.${encodeURIComponent(cat)}&order=name.asc&limit=${limit}`, revalidate);
  const toMap = (rows: HealthEmbedRow[]) => {
    const out: Record<string, ToolHealthPublic> = {};
    for (const r of Array.isArray(rows) ? rows : []) {
      const h = Array.isArray(r.tool_health) ? r.tool_health[0] : r.tool_health;
      if (r?.id && h && typeof h === "object") out[r.id] = h;
    }
    return out;
  };
  try {
    try { return toMap(await q("status,last_checked_at,moved_type,moved_to")); }
    catch (e) { if (!isClientErr(e)) throw e; return toMap(await q("status,last_checked_at")); } // 只有欄位不存在／沒有權限（4xx）才退回舊欄位
  } catch { return {}; }
}
