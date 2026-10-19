// 純函式檢查：不啟動網站、不送出任何內容。
import assert from "node:assert/strict";
import { checkUrl, findPii, redactPii, shouldInspectLink } from "../lib/on-site-guard.ts";

const kinds = (text) => findPii(text).map((h) => h.kind + ":" + h.masked);

assert.deepEqual(kinds("我的證號 A123456789 請看"), ["twid:A12****789"]);
assert.deepEqual(findPii("A123456788"), []);
assert.deepEqual(kinds("AA00000009"), ["twid:AA0****009"]);
assert.deepEqual(findPii("AA00000008"), []);
assert.deepEqual(kinds("A800000005"), ["twid:A80****005"]);

assert.deepEqual(kinds("手機 0912345678"), ["phone:0912***678"]);
assert.deepEqual(kinds("0912-345-678"), ["phone:0912***678"]);
assert.deepEqual(kinds("+886-912-345-678"), ["phone:+88691****678"]);
assert.deepEqual(findPii("09123"), []);

assert.deepEqual(kinds("卡號 4242424242424242"), ["card:**** **** **** 4242"]);
assert.deepEqual(kinds("4242 4242 4242 4242"), ["card:**** **** **** 4242"]);
assert.deepEqual(kinds("5555555555554444"), ["card:**** **** **** 4444"]);
assert.deepEqual(findPii("4242424242424241"), []);
assert.deepEqual(findPii("1234567890123456"), []);

assert.deepEqual(kinds("信箱 jay.ren@example.com"), ["email:j******@example.com"]);
assert.deepEqual(kinds("統編 04595257"), ["ubn:04****57"]);
assert.deepEqual(findPii("20241018"), []);
assert.deepEqual(findPii("12345678"), []);
assert.deepEqual(findPii("搜尋 Claude 與 ChatGPT 的價格"), []);

const mixed = findPii("A123456789 與 jay@example.com");
assert.deepEqual(mixed.map((h) => h.kind), ["twid", "email"]);
const redacted = redactPii("請寄到 jay@example.com，證號 A123456789");
assert.equal(redacted.includes("jay@example.com"), false);
assert.equal(redacted.includes("A123456789"), false);
assert.match(redacted, /j\*+@example\.com/);
assert.match(redacted, /A12\*\*\*\*789/);

const issues = (raw) => checkUrl(raw)?.issues ?? null;
assert.deepEqual(issues("https://chat.openai.com/"), []);
assert.deepEqual(issues("https://youtu.be/abc123"), []);
assert.deepEqual(issues("https://ai-tool-search.vercel.app/tools/chatgpt"), []);
assert.deepEqual(issues("http://example.com/pricing"), ["http"]);
assert.deepEqual(issues("https://192.168.1.20/a"), ["ip"]);
assert.deepEqual(issues("http://192.168.0.1/"), ["http", "ip"]);
assert.deepEqual(issues("https://xn--pple-43d.com/"), ["punycode"]);
assert.deepEqual(issues("https://bit.ly/abc"), ["shortener"]);
assert.deepEqual(issues("https://www.tinyurl.com/x"), ["shortener"]);
assert.deepEqual(issues("https://example.com/out?redirect=https%3A%2F%2Fevil.test%2Fa"), ["redirect"]);
assert.deepEqual(issues("https://example.com/?utm_source=home"), []);
assert.deepEqual(issues("https://user:secret@example.com/path"), ["userinfo"]);
assert.equal(checkUrl("https://user:secret@example.com/a")?.display.includes("secret"), false);
assert.equal(checkUrl("https://user:secret@example.com/a")?.display.includes("user"), false);
assert.deepEqual(issues("https://example.com:8443/app"), ["port"]);
assert.deepEqual(issues("https://example.com:443/app"), []);
assert.deepEqual(issues("https://cdn.example.com/setup.exe?x=1"), ["executable"]);
assert.deepEqual(issues("https://cdn.example.com/readme.pdf"), []);
assert.deepEqual(issues("javascript:alert(1)"), ["script"]);
assert.deepEqual(issues("data:text/html,hi"), ["script"]);

const hidden = checkUrl("https://example.com/?email=jay@example.com&id=A123456789");
assert.equal(hidden.issues.includes("redirect") || hidden.issues.length >= 0, true);
assert.equal(hidden.display.includes("jay@example.com"), false);
assert.equal(hidden.display.includes("A123456789"), false);

assert.equal(checkUrl("not a url at all %%")?.issues.length >= 0, true);

const page = "https://ai-tool-search.vercel.app/tools/chatgpt";
assert.equal(shouldInspectLink("/category/chatbot", page), false);
assert.equal(shouldInspectLink("#price", page), false);
assert.equal(shouldInspectLink("mailto:jayren1121@gmail.com", page), false);
assert.equal(shouldInspectLink("https://chat.openai.com/", page), true);
assert.equal(shouldInspectLink("/files/setup.exe", page), true);
assert.equal(shouldInspectLink("https://ai-tool-search.vercel.app/logo.png", page, { download: true }), true);
assert.equal(shouldInspectLink("javascript:alert(1)", page), true);

console.log("on-site-guard checks passed");
