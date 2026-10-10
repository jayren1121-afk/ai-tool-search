import type { Metadata } from "next";
import { cookies } from "next/headers";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminPanel, { type HealthData, type JobRun, type PendingTool } from "@/components/admin/AdminPanel";
import type { HealthItem, HealthRun } from "@/components/admin/HealthSection";
import { ADMIN_COOKIE, adminConfigured, sessionOk } from "@/lib/admin-auth";
import { isMissingColumn } from "@/lib/published";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "管理後台",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
};

const PENDING_COLS = "id,name,url,category,subcategory,description_zh,description_en,pricing_model,tags,released_at,released_source,discovery_source,discovery_url,added_at";

export default async function AdminPage() {
  if (!adminConfigured()) {
    return <main className="mx-auto max-w-xl p-4"><h1 className="mb-3 text-xl font-bold">管理後台</h1>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">尚未設定環境變數 ADMIN_PASSWORD（至少 8 個字元）。請到 Vercel → Settings → Environment Variables 新增後重新部署。</p></main>;
  }
  if (!sessionOk((await cookies()).get(ADMIN_COOKIE)?.value)) return <AdminLogin />;

  const db = supabaseAdmin();
  const [pend, runs] = await Promise.all([
    db.from("ai_tools").select(PENDING_COLS).eq("status", "pending").order("added_at", { ascending: false }).limit(100),
    db.from("job_runs").select("id,started_at,finished_at,status,message,details").eq("job", "discover").order("started_at", { ascending: false }).limit(5),
  ]);
  const setupError = pend.error ? `讀取待審核資料失敗：${pend.error.message}（請確認已在 Supabase 執行 supabase_migration_005.sql）` : runs.error ? `讀取排程紀錄失敗：${runs.error.message}` : null;
  return <AdminPanel pending={(pend.data ?? []) as PendingTool[]} runs={(runs.data ?? []) as JobRun[]} setupError={setupError} health={await loadHealth(db)} />;
}

/** 官網檢查區塊的資料；資料表尚未建立（migration 008）時只在該區塊顯示提示，不影響其他後台功能 */
async function loadHealth(db: ReturnType<typeof supabaseAdmin>): Promise<HealthData> {
  const BASE = "tool_id,status,consecutive_failures,detail,last_checked_at,last_http_status,last_final_url,needs_review,manual_down,reviewed_note,reviewed_at,snoozed_until";
  // excludeMoved：已設定「已轉址／已改名」提示的工具視為已人工處理（即使 status = down），不列入上方「需要人工檢查」，只出現在下方 moved 區塊
  const listQ = (cols: string, filter: string, excludeMoved: boolean) => {
    const q = db.from("tool_health").select(`${cols},ai_tools!inner(name,url,status)`).eq("ai_tools.status", "published").or(filter);
    return (excludeMoved ? q.is("moved_type", null) : q).order("last_checked_at", { ascending: false, nullsFirst: false }).limit(300);
  };
  // 先嘗試含「已轉址／已改名」欄位（migration 009）；欄位還不存在就退回舊欄位（後台其餘功能照常）
  let movedReady = true;
  let listR = await listQ(`${BASE},moved_type,moved_to`, "needs_review.eq.true,status.eq.down", true);
  if (listR.error && isMissingColumn(listR.error)) { movedReady = false; listR = await listQ(BASE, "needs_review.eq.true,status.eq.down", false); }
  const movedR = movedReady ? await db.from("tool_health").select("tool_id,status,consecutive_failures,detail,last_checked_at,last_http_status,last_final_url,needs_review,manual_down,reviewed_note,reviewed_at,snoozed_until,moved_type,moved_to,ai_tools!inner(name,url,status)")
    .eq("ai_tools.status", "published").not("moved_type", "is", null).order("last_checked_at", { ascending: false, nullsFirst: false }).limit(300) : null;
  const [list, all, total, runs] = await Promise.all([
    Promise.resolve(listR),
    db.from("tool_health").select("status,last_checked_at,ai_tools!inner(status)").eq("ai_tools.status", "published").limit(5000),
    db.from("ai_tools").select("id", { count: "exact", head: true }).eq("status", "published"),
    db.from("job_runs").select("id,started_at,finished_at,status,message,details").eq("job", "health").order("started_at", { ascending: false }).limit(5),
  ]);
  const err = list.error || all.error || total.error;
  if (err) {
    const missing = err.code === "42P01" || err.code === "PGRST205" || /tool_health/.test(err.message || "");
    return { items: [], stats: null, runs: [], error: missing ? "尚未建立官網檢查資料表，請先在 Supabase 執行 supabase_migration_008_tool_health.sql。" : `讀取官網檢查資料失敗：${err.message}` };
  }
  const now = Date.now(), rows = (all.data ?? []) as { status: string; last_checked_at: string | null }[];
  const all7 = rows.filter((r) => r.last_checked_at && Date.parse(r.last_checked_at) >= now - 7 * 86400_000).length;
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  // 上方清單：排除有 moved 提示者（查詢已排除，這裡再保險一次；它們會顯示在下方 moved 區塊，不會兩邊都消失）；略過 7 天內的也不列
  const unmoved = ((list.data ?? []) as unknown as (HealthItem & { snoozed_until: string | null })[]).filter((r) => !r.moved_type);
  const visible = unmoved.filter((r) => !r.snoozed_until || Date.parse(r.snoozed_until) <= now);
  const totalN = total.count ?? 0;
  return {
    items: visible,
    stats: { total: totalN, live: count("live"), down: count("down"), unknown: count("unknown"), unchecked: Math.max(0, totalN - rows.length), stale7d: Math.max(0, totalN - all7), snoozed: unmoved.length - visible.length },
    movedReady,
    moved: ((movedR?.data ?? []) as unknown as HealthItem[]).filter((m) => !visible.some((v) => v.tool_id === m.tool_id)), // 已在上方清單的不重複列出
    runs: (runs.data ?? []) as HealthRun[], error: runs.error ? `讀取官網檢查紀錄失敗：${runs.error.message}` : null,
  };
}
