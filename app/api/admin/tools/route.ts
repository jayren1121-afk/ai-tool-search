import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { guard, jerr, noStore } from "@/lib/admin-guard";
import { readJson, validToolId } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CATEGORIES } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().startsWith(s) && s >= "1990-01-01" && s <= new Date().toISOString().slice(0, 10);

/** 上架（publish，可同時修改欄位）或刪除（reject：標為已拒絕，之後不會再被自動發現） */
export async function POST(req: NextRequest) {
  const bad = guard(req);
  if (bad) return bad;
  const body = await readJson(req, 8192);
  if (!body) return jerr("請求格式錯誤或過大", 400);
  const { action, id } = body as { action?: unknown; id?: unknown };
  if (!validToolId(id)) return jerr("無效的 id", 400);
  const db = supabaseAdmin();
  const { data: cur, error: e0 } = await db.from("ai_tools").select("id,category,released_at,released_source,verification_note").eq("id", id).eq("status", "pending").maybeSingle();
  if (e0) return jerr("讀取失敗：" + e0.message, 500);
  if (!cur) return jerr("找不到這筆待審核資料（可能已處理過）", 404);

  if (action === "reject") {
    const { error } = await db.from("ai_tools").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
    if (error) return jerr("刪除失敗：" + error.message, 500);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (action !== "publish") return jerr("未知的動作", 400);

  const e = (body.edits && typeof body.edits === "object" ? body.edits : {}) as Record<string, unknown>;
  const name = str(e.name, 80), category = str(e.category, 40), dz = str(e.description_zh, 300), den = str(e.description_en, 500), rel = str(e.released_at, 10);
  if (!name) return jerr("名稱不可空白", 400);
  if (!(category in CATEGORIES)) return jerr("分類不正確", 400);
  if (!dz) return jerr("繁中描述不可空白", 400);
  if (rel && !validDate(rel)) return jerr("推出日期格式應為 YYYY-MM-DD，且不可是未來日期", 400);
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = {
    status: "published", name, category, description_zh: dz, description_en: den || null, updated_at: new Date().toISOString(),
    verification_note: `${cur.verification_note ?? "自動發現"}；${today} 人工審核上架`,
  };
  if ((rel || null) !== (cur.released_at ?? null)) { patch.released_at = rel || null; patch.released_source = rel ? "manual" : null; }
  const { error } = await db.from("ai_tools").update(patch).eq("id", id).eq("status", "pending");
  if (error) return jerr("上架失敗：" + error.message, 500);
  // 建立投票統計列（讓「好評優先」排序與投票顯示正常；003 未執行時忽略）
  await db.from("tool_vote_stats").upsert({ tool_id: id }, { onConflict: "tool_id", ignoreDuplicates: true }).then(() => {}, () => {});

  // 讓工具頁、分類頁（中英）與 sitemap 盡快更新
  for (const p of [`/tools/${id}`, `/en/tools/${id}`, `/category/${category}`, `/en/category/${category}`, `/category/${cur.category}`, `/en/category/${cur.category}`, "/sitemap.xml"]) revalidatePath(p);
  revalidateTag("ai_tools", "max"); // 其他頁面（同類推薦等）以背景更新方式逐步刷新
  return NextResponse.json({ ok: true, path: `/tools/${id}` }, { headers: noStore });
}
