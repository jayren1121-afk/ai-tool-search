import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { jerr, noStore } from "@/lib/admin-guard";
import { safeEqual } from "@/lib/admin-auth";
import { clean, taipeiDate, validPickDate, DAILY_PICKS_TAG } from "@/lib/daily-picks";
import { readJson, validToolId } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 排程助理提交草稿：Authorization: Bearer $DAILY_PICKS_TOKEN
 *  body: { date?: "YYYY-MM-DD"(預設台灣今天), picks: [{ tool_id, pros_zh, cons_zh, pros_en?, cons_en? } x2] }
 *  兩筆必須是不同分類；同一天同工具重送會覆寫草稿（已核准的不覆寫）。
 *  publish: true 時直接上線（status=approved），同一天其他已上線的推薦會改為 rejected。 */
export async function POST(req: NextRequest) {
  const tok = (process.env.DAILY_PICKS_TOKEN || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (tok.length < 16) return jerr("DAILY_PICKS_TOKEN 未設定", 503);
  if (!auth.startsWith("Bearer ") || !safeEqual(auth.slice(7).trim(), tok)) return jerr("未授權", 401);
  const body = await readJson(req, 16384);
  if (!body) return jerr("請求格式錯誤或過大", 400);
  const date = body.date == null ? taipeiDate() : body.date;
  if (!validPickDate(date)) return jerr("date 格式應為 YYYY-MM-DD", 400);
  const picks = Array.isArray(body.picks) ? (body.picks as Record<string, unknown>[]) : [];
  if (picks.length !== 2) return jerr("picks 必須剛好兩筆", 400);
  if (!picks.every((p) => p && validToolId(p.tool_id))) return jerr("tool_id 無效", 400);
  const rows = picks.map((p) => ({ tool_id: p.tool_id as string, pros_zh: clean(p.pros_zh), cons_zh: clean(p.cons_zh), pros_en: clean(p.pros_en), cons_en: clean(p.cons_en) }));
  if (rows.some((r) => !r.pros_zh || !r.cons_zh)) return jerr("pros_zh / cons_zh 不可空白", 400);
  if (rows[0].tool_id === rows[1].tool_id) return jerr("兩筆必須是不同工具", 400);
  const publish = body.publish === true;
  const db = supabaseAdmin();
  const { data: tools, error } = await db.from("ai_tools").select("id,category").in("id", rows.map((r) => r.tool_id)).eq("status", "published");
  if (error) return jerr("讀取工具失敗：" + error.message, 500);
  const cat = new Map((tools ?? []).map((t) => [t.id as string, t.category as string]));
  if (rows.some((r) => !cat.has(r.tool_id))) return jerr("找不到已上架的工具 id", 400);
  if (cat.get(rows[0].tool_id) === cat.get(rows[1].tool_id)) return jerr("兩筆必須是不同分類", 400);
  let up: Array<Record<string, unknown>>;
  if (publish) {
    const ids = rows.map((r) => r.tool_id);
    const { error: e1 } = await db.from("daily_picks").update({ status: "rejected", approved_at: null }).eq("pick_date", date).eq("status", "approved").not("tool_id", "in", `(${ids.join(",")})`);
    if (e1) return jerr("更新舊推薦失敗：" + e1.message, 500);
    const now = new Date().toISOString();
    up = rows.map((r) => ({ ...r, pick_date: date, category: cat.get(r.tool_id)!, status: "approved", approved_at: now }));
  } else {
    const { data: existing } = await db.from("daily_picks").select("tool_id,status").eq("pick_date", date).in("tool_id", rows.map((r) => r.tool_id));
    const locked = new Set((existing ?? []).filter((e) => e.status === "approved").map((e) => e.tool_id));
    up = rows.filter((r) => !locked.has(r.tool_id)).map((r) => ({ ...r, pick_date: date, category: cat.get(r.tool_id)!, status: "draft", approved_at: null }));
  }
  if (up.length) {
    const { error: e2 } = await db.from("daily_picks").upsert(up, { onConflict: "pick_date,tool_id" });
    if (e2) return jerr("寫入失敗：" + e2.message, 500);
  }
  revalidateTag(DAILY_PICKS_TAG, "max");
  if (publish) { revalidatePath("/"); revalidatePath("/en"); }
  return NextResponse.json({ ok: true, date, published: publish, saved: up.length, skipped_approved: rows.length - up.length }, { status: 201, headers: noStore });
}
