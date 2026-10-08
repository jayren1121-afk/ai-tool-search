import { NextRequest, NextResponse } from "next/server";
import { applyVoter, checkLimits, clientIp, getVoter, originOk, readJson } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ error: "來源不被允許" }, { status: 403 });
  const body = await readJson(req, 512);
  const id = Number(body?.reviewId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
  const ip = clientIp(req);
  if (await checkLimits("helpful", ip, [{ name: "min", max: 20, windowSec: 60 }, { name: "day", max: 200, windowSec: 86400 }]))
    return NextResponse.json({ error: "操作太頻繁" }, { status: 429 });
  const voter = getVoter(req, ip);
  const db = supabaseAdmin();
  const done = (data: Record<string, unknown>, status = 200) => { const res = NextResponse.json(data, { status }); applyVoter(res, voter); return res; };
  const { data: rv, error: e1 } = await db.from("tool_reviews").select("id,voter_hash,status").eq("id", id).maybeSingle();
  if (e1) return done({ error: "評論功能尚未啟用" }, 503);
  if (!rv || rv.status !== "visible") return done({ error: "找不到評論" }, 404);
  if (rv.voter_hash === voter.hash) return done({ error: "不能對自己的評論按有幫助" }, 400);
  const { error } = await db.from("review_helpful").upsert({ review_id: id, voter_hash: voter.hash }, { onConflict: "review_id,voter_hash", ignoreDuplicates: true });
  if (error) return done({ error: "操作失敗" }, 500);
  const { data: after } = await db.from("tool_reviews").select("helpful_count").eq("id", id).maybeSingle();
  return done({ ok: true, helpful_count: after?.helpful_count ?? null });
}
