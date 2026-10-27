import { NextRequest, NextResponse } from "next/server";
import { loadSearchCatalog } from "@/lib/search-catalog";
import { searchCatalog } from "@/lib/search-intent";
import { httpsUrl, placeExternal, type WebHit } from "@/lib/external-search";
import { searchWeb } from "@/lib/web-search";
import { buildPriceTip, externalPriceTip } from "@/lib/price-tip";
import { clientIp } from "@/lib/security";
import { cleanText, resolveSuggestionSecret, signSuggestion } from "@/lib/suggestions";
import { isLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 站外結果走 Tavily 免費方案（basic 搜尋，約每月 1,000 點）。未命中 72 小時快取的呼叫，全站每天 30 次。
// 沒有 TAVILY_API_KEY、或額度用完，只回站內目錄。此路由在伺服器呼叫，不改瀏覽器的 CSP。

const noStore = { "Cache-Control": "no-store" };
const env = (k: string) => (process.env[k] || "").trim();

/** 簽過名的網址與標題才能按「+」。密鑰留在伺服器，簽章對不上就不能建議。 */
function presentExternal(h: WebHit, locale: Locale) {
  const url = httpsUrl(h.url) || h.url;
  const title = cleanText(h.title, 120) || h.site;
  const base = { ...h, url, title, priceTip: externalPriceTip(locale) };
  const secret = resolveSuggestionSecret(env, process.env.NODE_ENV === "production");
  if (!secret) return base;
  return { ...base, sig: signSuggestion(secret, url, title) };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const cat = (req.nextUrl.searchParams.get("cat") || "").slice(0, 40);
  const pm = (req.nextUrl.searchParams.get("pm") || "").slice(0, 20);
  const rawLocale = req.nextUrl.searchParams.get("locale");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "zh";
  if (!q && !cat && !pm) return NextResponse.json({ mode: "list", tools: [] }, { headers: noStore });
  try {
    const webP = q ? searchWeb(q, locale, clientIp(req)).catch(() => [] as WebHit[]) : Promise.resolve([] as WebHit[]);
    const { rows, snaps } = await loadSearchCatalog();
    const hits = await webP;
    const withTip = <T extends { id: string; free_tier: string | null; paid_plans?: { name?: string | null; price_usd_month?: number | null; notes?: string | null }[] | null }>(t: T) => ({
      ...t,
      priceTip: buildPriceTip(locale, t, snaps.get(t.id) ?? null),
    });
    const withExternalTip = (h: WebHit) => presentExternal(h, locale);
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
      const empty = found.groups.filter((g) => g.tools.length === 0).map((g) => g.id);
      const placed = placeExternal(found.goalId, hits, empty);
      return NextResponse.json({
        mode: "goal",
        goalId: found.goalId,
        goalTitle: found.goalTitle,
        groups: found.groups.map((g) => ({
          ...g,
          tools: g.tools.map(withTip),
          external: (placed.byGroup[g.id] || []).map(withExternalTip),
        })),
        external: placed.rest.map(withExternalTip),
      }, { headers: noStore });
    }
    return NextResponse.json({
      mode: "list",
      tools: found.tools.map(withTip),
      external: hits.slice(0, 6).map(withExternalTip),
    }, { headers: noStore });
  } catch (e) {
    const missing = (e as Error).message === "supabase-unconfigured";
    const error = missing ? (locale === "en" ? "Search is not configured" : "尚未設定搜尋服務") : (locale === "en" ? "Search failed" : "搜尋失敗");
    return NextResponse.json({ error }, { status: missing ? 503 : 500, headers: noStore });
  }
}
