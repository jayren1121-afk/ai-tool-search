// 官網健康檢查（基本連線檢查；不用 AI、不呼叫任何 LLM）。
// 本檔是純邏輯（不連資料庫），資料庫讀寫在 lib/health-run.ts。
import { publicHttpUrl } from "./pagetext";

export const HEALTH_UA = "jAytalHealthBot/1.0 (+https://www.jaytaimark.com)";
export const REQUEST_TIMEOUT_MS = 10_000; // 單一請求逾時
export const TOOL_HARD_CAP_MS = 16_000;   // 單一工具（含 HEAD + GET + 轉址）的總上限
export const MAX_REDIRECTS = 5;
export const DOWN_AFTER_FAILURES = 3;     // 連續 3 次（不同天）失敗才標為異常
export const THIN_TEXT_CHARS = 200;
const BODY_LIMIT = 250_000;

export type HealthStatus = "live" | "down" | "unknown";
export type CheckKind =
  | "ok"          // 連線正常（可能附帶「頁面極短」旗標）
  | "blocked"     // 網站擋機器人（401/403/429/503 驗證頁）→ unknown，不算異常
  | "other"       // 其他無法判定的回應（例如 400/405/406）→ unknown
  | "suspicious"  // 轉址到明顯不同的網域或停放頁 → unknown + 待人工檢查
  | "fail";       // DNS／連線／憑證／逾時／404／410／5xx → 計入連續失敗

export type CheckResult = {
  kind: CheckKind;
  httpStatus: number | null;
  finalUrl: string | null;
  detail: string;
  /** 需要人工確認的狀況簽章：thin、redirect:網域、parked:網域；沒有則為 null */
  flag: string | null;
  netKind?: "dns" | "refused" | "cert" | "timeout" | "reset" | "headers" | "other" | "redirects";
  requests: number;
  ms: number;
};

export type HealthRow = {
  tool_id: string;
  status: HealthStatus;
  last_checked_at: string | null;
  last_ok_at: string | null;
  consecutive_failures: number;
  last_failure_at: string | null;
  last_http_status: number | null;
  last_final_url: string | null;
  detail: string | null;
  needs_review: boolean;
  reviewed_note: string | null;
  reviewed_at: string | null;
  review_signature: string | null;
  check_signature: string | null;
  manual_down: boolean;
  snoozed_until: string | null;
  /** 選填、公開：已轉址 / 已改名 與新網址／新名稱（需 migration 009；沒有這兩欄時為 undefined） */
  moved_type?: "moved" | "renamed" | null;
  moved_to?: string | null;
};

/* ---------------- 網域判斷 ---------------- */
const MULTI_TLD = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.jp", "ne.jp", "or.jp", "com.tw", "org.tw", "net.tw", "com.cn", "net.cn", "org.cn", "com.hk", "com.sg", "co.kr", "or.kr", "co.in", "com.br", "com.mx", "co.nz", "co.za", "com.tr", "com.ar", "co.il", "com.my", "com.ph", "com.vn", "co.id", "co.th"]);
// 這些平台的子網域屬於不同擁有者：視為「獨立網域」，不可把 a.vercel.app 與 b.vercel.app 當成同一個網站
const SHARED_HOSTS = ["vercel.app", "netlify.app", "github.io", "pages.dev", "web.app", "firebaseapp.com", "herokuapp.com", "replit.app", "repl.co", "streamlit.app", "notion.site", "webflow.io", "framer.website", "framer.app", "carrd.co", "wixsite.com", "blogspot.com", "gitbook.io", "onrender.com", "fly.dev", "railway.app", "hf.space", "lovable.app", "bubbleapps.io", "glitch.me", "ngrok.app", "workers.dev"];
// 常見的登入／驗證服務：工具官網導向這些網域通常只是需要登入，網站本身正常
const AUTH_HOSTS = ["accounts.google.com", "login.microsoftonline.com", "login.live.com", "appleid.apple.com", "auth0.com", "okta.com", "clerk.accounts.dev", "accounts.dev", "amazoncognito.com", "login.salesforce.com", "id.atlassian.com", "auth.openai.com", "login.tailscale.com"];
// 網域停放／買賣平台
const PARKING_HOSTS = ["sedo.com", "sedoparking.com", "dan.com", "afternic.com", "hugedomains.com", "parkingcrew.net", "bodis.com", "above.com", "domainmarket.com", "undeveloped.com", "porkbun.com", "namecheap.com", "godaddy.com", "squadhelp.com", "brandbucket.com", "uniregistry.com", "buydomains.com", "domainsponsor.com", "parklogic.com", "fabulous.com", "register.com", "network-solutions.com", "networksolutions.com", "1and1.com", "ionos.com", "hostgator.com", "bluehost.com"];

