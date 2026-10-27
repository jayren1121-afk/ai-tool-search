import { NextRequest, NextResponse } from "next/server";
import { loadSearchCatalog } from "@/lib/search-catalog";
import { searchCatalog } from "@/lib/search-intent";
import { buildPriceTip } from "@/lib/price-tip";
import { isLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 第二階段若接 Tavily 免費方案（約每月 1,000 點、不綁卡），未命中快取的外部搜尋每天約 30 次。此路由還沒有呼叫外部搜尋。

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const cat = (req.nextUrl.searchParams.get("cat") || "").slice(0, 40);
  const pm = (req.nextUrl.searchParams.get("pm") || "").slice(0, 20);
  const rawLocale = req.nextUrl.searchParams.get("locale");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "zh";
  if (!q && !cat && !pm) return NextResponse.json({ mode: "list", tools: [] }, { headers: noStore });
  try {
    const { rows, snaps } = await loadSearchCatalog();
    const withTip = <T extends { id: string; free_tier: string | null; paid_plans?: { name?: string | null; price_usd_month?: number | null; notes?: string | null }[] | null }>(t: T) => ({
      ...t,
      priceTip: buildPriceTip(locale, t, snaps.get(t.id) ?? null),
    });
    if (!q) {
      const list = rows
        .filter((t) => (!cat || t.category === cat) && (!pm || t.pricing_model === pm))
        .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))
        .slice(0, 60)
        .map(withTip);
      return NextResponse.json({ mode: "list", tools: list }, { headers: noStore });
    }
    const found = searchCatalog(rows, q, { locale, category: cat, pricing: pm });
    if (found.mode === "goal") {
      return NextResponse.json({
        mode: "goal",
        goalId: found.goalId,
        goalTitle: found.goalTitle,
        groups: found.groups.map((g) => ({ ...g, tools: g.tools.map(withTip) })),
      }, { headers: noStore });
    }
    return NextResponse.json({ mode: "list", tools: found.tools.map(withTip) }, { headers: noStore });
  } catch (e) {
    const missing = (e as Error).message === "supabase-unconfigured";
    const error = missing ? (locale === "en" ? "Search is not configured" : "尚未設定搜尋服務") : (locale === "en" ? "Search failed" : "搜尋失敗");
    return NextResponse.json({ error }, { status: missing ? 503 : 500, headers: noStore });
  }
}
