// 站外結果「建議給管理員」的純邏輯：清理、簽章、依網域合併。不含資料庫。
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hostKey } from "./discovery";
import { httpsUrl } from "./external-search";
import { stripHtml } from "./textutil";

/** 每個 IP 雜湊每天最多送出幾次（含「目錄裡已有」的重複點擊）。 */
export const SUGGEST_DAY_MAX = 10;
export const SUGGEST_LIMITS = [{ name: "day", max: SUGGEST_DAY_MAX, windowSec: 86400 }] as const;
/** 第三階段核准只留這句，不寫入 ai_tools。 */
export const APPROVE_NOTE = "已核准，尚未寫入目錄（第四階段）";

export type SuggestionStatus = "pending" | "approved" | "rejected";
export type SuggestionRow = {
  id: string;
  url: string;
  title: string;
  query: string;
  sub_need: string | null;
  domain_key: string;
  status: SuggestionStatus;
  submit_count: number;
  ip_hash: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  draft?: unknown;
  tool_id?: string | null;
};

const CTRL = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const SUB_NEED = /^[a-z][a-z0-9_]{0,31}$/;
const SIG_RE = /^[A-Za-z0-9_-]{20,128}$/;

export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return stripHtml(raw).replace(CTRL, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * 簽章密鑰。正式環境請設 SUGGESTION_SIGNING_SECRET。
 * 沒設時依序用既有的伺服器密鑰，避免把簽章密鑰寫死在程式裡。
 * 四個都沒有時，正式環境不簽、也不接受建議；本機開發才用這次行程的隨機密鑰。
 */
export function configuredSuggestionSecret(env: (k: string) => string): string {
  return env("SUGGESTION_SIGNING_SECRET") || env("IP_HASH_SALT") || env("ADMIN_SESSION_SECRET") || env("SUPABASE_SERVICE_ROLE_KEY") || "";
}

const memSecret = globalThis as { __suggestionSigningSecret?: string };

export function resolveSuggestionSecret(env: (k: string) => string, isProd: boolean): string {
  const set = configuredSuggestionSecret(env);
  if (set) return set;
  if (isProd) return "";
  if (!memSecret.__suggestionSigningSecret) memSecret.__suggestionSigningSecret = randomBytes(32).toString("base64url");
  return memSecret.__suggestionSigningSecret;
}

/** HMAC-SHA256，內容是「網址 + 換行 + 標題」。客戶端改任一個都會對不上。 */
export function signSuggestion(secret: string, url: string, title: string): string {
  return createHmac("sha256", secret).update(`${url}\n${title}`).digest("base64url");
}

export function suggestionSigOk(secret: string, url: string, title: string, sig: string): boolean {
  if (!secret || !SIG_RE.test(sig)) return false;
  const a = Buffer.from(signSuggestion(secret, url, title));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ParsedSuggestion = {
  url: string;
  title: string;
  query: string;
  subNeed: string | null;
  domainKey: string;
  sig: string;
};

export function parseSuggestion(body: Record<string, unknown>): ParsedSuggestion | null {
  const url = httpsUrl(typeof body.url === "string" ? body.url : "");
  if (!url) return null;
  const title = cleanText(body.title, 120);
  const query = cleanText(body.query, 200);
  if (!title || !query) return null;
  const domainKey = hostKey(url);
  if (!domainKey || domainKey.length > 200) return null;
  const rawNeed = cleanText(body.subNeed ?? body.sub_need, 40);
  const subNeed = rawNeed && SUB_NEED.test(rawNeed) ? rawNeed : null;
  const sig = typeof body.sig === "string" ? body.sig.trim() : "";
  if (!SIG_RE.test(sig)) return null;
  return { url, title, query, subNeed, domainKey, sig };
}

type PendingRef = { id: string; domain_key: string; submit_count: number };
export type SuggestionPlan =
  | { action: "catalog" }
  | { action: "insert"; row: Omit<SuggestionRow, "id" | "created_at" | "updated_at"> }
  | { action: "increment"; id: string; patch: Pick<SuggestionRow, "submit_count" | "query" | "sub_need" | "title" | "url" | "ip_hash" | "updated_at"> };

/** 目錄裡已有這個網域就不再建議；已有待審核則把次數加一。 */
export function planSuggestion(parsed: ParsedSuggestion, catalogKeys: Set<string>, pending: PendingRef[], ipHash: string, now: string): SuggestionPlan {
  if (catalogKeys.has(parsed.domainKey)) return { action: "catalog" };
  const hit = pending.find((p) => p.domain_key === parsed.domainKey);
  if (hit) {
    return {
      action: "increment",
      id: hit.id,
      patch: {
        submit_count: hit.submit_count + 1,
        query: parsed.query,
        sub_need: parsed.subNeed,
        title: parsed.title,
        url: parsed.url,
        ip_hash: ipHash,
        updated_at: now,
      },
    };
  }
  return {
    action: "insert",
    row: {
      url: parsed.url,
      title: parsed.title,
      query: parsed.query,
      sub_need: parsed.subNeed,
      domain_key: parsed.domainKey,
      status: "pending",
      submit_count: 1,
      ip_hash: ipHash,
      note: null,
    },
  };
}

export function applySuggestion(rows: SuggestionRow[], parsed: ParsedSuggestion, catalogKeys: Set<string>, ipHash: string, now: string, newId: string): { rows: SuggestionRow[]; state: "pending" | "catalog" } {
  const plan = planSuggestion(parsed, catalogKeys, rows.filter((r) => r.status === "pending"), ipHash, now);
  if (plan.action === "catalog") return { rows, state: "catalog" };
  if (plan.action === "increment") {
    return { state: "pending", rows: rows.map((r) => (r.id === plan.id ? { ...r, ...plan.patch } : r)) };
  }
  return { state: "pending", rows: [...rows, { ...plan.row, id: newId, created_at: now, updated_at: now }] };
}

/** 只改建議列的狀態。不會產生工具列。 */
export function moderateSuggestion(rows: SuggestionRow[], id: string, action: "approve" | "reject", now: string): { rows: SuggestionRow[]; note: string | null } | null {
  const cur = rows.find((r) => r.id === id && r.status === "pending");
  if (!cur) return null;
  const note = action === "approve" ? APPROVE_NOTE : null;
  const status: SuggestionStatus = action === "approve" ? "approved" : "rejected";
  return { note, rows: rows.map((r) => (r.id === id ? { ...r, status, note, updated_at: now } : r)) };
}
