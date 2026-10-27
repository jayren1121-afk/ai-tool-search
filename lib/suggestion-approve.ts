import "server-only";
import { hostKey } from "./discovery";
import { callProviderJSON } from "./llm";
import { pageText, publicHttpUrl } from "./pagetext";
import {
  SUGGEST_LLM_ORDER,
  catalogPrompt,
  failureNote,
  mockCatalogRaw,
  parseCatalogDraft,
  redact,
  type CatalogDraft,
} from "./suggestion-catalog";

const env = (k: string) => (process.env[k] || "").trim();
const KEY = { groq: "GROQ_API_KEY", openrouter: "OPENROUTER_API_KEY" } as const;
const FETCH_ERROR = "抓取被拒絕或沒有可讀文字";

function allowMock(): boolean {
  return process.env.NODE_ENV !== "production" && env("SUGGEST_APPROVE_MOCK") === "1";
}

/** Groq 然後 OpenRouter。不呼叫 Gemini，也不改每日檢查那條供應商鏈。 */
async function catalogModelText(system: string, user: string, title: string, page: string): Promise<string> {
  const order = SUGGEST_LLM_ORDER.filter((p) => env(KEY[p]));
  if (!order.length) {
    if (allowMock()) return mockCatalogRaw(title, page);
    throw new Error("尚未設定 GROQ_API_KEY 或 OPENROUTER_API_KEY");
  }
  const errs: string[] = [];
  for (const provider of order) {
    try { return await callProviderJSON(provider, system, user, 25000); }
    catch (e) { errs.push(redact((e as Error).message).slice(0, 80)); }
  }
  throw new Error(errs.join("；") || "AI 呼叫失敗");
}

export async function prepareCatalogDraft(url: string, title: string, query: string): Promise<{ draft: CatalogDraft; domain: string } | { error: string }> {
  if (!publicHttpUrl(url)) return { error: FETCH_ERROR };
  let page: { text: string; finalUrl?: string };
  try {
    page = await pageText(url, false, { strict: true, timeoutMs: 10000 });
  } catch {
    return { error: FETCH_ERROR };
  }
  if (page.text.length < 80) return { error: FETCH_ERROR };
  const domain = hostKey(page.finalUrl || url);
  if (!domain) return { error: FETCH_ERROR };
  let raw: string;
  try {
    const prompt = catalogPrompt(title, query, url, page.text);
    raw = await catalogModelText(prompt.system, prompt.user, title, page.text);
  } catch (e) {
    return { error: failureNote((e as Error).message).replace(/^失敗：/, "") };
  }
  const draft = parseCatalogDraft(raw, page.text, title, url);
  if ("error" in draft) return { error: draft.error };
  return { draft, domain };
}
