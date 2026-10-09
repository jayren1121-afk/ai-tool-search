import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, sessionOk } from "./admin-auth";
import { originOk } from "./security";

export const noStore = { "Cache-Control": "no-store" };
export const jerr = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

/** 所有會改資料的後台 API：只接受 POST（由 route 檔只匯出 POST 保證）、檢查來源、檢查登入 cookie */
export function guard(req: NextRequest): NextResponse | null {
  if (!originOk(req)) return jerr("來源不被允許", 403);
  if (!sessionOk(req.cookies.get(ADMIN_COOKIE)?.value)) return jerr("請先登入", 401);
  return null;
}
