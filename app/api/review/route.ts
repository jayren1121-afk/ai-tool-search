import { NextRequest, NextResponse } from "next/server";
import { normText, spamReason } from "@/lib/spam";
import { applyPass, applyVoter, checkLimits, clientIp, getVoter, originOk, readJson, turnstileGate, validToolId } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const MAX_PER_IP_PER_TOOL = 2;

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ error: "來源不被允許" }, { status: 403 });
  const body = await readJson(req, 6144);
  if (!body) return NextResponse.json({ error: "請求格式錯誤或過大" }, { status: 400 });
  const { toolId, rating, content, use_case, turnstileToken } = body as Record<string, unknown>;
  if (!validToolId(toolId)) return NextResponse.json({ error: "無效的 toolId" }, { status: 400 });
  const r = Number(rating);
  const text = typeof content === "string" ? content.trim().replace(/\s+\n/g, "\n") : "";
  const uc = typeof use_case === "string" && use_case.trim() ? use_case.trim().slice(0, 100) : null;
  if (!Number.isInteger(r) || r < 1 || r > 5) return NextResponse.json({ error: "請選擇 1–5 星" }, { status: 400 });
  if (text.length < 10 || text.length > 500) return NextResponse.json({ error: "評論內容需 10–500 字" }, { status: 400 });
  const spam = spamReason(text) || (uc ? spamReason(uc) : null);
  if (spam) return NextResponse.json({ error: spam }, { status: 400 });

  const ip = clientIp(req);
  if (await checkLimits("review", ip, [{ name: "10min", max: 5, windowSec: 600 }, { name: "day", max: 20, windowSec: 86400 }]))
    return NextResponse.json({ error: "送出太頻繁，請稍後再試" }, { status: 429 });
  const gate = await turnstileGate(req, turnstileToken, ip);
  if (!gate.ok) return NextResponse.json({ error: "請先完成人機驗證", turnstile: true }, { status: 403 });

  const voter = getVoter(req, ip);
  const db = supabaseAdmin();
  const done = (data: Record<string, unknown>, status = 200) => { const res = NextResponse.json(data, { status }); applyPass(res, gate); applyVoter(res, voter); return res; };

  const { data: tool } = await db.from("ai_tools").select("id").eq("id", toolId).maybeSingle();
  if (!tool) return done({ error: "找不到工具" }, 404);

  const { data: mine, error: e1 } = await db.from("tool_reviews").select("id").eq("tool_id", toolId).eq("voter_hash", voter.hash).maybeSingle();
  if (e1) return done({ error: "評論功能尚未啟用" }, 503);
  if (!mine) {
    const { count } = await db.from("tool_reviews").select("id", { count: "exact", head: true }).eq("tool_id", toolId).eq("ip_hash", voter.ipHash);
    if ((count ?? 0) >= MAX_PER_IP_PER_TOOL) return done({ error: "此網路對該工具的評論數已達上限" }, 429);
  }
  // 重複內容：30 天內他人（任何工具）相同文字
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: recent } = await db.from("tool_reviews").select("content,voter_hash").gte("created_at", since).neq("voter_hash", voter.hash).order("created_at", { ascending: false }).limit(500);
  const n = normText(text);
  if ((recent ?? []).some((x: { content: string }) => normText(x.content) === n)) return done({ error: "與其他評論內容重複" }, 400);

  const now = new Date().toISOString();
  const { error } = mine
    ? await db.from("tool_reviews").update({ rating: r, content: text, use_case: uc, updated_at: now }).eq("id", mine.id) // 編輯不改變 status（管理員隱藏的維持隱藏）
    : await db.from("tool_reviews").insert({ tool_id: toolId, voter_hash: voter.hash, ip_hash: voter.ipHash, rating: r, content: text, use_case: uc });
  if (error) { console.error("review", error); return done({ error: "送出失敗" }, 500); }
  return done({ ok: true, edited: !!mine });
}
