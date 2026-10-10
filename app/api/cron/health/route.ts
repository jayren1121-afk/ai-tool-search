import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin-auth";
import { runHealthCheck } from "@/lib/health-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron 每天呼叫一次（見 vercel.json）；Vercel 會自動帶 Authorization: Bearer ${CRON_SECRET}。每次檢查最久沒檢查的一批官網。 */
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (!secret || secret.length < 16 || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const r = await runHealthCheck("cron");
  return NextResponse.json(
    { status: r.status, message: r.message, checked: r.checked, batch: r.batch, due: r.due, total: r.total, stale7d: r.stale7d, counts: r.counts },
    { status: r.status === "error" ? 500 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
