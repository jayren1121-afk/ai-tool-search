"use client";
// 共用的前端 POST：遇到需人機驗證（403 + turnstile）時自動顯示 Turnstile 並重試一次
import { trError, type Locale } from "./i18n";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
/** 目前頁面語言（依 <html lang>） */
export const pageLocale = (): Locale => (typeof document !== "undefined" && document.documentElement.lang.startsWith("en") ? "en" : "zh");
const E = (m: string) => new Error(trError(pageLocale(), m));

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: Record<string, unknown>) => string;
      remove: (id: string) => void; reset: (id?: string) => void;
    };
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const ex = document.getElementById("cf-turnstile-js");
    if (ex) { ex.addEventListener("load", () => resolve()); ex.addEventListener("error", () => reject(E("無法載入人機驗證"))); return; }
    const s = document.createElement("script");
    s.id = "cf-turnstile-js"; s.async = true;
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload = () => resolve(); s.onerror = () => reject(E("無法載入人機驗證"));
    document.head.appendChild(s);
  });
}

let pending: Promise<string> | null = null;
/** 取得一次性 Turnstile token（managed 模式，多數情況不需互動） */
export function getTurnstileToken(): Promise<string> {
  if (!SITE_KEY) return Promise.reject(E("未設定人機驗證"));
  if (pending) return pending;
  pending = (async () => {
    await loadScript();
    const box = document.createElement("div");
    box.className = "fixed bottom-4 right-4 z-[100] rounded-lg bg-white p-2 shadow-xl";
    document.body.appendChild(box);
    try {
      return await new Promise<string>((resolve, reject) => {
        const id = window.turnstile!.render(box, {
          sitekey: SITE_KEY, appearance: "interaction-only", language: pageLocale() === "en" ? "en" : "zh-tw",
          callback: (t: string) => { resolve(t); setTimeout(() => { try { window.turnstile?.remove(id); } catch {} }, 0); },
          "error-callback": () => reject(E("人機驗證失敗，請重新整理頁面再試")),
          "timeout-callback": () => reject(E("人機驗證逾時")),
        });
      });
    } finally { box.remove(); pending = null; }
  })();
  return pending;
}

export async function protectedPost<T = Record<string, unknown>>(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const send = async (extra: Record<string, unknown> = {}) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) });
    return { r, j: await r.json().catch(() => ({})) };
  };
  let { r, j } = await send();
  if (r.status === 403 && j?.turnstile && SITE_KEY) {
    const token = await getTurnstileToken();
    ({ r, j } = await send({ turnstileToken: token }));
  }
  if (j && typeof j.error === "string") j.error = trError(pageLocale(), j.error); // 英文頁面翻譯伺服器錯誤訊息
  return { ok: r.ok, status: r.status, data: j };
}
