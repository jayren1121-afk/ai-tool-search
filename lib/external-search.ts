// 站外搜尋的純邏輯：清理連結、把結果放進對應的子需求、以及要不要真的去呼叫 Tavily。
import { createHash } from "node:crypto";
import type { Locale } from "./i18n";
import { externalNeedScores, normalizeQuery } from "./search-intent";
import { hostOf, stripHtml } from "./textutil";

export const TAVILY_DAILY_CAP = 30;
export const TAVILY_CACHE_SEC = 72 * 60 * 60;
/** 單一 IP：每分鐘 5 次、每天 8 次未命中快取的查詢，避免一個人用完整站 30 次。 */
export const TAVILY_IP_LIMITS = [
  { name: "min", max: 5, windowSec: 60 },
  { name: "day", max: 8, windowSec: 86400 },
] as const;

export type WebHit = { title: string; url: string; site: string; snippet: string };

const PER_GROUP = 3;
const REST_MAX = 6;

function clean(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

/** 只留 https，丟掉 javascript:、帳號密碼、本機與 IP。 */
export function httpsUrl(raw: string): string | null {
  if (!raw || raw.length > 2000) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
  u.hash = "";
  return u.toString();
}

export function sanitizeWebHit(raw: { title?: unknown; url?: unknown; content?: unknown; snippet?: unknown }): WebHit | null {
  const url = httpsUrl(typeof raw.url === "string" ? raw.url : "");
  if (!url) return null;
  const site = hostOf(url);
  if (!site) return null;
  const title = clean(stripHtml(typeof raw.title === "string" ? raw.title : "")).slice(0, 120) || site;
  const snippet = clean(stripHtml(String(raw.snippet ?? raw.content ?? ""))).slice(0, 180);
  return { title, url, site, snippet };
}

export function externalSearchText(query: string, locale: Locale): string {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 180);
  const suffix = locale === "en" ? "AI tool" : "AI 工具";
  return `${q} ${suffix}`.slice(0, 300);
}

export function externalCacheKey(query: string, locale: Locale): string {
  return "webq:" + createHash("sha256").update(normalizeQuery(externalSearchText(query, locale))).digest("hex").slice(0, 40);
}

/** 對得上子需求的放進那一組（空組同分時優先），其餘留到結果最下面。 */
export function placeExternal<T extends { title: string; snippet: string; url: string }>(
  goalId: string,
  hits: T[],
  emptyIds: string[] = [],
): { byGroup: Record<string, T[]>; rest: T[] } {
  const empty = new Set(emptyIds);
  const byGroup: Record<string, T[]> = {};
  const rest: T[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    const scores = externalNeedScores(goalId, `${hit.title} ${hit.snippet}`);
    if (!scores.length) { rest.push(hit); continue; }
    scores.sort((a, b) => b.score - a.score || Number(empty.has(b.id)) - Number(empty.has(a.id)));
    const id = scores[0].id;
    const bucket = byGroup[id] || (byGroup[id] = []);
    if (bucket.length < PER_GROUP) bucket.push(hit);
    else rest.push(hit);
  }
  return { byGroup, rest: rest.slice(0, REST_MAX) };
}

/** 沒有鑰匙的本機畫面用。正式環境不會走到這裡。 */
export function mockWebResults(query: string): WebHit[] {
  const q = query.toLowerCase();
  const sfx = /音效|sound effect|sfx|foley/.test(q);
  const video = /短影|short video|影片|video/.test(q);
  const raw: { title: string; url: string; content: string }[] = [];
  if (sfx || video) {
    raw.push(
      { title: "Freesound — 免費音效", url: "https://freesound.org/", content: "A collaborative database of Creative Commons sound effects and foley." },
      { title: "Epidemic Sound 音效庫", url: "https://www.epidemicsound.com/sound-effects/", content: "Royalty-free sound effects for videos." },
      { title: "<b>Pixabay</b> 音效", url: "https://pixabay.com/sound-effects/", content: "Free sound effects to download." },
    );
  }
  if (video) {
    raw.push(
      { title: "Runway 影片生成", url: "https://runwayml.com/", content: "AI video generation for short clips." },
      { title: "CapCut 剪輯", url: "https://www.capcut.com/", content: "A video editor for short videos." },
      { title: "短片拍攝入門", url: "https://www.youtube.com/results?search_query=short+video+ideas", content: "A general page of short video ideas." },
    );
  }
  if (!raw.length) {
    raw.push({ title: "AI tool roundup", url: "https://example.com/ai-tools", content: "A general list of AI tools." });
  }
  // 壞連結要被清掉，確認清理有作用。
  raw.push({ title: "javascript:alert(1)", url: "javascript:alert(1)", content: "nope" });
  raw.push({ title: "plain http", url: "http://example.com/insecure", content: "nope" });
  return raw.map(sanitizeWebHit).filter((h): h is WebHit => !!h);
}

export type ResolveDeps = {
  query: string;
  locale: Locale;
  apiKey: string;
  allowMock: boolean;
  cacheGet: (key: string) => Promise<WebHit[] | null>;
  cacheSet: (key: string, hits: WebHit[], ttlSec: number) => Promise<void>;
  /** 回傳 false 表示這個 IP 已超過次數，不再往下扣全站額度。 */
  takeIp: () => Promise<boolean>;
  /** 回傳 false 表示全站今天的未命中次數已滿。 */
  takeSiteSlot: () => Promise<boolean>;
  fetchImpl: typeof fetch;
};

function dedupe(hits: WebHit[]): WebHit[] {
  const seen = new Set<string>();
  const out: WebHit[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push(h);
  }
  return out.slice(0, 8);
}

async function callTavily(apiKey: string, text: string, fetchImpl: typeof fetch): Promise<WebHit[]> {
  const r = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: text,
      search_depth: "basic",
      topic: "general",
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`tavily ${r.status}`);
  const j = await r.json() as { results?: { title?: unknown; url?: unknown; content?: unknown }[] };
  const hits = (Array.isArray(j.results) ? j.results : []).map(sanitizeWebHit).filter((h): h is WebHit => !!h);
  return dedupe(hits);
}

/**
 * 先看 72 小時快取。沒有鑰匙、IP 超過次數、或全站 30 次未命中已滿，都回傳空陣列，讓呼叫端只顯示站內結果。
 * 本機若允許 mock，沒有鑰匙時改回固定的範例連結，正式環境不會開。
 */
export async function resolveExternal(opts: ResolveDeps): Promise<WebHit[]> {
  const key = externalCacheKey(opts.query, opts.locale);
  const cached = await opts.cacheGet(key);
  if (cached !== null) return dedupe(cached.map((h) => sanitizeWebHit(h)).filter((h): h is WebHit => !!h));
  if (!opts.apiKey) return opts.allowMock ? mockWebResults(opts.query) : [];
  if (!(await opts.takeIp())) return [];
  if (!(await opts.takeSiteSlot())) return [];
  try {
    const hits = await callTavily(opts.apiKey, externalSearchText(opts.query, opts.locale), opts.fetchImpl);
    await opts.cacheSet(key, hits, TAVILY_CACHE_SEC);
    return hits;
  } catch {
    return [];
  }
}
