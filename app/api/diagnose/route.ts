import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkLimits, clientIp, ipHash, originOk, readJson, validToolId } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ error: "來源不被允許" }, { status: 403 });
  const body = await readJson(req, 4096);
  if (!body) return NextResponse.json({ error: "請求格式錯誤或過大" }, { status: 400 });
  const { toolId, diagnosisId, message } = body as { toolId?: unknown; diagnosisId?: unknown; message?: unknown };
  if (!validToolId(toolId)) return NextResponse.json({ error: "無效的 toolId" }, { status: 400 });
  const msg = typeof message === "string" ? message.trim() : "";
  if (!msg || msg.length > 500) return NextResponse.json({ error: "請輸入 1–500 字的說明" }, { status: 400 });
  const did = diagnosisId == null ? null : Number(diagnosisId);
  if (did !== null && !(Number.isSafeInteger(did) && did > 0)) return NextResponse.json({ error: "無效的 diagnosisId" }, { status: 400 });

  const ip = clientIp(req);
  const hit = await checkLimits("report", ip, [{ name: "10min", max: 5, windowSec: 600 }, { name: "day", max: 20, windowSec: 86400 }]);
  if (hit) return NextResponse.json({ error: "回報次數過多，請稍後再試" }, { status: 429 });

  const db = supabaseAdmin();
  let diagId = did;
  if (diagId !== null) {
    const { data } = await db.from("diagnoses").select("id").eq("id", diagId).eq("tool_id", toolId).maybeSingle();
    if (!data) diagId = null;
  }
  const { error } = await db.from("reports").insert({ tool_id: toolId, diagnosis_id: diagId, message: msg, ip_hash: ipHash(ip) });
  if (error) {
    console.error("report insert error", error);
    return NextResponse.json({ error: "回報失敗，請稍後再試" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
