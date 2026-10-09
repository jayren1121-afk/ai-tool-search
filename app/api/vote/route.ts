import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/community";
import { applyPass, applyVoter, checkLimits, clientIp, getVoter, originOk, readJson, turnstileGate, validToolId } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withPublished } from "@/lib/published";

export const runtime = "nodejs";
const MAX_PER_IP_PER_TOOL = 5; // 同一 IP 對同一工具最多幾個不同投票者（容許共用網路）

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ error: "來源不被允許" }, { status: 403 });
  const body = await readJson(req, 4096);
  if (!body) return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  const { toolId, vote, turnstileToken } = body as { toolId?: unknown; vote?: unknown; turnstileToken?: unknown };
  if (!validToolId(toolId) || ![-1, 0, 1].includes(vote as number)) return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
  const ip = clientIp(req);
  if (await checkLimits("vote", ip, [{ name: "min", max: 20, windowSec: 60 }, { name: "day", max: 300, windowSec: 86400 }]))
    return NextResponse.json({ error: "投票太頻繁，請稍後再試" }, { status: 429 });
  const gate = await turnstileGate(req, turnstileToken, ip);
  if (!gate.ok) return NextResponse.json({ error: "請先完成人機驗證", turnstile: true }, { status: 403 });

  const voter = getVoter(req, ip);
  const db = supabaseAdmin();
  const done = (data: Record<string, unknown>, status = 200) => { const res = NextResponse.json(data, { status }); applyPass(res, gate); applyVoter(res, voter); return res; };

  const { data: tool } = await withPublished((pub) => { const q = db.from("ai_tools").select("id").eq("id", toolId); return (pub ? q.eq("status", "published") : q).maybeSingle(); }); // 只允許已上架工具
  if (!tool) return done({ error: "找不到工具" }, 404);

  if (vote === 0) {
    const { error } = await db.from("tool_votes").delete().eq("tool_id", toolId).eq("voter_hash", voter.hash);
    if (error) return done({ error: "投票功能尚未啟用" }, 503);
  } else {
    const { data: existing, error: e1 } = await db.from("tool_votes").select("id").eq("tool_id", toolId).eq("voter_hash", voter.hash).maybeSingle();
    if (e1) return done({ error: "投票功能尚未啟用" }, 503);
    if (!existing) {
      const { count } = await db.from("tool_votes").select("id", { count: "exact", head: true }).eq("tool_id", toolId).eq("ip_hash", voter.ipHash);
      if ((count ?? 0) >= MAX_PER_IP_PER_TOOL) return done({ error: "此網路對該工具的投票數已達上限" }, 429);
    }
    const { error } = await db.from("tool_votes").upsert({ tool_id: toolId, voter_hash: voter.hash, ip_hash: voter.ipHash, vote, updated_at: new Date().toISOString() }, { onConflict: "tool_id,voter_hash" });
    if (error) { console.error("vote", error); return done({ error: "投票失敗" }, 500); }
  }
  const stats = await getStats(toolId).catch(() => null);
  return done({ ok: true, myVote: vote, stats });
}