const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase().replace(/\.$/, ""); } catch { return ""; } };
const endsWithDomain = (h: string, d: string) => h === d || h.endsWith("." + d);

/** 註冊網域（簡化版 eTLD+1；平台子網域視為獨立） */
export function regDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, "");
  const labels = h.split(".");
  if (labels.length <= 2) return h;
  const shared = SHARED_HOSTS.find((s) => endsWithDomain(h, s));
  if (shared) return labels.slice(-(shared.split(".").length + 1)).join(".");
  const last2 = labels.slice(-2).join(".");
  return MULTI_TLD.has(last2) ? labels.slice(-3).join(".") : last2;
}
const brandLabel = (host: string) => { const r = regDomain(host); const l = r.split("."); return l.length >= 2 && !SHARED_HOSTS.some((s) => endsWithDomain(r, s)) ? l[0] : r; };

/** 原網域與最終網域是否視為同一個網站：同一註冊網域（含 www／語系子網域）或同品牌不同尾碼（notion.so → notion.com） */
export function sameSite(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (regDomain(a) === regDomain(b)) return true;
  return brandLabel(a) === brandLabel(b) && brandLabel(a).length >= 4 && !SHARED_HOSTS.some((s) => endsWithDomain(regDomain(a), s));
}

/* ---------------- 內容判斷 ---------------- */
const decode = (t: string) => t.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;|&gt;/g, " ").replace(/&#\d+;|&#x[0-9a-f]+;/gi, " ");
/** 可見文字（去掉 head、script、style、noscript、註解、標籤） */
export function visibleText(html: string): string {
  return decode(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|template|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
export const titleOf = (html: string) => decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
/** 以 JavaScript 呈現內容的網站（單頁應用）：可見文字少是正常的，不當成空白頁 */
const SPA_RE = /id=["']?(root|__next|app|__nuxt|___gatsby|svelte|q:container|react-root|__svelte|main-app)["'\s>]|<script[^>]+type=["']module["']|data-reactroot|__NEXT_DATA__|__next_f|__NUXT__|__remixContext|BAILOUT_TO_CLIENT_SIDE_RENDERING|data-server-rendered|ng-version|<app-root|data-framer|<noscript[^>]*>[^<]*(enable|turn on|requires?|without|need)[^<]*javascript/i;
/** 以 JavaScript 呈現內容的網站：可見文字少是正常的，不當成空白頁（有框架特徵，或外部 script 很多） */
export const looksJsRendered = (html: string) => SPA_RE.test(html) || (html.match(/<script[^>]+src=/gi)?.length ?? 0) >= 5;
const PARKED_RE = /this domain (name )?(is|may be|might be) (currently )?(for sale|available)|domain (name )?is for sale|domain (name )?for sale|buy this domain|this domain is parked|domain parking|parked (free|domain|at)|inquire (about|on|for) this domain|purchase this domain|make an offer (on|for) (this|the) domain|domain (is )?available for purchase|(網域|域名|網址).{0,8}(出售|待售|可供購買|停放)|(此|该|該)域名.{0,10}(出售|转让|轉讓)|sedoparking|hugedomains|afternic|domain has expired|this domain has been registered/i;
const BLOCK_RE = /just a moment|attention required|cf-browser-verification|cf-chl|challenge-platform|cf-turnstile|checking your browser|verify(ing)? (that )?you are (a )?human|enable javascript and cookies|captcha|access denied|request blocked|incapsula|imperva|datadome|perimeterx|px-captcha|sucuri|are you a robot|robot or human|unusual traffic|pardon our interruption|ddos protection|security check|bot (detection|protection)|errors?\.edgesuite\.net|akamai/i;

export function looksBlocked(status: number, headers: Headers | null, body: string): boolean {
  if (status === 401) return true;
  if (![403, 429, 503].includes(status)) return false;
  if (headers) {
    if (/challenge/i.test(headers.get("cf-mitigated") || "")) return true;
    if (/cloudflare|akamai|sucuri|incapsula|datadome/i.test(headers.get("server") || "") || headers.get("cf-ray")) return true;
    if (headers.get("x-datadome") || headers.get("x-sucuri-id") || headers.get("x-iinfo")) return true;
  }
  return BLOCK_RE.test(body.slice(0, 60_000));
}
const metaRefresh = (html: string, base: string): string | null => {
  const m = html.slice(0, 20_000).match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']\s*(\d+)\s*;\s*url=['"]?([^"'>\s]+)/i);
  if (!m || Number(m[1]) > 5) return null;
  try { return new URL(decode(m[2]), base).toString(); } catch { return null; }
};

/* ---------------- 網路 ---------------- */
type FetchFn = typeof fetch;
type Hop = { url: string; status: number; headers: Headers; body: string; truncated?: boolean; hops: number; requests: number };
type WalkEnd = ({ type: "resp" } & Hop) | { type: "err"; url: string; netKind: NonNullable<CheckResult["netKind"]>; detail: string; requests: number };

export function describeNetError(e: unknown): { netKind: NonNullable<CheckResult["netKind"]>; detail: string } {
  const err = e as { name?: string; code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = err?.cause?.code || err?.code || "";
  const msg = `${err?.cause?.message || ""} ${err?.message || ""}`;
  if (err?.name === "TimeoutError" || err?.name === "AbortError" || /TIMEDOUT|TIMEOUT|ABORT/i.test(code)) return { netKind: "timeout", detail: "逾時（10 秒內沒有回應）" };
  if (code === "UND_ERR_HEADERS_OVERFLOW") return { netKind: "headers", detail: "網站回應標頭過大，無法檢查（網站有回應）" };
  if (code === "ENOTFOUND") return { netKind: "dns", detail: "DNS 查無此網域" };
  if (code === "EAI_AGAIN") return { netKind: "dns", detail: "DNS 暫時無法解析" };
  if (code === "ECONNREFUSED") return { netKind: "refused", detail: "連線被拒絕" };
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS|HOSTNAME_MISMATCH|ALTNAME|SSL|EPROTO/i.test(code + " " + msg)) return { netKind: "cert", detail: `憑證／TLS 錯誤（${(code || msg).trim().slice(0, 60)}）` };
  if (/ECONNRESET|SOCKET|EPIPE|TERMINATED/i.test(code + " " + msg)) return { netKind: "reset", detail: "連線被中斷" };
  return { netKind: "other", detail: `連線失敗（${(code || msg || "未知錯誤").trim().slice(0, 80)}）` };
}

async function readBody(res: Response, limit: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = []; let n = 0;
  try {
    while (n < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); n += value.length;
    }
  } finally { reader.cancel().catch(() => {}); }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c)))).slice(0, limit), truncated: n >= limit };
}

