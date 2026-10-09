import { NextRequest, NextResponse } from "next/server";
import { guard, noStore } from "@/lib/admin-guard";
import { runDiscovery } from "@/lib/discovery-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 後台「立即執行一次」：與每日排程相同流程（每天仍最多新增 1 筆） */
export async function POST(req: NextRequest) {
  const bad = guard(req);
  if (bad) return bad;
  const r = await runDiscovery("admin");
  return NextResponse.json({ status: r.status, message: r.message, tried: r.tried, sources: r.sources }, { headers: noStore });
}
