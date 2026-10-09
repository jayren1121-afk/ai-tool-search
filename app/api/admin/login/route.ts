import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, cookieOpts, makeSession, safeEqual } from "@/lib/admin-auth";
import { jerr, noStore } from "@/lib/admin-guard";
import { checkLimits, clientIp, ipHash, originOk, readJson } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_IP_15MIN = 8;   // 同一 IP 15 分鐘內最多失敗次數（存在資料庫，跨伺服器實例有效）
const GLOBAL_HOUR = 40;   // 全站 1 小時內最多失敗次數（防分散式暴力破解）
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 以 job_runs 記錄登入失敗（不需 Upstash 也能跨實例限制）；資料表不存在時回傳 null */
async function recentFailures(ipH: string): Promise<{ ip: number; all: number } | null> {
  const db = supabaseAdmin();
  const since15 = new Date(Date.now() - 15 * 60_000).toISOString(), since60 = new Date(Date.now() - 3600_000).toISOString();
  const [a, b] = await Promise.all([
    db.from("job_runs").select("id", { count: "exact", head: true }).eq("job", "admin_login_fail").eq("message", ipH).gte("started_at", since15),
    db.from("job_runs").select("id", { count: "exact", head: true }).eq("job", "admin_login_fail").gte("started_at", since60),
  ]);
  if (a.error || b.error) return null;
  return { ip: a.count ?? 0, all: b.count ?? 0 };
}

export async function POST(req: NextRequest) {
  if (!originOk(req)) return jerr("來源不被允許", 403);
  if (!adminConfigured()) return jerr("尚未設定 ADMIN_PASSWORD（至少 8 個字元）", 503);
  const ip = clientIp(req), ipH = ipHash(ip);
  // 第一層：既有限流（有 Upstash 時跨實例；沒有時為單一實例記憶體）
  if (await checkLimits("admin-login", ip, [{ name: "min", max: 5, windowSec: 60 }, { name: "day", max: 50, windowSec: 86400 }]))
    return jerr("嘗試次數過多，請稍後再試", 429);
  // 第二層：資料庫記錄的失敗次數（沒有 Upstash 也有效）
  const fails = await recentFailures(ipH);
  if (fails && (fails.ip >= PER_IP_15MIN || fails.all >= GLOBAL_HOUR)) return jerr("登入失敗次數過多，請 15 分鐘後再試", 429);

  const body = await readJson(req, 1024);
  const pw = typeof body?.password === "string" ? body.password : "";
  if (!pw || !safeEqual(pw, (process.env.ADMIN_PASSWORD || "").trim())) {
    await supabaseAdmin().from("job_runs").insert({ job: "admin_login_fail", status: "fail", message: ipH, finished_at: new Date().toISOString() }).then(() => {}, () => {});
    await sleep(700); // 拖慢暴力破解
    return jerr("密碼錯誤", 401);
  }
  const s = makeSession();
  const res = NextResponse.json({ ok: true }, { headers: noStore });
  res.cookies.set(ADMIN_COOKIE, s.value, cookieOpts(s.maxAge));
  return res;
}
