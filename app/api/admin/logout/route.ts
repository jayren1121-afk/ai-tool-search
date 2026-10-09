import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOpts } from "@/lib/admin-auth";
import { jerr, noStore } from "@/lib/admin-guard";
import { originOk } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!originOk(req)) return jerr("來源不被允許", 403);
  const res = NextResponse.json({ ok: true }, { headers: noStore });
  res.cookies.set(ADMIN_COOKIE, "", cookieOpts(0));
  return res;
}
