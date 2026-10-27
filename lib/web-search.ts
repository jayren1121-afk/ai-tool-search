import "server-only";
import { checkLimits, incrPublic, ipHash, upstashEnabled } from "./security";
import { TAVILY_CACHE_SEC, TAVILY_DAILY_CAP, TAVILY_IP_LIMITS, resolveExternal, type WebHit } from "./external-search";
import type { Locale } from "./i18n";

// Tavily 免費方案約每月 1,000 點。basic 搜尋一次 1 點，所以未命中快取的呼叫全站每天 30 次。
// 快取鍵是正規化後的查詢，72 小時。沒有鑰匙或額度用完時回傳空陣列。

const env = (k: string) => (process.env[k] || "").trim();
const mem = new Map<string, { exp: number; hits: WebHit[] }>();

function dayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

async function upstash(commands: unknown[]): Promise<unknown[] | null> {
  if (!upstashEnabled()) return null;
  try {
    const r = await fetch(env("UPSTASH_REDIS_REST_URL").replace(/\/+$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("UPSTASH_REDIS_REST_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch {
    console.error("tavily cache unavailable");
    return null;
  }
}

async function cacheGet(key: string): Promise<WebHit[] | null> {
  const now = Date.now();
  const local = mem.get(key);
  if (local && local.exp > now) return local.hits;
  const j = await upstash([["GET", key]]);
  const raw = (j?.[0] as { result?: unknown } | undefined)?.result;
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as WebHit[];
    if (!Array.isArray(parsed)) return null;
    mem.set(key, { exp: now + TAVILY_CACHE_SEC * 1000, hits: parsed });
    return parsed;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, hits: WebHit[], ttlSec: number): Promise<void> {
  mem.set(key, { exp: Date.now() + ttlSec * 1000, hits });
  await upstash([["SET", key, JSON.stringify(hits), "EX", String(ttlSec)]]);
}

/** 站外結果。失敗、沒鑰匙、或超過額度時是空陣列，不影響站內搜尋。 */
export async function searchWeb(query: string, locale: Locale, ip: string): Promise<WebHit[]> {
  const apiKey = env("TAVILY_API_KEY");
  return resolveExternal({
    query,
    locale,
    apiKey,
    allowMock: process.env.NODE_ENV !== "production" && process.env.TAVILY_MOCK === "1" && !apiKey,
    cacheGet,
    cacheSet,
    takeIp: async () => (await checkLimits("websearch", ipHash(ip), [...TAVILY_IP_LIMITS])) === null,
    takeSiteSlot: async () => (await incrPublic(`cap:tavily:${dayKey()}`, 86400 + 3600)) <= TAVILY_DAILY_CAP,
    fetchImpl: fetch,
  });
}