type Ctx = { fetchImpl: FetchFn; signal: AbortSignal; jar: Map<string, Map<string, string>>; };
function cookieHeader(ctx: Ctx, host: string) { const j = ctx.jar.get(host); return j && j.size ? [...j].map(([k, v]) => `${k}=${v}`).join("; ") : ""; }
function storeCookies(ctx: Ctx, host: string, h: Headers) {
  const list = (h as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  if (!list.length) return;
  const j = ctx.jar.get(host) ?? new Map<string, string>(); ctx.jar.set(host, j);
  for (const c of list.slice(0, 20)) { const kv = c.split(";")[0]; const i = kv.indexOf("="); if (i > 0) j.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
}

/** 手動跟隨轉址（最多 MAX_REDIRECTS 次；每一跳都要求公開網域）；HTTP 4xx/5xx 也回傳回應，只有網路錯誤才算 err */
async function walk(start: string, method: "HEAD" | "GET", ctx: Ctx, hopsUsed = 0): Promise<WalkEnd | { type: "toomany" | "badurl"; url: string; requests: number; hops: number }> {
  let url = start, hops = hopsUsed, requests = 0;
  for (;;) {
    if (!publicHttpUrl(url)) return { type: "badurl", url, requests, hops };
    const host = hostOf(url);
    const headers: Record<string, string> = { "User-Agent": HEALTH_UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "zh-TW,zh;q=0.8,en;q=0.7" };
    const ck = cookieHeader(ctx, host); if (ck) headers.Cookie = ck;
    let res: Response;
    try {
      requests++;
      res = await ctx.fetchImpl(url, { method, headers, redirect: "manual", signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) });
    } catch (e) { return { type: "err", url, requests, ...describeNetError(e) }; }
    storeCookies(ctx, host, res.headers);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      res.body?.cancel().catch(() => {});
      if (hops >= MAX_REDIRECTS) return { type: "toomany", url, requests, hops };
      try { url = new URL(loc, url).toString(); } catch { return { type: "badurl", url: loc, requests, hops }; }
      hops++; continue;
    }
    let body = "", truncated = false;
    if (method === "GET") {
      try { ({ text: body, truncated } = await readBody(res, res.status >= 200 && res.status < 300 ? BODY_LIMIT : 60_000)); } catch { /* 讀取中斷：保留已有內容 */ }
      if (res.status >= 200 && res.status < 300) {
        const next = metaRefresh(body, url);
        if (next && next !== url) { if (hops >= MAX_REDIRECTS) return { type: "toomany", url, requests, hops }; url = next; hops++; continue; }
      }
    } else res.body?.cancel().catch(() => {});
    return { type: "resp", url, status: res.status, headers: res.headers, body, truncated, hops, requests };
  }
}

