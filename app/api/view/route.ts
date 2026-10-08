import { NextRequest, NextResponse } from "next/server";
import { checkLimits, clientIp, firstTime, ipHash, originOk, readJson, validToolId } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await readJson(req, 512);
  const toolId = body?.toolId;
  if (!validToolId(toolId)) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = clientIp(req);
  if (await checkLimits("view", ip, [{ name: "min", max: 30, windowSec: 60 }, { name: "day", max: 500, windowSec: 86400 }]))
    return NextResponse.json({ ok: false }, { status: 429 });
  // 同一 IP 對同一工具每 6 小時只計一次
  if (!(await firstTime(`view:${toolId}:${ipHash(ip)}:${Math.floor(Date.now() / 21600_000)}`, 21600 + 60))) return NextResponse.json({ ok: true, counted: false });
  const { error } = await supabaseAdmin().rpc("increment_tool_view", { p_tool: toolId });
  return NextResponse.json({ ok: !error, counted: !error });
}
