import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPriceTip } from "./price-tip";
import { searchCatalog, type SearchTool } from "./search-intent";

const tools = JSON.parse(readFileSync(new URL("../price-scraper/ai_tools.json", import.meta.url), "utf8")) as SearchTool[];

test("短影片拆成七項，音效這組是空的，其餘有工具", () => {
  const zh = searchCatalog(tools, "我要做一個短影片", { locale: "zh" });
  assert.equal(zh.mode, "goal");
  if (zh.mode !== "goal") return;
  assert.equal(zh.goalId, "short_video");
  assert.deepEqual(zh.groups.map((g) => g.id), ["script", "footage", "editing", "music", "sfx", "voiceover", "captions"]);
  const sfx = zh.groups.find((g) => g.id === "sfx");
  assert.equal(sfx?.tools.length, 0);
  for (const id of ["script", "footage", "editing", "music", "voiceover", "captions"]) {
    assert.ok((zh.groups.find((g) => g.id === id)?.tools.length || 0) > 0, id);
  }
  const footage = zh.groups.find((g) => g.id === "footage");
  const names = footage?.tools.map((t) => t.name) || [];
  assert.ok(names.includes("Runway") && names.includes("Sora"), names.join(", "));
  const script = zh.groups.find((g) => g.id === "script");
  assert.ok(script?.tools.some((t) => t.pricing_model === "freemium"));
  assert.ok(!script?.tools.some((t) => t.name === "Sudowrite"));
  const prices = new Set(zh.groups.flatMap((g) => g.tools.map((t) => t.pricing_model)));
  assert.ok(prices.has("freemium"));
  assert.ok(prices.has("paid"));
});

test("英文短影片走同一個目標", () => {
  const en = searchCatalog(tools, "Make a short video", { locale: "en" });
  assert.equal(en.mode, "goal");
  if (en.mode !== "goal") return;
  assert.equal(en.goalId, "short_video");
  assert.equal(en.goalTitle, "Short video");
});

test("音效沒有直接工具，但仍列出相近分類", () => {
  const zh = searchCatalog(tools, "音效", { locale: "zh" });
  assert.equal(zh.mode, "goal");
  if (zh.mode !== "goal") return;
  assert.equal(zh.groups[0].tools.length, 0);
  assert.ok(zh.groups[1].tools.length > 0);
});

test("目錄價格標成未核對，沒有數字就不編一個", () => {
  const none = buildPriceTip("zh", { free_tier: null, paid_plans: [] }, null);
  assert.equal(none.source, "none");
  const catalog = buildPriceTip("zh", { free_tier: "免費版有限額度", paid_plans: [{ name: "Plus", price_usd_month: 20, notes: "需人工確認" }] }, null);
  assert.equal(catalog.source, "catalog");
  assert.equal(catalog.confirmed, false);
  assert.match(catalog.lines.map((l) => l.text).join(" "), /\$20/);
  assert.match(catalog.note || "", /尚未用已核准/);
  const snap = buildPriceTip("zh", { free_tier: "舊目錄", paid_plans: [{ name: "Old", price_usd_month: 1, notes: null }] }, {
    fetched_at: "2026-10-01T00:00:00Z",
    free_tier: { available: true, limits: "每天 10 次" },
    plans: [{ name: "Pro", price_monthly: 12, currency: "USD" }],
  });
  assert.equal(snap.source, "snapshot");
  const snapText = snap.lines.map((l) => l.text).join(" ");
  assert.match(snapText, /每天 10 次/);
  assert.match(snapText, /\$12/);
  assert.doesNotMatch(snapText, /舊目錄/);
  assert.doesNotMatch(snapText, /\$1(?!\d)/);
});
