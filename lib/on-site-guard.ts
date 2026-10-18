// 免費站內保護的純檢查邏輯（瀏覽器端、與搜尋／診斷／投票無關）。
// 只做格式與網址啟發式判斷，不連線、不讀寫使用者原文。呼叫端負責「預設關閉」與「沒有風險就不打擾」。

export const GUARD_STORAGE_KEY = "jaytal-onsite-guard";

export type PiiKind = "twid" | "phone" | "card" | "email" | "ubn";
export type PiiHit = { kind: PiiKind; masked: string };

export type LinkIssue =
  | "script"
  | "http"
  | "ip"
  | "punycode"
  | "shortener"
  | "redirect"
  | "userinfo"
  | "port"
  | "executable";

export type LinkCheck = { issues: LinkIssue[]; display: string };

const ID_LETTER: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18, K: 19, L: 20, M: 21,
  N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
};
// 新式外來人口統一證號第 2 碼若是字母：A=0 … J=9（內政部規則），再套用與身分證相同的權重。
const NEW_SECOND = "ABCDEFGHIJ";
const ID_WEIGHTS = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];

const SHORTENERS = [
  "bit.ly", "bitly.com", "tinyurl.com", "tiny.one", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "cutt.ly", "shorturl.at", "rb.gy", "rebrand.ly", "tiny.cc", "t.ly", "adf.ly", "bc.vc", "bit.do",
  "v.gd", "shorte.st", "ouo.io", "clk.sh", "short.io", "s.id", "reurl.cc", "pse.is", "lihi.io", "0rz.tw", "ppt.cc",
];
const REDIR_KEYS = new Set([
  "url", "redirect", "redirect_url", "redirect_uri", "return", "return_url", "returnurl", "next", "goto",
  "dest", "destination", "target", "continue", "rurl", "to", "link", "out", "jump", "redir", "redirect_to",
  "open", "go", "u", "view", "targeturl",
]);
const RISKY_EXT = /\.(exe|scr|bat|cmd|msi|dll|vbs|ps1|apk|dmg|pkg|iso|hta|jar|lnk|reg|wsf|cpl|deb|rpm|appimage)$/i;
const ISSUE_ORDER: LinkIssue[] = ["script", "http", "ip", "punycode", "shortener", "redirect", "userinfo", "port", "executable"];

type Span = { start: number; end: number; kind: PiiKind; masked: string };

const maskKeep = (raw: string, head: number, tail: number) =>
  raw.length <= head + tail ? "*".repeat(Math.max(raw.length, 1)) : raw.slice(0, head) + "*".repeat(raw.length - head - tail) + raw.slice(-tail);

function twIdOk(id: string): boolean {
  const s = id.toUpperCase();
  if (!/^[A-Z][0-9A-Z][0-9]{8}$/.test(s)) return false;
  const n1 = ID_LETTER[s[0]];
  if (n1 == null) return false;
  const secondChar = s[1];
  const classic = secondChar === "1" || secondChar === "2";
  const foreign = secondChar === "8" || secondChar === "9" || (secondChar >= "A" && secondChar <= "D");
  if (!classic && !foreign) return false;
  const second = secondChar >= "0" && secondChar <= "9" ? Number(secondChar) : NEW_SECOND.indexOf(secondChar);
  if (second < 0) return false;
  const nums = [Math.floor(n1 / 10), n1 % 10, second];
  for (let i = 2; i < 10; i++) nums.push(Number(s[i]));
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += nums[i] * ID_WEIGHTS[i];
  return sum % 10 === 0;
}

function luhnOk(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = num.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0 && sum > 0;
}

function knownCard(n: string): boolean {
  if (/^4\d{12}(\d{3})?(\d{3})?$/.test(n)) return true;
  if (/^3[47]\d{13}$/.test(n)) return true;
  if (/^5[1-5]\d{14}$/.test(n)) return true;
  if (/^2(2[2-9]\d|[3-6]\d{2}|7[01]\d|720)\d{12}$/.test(n)) return true;
  if (/^35\d{14}$/.test(n)) return true;
  if (/^62\d{14,17}$/.test(n)) return true;
  return false;
}

