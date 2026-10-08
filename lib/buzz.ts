import "server-only";
import { distinctHost, estTokens, hostOf, stripHtml } from "./textutil";

export type Snippet = { id: string; site: string; title: string; text: string; url: string };
export type BuzzFetch = { snippets: Snippet[]; checked: string[]; hnMentions90d: number | null };

const env = (k: string) => (process.env[k] || "").trim();
const UA = "jAytal-ai-tool-search/1.0 (+https://ai-tool-search.vercel.app; community summary bot)";
const SNIPPET_CHARS = 220;
const BUZZ_TOKENS = 900; // 口碑片段總 token 上限（配合 Groq 免費額度）

async function getJson(url: string, init: RequestInit = {}, ms = 6000): Promise<any> {
  const r = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers || {}) }, signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** 片段需提到工具名稱（整字比對）；名稱過短或為常見字時，另需提到網域或 AI 相關字 */
function relevant(text: string, name: string, host: string) {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${esc(name)}([^\\p{L}\\p{N}]|$)`, "giu");
  const hits = [...text.matchAll(re)].map((m) => m.index ?? 0);
  if (!hits.length) return false;
  const generic = name.length <= 5 || /^(make|rows|jan|pi|merlin|cursor|claude|copilot|gamma|pitch|hex|mode|loom|motion|craft|tana|lex|writer|rev|speak|clay|ramp|dust|warp|zed|continue|replit|bolt|lovable|v0|kiro|trae|devin|aider|cline|recall|reflect|glean|guru|mem|krisp|otter|descript|runway|pika|luma|sora|kling|suno|udio|whisper|gemini|jasper|poe|character|perplexity|notion|grammarly|elicit|consensus|scite|julius|tome|beautiful|synthesia|invideo|fliki|murf|eleven|sudowrite|rytr|copy|anyword|frase|surfer)$/i.test(name);
  if (!generic) return true;
  const hostRoot = host.split(".")[0];
  // 常見字名稱：只看名稱出現處前後 160 字內是否有網域或 AI 工具語境，避免「gamma ray」之類誤判
  return hits.some((i) => {
    const w = text.slice(Math.max(0, i - 160), i + name.length + 160), lower = w.toLowerCase();
    return (!!host && (lower.includes(host) || (hostRoot.length >= 3 && lower.includes(hostRoot + ".")))) || new RegExp(`${esc(name)}[\\s.-]?(ai|app|ide)\\b`, "i").test(w) || /\b(llms?|gpt-?\d*|chatgpt|openai|anthropic|claude|copilot|prompts?|ai (tools?|apps?|assistants?|models?|agents?|coding|harness)|coding agents?|vibe coding)\b/i.test(w);
  });
}
function clip(t: string, name: string) {
  const i = t.toLowerCase().indexOf(name.toLowerCase());
  const start = Math.max(0, i - 60);
  return (start > 0 ? "…" : "") + t.slice(start, start + SNIPPET_CHARS) + (t.length > start + SNIPPET_CHARS ? "…" : "");
}

async function hackerNews(name: string, host: string): Promise<{ snippets: Omit<Snippet, "id">[]; mentions: number | null }> {
  const now = Math.floor(Date.now() / 1000);
  const since90 = now - 90 * 86400, since365 = now - 365 * 86400;
  const base = "https://hn.algolia.com/api/v1/search";
  const [count, comments] = await Promise.all([
    host ? getJson(`${base}?query=${encodeURIComponent(`"${host}"`)}&tags=(story,comment)&numericFilters=created_at_i>${since90}&hitsPerPage=0`).catch(() => null) : null,
    getJson(`${base}?query=${encodeURIComponent(`"${name}"`)}&tags=comment&numericFilters=created_at_i>${since365}&hitsPerPage=30`).catch(() => null),
  ]);
  const out: Omit<Snippet, "id">[] = [];
  for (const h of comments?.hits ?? []) {
    const text = stripHtml(String(h.comment_text ?? ""));
    if (text.length < 40 || !relevant(text, name, host)) continue;
    out.push({ site: "Hacker News", title: String(h.story_title ?? "HN 留言").slice(0, 80), text: clip(text, name), url: `https://news.ycombinator.com/item?id=${h.objectID}` });
    if (out.length >= 6) break;
  }
  return { snippets: out, mentions: typeof count?.nbHits === "number" ? count.nbHits : null };
}

