import "server-only";
import { randomUUID } from "node:crypto";
import { hostKey } from "./discovery";
import { loadSearchCatalog } from "./search-catalog";
import { supabaseAdmin } from "./supabase-admin";
import {
  APPROVE_NOTE,
  applySuggestion,
  moderateSuggestion,
  planSuggestion,
  type ParsedSuggestion,
  type SuggestionRow,
} from "./suggestions";

export type PendingSuggestion = {
  id: string;
  title: string;
  url: string;
  query: string;
  sub_need: string | null;
  submit_count: number;
  created_at: string;
  updated_at: string;
  note: string | null;
};

export type SaveResult = { ok: true; state: "pending" | "catalog" } | { ok: false; error: string; status: number };

const MISSING = "建議資料表尚未建立，請先在 Supabase 執行 supabase_migration_011_tool_suggestions.sql";
const bag = globalThis as { __toolSuggestions?: SuggestionRow[] };

export function supabaseReady(): boolean {
  return !!((process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim() && (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

/** 沒有 Supabase 的本機開發才用行程內暫存，方便看畫面。正式環境不會走這裡。 */
export function suggestionsUseMemory(): boolean {
  return !supabaseReady() && process.env.NODE_ENV !== "production";
}

function memory(): SuggestionRow[] {
  return bag.__toolSuggestions || (bag.__toolSuggestions = []);
}

function toPublic(r: SuggestionRow): PendingSuggestion {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    query: r.query,
    sub_need: r.sub_need,
    submit_count: r.submit_count,
    created_at: r.created_at,
    updated_at: r.updated_at,
    note: r.note,
  };
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /tool_suggestions/.test(error.message || "");
}

async function catalogDomainKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  try {
    const { rows } = await loadSearchCatalog();
    for (const row of rows) {
      const key = hostKey(row.url || "");
      if (key) keys.add(key);
    }
  } catch { /* 正式環境沒設定時由下面的 service role 查詢補上 */ }
  if (!supabaseReady()) return keys;
  const { data, error } = await supabaseAdmin().from("ai_tools").select("url").limit(5000);
  if (error || !data) return keys;
  for (const row of data as { url?: string }[]) {
    const key = hostKey(row.url || "");
    if (key) keys.add(key);
  }
  return keys;
}

export async function saveSuggestion(parsed: ParsedSuggestion, ipHash: string): Promise<SaveResult> {
  const now = new Date().toISOString();
  const catalog = await catalogDomainKeys();
  if (suggestionsUseMemory()) {
    const applied = applySuggestion(memory(), parsed, catalog, ipHash, now, randomUUID());
    bag.__toolSuggestions = applied.rows;
    return { ok: true, state: applied.state };
  }
  if (!supabaseReady()) return { ok: false, error: "建議功能尚未設定", status: 503 };

  const db = supabaseAdmin();
  const pending = await db.from("tool_suggestions").select("id,domain_key,submit_count").eq("status", "pending").limit(500);
  if (pending.error) return { ok: false, error: missingTable(pending.error) ? MISSING : "送出失敗，請稍後再試", status: missingTable(pending.error) ? 503 : 500 };
  const plan = planSuggestion(parsed, catalog, (pending.data ?? []) as { id: string; domain_key: string; submit_count: number }[], ipHash, now);
  if (plan.action === "catalog") return { ok: true, state: "catalog" };
  if (plan.action === "increment") {
    const upd = await db.from("tool_suggestions").update(plan.patch).eq("id", plan.id).eq("status", "pending");
    if (upd.error) return { ok: false, error: "送出失敗，請稍後再試", status: 500 };
    return { ok: true, state: "pending" };
  }
  const ins = await db.from("tool_suggestions").insert(plan.row);
  if (ins.error && ins.error.code === "23505") {
    const again = await db.from("tool_suggestions").select("id,submit_count").eq("status", "pending").eq("domain_key", parsed.domainKey).maybeSingle();
    if (again.error || !again.data) return { ok: false, error: "送出失敗，請稍後再試", status: 500 };
    const upd = await db.from("tool_suggestions").update({
      submit_count: Number(again.data.submit_count) + 1,
      query: parsed.query,
      sub_need: parsed.subNeed,
      title: parsed.title,
      url: parsed.url,
      ip_hash: ipHash,
      updated_at: now,
    }).eq("id", again.data.id).eq("status", "pending");
    if (upd.error) return { ok: false, error: "送出失敗，請稍後再試", status: 500 };
    return { ok: true, state: "pending" };
  }
  if (ins.error) return { ok: false, error: missingTable(ins.error) ? MISSING : "送出失敗，請稍後再試", status: missingTable(ins.error) ? 503 : 500 };
  return { ok: true, state: "pending" };
}

export async function listPendingSuggestions(): Promise<{ items: PendingSuggestion[]; error: string | null }> {
  if (suggestionsUseMemory()) {
    return { items: memory().filter((r) => r.status === "pending").sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(toPublic), error: null };
  }
  if (!supabaseReady()) return { items: [], error: "尚未設定 Supabase，無法讀取建議。" };
  const { data, error } = await supabaseAdmin()
    .from("tool_suggestions")
    .select("id,title,url,query,sub_need,submit_count,created_at,updated_at,note")
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return { items: [], error: missingTable(error) ? `尚未建立建議資料表，請先在 Supabase 執行 supabase_migration_011_tool_suggestions.sql。` : `讀取建議失敗：${error.message}` };
  return { items: (data ?? []) as PendingSuggestion[], error: null };
}

export async function moderateStoredSuggestion(id: string, action: "approve" | "reject"): Promise<{ ok: true; note: string | null } | { ok: false; error: string; status: number }> {
  const now = new Date().toISOString();
  if (suggestionsUseMemory()) {
    const next = moderateSuggestion(memory(), id, action, now);
    if (!next) return { ok: false, error: "找不到這筆待審核建議（可能已處理過）", status: 404 };
    bag.__toolSuggestions = next.rows;
    return { ok: true, note: next.note };
  }
  if (!supabaseReady()) return { ok: false, error: "尚未設定 Supabase", status: 503 };
  const note = action === "approve" ? APPROVE_NOTE : null;
  const { data, error } = await supabaseAdmin()
    .from("tool_suggestions")
    .update({ status: action === "approve" ? "approved" : "rejected", note, updated_at: now })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: missingTable(error) ? MISSING : "更新失敗：" + error.message, status: missingTable(error) ? 503 : 500 };
  if (!data) return { ok: false, error: "找不到這筆待審核建議（可能已處理過）", status: 404 };
  return { ok: true, note };
}