function ubnProduct(n: number): number {
  let s = n;
  while (s >= 10) {
    let x = 0;
    for (let v = s; v > 0; v = Math.floor(v / 10)) x += v % 10;
    s = x;
  }
  return s;
}

/** 統一編號檢查碼。第 7 碼為 7 時，乘積 28 的兩種進位（1 或 0）都算通過。 */
function ubnOk(n: string): boolean {
  if (!/^\d{8}$/.test(n)) return false;
  const w = [1, 2, 1, 2, 1, 2, 4, 1];
  const parts = n.split("").map((d, i) => ubnProduct(Number(d) * w[i]));
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum % 10 === 0) return true;
  return n[6] === "7" && (sum - 1) % 10 === 0;
}

function looksLikeDate(n: string): boolean {
  if (!/^\d{8}$/.test(n)) return false;
  const y = Number(n.slice(0, 4));
  const m = Number(n.slice(4, 6));
  const d = Number(n.slice(6, 8));
  return y >= 1900 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function maskEmail(addr: string): string {
  const at = addr.indexOf("@");
  if (at <= 0) return "***";
  const local = addr.slice(0, at);
  return `${local.slice(0, 1)}${"*".repeat(Math.max(1, local.length - 1))}@${addr.slice(at + 1)}`;
}

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("886")) return "+886" + maskKeep(digits.slice(3), 2, 3);
  return maskKeep(digits, 4, 3);
}

function scan(re: RegExp, text: string, fn: (m: RegExpExecArray) => Span | null, out: Span[]) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    const span = fn(m);
    if (span) out.push(span);
  }
}

function collectSpans(text: string): Span[] {
  const src = text.length > 20_000 ? text.slice(0, 20_000) : text;
  const found: Span[] = [];
  scan(/(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![A-Za-z0-9.-])/g, src, (m) => ({
    start: m.index, end: m.index + m[0].length, kind: "email", masked: maskEmail(m[0]),
  }), found);
  scan(/(?<![A-Za-z0-9])[A-Za-z][1289A-Da-d][0-9]{8}(?![A-Za-z0-9])/g, src, (m) => (
    twIdOk(m[0]) ? { start: m.index, end: m.index + m[0].length, kind: "twid", masked: m[0].toUpperCase().slice(0, 3) + "****" + m[0].slice(-3) } : null
  ), found);
  scan(/(?<!\d)(?:\+?886[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{3}|09\d{2}[-\s]?\d{3}[-\s]?\d{3})(?!\d)/g, src, (m) => ({
    start: m.index, end: m.index + m[0].length, kind: "phone", masked: maskPhone(m[0]),
  }), found);
  scan(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g, src, (m) => {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhnOk(digits) || !knownCard(digits)) return null;
    return { start: m.index, end: m.index + m[0].length, kind: "card", masked: "**** **** **** " + digits.slice(-4) };
  }, found);
  scan(/(?<!\d)\d{8}(?!\d)/g, src, (m) => (
    !looksLikeDate(m[0]) && ubnOk(m[0])
      ? { start: m.index, end: m.index + m[0].length, kind: "ubn", masked: m[0].slice(0, 2) + "****" + m[0].slice(-2) }
      : null
  ), found);

  found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept: Span[] = [];
  let end = -1;
  for (const s of found) {
    if (s.start < end) continue;
    kept.push(s);
    end = s.end;
  }
  return kept;
}

/** 找出可能的台灣常見個資格式。回傳遮罩後的結果，不含原文。 */
export function findPii(text: string): PiiHit[] {
  if (!text) return [];
  const seen = new Set<string>();
  const hits: PiiHit[] = [];
  for (const s of collectSpans(text)) {
    const key = s.kind + ":" + s.masked;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ kind: s.kind, masked: s.masked });
    if (hits.length >= 8) break;
  }
  return hits;
}