/* ---------------- 判定 ---------------- */
const res = (kind: CheckKind, o: Partial<CheckResult> & { detail: string }): CheckResult => ({ kind, httpStatus: null, finalUrl: null, flag: null, requests: 0, ms: 0, ...o });

/** 把最後一個回應判定為結果（純函式，方便單元測試） */
export function classify(origUrl: string, final: { url: string; status: number; headers: Headers | null; body: string; truncated?: boolean }): CheckResult {
  const { url, status, headers, body } = final;
  const oh = hostOf(origUrl), fh = hostOf(url);
  const base = { httpStatus: status, finalUrl: url };
  const isHtmlBody = body.length > 0;
  const title = isHtmlBody ? titleOf(body) : "";
  const text = isHtmlBody ? visibleText(body) : "";
  const parkedHost = PARKING_HOSTS.some((p) => endsWithDomain(fh, p)) && !PARKING_HOSTS.some((p) => endsWithDomain(oh, p));
  const parkedWords = isHtmlBody && status >= 200 && status < 300 && (text.length < 2500 || PARKED_RE.test(title)) && PARKED_RE.test(`${title} ${text.slice(0, 3000)}`);
  const authHost = AUTH_HOSTS.some((a) => endsWithDomain(fh, a));
  const same = sameSite(oh, fh);

  if (!same && !authHost) {
    const parked = parkedHost || parkedWords;
    const dest = `${fh}${new URL(url).pathname === "/" ? "" : new URL(url).pathname}`;
    return res("suspicious", { ...base, flag: `${parked ? "parked" : "redirect"}:${regDomain(fh)}`, detail: parked ? `轉址到疑似網域停放／待售頁：${dest}` : `轉址到不同網域：${dest}` });
  }
  if (status >= 200 && status < 400) {
    if (parkedWords && same) return res("suspicious", { ...base, flag: `parked:${regDomain(fh)}`, detail: "頁面疑似網域停放／待售頁" });
    if (authHost && !same) return res("ok", { ...base, detail: `HTTP ${status}（導向登入頁，網站正常）` });
    if (isHtmlBody && text.length < THIN_TEXT_CHARS && !final.truncated && !looksJsRendered(body)) return res("ok", { ...base, flag: "thin", detail: `頁面可見文字只有 ${text.length} 字（可能是空白頁或即將推出）` });
    return res("ok", { ...base, detail: `HTTP ${status}${sameSite(oh, fh) && regDomain(oh) !== regDomain(fh) ? "（轉址到同品牌網域）" : ""}` });
  }
  if (status === 401) return res("blocked", { ...base, detail: "網站擋機器人（需要驗證），無法檢查" });
  if (looksBlocked(status, headers, body)) return res("blocked", { ...base, detail: `網站擋機器人，無法檢查（HTTP ${status}）` });
  if (status === 403 || status === 429) return res("blocked", { ...base, detail: `網站拒絕自動檢查（HTTP ${status}），無法判斷` });
  if (status === 404 || status === 410) return res("fail", { ...base, detail: `HTTP ${status}（頁面不存在）` });
  if (status >= 500) return res("fail", { ...base, detail: `伺服器錯誤 HTTP ${status}` });
  return res("other", { ...base, detail: `HTTP ${status}，無法判斷` });
}

export type CheckOpts = { fetchImpl?: FetchFn; hardCapMs?: number };

