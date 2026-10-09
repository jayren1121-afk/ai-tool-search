"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { protectedPost } from "@/lib/client";
import { pctGood, type AltRow, type Buzz, type Community, type Heat, type Review } from "@/lib/types";
import { pricingName, t, toolHref, trChecked, trError, trFree, trHeat, trSub, type Locale } from "@/lib/i18n";

const fmt = (d: string, loc: Locale) => new Date(d).toLocaleString(t(loc).dateLocale, { dateStyle: "medium", timeStyle: "short" });

/** 讀取站內社群資料（投票、熱度、評論、替代方案） */
export function useCommunity(toolId: string | null, locale: Locale = "zh") {
  const [data, setData] = useState<Community | null>(null);
  const [sort, setSort] = useState<"new" | "helpful">("new");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const reload = useCallback(async () => {
    if (!toolId) return;
    setLoading(true); setErr("");
    try {
      const r = await fetch(`/api/community?toolId=${encodeURIComponent(toolId)}&sort=${sort}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(trError(locale, j.error || "載入失敗"));
      setData(j);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [toolId, sort, locale]);
  useEffect(() => { setData(null); }, [toolId]);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, sort, setSort, loading, err, reload };
}

export function HeatCard({ heat, enabled, locale = "zh" }: { heat: Heat | null; enabled: boolean; locale?: Locale }) {
  const L = t(locale);
  if (!enabled) return <p className="text-sm text-slate-500">{L.heatOff}</p>;
  if (!heat) return <p className="text-sm text-slate-500">{L.heatPending}</p>;
  const parts = heat.breakdown?.parts ?? [];
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-orange-100 px-3 py-1 text-lg font-bold text-orange-700">🔥 {heat.heat_score ?? "?"}</span>
        <span className="text-xs text-slate-500">{L.heatRel}</span>
      </div>
      <table className="mt-3 w-full text-left text-xs">
        <thead className="text-slate-500"><tr><th className="py-1">{L.heatSrc}</th><th>{L.heatVal}</th><th className="text-right">{L.heatPts}</th></tr></thead>
        <tbody>
          {parts.map((p, i) => (
            <tr key={i} className="border-t">
              <td className="py-1 pr-2">{trHeat(locale, p.label)}{p.note ? <div className="text-[10px] text-slate-400">{trHeat(locale, p.note)}</div> : null}</td>
              <td>{p.value ?? L.unknown}</td><td className="text-right">{p.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">{L.heatUpdated(fmt(heat.refreshed_at, locale))}</p>
    </div>
  );
}

export function BuzzView({ buzz, locale = "zh" }: { buzz?: Buzz; locale?: Locale }) {
  const L = t(locale);
  if (!buzz) return <p className="text-sm text-slate-500">{L.buzzOld}</p>;
  const Src = ({ s }: { s: Buzz["praise"][number]["sources"] }) => (
    <span className="ml-1 text-xs">{s.map((x, i) => <a key={i} href={x.url} target="_blank" rel="nofollow noopener noreferrer" className="mr-1 text-indigo-600 hover:underline" title={x.title}>[{x.site}]</a>)}</span>
  );
  return (
    <div className="space-y-3 text-sm">
      <p className={buzz.sufficient ? "" : "text-slate-500"}><b>{L.overall}</b>{buzz.overall}</p>
      {buzz.praise.length > 0 && <div><div className="font-medium text-emerald-700">{L.praise}</div><ul className="list-disc pl-5">{buzz.praise.map((p, i) => <li key={i}>{p.text}<Src s={p.sources} /></li>)}</ul></div>}
      {buzz.complaints.length > 0 && <div><div className="font-medium text-rose-700">{L.complaints}</div><ul className="list-disc pl-5">{buzz.complaints.map((p, i) => <li key={i}>{p.text}<Src s={p.sources} /></li>)}</ul></div>}
      <p className="text-xs text-slate-400">{L.buzzNote(buzz.snippet_count, buzz.checked.map((c) => trChecked(locale, c)).join(L.listSep) || L.none)}</p>
    </div>
  );
}

export function AlternativesTable({ selfId, alts, note, locale = "zh" }: { selfId: string; alts: AltRow[]; note?: string; locale?: Locale }) {
  const L = t(locale);
  if (!alts.length) return <p className="text-sm text-slate-500">{L.noAlts}</p>;
  return (
    <div className="text-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1">{L.altTool}</th><th>{L.altPricing}</th><th>{L.altMin}</th><th>{L.altFree}</th><th>{L.altGood}</th></tr></thead>
          <tbody>
            {alts.map((a) => {
              const pct = pctGood(a.up, a.down);
              return (
                <tr key={a.id} className={`border-t align-top ${a.id === selfId ? "bg-indigo-50/50" : ""}`}>
                  <td className="py-1 pr-2"><Link href={toolHref(locale, a.id)} className="font-medium text-indigo-700 hover:underline">{a.name}</Link>{a.subcategory ? <div className="text-[10px] text-slate-400">{trSub(locale, a.subcategory)}</div> : null}</td>
                  <td>{pricingName(locale, a.pricing_model) ?? L.unknown}</td>
                  <td>{a.min_price != null ? `US$${a.min_price}` : L.unknown}</td>
                  <td className="max-w-[10rem]">{trFree(locale, a.free_tier) || L.unknown}</td>
                  <td>{pct !== null ? `${pct}% (${a.up + a.down})` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {note ? <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600"><b>{L.aiCompare}</b>{note}<span className="text-slate-400">{L.aiCompareNote}</span></p> : null}
      <p className="mt-1 text-[10px] text-slate-400">{L.altFoot}</p>
    </div>
  );
}

function Stars({ n, size = "text-sm", locale = "zh" }: { n: number; size?: string; locale?: Locale }) {
  return <span className={`${size} text-amber-500`} aria-label={t(locale).stars(n)}>{"★".repeat(n)}<span className="text-slate-300">{"★".repeat(5 - n)}</span></span>;
}

export function ReviewsSection({ toolId, c, sort, setSort, reload, locale = "zh" }: { toolId: string; c: Community; sort: "new" | "helpful"; setSort: (s: "new" | "helpful") => void; reload: () => void; locale?: Locale }) {
  const [editing, setEditing] = useState(false);
  const L = t(locale);
  if (!c.enabled) return <p className="text-sm text-slate-500">{trError(locale, "評論功能尚未啟用")}</p>;
  const st = c.stats;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {st?.review_count ? <><Stars n={Math.round(Number(st.rating_avg) || 0)} size="text-lg" locale={locale} /><span className="font-semibold">{Number(st.rating_avg).toFixed(1)}</span><span className="text-slate-500">{L.reviewCount(st.review_count)}</span></> : <span className="text-slate-500">{L.noReviews}</span>}
        <select value={sort} onChange={(e) => setSort(e.target.value as "new" | "helpful")} className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs" aria-label={L.sortLabel}>
          <option value="new">{L.sortNew}</option><option value="helpful">{L.sortHelpful}</option>
        </select>
      </div>
      {editing || !c.myReview
        ? <ReviewForm toolId={toolId} initial={c.myReview} locale={locale} onDone={() => { setEditing(false); reload(); }} onCancel={c.myReview ? () => setEditing(false) : undefined} />
        : <button className="rounded border px-3 py-1 text-xs hover:bg-slate-50" onClick={() => setEditing(true)}>{L.editMine}</button>}
      <ul className="space-y-2">
        {c.reviews.map((r) => <ReviewItem key={r.id} r={r} locale={locale} />)}
      </ul>
      <p className="text-[10px] text-slate-400">{L.reviewDisclaimer}</p>
    </div>
  );
}

function ReviewItem({ r, locale }: { r: Review; locale: Locale }) {
  const L = t(locale);
  const [count, setCount] = useState(r.helpful_count); const [helped, setHelped] = useState(!!r.helped); const [err, setErr] = useState("");
  const help = async () => {
    if (helped || r.mine) return;
    setHelped(true); setCount((c) => c + 1);
    try {
      const { ok, data } = await protectedPost<{ helpful_count?: number }>("/api/review/helpful", { reviewId: r.id });
      if (!ok) throw new Error(data.error || L.actionFailed);
      if (typeof data.helpful_count === "number") setCount(data.helpful_count);
    } catch (e) { setHelped(false); setCount((c) => c - 1); setErr((e as Error).message); }
  };
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2"><Stars n={r.rating} locale={locale} />{r.use_case ? <span className="rounded bg-slate-100 px-1.5 text-[10px]">{r.use_case}</span> : null}{r.mine ? <span className="text-[10px] text-indigo-600">{L.myReview}</span> : null}
        <span className="ml-auto text-[10px] text-slate-400">{fmt(r.updated_at || r.created_at, locale)}</span></div>
      <p className="mt-1 whitespace-pre-line break-words">{r.content}</p>
      <button onClick={help} disabled={helped || r.mine} className="mt-1 text-xs text-slate-500 hover:text-indigo-600 disabled:opacity-60">{L.helpful(count)}</button>
      {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
    </li>
  );
}

function ReviewForm({ toolId, initial, onDone, onCancel, locale }: { toolId: string; initial: Community["myReview"]; onDone: () => void; onCancel?: () => void; locale: Locale }) {
  const L = t(locale);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [content, setContent] = useState(initial?.content ?? ""); const [uc, setUc] = useState(initial?.use_case ?? "");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const submit = async () => {
    setBusy(true); setErr(""); setOk("");
    try {
      const { ok, data } = await protectedPost<{ edited?: boolean }>("/api/review", { toolId, rating, content, use_case: uc });
      if (!ok) throw new Error(data.error || L.submitFailed);
      setOk(data.edited ? L.updated : L.thanks); onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const len = content.trim().length;
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="flex items-center gap-1 text-sm">{initial ? L.editReview : L.writeReview}{locale === "en" ? ":" : "："}
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={L.stars(n)} className={`text-xl ${n <= rating ? "text-amber-500" : "text-slate-300"}`}>★</button>)}
      </div>
      <input value={uc} onChange={(e) => setUc(e.target.value.slice(0, 100))} placeholder={L.useCasePh} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
      <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 500))} rows={3} placeholder={L.contentPh} className="w-full rounded border border-slate-300 p-2 text-sm" />
      <div className="flex items-center gap-2 text-xs">
        <span className={len < 10 ? "text-rose-600" : "text-slate-400"}>{len}/500</span>
        <button disabled={busy || rating < 1 || len < 10} onClick={submit} className="rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-50">{busy ? L.submitting : L.submit}</button>
        {onCancel && <button onClick={onCancel} className="underline">{L.cancel}</button>}
        {err && <span className="text-red-600">{err}</span>}{ok && <span className="text-emerald-700">{ok}</span>}
      </div>
    </div>
  );
}
