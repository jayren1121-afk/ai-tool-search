import type { Metadata } from "next";
import { cookies } from "next/headers";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminPanel, { type JobRun, type PendingTool } from "@/components/admin/AdminPanel";
import { ADMIN_COOKIE, adminConfigured, sessionOk } from "@/lib/admin-auth";
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
  return <AdminPanel pending={(pend.data ?? []) as PendingTool[]} runs={(runs.data ?? []) as JobRun[]} setupError={setupError} />;
}
