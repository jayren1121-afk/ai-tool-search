import "server-only";
import { supabaseUrl } from "./supabase-url";
import type { Locale } from "./i18n";

/** price_snapshots（migration 007）一個方案；所有數字都來自官網價格頁原文，找不到為 null */
export type SnapPlan = {
  name: string | null;
  price_monthly: number | null;
  price_yearly_per_month: number | null;
  price_yearly_total: number | null;
  price_unclear?: number | null; // 確定是訂閱價但看不出月付或年付
  list_price?: number | null; // 劃掉的原價
  list_price_unit?: "month" | "year" | null;
  billing_note: string | null;
  currency: string | null;
  is_promo: boolean;
  regular_price_monthly?: number | null; // 舊欄位（v1），新資料用 list_price
  evidence_quote: string;
};
export type SnapFree = { available: boolean | null; limits: string | null; evidence_quote: string | null } | null;
export type PriceSnapshot = {
  tool_id: string;
  plans: SnapPlan[];
  free_tier: SnapFree;
  price_summary: string | null;
  display_region_note: string | null;
  source_url: string;
  fetched_at: string;
  evidence: { evidence_quote: string; source_url: string; fetched_at: string }[];
};

const COLS = "tool_id,plans,free_tier,price_summary,display_region_note,source_url,fetched_at,evidence";

/** 只取 http(s) 連結，避免資料庫裡被塞入 javascript: 之類的網址 */
export const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);

/** 轉成 YYYY-MM-DD（以 UTC+8 顯示，與網站其他日期一致） */
export function snapDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
}

/**
 * 以 anon key 讀取最新一筆「已核准」快照（RLS 保證只有 reviewed=true 且工具已上架才讀得到）。
 * migration 007/010 尚未執行、網路錯誤、沒有資料：一律回傳 null（頁面顯示原本內容）。
 */
export async function getPriceSnapshot(toolId: string, _locale: Locale = "zh"): Promise<PriceSnapshot | null> {
  void _locale;
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const base = supabaseUrl();
  if (!key || !base) return null;
  try {
    const r = await fetch(
      `${base}/rest/v1/price_snapshots?select=${COLS}&tool_id=eq.${encodeURIComponent(toolId)}&reviewed=eq.true&status=eq.ok&order=fetched_at.desc&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, next: { revalidate: 3600, tags: ["price_snapshots"] }, signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as PriceSnapshot[];
    const s = rows[0];
    if (!s || !Array.isArray(s.plans) || !safeUrl(s.source_url)) return null;
    return s;
  } catch { return null; }
}

/** 診斷用（伺服器端，service_role）：同樣只回傳 reviewed=true 的快照 */
export async function getReviewedSnapshotAdmin(db: { from: (t: string) => any }, toolId: string): Promise<PriceSnapshot | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const { data, error } = await db.from("price_snapshots").select(COLS).eq("tool_id", toolId).eq("reviewed", true).eq("status", "ok").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data || !Array.isArray(data.plans) || !safeUrl(data.source_url)) return null;
    return data as PriceSnapshot;
  } catch { return null; }
}

const fmt = (n: number | null, cur: string | null) => (n == null ? null : `${cur === "USD" || !cur ? "$" : cur + " "}${n}`);

/** 提供給 AI 的快照文字。quote 為官網原文，會一併加入證據比對的文字範圍 */
export function snapshotForPrompt(s: PriceSnapshot): string {
  const lines = [`SOURCE_URL: ${s.source_url}`, `FETCHED_AT: ${snapDate(s.fetched_at)}`];
  for (const p of s.plans.slice(0, 10)) {
    const parts = [
      fmt(p.price_monthly, p.currency) && `monthly ${fmt(p.price_monthly, p.currency)}`,
      fmt(p.price_yearly_per_month, p.currency) && `yearly-billed per month ${fmt(p.price_yearly_per_month, p.currency)}`,
      fmt(p.price_yearly_total, p.currency) && `yearly total ${fmt(p.price_yearly_total, p.currency)}`,
      fmt(p.price_unclear ?? null, p.currency) && `price (billing period unclear) ${fmt(p.price_unclear ?? null, p.currency)}`,
      fmt(p.list_price ?? null, p.currency) && `original/list price ${fmt(p.list_price ?? null, p.currency)}/${p.list_price_unit ?? "?"}`,
      p.billing_note && `note: ${p.billing_note}`,
      p.is_promo && "PROMO price",
    ].filter(Boolean);
    lines.push(`PLAN ${p.name ?? "(unnamed)"}: ${parts.join("; ") || "no price"} | QUOTE: ${p.evidence_quote}`);
  }
  if (s.free_tier?.available != null) lines.push(`FREE_TIER: ${s.free_tier.available ? "yes" : "no"}${s.free_tier.limits ? `; ${s.free_tier.limits}` : ""}${s.free_tier.evidence_quote ? ` | QUOTE: ${s.free_tier.evidence_quote}` : ""}`);
  return lines.join("\n").replace(/<<<|>>>/g, ""); // 不讓原文裡的分隔符號跳出資料區塊
}
