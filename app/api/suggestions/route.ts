import { NextRequest, NextResponse } from "next/server";
import { saveSuggestion } from "@/lib/suggestion-store";
import { applyPass, checkLimits, clientIp, ipHash, originOk, readJson, turnstileGate } from "@/lib/security";
import { SUGGEST_LIMITS, parseSuggestion, resolveSuggestionSecret, suggestionSigOk } from "@/lib/suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const env = (k: string) => (process.env[k] || "").trim();

/** 只接受搜尋回應裡簽過名的網址與標題。Turnstile 沒設定時略過。 */
export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ error: "來源不被允許" }, { status: 403, headers: noStore });
  const body = await readJson(req, 4096);
  if (!body) return NextResponse.json({ error: "請求格式錯誤或過大" }, { status: 400, headers: noStore });
  const parsed = parseSuggestion(body);
  const secret = resolveSuggestionSecret(env, process.env.NODE_ENV === "production");
  if (!secret) return NextResponse.json({ error: "建議功能尚未設定" }, { status: 503, headers: noStore });
  if (!parsed || !suggestionSigOk(secret, parsed.url, parsed.title, parsed.sig)) {
    return NextResponse.json({ error: "這筆結果無法送出" }, { status: 400, headers: noStore });
  }
  const ip = clientIp(req);
  const gate = await turnstileGate(req, body.turnstileToken, ip);
  if (!gate.ok) return NextResponse.json({ error: "請先完成人機驗證", turnstile: true }, { status: 403, headers: noStore });
  const limited = await checkLimits("suggest", ipHash(ip), [...SUGGEST_LIMITS]);
  if (limited) return NextResponse.json({ error: "今天的建議次數已達上限，請明天再試" }, { status: 429, headers: noStore });
  const saved = await saveSuggestion(parsed, ipHash(ip));
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status, headers: noStore });
  const res = NextResponse.json({ ok: true, state: saved.state }, { headers: noStore });
  applyPass(res, gate);
  return res;
}
