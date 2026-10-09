import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";

const env = (k: string) => (process.env[k] || "").trim();
export const ADMIN_COOKIE = "adm_s";
export const ADMIN_TTL = 12 * 3600; // 12 小時

/** 長度不同也不會提早結束的比較（先各自做 SHA-256 再 timingSafeEqual） */
export function safeEqual(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y) && a.length === b.length;
}

export const adminConfigured = () => env("ADMIN_PASSWORD").length >= 8;

/** 簽章密鑰：ADMIN_SESSION_SECRET（選填）＋密碼雜湊 → 改密碼後舊的登入 cookie 立即失效 */
function key(): string {
  const pw = createHash("sha256").update("jaytal-admin:" + env("ADMIN_PASSWORD")).digest("hex");
  return (env("ADMIN_SESSION_SECRET") || "derived") + ":" + pw;
}
const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

export function makeSession(): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_TTL;
  const payload = `v1.${exp}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: ADMIN_TTL };
}

export function sessionOk(v: string | undefined | null): boolean {
  if (!v || !adminConfigured() || v.length > 200) return false;
  const parts = v.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  return safeEqual(parts[2], sign(`v1.${parts[1]}`));
}

export const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: true, sameSite: "strict" as const, path: "/", maxAge });