async function reddit(name: string, host: string): Promise<Omit<Snippet, "id">[]> {
  if (env("REDDIT_DISABLED") === "1") return [];
  const j = await getJson(`https://www.reddit.com/search.json?q=${encodeURIComponent(`"${name}"`)}&sort=relevance&t=year&limit=15&raw_json=1`);
  const out: Omit<Snippet, "id">[] = [];
  for (const c of j?.data?.children ?? []) {
    const d = c?.data ?? {}; const text = `${d.title ?? ""} ${stripHtml(String(d.selftext ?? ""))}`.trim();
    if (d.over_18 || !relevant(text, name, host)) continue;
    out.push({ site: `Reddit r/${d.subreddit ?? ""}`, title: String(d.title ?? "").slice(0, 80), text: clip(text, name), url: `https://www.reddit.com${d.permalink ?? ""}` });
    if (out.length >= 4) break;
  }
  return out;
}

const TW_DOMAINS = ["ptt.cc", "dcard.tw", "mobile01.com", "producthunt.com", "threads.net", "reddit.com"];
async function webSearch(name: string, host: string): Promise<{ label: string; items: Omit<Snippet, "id">[] } | null> {
  const q = `${name} 評價 心得 使用經驗`;
  if (env("TAVILY_API_KEY")) {
    const j = await getJson("https://api.tavily.com/search", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("TAVILY_API_KEY")}` },
      body: JSON.stringify({ query: q, max_results: 6, search_depth: "basic", include_domains: TW_DOMAINS }),
    }, 8000);
    return { label: "Tavily 搜尋", items: (j?.results ?? []).map((r: any) => ({ site: hostOf(r.url), title: String(r.title ?? "").slice(0, 80), text: clip(stripHtml(String(r.content ?? "")), name), url: String(r.url) })).filter((s: any) => /^https?:\/\//.test(s.url) && relevant(`${s.title} ${s.text}`, name, host)).slice(0, 4) };
  }
  if (env("BRAVE_SEARCH_API_KEY")) {
    const sites = TW_DOMAINS.map((d) => `site:${d}`).join(" OR ");
    const j = await getJson(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(`${q} (${sites})`)}&count=6`, { headers: { "X-Subscription-Token": env("BRAVE_SEARCH_API_KEY") } }, 8000);
    return { label: "Brave 搜尋", items: (j?.web?.results ?? []).map((r: any) => ({ site: hostOf(r.url), title: stripHtml(String(r.title ?? "")).slice(0, 80), text: clip(stripHtml(String(r.description ?? "")), name), url: String(r.url) })).filter((s: any) => /^https?:\/\//.test(s.url) && relevant(`${s.title} ${s.text}`, name, host)).slice(0, 4) };
  }
  return null;
}

/** 從免費來源抓取真實討論片段；任何來源失敗都只略過 */
export async function fetchBuzz(name: string, url: string): Promise<BuzzFetch> {
  const host = distinctHost(url) || ""; // 共用網域（github.com 等）不做網域比對
  const checked: string[] = [];
  const [hn, rd, ws] = await Promise.allSettled([hackerNews(name, host), reddit(name, host), webSearch(name, host)]);
  let all: Omit<Snippet, "id">[] = [];
  let mentions: number | null = null;
  if (hn.status === "fulfilled") { checked.push(`Hacker News（${hn.value.snippets.length} 則）`); all.push(...hn.value.snippets); mentions = hn.value.mentions; }
  else checked.push("Hacker News（連線失敗）");
  if (rd.status === "fulfilled") { if (env("REDDIT_DISABLED") !== "1") checked.push(`Reddit（${rd.value.length} 則）`); all.push(...rd.value); }
  else checked.push("Reddit（無法存取，可能被封鎖）");
  if (ws.status === "fulfilled" && ws.value) { checked.push(`${ws.value.label}（${ws.value.items.length} 則）`); all.push(...ws.value.items); }
  else if (ws.status === "rejected") checked.push("網路搜尋 API（連線失敗）");
  // 去重並限制總長度
  const seen = new Set<string>(); let budget = BUZZ_TOKENS; const snippets: Snippet[] = [];
  // 交錯排列不同來源，避免單一來源佔滿
  const bySite = new Map<string, Omit<Snippet, "id">[]>();
  for (const s of all) { const k = s.site.split(" ")[0]; bySite.set(k, [...(bySite.get(k) || []), s]); }
  const queues = [...bySite.values()];
  while (queues.some((q) => q.length)) for (const q of queues) {
    const s = q.shift(); if (!s || seen.has(s.url)) continue;
    const cost = estTokens(s.title + s.text) + 15; if (cost > budget) continue;
    seen.add(s.url); budget -= cost; snippets.push({ ...s, id: `S${snippets.length + 1}` });
  }
  return { snippets, checked, hnMentions90d: mentions };
}
