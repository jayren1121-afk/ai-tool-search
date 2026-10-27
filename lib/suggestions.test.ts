import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVE_NOTE,
  SUGGEST_DAY_MAX,
  applySuggestion,
  cleanText,
  moderateSuggestion,
  parseSuggestion,
  signSuggestion,
  suggestionSigOk,
  type ParsedSuggestion,
  type SuggestionRow,
} from "./suggestions";

const SECRET = "test-suggestion-secret";
const NOW = "2026-10-27T00:00:00.000Z";

function parsed(over: Partial<ParsedSuggestion> = {}): ParsedSuggestion {
  const url = over.url ?? "https://freesound.org/";
  const title = over.title ?? "Freesound";
  return {
    url,
    title,
    query: over.query ?? "音效",
    subNeed: over.subNeed === undefined ? "sfx" : over.subNeed,
    domainKey: over.domainKey ?? "freesound.org",
    sig: over.sig ?? signSuggestion(SECRET, url, title),
  };
}

test("簽章只對得上同一組網址與標題", () => {
  const url = "https://freesound.org/";
  const title = "Freesound";
  const sig = signSuggestion(SECRET, url, title);
  assert.equal(suggestionSigOk(SECRET, url, title, sig), true);
  assert.equal(suggestionSigOk(SECRET, "https://evil.example/phish", title, sig), false);
  assert.equal(suggestionSigOk(SECRET, url, "別的標題", sig), false);
  assert.equal(suggestionSigOk("other-secret", url, title, sig), false);
  assert.equal(suggestionSigOk(SECRET, url, title, sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a")), false);
});

test("清理標題與網址，壞連結與亂寫的子需求不會進欄位", () => {
  assert.equal(cleanText("<script>alert(1)</script><b>Freesound</b>", 120), "Freesound");
  assert.equal(cleanText("音效\u0000  工具", 20), "音效 工具");
  const body = {
    url: "https://www.epidemicsound.com/sound-effects/",
    title: "<img src=x onerror=alert(1)>Epidemic",
    query: "我要做一個短影片",
    subNeed: "sfx",
    sig: "a".repeat(43),
  };
  const ok = parseSuggestion(body);
  assert.equal(ok?.title, "Epidemic");
  assert.equal(ok?.domainKey, "epidemicsound.com");
  assert.equal(ok?.subNeed, "sfx");
  assert.equal(parseSuggestion({ ...body, url: "javascript:alert(1)" }), null);
  assert.equal(parseSuggestion({ ...body, url: "http://epidemicsound.com/" }), null);
  assert.equal(parseSuggestion({ ...body, url: "https://user:pass@epidemicsound.com/" }), null);
  const weird = parseSuggestion({ ...body, subNeed: "../admin" });
  assert.equal(weird?.subNeed, null);
  const gh = parseSuggestion({ ...body, url: "https://github.com/acme/one", title: "One" });
  const gh2 = parseSuggestion({ ...body, url: "https://github.com/acme/two", title: "Two" });
  assert.equal(gh?.domainKey, "github.com/acme/one");
  assert.notEqual(gh?.domainKey, gh2?.domainKey);
  const again = ok && parseSuggestion({ ...body, url: ok.url, title: ok.title });
  assert.equal(again?.url, ok?.url);
  assert.equal(again?.title, ok?.title);
});

test("同一個網域的待審核建議只加次數，目錄裡已有的不新增", () => {
  const first = applySuggestion([], parsed(), new Set(), "ip1", NOW, "id-1");
  assert.equal(first.state, "pending");
  assert.equal(first.rows.length, 1);
  assert.equal(first.rows[0].submit_count, 1);
  const second = applySuggestion(first.rows, parsed({ url: "https://www.freesound.org/browse/", title: "Freesound 音效", query: "音效庫" }), new Set(), "ip2", "2026-10-27T01:00:00.000Z", "id-2");
  assert.equal(second.rows.length, 1);
  assert.equal(second.rows[0].id, "id-1");
  assert.equal(second.rows[0].submit_count, 2);
  assert.equal(second.rows[0].query, "音效庫");
  assert.equal(second.rows[0].ip_hash, "ip2");
  const listed = applySuggestion([], parsed({ url: "https://runwayml.com/", title: "Runway", domainKey: "runwayml.com" }), new Set(["runwayml.com"]), "ip1", NOW, "id-3");
  assert.equal(listed.state, "catalog");
  assert.equal(listed.rows.length, 0);
  const ghA = parsed({ url: "https://github.com/acme/one", title: "One", domainKey: "github.com/acme/one" });
  const ghB = parsed({ url: "https://github.com/acme/two", title: "Two", domainKey: "github.com/acme/two" });
  const both = applySuggestion(applySuggestion([], ghA, new Set(), "ip", NOW, "g1").rows, ghB, new Set(), "ip", NOW, "g2");
  assert.equal(both.rows.length, 2);
});

test("核准只改狀態與備註，拒絕則清掉備註", () => {
  const made = applySuggestion([], parsed(), new Set(), "ip", NOW, "id-1");
  const approved = moderateSuggestion(made.rows, "id-1", "approve", "2026-10-27T02:00:00.000Z");
  assert.ok(approved);
  assert.equal(approved.note, APPROVE_NOTE);
  assert.equal(approved.rows[0].status, "approved");
  assert.equal(approved.rows[0].note, APPROVE_NOTE);
  assert.equal("name" in approved.rows[0], false);
  const again = applySuggestion(approved.rows, parsed({ query: "再送一次" }), new Set(), "ip", NOW, "id-9");
  assert.equal(again.rows.filter((r) => r.status === "pending").length, 1);
  assert.equal(again.rows.length, 2);
  const rejected = moderateSuggestion(again.rows, "id-9", "reject", NOW);
  assert.equal(rejected?.rows.find((r) => r.id === "id-9")?.status, "rejected");
  assert.equal(rejected?.note, null);
  assert.equal(moderateSuggestion(approved.rows, "id-1", "approve", NOW), null);
  assert.equal(SUGGEST_DAY_MAX, 10);
});

test("簽過名的內容再清理一次仍然對得上", () => {
  const row = parseSuggestion({
    url: "https://pixabay.com/sound-effects/",
    title: "Pixabay 音效",
    query: "音效",
    subNeed: "not a slug!",
    sig: "b".repeat(43),
  });
  assert.ok(row);
  assert.equal(row.subNeed, null);
  const sig = signSuggestion(SECRET, row.url, row.title);
  assert.equal(suggestionSigOk(SECRET, row.url, row.title, sig), true);
  const rows: SuggestionRow[] = [];
  assert.equal(applySuggestion(rows, { ...row, sig }, new Set(), "abc", NOW, "p1").rows[0].title, "Pixabay 音效");
});
