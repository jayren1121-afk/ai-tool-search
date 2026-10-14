import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { guard, jerr, noStore } from "@/lib/admin-guard";
import { readJson } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * 後台「價格」（update26：價格全部自動上線，這裡主要用來拒絕；只接受 POST；需登入 cookie 與合法 origin）：
 *  approve 核准／恢復上線：review_status=approved、reviewed=true → 網站顯示這筆價格
 *  reject  拒絕：review_status=rejected、reviewed=false → 網站不顯示（會改顯示這個工具較早已上線的價格，若有）
 * 都會記錄 decided_by=admin；之後每日自動更新只要內容沒變就不會改掉你的決定（拒絕過的同樣內容，重新抓取後也維持拒絕）。需要 migration 010。
 */
export async function POST(req: NextRequest) {
  const bad = guard(req);
  if (bad) return bad;
  const body = await readJson(req, 2048);
  if (!body) return jerr("請求格式錯誤或過大", 400);
  const { action, id } = body as { action?: unknown; id?: unknown };
  if (action !== "approve" && action !== "reject") return jerr("未知的動作", 400);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return jerr("無效的 id", 400);

  const db = supabaseAdmin();
  const { data: cur, error: e0 } = await db.from("price_snapshots").select("id,tool_id,source_url,fetched_at").eq("id", id).maybeSingle();
  if (e0) return jerr("讀取失敗：" + e0.message + "（請確認已執行 supabase_migration_010_price_publish.sql）", 500);
  if (!cur) return jerr("找不到這筆價格資料（可能已被更新，請重新整理）", 404);
  if (!/^https?:\/\//i.test(cur.source_url || "") || !cur.fetched_at) return jerr("這筆資料缺少來源網址或擷取日期，不能上線", 400);

  const approve = action === "approve";
  const { error } = await db.from("price_snapshots").update({
    review_status: approve ? "approved" : "rejected", reviewed: approve, reviewed_at: new Date().toISOString(), decided_by: "admin", review_note: str(body.note, 200) || null,
  }).eq("id", id);
  if (error) return jerr("儲存失敗：" + error.message, 500);

  try { revalidateTag("price_snapshots", "max"); } catch (e) { console.warn("revalidateTag", (e as Error).message); }
  for (const p of [`/tools/${cur.tool_id}`, `/en/tools/${cur.tool_id}`]) { try { revalidatePath(p); } catch (e) { console.warn("revalidatePath", p, (e as Error).message); } }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