/** 對單一官網做一次健康檢查：HEAD（含轉址）→ 正常再 GET 一次讀內容；HEAD 失敗或非 2xx/3xx 則改用 GET */
export async function checkSite(url: string, opts: CheckOpts = {}): Promise<CheckResult> {
  const t0 = Date.now();
  const cap = new AbortController();
  const timer = setTimeout(() => cap.abort(Object.assign(new Error("timeout"), { name: "TimeoutError" })), opts.hardCapMs ?? TOOL_HARD_CAP_MS);
  const ctx: Ctx = { fetchImpl: opts.fetchImpl ?? fetch, signal: cap.signal, jar: new Map() };
  const done = (r: CheckResult, requests: number) => ({ ...r, requests, ms: Date.now() - t0 });
  try {
    if (!publicHttpUrl(url)) return done(res("fail", { detail: "官網網址不是合法的公開網址" }), 0);
    let requests = 0;
    const head = await walk(url, "HEAD", ctx); requests += head.requests;
    let end: Awaited<ReturnType<typeof walk>> = head;
    if (head.type === "resp" && head.status < 400) {
      // HEAD 正常 → 再用 GET 讀一次最終頁面內容（判斷空白頁／停放頁），失敗時沿用 HEAD 結果
      await new Promise((r) => setTimeout(r, 250));
      const get = await walk(head.url, "GET", ctx, head.hops); requests += get.requests;
      if (get.type === "resp" && get.status < 400) end = get;
      else if (get.type === "resp" && get.status >= 400) end = { ...head, body: "" };
    } else {
      await new Promise((r) => setTimeout(r, 250));
      const get = await walk(url, "GET", ctx); requests += get.requests;
      end = get;
    }
    if (end.type === "err") {
      const oh = hostOf(url), eh = hostOf(end.url);
      // 已經被轉址到不同網站、而且那邊連不上：重點是「轉址」本身，交給人工確認
      if (eh && !sameSite(oh, eh) && !AUTH_HOSTS.some((a) => endsWithDomain(eh, a))) return done(res("suspicious", { finalUrl: end.url, flag: `redirect:${regDomain(eh)}`, detail: end.netKind === "headers" ? `轉址到不同網域：${eh}` : `轉址到不同網域：${eh}（對方網站連線失敗：${end.detail}）` }), requests);
      if (end.netKind === "headers") return done(res("other", { netKind: end.netKind, detail: end.detail, finalUrl: end.url }), requests); // 伺服器有回應，只是標頭太大：無法判定，不算失敗
      return done(res("fail", { netKind: end.netKind, detail: end.detail, finalUrl: end.url }), requests);
    }
    if (end.type === "toomany") return done(res("fail", { netKind: "redirects", detail: `轉址超過 ${MAX_REDIRECTS} 次（可能是轉址迴圈）`, finalUrl: end.url }), requests);
    if (end.type === "badurl") return done(res("fail", { detail: "轉址到不合法或非公開的位址", finalUrl: end.url }), requests);
    if (end.type !== "resp") return done(res("fail", { detail: "未知的檢查結果" }), requests);
    return done(classify(url, end), requests);
  } finally { clearTimeout(timer); }
}

/* ---------------- 狀態轉移 ---------------- */
const day = (iso: string) => iso.slice(0, 10);
export function emptyRow(tool_id: string): HealthRow {
  return { tool_id, status: "unknown", last_checked_at: null, last_ok_at: null, consecutive_failures: 0, last_failure_at: null, last_http_status: null, last_final_url: null, detail: null, needs_review: false, reviewed_note: null, reviewed_at: null, review_signature: null, check_signature: null, manual_down: false, snoozed_until: null };
}

