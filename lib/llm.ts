import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { Conf, Diagnosis, Evidence, EvidenceField } from "./types";

export type Provider = "groq" | "gemini" | "openrouter";
const env = (k: string) => (process.env[k] || "").trim();

const FIELDS = ["price", "plans", "is_wrapper", "underlying_models", "summary"] as const;
const CONF = { type: "string", enum: ["high", "medium", "low"] };
const EVID = { type: "object", properties: { quote: { type: "string" }, source: { type: "string" } }, required: ["quote", "source"] };

export const DIAGNOSIS_SCHEMA = {
  type: "object",
  properties: {
    useful: { type: "boolean" }, score: { type: "number" }, verdict: { type: "string" }, price_summary: { type: "string" },
    plans: { type: "array", items: { type: "object", properties: { name: { type: "string" }, price: { type: "string" }, notes: { type: "string" } }, required: ["name", "price", "notes"] } },
    is_wrapper: { type: "string", enum: ["true", "false", "partial", "unknown"] },
    underlying_models: { type: "array", items: { type: "string" } },
    summary: { type: "array", items: { type: "string" } }, pros: { type: "array", items: { type: "string" } },
    cons: { type: "array", items: { type: "string" } }, sources: { type: "array", items: { type: "string" } },
    field_confidence: { type: "object", properties: Object.fromEntries(FIELDS.map((f) => [f, CONF])), required: [...FIELDS] },
    evidence: { type: "object", properties: Object.fromEntries(FIELDS.map((f) => [f, EVID])), required: [...FIELDS] },
    data_quality: { type: "string" },
  },
  required: ["useful", "score", "verdict", "price_summary", "plans", "is_wrapper", "underlying_models", "summary", "pros", "cons", "sources", "field_confidence", "evidence", "data_quality"],
};

export const JSON_SHAPE = `只輸出一個 JSON 物件（不要 markdown），格式：
{"useful":true,"score":7,"verdict":"一句話結論","price_summary":"價位摘要或「無法確認」","plans":[{"name":"方案名","price":"$20/月","notes":"備註"}],"is_wrapper":"true|false|partial|unknown","underlying_models":["模型名"],"summary":["重點1","重點2"],"pros":["優點"],"cons":["缺點"],"sources":["https://..."],
"field_confidence":{"price":"high|medium|low","plans":"...","is_wrapper":"...","underlying_models":"...","summary":"..."},
"evidence":{"price":{"quote":"自網頁逐字引用的原文（無則空字串）","source":"網址"},"plans":{"quote":"","source":""},"is_wrapper":{"quote":"","source":""},"underlying_models":{"quote":"","source":""},"summary":{"quote":"","source":""}},
"data_quality":"網頁文字是否充足的說明（例如：價格頁內容過少）"}`;

const strArr = (v: unknown, max = 8): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max);
const conf = (v: unknown): Conf => (v === "high" || v === "medium" || v === "low" ? v : "low");

/** 將模型輸出正規化為固定結構，缺漏欄位給預設值 */
export function normalize(raw: unknown): Diagnosis {
  let o: Record<string, unknown> = {};
  if (typeof raw === "string") {
    const s = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const m = s.match(/\{[\s\S]*\}/);
    o = JSON.parse(m ? m[0] : s);
  } else if (raw && typeof raw === "object") o = raw as Record<string, unknown>;
  if (o.diagnosis && typeof o.diagnosis === "object") o = o.diagnosis as Record<string, unknown>;
  const score = Math.max(0, Math.min(10, Number(o.score) || 0));
  const w = String(o.is_wrapper ?? "unknown").toLowerCase();
  const plans = (Array.isArray(o.plans) ? o.plans : []).slice(0, 10).map((p) => {
    const q = (p && typeof p === "object" ? p : { name: String(p) }) as Record<string, unknown>;
    return { name: String(q.name ?? "").trim() || "未命名", price: String(q.price ?? "無法確認"), notes: String(q.notes ?? "") };
  });
  const fc = (o.field_confidence && typeof o.field_confidence === "object" ? o.field_confidence : {}) as Record<string, unknown>;
  const ev = (o.evidence && typeof o.evidence === "object" ? o.evidence : {}) as Record<string, unknown>;
  const field_confidence: Partial<Record<EvidenceField, Conf>> = {};
  const evidence: Partial<Record<EvidenceField, Evidence>> = {};
  for (const f of FIELDS) {
    field_confidence[f] = conf(fc[f]);
    const e = (ev[f] && typeof ev[f] === "object" ? ev[f] : {}) as Record<string, unknown>;
    evidence[f] = { quote: String(e.quote ?? "").trim().slice(0, 300), source: String(e.source ?? "").trim().slice(0, 300) };
  }
  const d: Diagnosis = {
    useful: typeof o.useful === "boolean" ? o.useful : String(o.useful).toLowerCase() === "true" || score >= 6,
    score, verdict: String(o.verdict ?? ""), price_summary: String(o.price_summary ?? "").trim() || "無法確認", plans,
    is_wrapper: (["true", "false", "partial", "unknown"].includes(w) ? w : w === "yes" ? "true" : w === "no" ? "false" : "unknown") as Diagnosis["is_wrapper"],
    underlying_models: strArr(o.underlying_models), summary: strArr(o.summary), pros: strArr(o.pros), cons: strArr(o.cons),
    sources: strArr(o.sources, 10), field_confidence, evidence, data_quality: String(o.data_quality ?? "").slice(0, 300), schema_version: 2,
  };
  if (!d.verdict && !d.summary.length) throw new Error("模型輸出缺少必要欄位");
  return d;
}

