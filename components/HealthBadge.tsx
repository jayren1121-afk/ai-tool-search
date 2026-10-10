import { t, type Locale } from "@/lib/i18n";

export type HealthInfo = { status?: string | null; last_checked_at?: string | null } | null | undefined;

/** 官網連線狀態小標籤。只顯示 live（綠）與 down（紅）；unknown 或沒有資料時不顯示任何東西（避免誤導訪客）。 */
export default function HealthBadge({ health, locale, full = false, className = "" }: { health: HealthInfo; locale: Locale; full?: boolean; className?: string }) {
  const s = health?.status;
  if (s !== "live" && s !== "down") return null;
  const L = t(locale);
  const ts = health?.last_checked_at ? Date.parse(String(health.last_checked_at)) : NaN;
  const date = Number.isNaN(ts) ? "" : new Date(ts).toISOString().slice(0, 10); // 一律用 UTC 日期，避免資料庫時區造成不同顯示
  const tone = s === "live" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200";
  return (
    <div className={`text-xs ${className}`}>
      <span title={L.healthHint} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ring-1 ring-inset ${tone}`}>
        <span aria-hidden="true">{s === "live" ? "●" : "▲"}</span>{s === "live" ? L.healthLive : L.healthDown}
      </span>
      {date && <span className="ml-2 text-slate-400" title={L.healthHint}>{L.healthChecked(date)}</span>}
      {full && <p className="mt-1 text-slate-400">{L.healthHint}{s === "down" ? ` ${L.healthDownNote}` : ""}</p>}
    </div>
  );
}
