import { NextRequest, NextResponse } from "next/server";
import { guard, jerr, noStore } from "@/lib/admin-guard";
import { approveStoredSuggestion, confirmStoredSuggestion, moderateStoredSuggestion } from "@/lib/suggestion-store";
import { readJson } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 核准會抓取建議網址並整理成目錄列。沒有新的公開入口，仍走原本的登入與來源檢查。 */
export async function POST(req: NextRequest) {
  const bad = guard(req);
  if (bad) return bad;
  const body = await readJson(req, 12000);
  if (!body) return jerr("請求格式錯誤或過大", 400);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = body.action;
  if (!ID_RE.test(id)) return jerr("無效的 id", 400);
  if (action === "approve" || action === "retry") {
    const result = await approveStoredSuggestion(id);
    if (!result.ok) return jerr(result.error, result.status);
    return NextResponse.json(result, { headers: noStore });
  }
  if (action === "confirm") {
    const result = await confirmStoredSuggestion(id, body.edits);
    if (!result.ok) return jerr(result.error, result.status);
    return NextResponse.json(result, { headers: noStore });
  }
  if (action !== "reject") return jerr("未知的動作", 400);
  const result = await moderateStoredSuggestion(id, "reject");
  if (!result.ok) return jerr(result.error, result.status);
  return NextResponse.json({ ok: true, state: "rejected", note: result.note }, { headers: noStore });
}