/** 依上一次狀態與這次檢查結果，算出新的整列資料（人工欄位原樣保留，除非狀況改變） */
export function nextHealth(prev: HealthRow | null, r: CheckResult, now: Date): HealthRow {
  const p = prev ?? emptyRow("");
  const iso = now.toISOString();
  const row: HealthRow = { ...p, last_checked_at: iso, last_http_status: r.httpStatus, last_final_url: r.finalUrl, detail: r.detail.slice(0, 300) };
  let status: HealthStatus = p.status;
  switch (r.kind) {
    case "fail": {
      const sameDay = !!p.last_failure_at && day(p.last_failure_at) === day(iso); // 同一天不重複計算
      row.consecutive_failures = sameDay ? Math.max(p.consecutive_failures, 1) : p.consecutive_failures + 1;
      if (!sameDay) row.last_failure_at = iso;
      status = row.consecutive_failures >= DOWN_AFTER_FAILURES ? "down" : p.status === "down" ? "down" : p.status;
      row.needs_review = false; row.check_signature = null;
      break;
    }
    case "ok": {
      row.consecutive_failures = 0; row.last_ok_at = iso; row.manual_down = false; // 恢復正常：解除人工鎖定
      status = "live";
      if (r.flag) { row.check_signature = r.flag; row.needs_review = r.flag !== p.review_signature; }
      else { row.check_signature = null; row.needs_review = false; row.review_signature = null; }
      break;
    }
    case "suspicious": {
      row.consecutive_failures = 0;
      row.check_signature = r.flag;
      const accepted = !!r.flag && r.flag === p.review_signature; // 人工已確認過同一狀況
      row.needs_review = !accepted;
      status = accepted ? "live" : "unknown";
      break;
    }
    default: { // blocked / other：伺服器有回應，只是無法判定 → 失敗次數歸零，不算異常
      row.consecutive_failures = 0; row.needs_review = false; row.check_signature = null;
      status = "unknown";
    }
  }
  if (row.manual_down && r.kind !== "ok") { status = "down"; row.needs_review = false; } // 人工確認異常：直到看到恢復才解除
  if (p.moved_type) row.needs_review = false; // 已設定「已轉址／已改名」提示 = 已人工處理：再次檢查也不會把它丟回「需要人工檢查」
  row.status = status;
  if (status !== p.status || row.check_signature !== p.check_signature) row.snoozed_until = null; // 狀況改變 → 重新出現在清單
  return row;
}

/** 公開顯示用：只有 live / down 顯示標籤，其餘（unknown 或沒有資料）不顯示 */
export const publicHealth = (h: { status?: string | null } | null | undefined): "live" | "down" | null => (h?.status === "live" || h?.status === "down" ? h.status : null);

/* ---------------- 批次執行（併發、同網域序列、整批限速） ---------------- */
export type BatchOpts = {
  concurrency?: number; deadlineAt: number; hostGapMs?: number; startGapMs?: number;
  fetchImpl?: FetchFn; onResult?: (t: { id: string; url: string }, r: CheckResult) => void;
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runBatch(tools: { id: string; url: string }[], o: BatchOpts): Promise<{ results: Map<string, CheckResult>; skipped: string[] }> {
  const results = new Map<string, CheckResult>(); const skipped: string[] = [];
  const queue = [...tools]; const hostTail = new Map<string, Promise<void>>();
  let nextStart = 0; const startGap = o.startGapMs ?? 120, hostGap = o.hostGapMs ?? 1500;
  const worker = async () => {
    for (;;) {
      const t = queue.shift(); if (!t) return;
      const key = regDomain(hostOf(t.url)) || t.id;
      const prev = hostTail.get(key) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((r) => { release = r; });
      hostTail.set(key, prev.then(() => mine));
      await prev; // 同一個註冊網域的工具一個接一個檢查
      try {
        if (Date.now() > o.deadlineAt) { skipped.push(t.id); continue; }
        const wait = Math.max(0, nextStart - Date.now()); nextStart = Math.max(nextStart, Date.now()) + startGap; // 整批限速：每個工具至少間隔 startGap 才開始
        if (wait) await sleep(wait);
        if (Date.now() > o.deadlineAt) { skipped.push(t.id); continue; }
        const r = await checkSite(t.url, { fetchImpl: o.fetchImpl });
        results.set(t.id, r); o.onResult?.(t, r);
      } finally { setTimeout(release, hostGap); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.concurrency ?? 8, 12)) }, worker));
  return { results, skipped };
}

/** 從候選清單挑出最久沒檢查的一批（沒檢查過的最優先；20 小時內檢查過的先跳過，避免同一天重複請求） */
export function pickBatch<T extends { id: string }>(tools: T[], checked: Map<string, string | null>, now: Date, size: number): { batch: T[]; due: number } {
  const cutoff = now.getTime() - 20 * 3600_000;
  const due = tools.filter((t) => { const c = checked.get(t.id); return !c || Date.parse(c) < cutoff; });
  due.sort((a, b) => (Date.parse(checked.get(a.id) || "") || 0) - (Date.parse(checked.get(b.id) || "") || 0));
  return { batch: due.slice(0, size), due: due.length };
}
/** 每批數量：約 90–110，並確保整批輪完不超過 6 天（留 1 天緩衝，7 天內一定會輪到） */
export const batchSizeFor = (total: number) => Math.min(110, Math.max(90, Math.ceil(total / 6)));
