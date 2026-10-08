import { pctGood } from "@/lib/types";
import { t, type Locale } from "@/lib/i18n";
/** 唯讀：👍 / 👎 / 好評率 */
export default function VoteSummary({ up = 0, down = 0, className = "", locale = "zh" }: { up?: number; down?: number; className?: string; locale?: Locale }) {
  const pct = pctGood(up, down); const L = t(locale);
  return (
    <span className={`inline-flex items-center gap-2 text-xs text-slate-500 ${className}`} title={L.votes}>
      <span>👍 {up}</span><span>👎 {down}</span>
      {pct !== null ? <span className={pct >= 70 ? "text-emerald-700" : pct >= 40 ? "text-amber-700" : "text-rose-700"}>{L.good(pct)}</span> : <span>{L.noVotes}</span>}
    </span>
  );
}
