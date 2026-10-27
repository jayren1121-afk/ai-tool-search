import { NextRequest, NextResponse } from "next/server";
import { guard, jerr, noStore } from "@/lib/admin-guard";
import { moderateStoredSuggestion } from "@/lib/suggestion-store";
import { readJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 核准只標記建議本身。這一階段不新增 ai_tools。 */
export async function POST(req: NextRequest) {
  const bad = guard(req);
  if (bad) return bad;
  const body = await readJson(req, 1024);
  if (!body) return jerr("請求格式錯誤或過大", 400);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = body.action;
  if (!ID_RE.test(id)) return jerr("無效的 id", 400);
  if (action !== "approve" && action !== "reject") return jerr("未知的動作", 400);
  const result = await moderateStoredSuggestion(id, action);
  if (!result.ok) return jerr(result.error, result.status);
  return NextResponse.json({ ok: true, note: result.note }, { headers: noStore });
}
