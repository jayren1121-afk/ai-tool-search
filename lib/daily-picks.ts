import "server-only";
import { supabaseUrl } from "./supabase-url";

export const DAILY_PICKS_TAG = "daily_picks";
export type DailyPick = {
  id: string; pick_date: string; tool_id: string; category: string;
  pros_zh: string; cons_zh: string; pros_en: string; cons_en: string;
  status: "draft" | "approved" | "rejected"; created_at: string; approved_at: string | null;
  ai_tools?: { name: string } | null;
};

/** 台灣日期 YYYY-MM-DD */
export const taipeiDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const validPickDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().startsWith(s);
export const clean = (v: unknown, max = 400) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");

/** 首頁用：今天（台灣）已核准的推薦（anon key，RLS 只回傳 approved）。失敗時回傳空陣列 */
export async function getTodayPicks(): Promise<DailyPick[]> {
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl() || !key) return [];
  try {
    const q = `daily_picks?select=id,pick_date,tool_id,category,pros_zh,cons_zh,pros_en,cons_en,status,created_at,approved_at,ai_tools(name)&pick_date=eq.${taipeiDate()}&status=eq.approved&order=approved_at.asc&limit=2`;
    const r = await fetch(`${supabaseUrl()}/rest/v1/${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      next: { revalidate: 300, tags: [DAILY_PICKS_TAG] }, signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    return (await r.json()) as DailyPick[];
  } catch { return []; }
}
