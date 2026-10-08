import "server-only";
import { supabaseUrl } from "./supabase-url";
import type { Tool } from "./types";

export const REVALIDATE = 86400;
export type ToolFull = Tool & { updated_at?: string | null; platforms?: string[] | null };
export type ToolLite = Pick<Tool, "id" | "name" | "category" | "description_zh" | "pricing_model"> & { updated_at?: string | null };

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
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

/** 找不到回傳 null；連線失敗丟出例外（避免把暫時性錯誤快取成 404） */
export async function getTool(id: string): Promise<ToolFull | null> {
  const rows = await rest<ToolFull[]>(`ai_tools?select=${FULL}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ?? null;
}

export async function getToolsByCategory(cat: string, limit = 200): Promise<ToolLite[]> {
  return rest<ToolLite[]>(`ai_tools?select=${LITE}&category=eq.${encodeURIComponent(cat)}&order=name.asc&limit=${limit}`);
}

/** sitemap 用；失敗時回傳 null 由呼叫端改用靜態清單 */
export async function getAllToolsLite(): Promise<ToolLite[] | null> {
  try { return await rest<ToolLite[]>(`ai_tools?select=${LITE}&order=id.asc&limit=1000`); }
  catch (e) { console.warn("getAllToolsLite fallback:", (e as Error).message); return null; }
}
