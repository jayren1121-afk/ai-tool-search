import "server-only";
import { randomUUID } from "node:crypto";
import { hostKey, makeId } from "./discovery";
import { isMissingColumn } from "./published";
import { addDevCatalogRow, invalidateSearchCatalog, loadSearchCatalog, type CatalogRow } from "./search-catalog";
import { prepareCatalogDraft } from "./suggestion-approve";
import {
  NOTE_EXISTS,
  NOTE_PREVIEW,
  NOTE_SAVED,
  applyCatalogEdits,
  failureNote,
  storedDraft,
  toToolInsert,
  type CatalogDraft,
} from "./suggestion-catalog";
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
  draft: CatalogDraft | null;
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
    draft: storedDraft(r.draft),
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

const LIST_COLS = "id,title,url,query,sub_need,submit_count,created_at,updated_at,note,draft";

export async function listPendingSuggestions(): Promise<{ items: PendingSuggestion[]; error: string | null }> {
  if (suggestionsUseMemory()) {
    return { items: memory().filter((r) => r.status === "pending").sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(toPublic), error: null };
  }
  if (!supabaseReady()) return { items: [], error: "尚未設定 Supabase，無法讀取建議。" };
  const db = supabaseAdmin();
  const res = await db.from("tool_suggestions").select(LIST_COLS).eq("status", "pending").order("updated_at", { ascending: false }).limit(100);
  let draftMissing = false;
  let data = res.data as { draft?: unknown }[] | null;
  let error = res.error;
  if (error && isMissingColumn(error)) {
    draftMissing = true;
    const again = await db.from("tool_suggestions").select("id,title,url,query,sub_need,submit_count,created_at,updated_at,note").eq("status", "pending").order("updated_at", { ascending: false }).limit(100);
    data = again.data as { draft?: unknown }[] | null;
    error = again.error;
  }
  if (error) return { items: [], error: missingTable(error) ? `尚未建立建議資料表，請先在 Supabase 執行 supabase_migration_011_tool_suggestions.sql。` : `讀取建議失敗：${error.message}` };
  const items = ((data ?? []) as PendingSuggestion[]).map((row) => ({ ...row, draft: storedDraft(row.draft) }));
  return { items, error: draftMissing ? "建議草稿欄位還沒有。請在 Supabase 執行 supabase_migration_012_suggestion_publish.sql。沒有這欄時，核准會直接寫入目錄。" : null };
}

function columnMissing(error: { code?: string; message?: string } | null): boolean {
  return isMissingColumn(error) || error?.code === "PGRST204" || /draft|tool_id/.test(error?.message || "");
}

async function toolIdsAndDomains(): Promise<{ ids: Set<string>; byDomain: Map<string, string> }> {
  const ids = new Set<string>();
  const byDomain = new Map<string, string>();
  const add = (id: string, url: string) => {
    if (id) ids.add(id);
    const key = hostKey(url || "");
    if (key && id && !byDomain.has(key)) byDomain.set(key, id);
  };
  try {
    const { rows } = await loadSearchCatalog();
    for (const row of rows) add(row.id, row.url);
  } catch { /* 正式環境沒有目錄時改查 service role */ }
  if (!supabaseReady()) return { ids, byDomain };
  const { data } = await supabaseAdmin().from("ai_tools").select("id,url").limit(5000);
  for (const row of (data ?? []) as { id?: string; url?: string }[]) add(String(row.id || ""), String(row.url || ""));
  return { ids, byDomain };
}

function catalogRow(inserted: Record<string, unknown>): CatalogRow {
  return {
    id: String(inserted.id),
    name: String(inserted.name),
    url: String(inserted.url),
    category: String(inserted.category),
    subcategory: (inserted.subcategory as string | null) ?? null,
    description_zh: (inserted.description_zh as string | null) ?? null,
    description_en: (inserted.description_en as string | null) ?? null,
    key_features: [],
    key_features_en: [],
    tags: Array.isArray(inserted.tags) ? inserted.tags as string[] : [],
    pricing_model: (inserted.pricing_model as string | null) ?? null,
    free_tier: (inserted.free_tier as string | null) ?? null,
    paid_plans: Array.isArray(inserted.paid_plans) ? inserted.paid_plans as CatalogRow["paid_plans"] : [],
    pricing_url: (inserted.pricing_url as string | null) ?? null,
    is_wrapper: null,
    underlying_models: null,
    company: null,
    country: null,
    confidence: "low",
    last_verified: null,
    source_urls: Array.isArray(inserted.source_urls) ? inserted.source_urls as string[] : [],
  };
}

async function loadPending(id: string): Promise<SuggestionRow | null> {
  if (suggestionsUseMemory()) return memory().find((row) => row.id === id && row.status === "pending") ?? null;
  if (!supabaseReady()) return null;
  const withDraft = await supabaseAdmin().from("tool_suggestions").select("id,url,title,query,sub_need,domain_key,status,submit_count,ip_hash,note,created_at,updated_at,draft,tool_id").eq("id", id).eq("status", "pending").maybeSingle();
  if (!withDraft.error) return (withDraft.data as SuggestionRow | null) ?? null;
  if (!columnMissing(withDraft.error)) return null;
  const plain = await supabaseAdmin().from("tool_suggestions").select("id,url,title,query,sub_need,domain_key,status,submit_count,ip_hash,note,created_at,updated_at").eq("id", id).eq("status", "pending").maybeSingle();
  return (plain.data as SuggestionRow | null) ?? null;
}

