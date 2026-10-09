// 抓網頁文字（原本位於 app/api/diagnose/route.ts，抽出供 AI 診斷與每日自動發現共用）
// 除了可見內文，也擷取標題、meta 描述與結構化資料（JS 網站的可見文字常常很少，但這些通常還在）

export const PAGE_CHARS = 6000;   // 每頁最多字元數
export const PAGE_TOKENS = 1200;  // 每頁估算 token 上限；加上口碑片段與替代方案仍需低於 Groq 免費額度（約 8K tokens/分鐘）

export function truncateTokens(t: string, max = PAGE_TOKENS) {
  let n = 0, i = 0;
  for (; i < t.length && n < max; i++) n += /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(t[i]) ? 1 : 0.25;
  return t.slice(0, i);
}

export const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 AIToolSearchBot",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,zh-TW;q=0.8",
};
const decodeEntities = (t: string) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;|&gt;/g, " ");
const metaOf = (html: string, attr: string, key: string) => {
  const m = html.match(new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, "i"));
  const c = m?.[0].match(/content=["']([^"']*)["']/i);
  return c ? decodeEntities(c[1]).trim() : "";
};

/** 只允許公開網域（擋 IP、localhost、內網網域），用於抓取「外部來源提供的」網址（自動發現） */
export function publicHttpUrl(u: string): boolean {
  try {
    const x = new URL(u);
    if (x.protocol !== "https:" && x.protocol !== "http:") return false;
    if (x.username || x.password || (x.port && x.port !== "80" && x.port !== "443")) return false;
    const h = x.hostname.toLowerCase();
    if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
    if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa)$/.test(h)) return false;
    return true;
  } catch { return false; }
}

async function fetchHtml(url: string, timeoutMs: number, strict: boolean): Promise<Response | null> {
  if (!strict) return fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  // strict：手動跟隨轉址（最多 4 次），每一跳都檢查是否為公開網域
  let cur = url;
  const signal = AbortSignal.timeout(timeoutMs);
  for (let i = 0; i < 5; i++) {
    if (!publicHttpUrl(cur)) return null;
    const r = await fetch(cur, { headers: BROWSER_HEADERS, signal, redirect: "manual" });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { cur = new URL(r.headers.get("location")!, cur).toString(); continue; }
    return r;
  }
  return null;
}

export type PageOpts = { timeoutMs?: number; strict?: boolean };
export async function pageText(url: string | null, keepHtml = false, opts: PageOpts = {}): Promise<{ text: string; html: string; finalUrl?: string }> {
  const empty = { text: "", html: "" };
  if (!url || !/^https?:\/\//.test(url)) return empty;
  try {
    const r = await fetchHtml(url, opts.timeoutMs ?? 10000, !!opts.strict);
    if (!r || !r.ok) return empty;
    const html = (await r.text()).slice(0, 800_000);
    const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")).trim();
    const metas = [title && `標題：${title}`, metaOf(html, "name", "description"), metaOf(html, "property", "og:description"), metaOf(html, "name", "twitter:description")]
      .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    const ld = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1].replace(/\s+/g, " ").trim()).join(" ").slice(0, 1500);
    const body = decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " "));
    const text = (metas.join(" ｜ ") + " ｜ " + body + (ld ? " ｜ " + ld : ""))
      .replace(/<<<|>>>/g, " ") // 防止偽造分隔符號
      .replace(/\s+/g, " ").trim().slice(0, PAGE_CHARS);
    return { text: truncateTokens(text), html: keepHtml ? html : "", finalUrl: r.url || url };
  } catch { return empty; }
}