/** 把個資原文換成遮罩，供畫面上的網址預覽使用。沒有命中就原樣返回（呼叫端仍不應把這段存起來）。 */
export function redactPii(text: string): string {
  const spans = collectSpans(text);
  if (!spans.length) return text;
  let out = "";
  let i = 0;
  for (const s of spans) {
    out += text.slice(i, s.start) + s.masked;
    i = s.end;
  }
  return out + text.slice(i);
}

function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

function isIpHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return h.split(".").every((n) => Number(n) <= 255);
  return h.includes(":") && /^[0-9a-f:]*$/i.test(h) && /[0-9a-f]/i.test(h);
}

function decodeLoose(v: string): string {
  let s = v.trim();
  for (let i = 0; i < 2; i++) {
    try {
      const n = decodeURIComponent(s.replace(/\+/g, " "));
      if (n === s) break;
      s = n;
    } catch { break; }
  }
  return s;
}

function looksLikeJumpTarget(v: string): boolean {
  const s = decodeLoose(v);
  return /^https?:\/\//i.test(s) || s.startsWith("//") || /https?%3a%2f%2f|%2f%2f/i.test(v);
}

function hasRedirect(url: URL): boolean {
  for (const [key, value] of url.searchParams) {
    if (!REDIR_KEYS.has(key.toLowerCase())) continue;
    if (looksLikeJumpTarget(value)) return true;
  }
  return false;
}

/**
 * 網址風險啟發式檢查。回傳的 display 已去掉帳密並遮罩個資，可給使用者看。
 * 沒有任何疑點時 issues 為空陣列——呼叫端不應因此打擾使用者。
 * 無法解析時回傳 null（呼叫端應放行）。
 */
export function checkUrl(raw: string, base = "https://jaytal.local/"): LinkCheck | null {
  let url: URL;
  try { url = new URL(raw, base); } catch { return null; }
  const issues: LinkIssue[] = [];
  const proto = url.protocol;
  if (proto === "javascript:" || proto === "data:") issues.push("script");
  else if (proto === "http:") issues.push("http");

  const host = url.hostname.toLowerCase();
  if (host && isIpHost(host)) issues.push("ip");
  if (host.split(".").some((p) => p.startsWith("xn--"))) issues.push("punycode");
  if (host && SHORTENERS.some((d) => hostIs(host, d))) issues.push("shortener");
  if (hasRedirect(url)) issues.push("redirect");
  if (url.username || url.password) issues.push("userinfo");
  if (url.port && url.port !== "80" && url.port !== "443") issues.push("port");
  if (RISKY_EXT.test(url.pathname)) issues.push("executable");

  issues.sort((a, b) => ISSUE_ORDER.indexOf(a) - ISSUE_ORDER.indexOf(b));
  const clean = new URL(url.href);
  clean.username = "";
  clean.password = "";
  let display = redactPii(clean.href);
  if (display.length > 180) display = display.slice(0, 177) + "…";
  return { issues, display };
}

/** 給點擊判斷用：這個路徑像不像可執行檔或腳本下載。 */
export function hasRiskyExtension(pathname: string): boolean {
  return RISKY_EXT.test(pathname);
}

/**
 * 這個點擊要不要做網址檢查。站內一般連結直接放行（不掃描）；
 * 外站 http(s)、javascript/data，以及下載／可執行檔才檢查。解析失敗則放行。
 */
export function shouldInspectLink(href: string, pageUrl: string, opts: { download?: boolean } = {}): boolean {
  let page: URL;
  let url: URL;
  try {
    page = new URL(pageUrl);
    url = new URL(href, page);
  } catch { return false; }
  if (url.protocol === "javascript:" || url.protocol === "data:") return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const download = !!opts.download || hasRiskyExtension(url.pathname);
  if (url.origin === page.origin && !download) return false;
  return true;
}
