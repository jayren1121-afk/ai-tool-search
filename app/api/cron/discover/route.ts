import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin-auth";
import { runDiscovery } from "@/lib/discovery-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron 每天呼叫一次（見 vercel.json）；Vercel 會自動帶 Authorization: Bearer ${CRON_SECRET} */
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (!secret || secret.length < 16 || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const r = await runDiscovery("cron");
  return NextResponse.json(
    { status: r.status, message: r.message, added: r.added ? { id: r.added.id, name: r.added.name, url: r.added.url } : null, sources: r.sources, tried: r.tried },
    { status: r.status === "error" ? 500 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