async function patchPending(id: string, patch: Record<string, unknown>, allowMissingDraft: boolean): Promise<{ ok: true } | { ok: false; missingColumn: boolean; message: string }> {
  if (suggestionsUseMemory()) {
    const rows = memory();
    const cur = rows.find((row) => row.id === id && row.status === "pending");
    if (!cur) return { ok: false, missingColumn: false, message: "找不到這筆待審核建議（可能已處理過）" };
    Object.assign(cur, patch);
    return { ok: true };
  }
  const { error } = await supabaseAdmin().from("tool_suggestions").update(patch).eq("id", id).eq("status", "pending");
  if (!error) return { ok: true };
  if (allowMissingDraft && columnMissing(error)) return { ok: false, missingColumn: true, message: error.message };
  return { ok: false, missingColumn: false, message: error.message };
}

async function insertTool(draft: CatalogDraft, url: string, ids: Set<string>, now: string): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const row = toToolInsert(draft, { id: makeId(draft.name, url, ids), url, now });
  row.pricing_url = draft.free_tier || draft.paid_plans.length ? url : null;
  if (suggestionsUseMemory()) {
    addDevCatalogRow(catalogRow(row));
    return { ok: true, id: String(row.id) };
  }
  if (!supabaseReady()) return { ok: false, message: "尚未設定 Supabase" };
  const { error } = await supabaseAdmin().from("ai_tools").insert(row);
  if (error) return { ok: false, message: "寫入目錄失敗" };
  invalidateSearchCatalog();
  return { ok: true, id: String(row.id) };
}

export type ApproveOutcome =
  | { ok: true; state: "preview"; note: string; draft: CatalogDraft }
  | { ok: true; state: "approved"; note: string; toolId: string | null }
  | { ok: true; state: "error"; note: string };

async function rememberError(id: string, note: string): Promise<ApproveOutcome> {
  const now = new Date().toISOString();
  const saved = await patchPending(id, { note, draft: null, updated_at: now }, true);
  if (!saved.ok) await patchPending(id, { note, updated_at: now }, false);
  return { ok: true, state: "error", note };
}

async function markApproved(id: string, note: string, toolId: string | null): Promise<ApproveOutcome> {
  const now = new Date().toISOString();
  const full = { status: "approved", note, tool_id: toolId, draft: null, updated_at: now };
  const saved = await patchPending(id, full, true);
  if (saved.ok) return { ok: true, state: "approved", note, toolId };
  if (saved.missingColumn) {
    const again = await patchPending(id, { status: "approved", note: toolId ? `${note}（${toolId}）` : note, updated_at: now }, false);
    if (again.ok) return { ok: true, state: "approved", note, toolId };
  }
  return { ok: true, state: "error", note: failureNote("建議狀態沒有更新") };
}

export async function approveStoredSuggestion(id: string): Promise<ApproveOutcome | { ok: false; error: string; status: number }> {
  const row = await loadPending(id);
  if (!row) return { ok: false, error: "找不到這筆待審核建議（可能已處理過）", status: 404 };
  const prepared = await prepareCatalogDraft(row.url, row.title, row.query);
  if ("error" in prepared) return rememberError(id, failureNote(prepared.error));
  const known = await toolIdsAndDomains();
  const domains = [row.domain_key, prepared.domain].filter(Boolean);
  const existing = domains.map((key) => known.byDomain.get(key)).find(Boolean) ?? null;
  if (existing) return markApproved(id, NOTE_EXISTS, existing);
  const now = new Date().toISOString();
  const saved = await patchPending(id, { draft: prepared.draft, note: NOTE_PREVIEW, updated_at: now }, true);
  if (saved.ok) return { ok: true, state: "preview", note: NOTE_PREVIEW, draft: prepared.draft };
  if (!saved.missingColumn) return rememberError(id, failureNote("草稿沒有存起來"));
  const inserted = await insertTool(prepared.draft, row.url, known.ids, now);
  if (!inserted.ok) return rememberError(id, failureNote(inserted.message));
  return markApproved(id, NOTE_SAVED, inserted.id);
}

export async function confirmStoredSuggestion(id: string, edits: unknown): Promise<ApproveOutcome | { ok: false; error: string; status: number }> {
  const row = await loadPending(id);
  if (!row) return { ok: false, error: "找不到這筆待審核建議（可能已處理過）", status: 404 };
  const base = storedDraft(row.draft);
  if (!base) return { ok: false, error: "請先產生目錄草稿", status: 400 };
  const draft = applyCatalogEdits(base, edits ?? {});
  if ("error" in draft) return { ok: false, error: draft.error, status: 400 };
  draft.pricing_url = draft.free_tier || draft.paid_plans.length ? row.url : null;
  const known = await toolIdsAndDomains();
  const existing = known.byDomain.get(row.domain_key);
  if (existing) return markApproved(id, NOTE_EXISTS, existing);
  const inserted = await insertTool(draft, row.url, known.ids, new Date().toISOString());
  if (!inserted.ok) return rememberError(id, failureNote(inserted.message));
  return markApproved(id, NOTE_SAVED, inserted.id);
}

export async function moderateStoredSuggestion(id: string, action: "approve" | "reject"): Promise<{ ok: true; note: string | null } | { ok: false; error: string; status: number }> {
  const now = new Date().toISOString();
  if (suggestionsUseMemory()) {
    const next = moderateSuggestion(memory(), id, action, now);
    if (!next) return { ok: false, error: "找不到這筆待審核建議（可能已處理過）", status: 404 };
    bag.__toolSuggestions = next.rows.map((row) => (row.id === id ? { ...row, draft: null } : row));
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
