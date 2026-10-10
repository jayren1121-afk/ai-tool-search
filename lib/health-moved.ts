// 「已轉址／已改名」提示（選填）：純邏輯，前後台共用（不連資料庫、不依賴伺服器專用套件）。
// 內容只會以「文字」渲染（React 預設跳脫），絕不使用 dangerouslySetInnerHTML。
export type MovedType = "moved" | "renamed";
export const MOVED_MAX = 200;
export const isMovedType = (v: unknown): v is MovedType => v === "moved" || v === "renamed";

// 控制字元、零寬字元、雙向文字控制字元（可用來偽裝網址或名稱）一律移除
// eslint-disable-next-line no-control-regex
const STRIP = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
export const cleanMovedText = (v: unknown) => (typeof v === "string" ? v.replace(STRIP, " ").replace(/\s+/g, " ").trim() : "");

/** 只接受 http / https、沒有帳號密碼、主機名稱含「.」且不是 IP／內網名稱的網址 */
export function safeHttpUrl(u: unknown): string | null {
  if (typeof u !== "string" || !u || u.length > 2048) return null;
  try {
    const x = new URL(u);
    if (x.protocol !== "https:" && x.protocol !== "http:") return null;
    if (x.username || x.password) return null;
    const h = x.hostname.toLowerCase();
    if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return null;
    if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa)$/.test(h)) return null;
    return x.toString();
  } catch { return null; }
}

export type MovedCheck = { ok: true; type: MovedType | null; to: string | null } | { ok: false; error: string };

/** 驗證後台輸入。type 為空／"none"／null 代表清除。 */
export function validateMoved(typeIn: unknown, toIn: unknown): MovedCheck {
  if (typeIn === null || typeIn === undefined || typeIn === "" || typeIn === "none") return { ok: true, type: null, to: null };
  if (!isMovedType(typeIn)) return { ok: false, error: "類型只能是「無」、「已轉址」或「已改名」" };
  const raw = typeof toIn === "string" ? toIn : "";
  const to = cleanMovedText(raw);
  if (!to) return { ok: false, error: typeIn === "moved" ? "請填入新網址" : "請填入新名稱" };
  if (to.length > MOVED_MAX) return { ok: false, error: `最多 ${MOVED_MAX} 字（目前 ${to.length} 字）` };
  if (typeIn === "moved") {
    if (/\s/.test(to)) return { ok: false, error: "網址中不能有空白" };
    if (!/^https?:\/\//i.test(to)) return { ok: false, error: "新網址必須以 http:// 或 https:// 開頭" };
    if (!safeHttpUrl(to)) return { ok: false, error: "新網址格式不正確（需為公開的 http／https 網址，不能含帳號密碼）" };
  }
  return { ok: true, type: typeIn, to };
}
