import assert from "node:assert/strict";
import test from "node:test";
import { externalPriceTip } from "./price-tip";
import { searchCatalog, type SearchTool } from "./search-intent";
import { readFileSync } from "node:fs";
import {
  TAVILY_CACHE_SEC,
  TAVILY_DAILY_CAP,
  TAVILY_IP_LIMITS,
  httpsUrl,
  mockWebResults,
  placeExternal,
  resolveExternal,
  sanitizeWebHit,
  type WebHit,
} from "./external-search";

const tools = JSON.parse(readFileSync(new URL("../price-scraper/ai_tools.json", import.meta.url), "utf8")) as SearchTool[];

test("只接受 https，標題裡的標籤會拿掉", () => {
  assert.equal(httpsUrl("javascript:alert(1)"), null);
  assert.equal(httpsUrl("http://example.com/a"), null);
  assert.equal(httpsUrl("https://user:pass@example.com/a"), null);
  assert.equal(httpsUrl("https://127.0.0.1/a"), null);
  assert.equal(httpsUrl("https://freesound.org/"), "https://freesound.org/");
  const hit = sanitizeWebHit({ title: "<script>alert(1)</script><b>Freesound</b>", url: "https://freesound.org/", content: "sound effects" });
  assert.equal(hit?.title, "Freesound");
  assert.equal(hit?.site, "freesound.org");
  assert.doesNotMatch(hit?.title || "", /script|<|>/);
});

test("音效的站外結果放進空的音效組", () => {
  const found = searchCatalog(tools, "音效", { locale: "zh" });
  assert.equal(found.mode, "goal");
  if (found.mode !== "goal") return;
  const hits = mockWebResults("音效");
  const empty = found.groups.filter((g) => g.tools.length === 0).map((g) => g.id);
  const placed = placeExternal(found.goalId, hits, empty);
  assert.ok(empty.includes("sfx"));
  assert.ok((placed.byGroup.sfx || []).some((h) => h.url.startsWith("https://freesound.org")));
  assert.ok((placed.byGroup.sfx || []).every((h) => h.url.startsWith("https://")));
});

test("短影片把音效放進音效組，其餘能對上的放進該組", () => {
  const found = searchCatalog(tools, "我要做一個短影片", { locale: "zh" });
  assert.equal(found.mode, "goal");
  if (found.mode !== "goal") return;
  const hits = mockWebResults("我要做一個短影片");
  const empty = found.groups.filter((g) => g.tools.length === 0).map((g) => g.id);
  const placed = placeExternal(found.goalId, hits, empty);
  assert.ok((placed.byGroup.sfx || []).some((h) => /freesound/.test(h.url)));
  assert.ok((placed.byGroup.footage || []).some((h) => /runwayml/.test(h.url)));
  assert.ok((placed.byGroup.editing || []).some((h) => /capcut/.test(h.url)));
  assert.ok(placed.rest.some((h) => /youtube/.test(h.url)));
});

test("站外價格不編數字", () => {
  const tip = externalPriceTip("zh");
  assert.equal(tip.note, "本站沒有這個網站的價格");
  assert.equal(tip.lines.length, 0);
  assert.equal(externalPriceTip("en").note, "This site has no price for this website.");
});

test("快取命中不再呼叫，沒鑰匙或額度滿了就留空", async () => {
  assert.equal(TAVILY_DAILY_CAP, 30);
  assert.equal(TAVILY_CACHE_SEC, 72 * 60 * 60);
  assert.equal(TAVILY_IP_LIMITS[1].max, 8);
  const cache = new Map<string, WebHit[]>();
  let fetches = 0;
  let slots = 0;
  let ips = 0;
  const fetchImpl: typeof fetch = async () => {
    fetches += 1;
    return new Response(JSON.stringify({
      results: [
        { title: "Freesound <i>音效</i>", url: "https://freesound.org/people/demo/", content: "sound effects" },
        { title: "bad", url: "javascript:alert(1)", content: "x" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const base = {
    query: "音效",
    locale: "zh" as const,
    apiKey: "test-key",
    allowMock: false,
    cacheGet: async (k: string) => cache.get(k) ?? null,
    cacheSet: async (k: string, hits: WebHit[]) => { cache.set(k, hits); },
    takeIp: async () => { ips += 1; return true; },
    takeSiteSlot: async () => { slots += 1; return true; },
    fetchImpl,
  };
  const first = await resolveExternal(base);
  assert.equal(fetches, 1);
  assert.equal(slots, 1);
  assert.equal(ips, 1);
  assert.equal(first.length, 1);
  assert.equal(first[0].title, "Freesound 音效");
  const second = await resolveExternal(base);
  assert.equal(fetches, 1);
  assert.equal(second.length, 1);

  const capped = await resolveExternal({ ...base, query: "另一個查詢", takeSiteSlot: async () => false });
  assert.equal(capped.length, 0);
  assert.equal(fetches, 1);

  let slotAfterIp = 0;
  const limited = await resolveExternal({
    ...base,
    query: "再一個查詢",
    takeIp: async () => false,
    takeSiteSlot: async () => { slotAfterIp += 1; return true; },
  });
  assert.equal(limited.length, 0);
  assert.equal(slotAfterIp, 0);

  const cold = new Map<string, WebHit[]>();
  const noCache = {
    cacheGet: async (k: string) => cold.get(k) ?? null,
    cacheSet: async (k: string, hits: WebHit[]) => { cold.set(k, hits); },
  };
  const missing = await resolveExternal({ ...base, ...noCache, query: "沒鑰匙", apiKey: "", allowMock: false });
  assert.equal(missing.length, 0);
  const mocked = await resolveExternal({ ...base, ...noCache, query: "音效", apiKey: "", allowMock: true });
  assert.ok(mocked.some((h) => h.site === "freesound.org"));
  assert.equal(fetches, 1);
});
