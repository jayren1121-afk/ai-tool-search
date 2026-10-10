import { cleanMovedText, isMovedType, MOVED_MAX, safeHttpUrl } from "@/lib/health-moved";
import { t, type Locale } from "@/lib/i18n";

export type HealthInfo = { status?: string | null; last_checked_at?: string | null; moved_type?: string | null; moved_to?: string | null } | null | undefined;

/** 官網連線狀態小標籤。只顯示 live（綠）與 down（紅）；unknown 或沒有資料時不顯示任何東西（避免誤導訪客）。 */
export default function HealthBadge({ health, locale, full = false, className = "" }: { health: HealthInfo; locale: Locale; full?: boolean; className?: string }) {
  const s = health?.status;
  const L = t(locale);
  // 「已轉址／已改名」提示（後台選填）：全部以文字渲染（React 會跳脫），不用 dangerouslySetInnerHTML；沒填就什麼都不顯示
  const mType = isMovedType(health?.moved_type) ? health?.moved_type : null;
  const mTo = mType ? cleanMovedText(health?.moved_to).slice(0, MOVED_MAX) : "";
  const mHref = mType === "moved" ? safeHttpUrl(mTo) : null; // 不是 http/https 網址就不做成連結（只顯示文字）
  const movedLine = mType && mTo ? (
    <p className="mt-1 break-words font-medium text-slate-900">
      <span aria-hidden="true">↪ </span>{mType === "moved" ? L.healthMoved : L.healthRenamed}{" "}
      {mHref ? <a href={mHref} target="_blank" rel="nofollow noopener noreferrer" className="break-all text-slate-900 underline">{mTo}</a> : <span className="break-all">{mTo}</span>}
    </p>
  ) : null;
  // 已有改名／轉址提示且 status = down：不顯示紅色「網站異常」，只顯示改名／轉址那一行（live 照常顯示）
  if (s !== "live" && !(s === "down" && !movedLine)) return movedLine ? <div className={`text-xs ${className}`}>{movedLine}</div> : null;
  const ts = health?.last_checked_at ? Date.parse(String(health.last_checked_at)) : NaN;
  const date = Number.isNaN(ts) ? "" : new Date(ts).toISOString().slice(0, 10); // 一律用 UTC 日期，避免資料庫時區造成不同顯示
  const tone = s === "live" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200";
  return (
    <div className={`text-xs ${className}`}>
      <span title={L.healthHint} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ring-1 ring-inset ${tone}`}>
        <span aria-hidden="true">{s === "live" ? "●" : "▲"}</span>{s === "live" ? L.healthLive : L.healthDown}
      </span>
      {date && <span className="ml-2 text-slate-400" title={L.healthHint}>{L.healthChecked(date)}</span>}
      {movedLine}
      {full && <p className="mt-1 text-slate-400">{L.healthHint}{s === "down" ? ` ${L.healthDownNote}` : ""}</p>}
    </div>
  );
}
