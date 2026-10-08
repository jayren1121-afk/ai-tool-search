import { NextResponse, type NextRequest } from "next/server";

// 語言自動導向（只作用於中文首頁「/」）：
// - 曾用語言切換或先前導向過 → 依 cookie（lang=zh 不導向、lang=en 導向 /en）
// - 爬蟲／預覽機器人一律不導向（避免影響 Google 收錄中文首頁）
// - 首次造訪且 Accept-Language 不含中文 → 307 導向 /en 並記住 lang=en
// matcher 只含 "/"：/api、靜態檔、Google 驗證檔、sitemap、robots、工具頁與分類頁都不會經過這裡
const COOKIE = "lang";
const BOT = /bot|crawl|spider|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|meta-externalagent|embedly|quora link preview|whatsapp|telegram|discord|slack|linkedin|twitter|skype|pinterest|redditbot|applebot|yandex|baidu|duckduck|petal|bytespider|google-inspectiontool|google-extended|lighthouse|pagespeed|chrome-lighthouse|headless|phantom|puppeteer|playwright|preview|validator|monitor|uptime|curl|wget|python|httpclient|okhttp|node-fetch|axios|go-http|java\//i;

export function proxy(req: NextRequest) {
  if (req.method !== "GET" && req.method !== "HEAD") return NextResponse.next();
  const pref = req.cookies.get(COOKIE)?.value;
  if (pref === "zh") return NextResponse.next();
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua)) return NextResponse.next();
  if (pref !== "en") {
    const al = (req.headers.get("accept-language") || "").toLowerCase();
    if (!al || /(^|[,\s])zh\b/.test(al)) return NextResponse.next(); // 沒有語言資訊或接受中文 → 維持中文
  }
  const url = req.nextUrl.clone();
  url.pathname = "/en";
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Vary", "Accept-Language, Cookie, User-Agent");
  if (pref !== "en") res.cookies.set(COOKIE, "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/"] };
