import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { guard, jerr, noStore } from "@/lib/admin-guard";
import { validateMoved } from "@/lib/health-moved";
import { runHealthCheck } from "@/lib/health-run";
import { isMissingColumn } from "@/lib/published";
import { readJson, validToolId } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * 後台「官網檢查」動作（只接受 POST；需登入 cookie 與合法 origin）：
 *  run  立即執行一批（與排程相同，最多一批）
 *  ok   確認正常：status=live、needs_review=false，並記住這個狀況，之後同樣的狀況不會再被丟回清單
 *  down 確認異常：status=down 並鎖定，直到自動檢查看到恢復
 *  skip 略過：7 天內不在清單顯示（不改變前台狀態）
 *  moved 只更新「已轉址／已改名」提示（不改變狀態與內部備註）；movedType 為 none 即清除
 * ok／down 也可附帶 movedType（none｜moved｜renamed）與 movedTo（最長 200 字；轉址必須是 http/https 網址）；
 * 沒有帶 movedType 時不動現有的轉址／改名提示。需要 migration 009。
 */
export async function POST(req: NextRequest) {
  const bad = guard(req);
  if (bad) return bad;
  const body = await readJson(req, 4096);
  if (!body) return jerr("請求格式錯誤或過大", 400);
  const { action, id } = body as { action?: unknown; id?: unknown };

  if (action === "run") {
    const r = await runHealthCheck("admin");
    return NextResponse.json({ status: r.status, message: r.message, checked: r.checked, counts: r.counts }, { headers: noStore });
  }
  if (action !== "ok" && action !== "down" && action !== "skip" && action !== "moved") return jerr("未知的動作", 400);
  if (!validToolId(id)) return jerr("無效的 id", 400);

  // 轉址／改名提示（選填）：先驗證再碰資料庫
  const hasMoved = body.movedType !== undefined;
  if (action === "moved" && !hasMoved) return jerr("缺少轉址／改名資料", 400);
  let moved: { type: string | null; to: string | null } | null = null;
  if (hasMoved && action !== "skip") {
    const v = validateMoved(body.movedType, body.movedTo);
    if (!v.ok) return jerr(v.error, 400);
    moved = { type: v.type, to: v.to };
  }

  const db = supabaseAdmin();
  // 只允許處理已上架工具的紀錄
  const { data: tool, error: e0 } = await db.from("ai_tools").select("id").eq("id", id).eq("status", "published").maybeSingle();
  if (e0) return jerr("讀取失敗：" + e0.message, 500);
  if (!tool) return jerr("找不到這個已上架的工具", 404);
  const { data: cur, error: e1 } = await db.from("tool_health").select("*").eq("tool_id", id).maybeSingle();
  if (e1) return jerr("讀取失敗：" + e1.message + "（請確認已執行 supabase_migration_008_tool_health.sql）", 500);

  const now = new Date().toISOString();
  const note = str(body.note, 200);
  let patch: Record<string, unknown>;
  if (action === "ok") {
    patch = { status: "live", needs_review: false, manual_down: false, consecutive_failures: 0, snoozed_until: null, reviewed_at: now, reviewed_note: note || "人工確認正常", review_signature: cur?.check_signature ?? null };
  } else if (action === "down") {
    patch = { status: "down", needs_review: false, manual_down: true, snoozed_until: null, reviewed_at: now, reviewed_note: note || "人工確認異常" };
  } else if (action === "moved") {
    patch = {};
  } else {
    patch = { snoozed_until: new Date(Date.now() + 7 * 86400_000).toISOString() };
  }
  if (moved) patch = { ...patch, moved_type: moved.type, moved_to: moved.to };
  const { error } = cur
    ? await db.from("tool_health").update(patch).eq("tool_id", id)
    : await db.from("tool_health").insert({ tool_id: id, ...patch });
  if (error) {
    if (moved && isMissingColumn(error)) return jerr("儲存失敗：資料庫還沒有轉址／改名欄位，請先在 Supabase 執行 supabase_migration_009_tool_health_moved.sql", 500);
    return jerr("儲存失敗：" + error.message, 500);
  }

  if (action !== "skip") for (const p of [`/tools/${id}`, `/en/tools/${id}`]) revalidatePath(p); // 讓工具頁的標籤盡快更新
  return NextResponse.json({ ok: true }, { headers: noStore });
}