const squash = (t: string) => t.toLowerCase().replace(/[\s"'“”‘’`]+/g, "");
/** 事後檢查：引用文字必須真的出現在抓取到的網頁中，否則降級信心並清除無根據的判斷 */
export function enforceEvidence(d: Diagnosis, pageText: string, thin: boolean): Diagnosis {
  const hay = squash(pageText);
  for (const f of FIELDS) {
    const e = d.evidence?.[f];
    if (!e) continue;
    const q = squash(e.quote);
    e.verified = q.length >= 4 && hay.includes(q.slice(0, 80));
    if (!e.verified && d.field_confidence) d.field_confidence[f] = "low";
  }
  if (d.is_wrapper !== "unknown" && !d.evidence?.is_wrapper?.verified) d.is_wrapper = "unknown";
  if (!d.evidence?.underlying_models?.verified) d.underlying_models = [];
  if (!d.evidence?.price?.verified && !d.evidence?.plans?.verified) {
    d.plans = d.plans.map((p) => ({ ...p, notes: (p.notes ? p.notes + "；" : "") + "官網文字中未找到對應引用，請以官網為準" }));
  }
  if (thin && !d.data_quality) d.data_quality = "抓取到的網頁文字很少（可能為 JavaScript 渲染或阻擋機器人），診斷可信度有限";
  return d;
}

async function openaiCompatible(url: string, key: string, model: string, system: string, user: string, extra: Record<string, unknown> = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(url.includes("openrouter") ? { "HTTP-Referer": "https://ai-tool-search.vercel.app", "X-Title": "AI Tool Search" } : {}) },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, temperature: 0.2, max_completion_tokens: 2200, ...extra }),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${j?.error?.message ?? "unknown"}`);
  const content = j?.choices?.[0]?.message?.content;
  if (!content) throw new Error("空的回應");
  return content as string;
}

export function modelFor(p: Provider): string {
  if (p === "groq") return env("GROQ_MODEL") || "openai/gpt-oss-120b";
  if (p === "openrouter") return env("OPENROUTER_MODEL") || "google/gemma-4-31b-it:free";
  return env("GEMINI_MODEL") || "gemini-2.5-flash";
}
const KEY: Record<Provider, string> = { groq: "GROQ_API_KEY", gemini: "GEMINI_API_KEY", openrouter: "OPENROUTER_API_KEY" };

/** 依 LLM_PROVIDER 為主，失敗時改用其他已設定金鑰的供應商 */
export function providerOrder(): Provider[] {
  const all: Provider[] = ["groq", "gemini", "openrouter"];
  const p = env("LLM_PROVIDER").toLowerCase() as Provider;
  const primary = all.includes(p) ? p : "groq";
  return [primary, ...all.filter((x) => x !== primary)].filter((x) => env(KEY[x]));
}

export async function callProvider(p: Provider, system: string, user: string): Promise<Diagnosis> {
  const model = modelFor(p);
  if (p === "gemini") {
    const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
    const r = await ai.models.generateContent({ model, contents: `${system}\n\n${user}`, config: { responseMimeType: "application/json", responseJsonSchema: DIAGNOSIS_SCHEMA, temperature: 0.2 } });
    return normalize(r.text || "");
  }
  if (p === "groq") {
    const extra = model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
    return normalize(await openaiCompatible("https://api.groq.com/openai/v1/chat/completions", env("GROQ_API_KEY"), model, system, user, extra));
  }
  return normalize(await openaiCompatible("https://openrouter.ai/api/v1/chat/completions", env("OPENROUTER_API_KEY"), model, system, user));
}
