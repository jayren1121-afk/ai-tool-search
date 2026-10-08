import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const env = (k: string) => (process.env[k] || "").trim();

/* ---------- 來源檢查 ---------- */
export function allowedOrigins(): string[] {
  const list = (env("ALLOWED_ORIGINS") || "https://ai-tool-search.vercel.app").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  if (env("NEXT_PUBLIC_SITE_URL")) list.push(env("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, ""));
  if (env("VERCEL_URL")) list.push(`https://${env("VERCEL_URL")}`);
  if (env("VERCEL_PROJECT_PRODUCTION_URL")) list.push(`https://${env("VERCEL_PROJECT_PRODUCTION_URL")}`);
  if (process.env.NODE_ENV !== "production") list.push("http://localhost:3000", "http://127.0.0.1:3000");
  return list;
}
export function originOk(req: NextRequest): boolean {
  let o = req.headers.get("origin");
  if (!o) { const ref = req.headers.get("referer"); if (ref) { try { o = new URL(ref).origin; } catch { o = null; } } }
  return !!o && allowedOrigins().includes(o.replace(/\/+$/, ""));
}

/* ---------- IP ---------- */
export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim();
}
export function ipHash(ip: string): string {
  const salt = env("IP_HASH_SALT") || env("SUPABASE_SERVICE_ROLE_KEY").slice(-16) || "ai-tool-search";
  return createHash("sha256").update(salt + ":" + ip).digest("hex").slice(0, 32);
}

/* ---------- 請求內容 ---------- */
export async function readJson(req: NextRequest, maxBytes = 2048): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) return null;
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) return null;
  try { const j = JSON.parse(text); return j && typeof j === "object" && !Array.isArray(j) ? j : null; } catch { return null; }
}
export const TOOL_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const validToolId = (v: unknown): v is string => typeof v === "string" && v.length <= 64 && TOOL_ID_RE.test(v);

/* ---------- 限流：Upstash Redis（REST），無設定時退回記憶體 ---------- */
const mem = new Map<string, { n: number; exp: number }>();
function memIncr(key: string, ttlSec: number): number {
  const now = Date.now(); const cur = mem.get(key);
  if (!cur || cur.exp < now) { mem.set(key, { n: 1, exp: now + ttlSec * 1000 }); return 1; }
  cur.n++; return cur.n;
}
export const upstashEnabled = () => !!(env("UPSTASH_REDIS_REST_URL") && env("UPSTASH_REDIS_REST_TOKEN"));

async function incr(key: string, ttlSec: number): Promise<number> {
  if (!upstashEnabled()) return memIncr(key, ttlSec);
  try {
    const r = await fetch(env("UPSTASH_REDIS_REST_URL").replace(/\/+$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("UPSTASH_REDIS_REST_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(ttlSec), "NX"]]),
      signal: AbortSignal.timeout(3000), cache: "no-store",
    });
    const j = await r.json();
    const n = Number(j?.[0]?.result);
    if (!r.ok || !Number.isFinite(n)) throw new Error("upstash bad response");
    return n;
  } catch (e) {
    console.error("upstash error, fallback to memory", e);
    return memIncr(key, ttlSec);
  }
}

const day = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
export type Limit = { name: string; max: number; windowSec: number };

/** 依序檢查多個限制；回傳第一個超過的限制名稱，或 null */
export async function checkLimits(scope: string, id: string, limits: Limit[]): Promise<string | null> {
  for (const l of limits) {
    const bucket = l.windowSec >= 86400 ? day() : String(Math.floor(Date.now() / 1000 / l.windowSec));
    const n = await incr(`rl:${scope}:${l.name}:${id}:${bucket}`, l.windowSec + 60);
    if (n > l.max) return l.name;
  }
  return null;
}

/** 全站每日 LLM 呼叫上限（低於 Groq 免費 1K/天） */
export async function globalDailyOk(): Promise<boolean> {
  const cap = Number(env("DIAGNOSE_DAILY_CAP")) || 800;
  const n = await incr(`cap:diagnose:${day()}`, 86400 + 3600);
  return n <= cap;
}

/* ---------- Cloudflare Turnstile ---------- */
export const turnstileEnabled = () => !!env("TURNSTILE_SECRET_KEY");
export const TS_COOKIE = "ts_pass";
const TS_TTL = 2 * 3600;

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: env("TURNSTILE_SECRET_KEY"), response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    return j?.success === true;
  } catch { return false; }
}
function sign(v: string) { return createHmac("sha256", env("TURNSTILE_SECRET_KEY")).update(v).digest("base64url"); }
/** 通過驗證後發出 2 小時有效的簽章 cookie，避免每次診斷都要驗證 */
export function makePassCookie(): { name: string; value: string; maxAge: number } {
  const exp = String(Math.floor(Date.now() / 1000) + TS_TTL);
  return { name: TS_COOKIE, value: `${exp}.${sign(exp)}`, maxAge: TS_TTL };
}
export function passCookieOk(v: string | undefined): boolean {
  if (!v) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}
