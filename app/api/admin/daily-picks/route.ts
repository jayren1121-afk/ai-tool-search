import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { guard, jerr, noStore } from "@/lib/admin-guard";
import { clean, DAILY_PICKS_TAG } from "@/lib/daily-picks";
import { readJson } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 後台：{ action: "save"|"approve"|"reject", id, edits?: { pros_zh, cons_zh, pros_en, cons_en } } */
export async function POST(req: NextRequest) {
  const bad = guard(req);
  if (bad) return bad;
  const body = await readJson(req, 16384);
  if (!body) return jerr("請求格式錯誤或過大", 400);
  const { action, id } = body as { action?: unknown; id?: unknown };
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return jerr("無效的 id", 400);
  if (!["save", "approve", "reject"].includes(action as string)) return jerr("未知的動作", 400);
  const db = supabaseAdmin();
  const { data: cur, error: e0 } = await db.from("daily_picks").select("id,pick_date,category,status").eq("id", id).maybeSingle();
  if (e0) return jerr("讀取失敗：" + e0.message, 500);
  if (!cur) return jerr("找不到這筆推薦", 404);
  const patch: Record<string, unknown> = {};
  const e = (body.edits && typeof body.edits === "object" ? body.edits : null) as Record<string, unknown> | null;
  if (e) {
    for (const k of ["pros_zh", "cons_zh", "pros_en", "cons_en"]) patch[k] = clean(e[k]);
    if (!patch.pros_zh || !patch.cons_zh) return jerr("中文優點／缺點不可空白", 400);
  }
  if (action === "approve") {
    const { data: others, error: e1 } = await db.from("daily_picks").select("id,category").eq("pick_date", cur.pick_date).eq("status", "approved").neq("id", id);
    if (e1) return jerr("讀取失敗：" + e1.message, 500);
    if ((others ?? []).some((o) => o.category === cur.category)) return jerr("這天已核准同分類的推薦，兩筆必須是不同分類", 409);
    if ((others ?? []).length >= 2) return jerr("這天已核准兩筆推薦", 409);
    Object.assign(patch, { status: "approved", approved_at: new Date().toISOString() });
  } else if (action === "reject") Object.assign(patch, { status: "rejected", approved_at: null });
  const { error } = await db.from("daily_picks").update(patch).eq("id", id);
  if (error) return jerr("更新失敗：" + error.message, 500);
  revalidateTag(DAILY_PICKS_TAG, "max");
  revalidatePath("/"); revalidatePath("/en");
  return NextResponse.json({ ok: true }, { headers: noStore });
}
