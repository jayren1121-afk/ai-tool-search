import { t, type Locale } from "@/lib/i18n";
import { safeUrl, snapDate, type PriceSnapshot, type SnapPlan } from "@/lib/price-snapshots";

const SYM: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", TWD: "NT$", KRW: "₩", INR: "₹" };
const money = (n: number | null, cur: string | null) => (n == null ? null : `${cur ? (SYM[cur] ?? cur + " ") : "$"}${Number.isInteger(n) ? n.toLocaleString("en-US") : n}`);

/** 官網價格快照（已人工核准的資料）。所有欄位只顯示頁面上明確出現過的數字；沒有的顯示「—」。 */
export default function PriceSnapshotSection({ snap, locale }: { snap: PriceSnapshot; locale: Locale }) {
  const L = t(locale);
  const date = snapDate(snap.fetched_at);
  const src = safeUrl(snap.source_url)!;
  const plans = snap.plans.filter((p) => p && p.name).slice(0, 10); // 沒有方案名稱的不顯示（寧缺勿錯）
  const cell = (p: SnapPlan, v: number | null) => money(v, p.currency) ?? "—";
  const free = snap.free_tier && snap.free_tier.available != null ? snap.free_tier : null;
  return (
    <section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3" aria-label={L.officialPrice(date)}>
      <h3 className="text-sm font-semibold text-slate-900">{L.officialPrice(date)}</h3>
      {plans.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr><th className="py-1 pr-2 font-medium">{L.snapPlan}</th><th className="py-1 pr-2 font-medium">{L.snapMonthly}</th><th className="py-1 pr-2 font-medium">{L.snapYearlyPerMonth}</th><th className="py-1 pr-2 font-medium">{L.snapYearTotal}</th><th className="py-1 font-medium">{L.snapNote}</th></tr>
            </thead>
            <tbody>
              {plans.map((p, i) => {
                const unclear = p.price_unclear ?? null;
                const none = p.price_monthly == null && p.price_yearly_per_month == null && p.price_yearly_total == null && unclear == null;
                const listP = p.list_price ?? p.regular_price_monthly ?? null;
                const listU = p.list_price_unit ?? (p.regular_price_monthly != null ? "month" : null);
                return (
                  <tr key={i} className="border-t border-emerald-100 align-top">
                    <td className="py-1 pr-2 font-medium">{p.name}{p.is_promo && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">{L.snapPromo}</span>}</td>
                    <td className="py-1 pr-2">{none ? <span className="text-slate-500">{L.snapContact}</span> : cell(p, p.price_monthly)}</td>
                    <td className="py-1 pr-2">{none ? "" : cell(p, p.price_yearly_per_month)}</td>
                    <td className="py-1 pr-2">{none ? "" : cell(p, p.price_yearly_total)}</td>
                    <td className="py-1 text-xs text-slate-500">{[p.billing_note, unclear != null ? `${money(unclear, p.currency)} ${L.snapUnclear}` : null, listP != null ? L.snapRegular(money(listP, p.currency)! + (listU === "year" ? L.perYear : L.perMonth)) : null].filter(Boolean).join("；") || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {free && <p className="mt-2 text-sm"><span className="text-slate-500">{L.freeTier}{locale === "en" ? ": " : "："}</span>{free.available ? (free.limits || L.snapFreeYes) : L.snapFreeNo}</p>}
      {snap.display_region_note && <p className="mt-1 text-xs text-slate-500">{snap.display_region_note}</p>}
      <p className="mt-2 text-xs text-slate-600">
        {L.snapSource}{locale === "en" ? ": " : "："}
        <a href={src} target="_blank" rel="nofollow noopener noreferrer" className="break-all font-medium text-slate-900 underline hover:text-black">{L.snapSourceLabel}</a>
        {L.snapFetched(date)}
      </p>
      <p className="mt-1 text-xs text-amber-800">{L.snapDisclaimer}</p>
      {snap.evidence?.length > 0 && (
        <details className="mt-1 text-xs text-slate-500">
          <summary className="cursor-pointer">{L.snapEvidence}</summary>
          <ul className="mt-1 list-disc space-y-1 pl-5">{snap.evidence.slice(0, 6).map((e, i) => <li key={i} className="break-words">“{e.evidence_quote}”</li>)}</ul>
        </details>
      )}
    </section>
  );
}
