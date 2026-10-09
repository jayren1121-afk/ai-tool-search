"use client";
import { useCallback, useEffect, useState } from "react";
import { protectedPost } from "@/lib/client";
import type { Conf, DiagnoseResponse, EvidenceField, Tool } from "@/lib/types";
import { catName, pricingName, t, toolDesc, trError, trFree, trModels, trSub, type Locale } from "@/lib/i18n";
import { AlternativesTable, HeatCard, ReviewsSection, useCommunity } from "./Community";
import VoteButtons from "./VoteButtons";

type Tab = "official" | "heat" | "reviews" | "alts";
type L = ReturnType<typeof t>;

export default function DiagnosePanel({ tool, onClose, locale = "zh" }: { tool: Tool | null; onClose: () => void; locale?: Locale }) {
  const L = t(locale); const NA = L.unknown;
  const TABS: { k: Tab; label: string }[] = [
    { k: "heat", label: L.tabHeat }, { k: "reviews", label: L.tabReviews }, { k: "alts", label: L.tabAlts }, { k: "official", label: L.tabOfficial },
  ];
  const [shown, setShown] = useState<Tool | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("heat");
  const [d, setD] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const community = useCommunity(tool?.id ?? null, locale);

  useEffect(() => {
    if (tool) { setShown(tool); requestAnimationFrame(() => setOpen(true)); }
    else { setOpen(false); const x = setTimeout(() => setShown(null), 300); return () => clearTimeout(x); }
  }, [tool]);

  const run = useCallback(async (force = false) => {
    if (!tool) return;
    setLoading(true); setErr("");
    try {
      const { ok, data } = await protectedPost<DiagnoseResponse>("/api/diagnose", { toolId: tool.id, force, locale });
      if (!ok) throw new Error(data.error || L.diagFailed);
      setD(data);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [tool, locale, L.diagFailed]);

  useEffect(() => { setD(null); setErr(""); setTab("heat"); if (tool) run(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);

  if (!shown) return null;
  const tl = shown; const r = d?.result; const c = community.data;
  const fc = (f: EvidenceField) => r?.field_confidence?.[f];
  const ev = (f: EvidenceField) => r?.evidence?.[f];
  const List = ({ a }: { a?: string[] }) => a?.length ? <ul className="list-disc pl-5">{a.map((x, i) => <li key={i}>{x}</li>)}</ul> : <>{NA}</>;
  const aiLoading = loading && <div className="animate-pulse space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 rounded bg-slate-200" />)}<p className="text-sm text-slate-500">{L.analyzing}</p></div>;
  const aiError = err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err} <button className="underline" onClick={() => run()}>{L.retry}</button></div>;
  const loadingTxt = <p className="text-sm text-slate-400">{L.loading}</p>;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside className={`absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl transition-transform duration-300 ease-out
        md:left-auto md:top-0 md:h-full md:max-h-none md:w-[520px] md:rounded-none md:rounded-l-2xl
        ${open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}`}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 md:hidden" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">{tl.name}</h2>
            <a href={tl.url} target="_blank" rel="nofollow noopener noreferrer" className="text-sm text-indigo-600 break-all">{tl.url}</a>
          </div>
          <button onClick={onClose} aria-label={L.close} className="rounded-full px-3 py-1 text-xl text-slate-500 hover:bg-slate-100">×</button>
        </div>
        <div className="mt-3">{c?.enabled && <VoteButtons toolId={tl.id} stats={c.stats} myVote={c.myVote} locale={locale} />}</div>

        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-500">{L.dbData}</summary>
          <p className="mt-2">{toolDesc(locale, tl) || NA}</p>
          <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1">
            <dt className="text-slate-500">{L.category}</dt><dd>{catName(locale, tl.category)}{tl.subcategory ? ` / ${trSub(locale, tl.subcategory)}` : ""}</dd>
            <dt className="text-slate-500">{L.pricing}</dt><dd>{pricingName(locale, tl.pricing_model) ?? NA}</dd>
            <dt className="text-slate-500">{L.freeTier}</dt><dd>{trFree(locale, tl.free_tier) || NA}</dd>
            <dt className="text-slate-500">{L.wrapperS}</dt><dd>{L.wrapperFull[tl.is_wrapper ?? "unknown"] ?? NA}</dd>
            <dt className="text-slate-500">{L.models}</dt><dd>{trModels(locale, tl.underlying_models) || NA}</dd>
          </dl>
        </details>

        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{L.aiDisclaimer}</p>
        {d?.notice && <div className="mt-2 rounded bg-sky-50 p-2 text-xs text-sky-800">{d.notice}</div>}

        <div role="tablist" className="sticky top-0 z-10 -mx-5 mt-3 flex gap-1 overflow-x-auto border-b bg-white px-5">
          {TABS.map((x) => (
            <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm ${tab === x.k ? "border-indigo-600 font-semibold text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{x.label}</button>
          ))}
        </div>

        <div className="pt-4">
          {tab === "heat" && (c ? <HeatCard heat={c.heat} enabled={c.enabled} locale={locale} /> : loadingTxt)}
          {tab === "reviews" && (c ? <ReviewsSection toolId={tl.id} c={c} sort={community.sort} setSort={community.setSort} reload={community.reload} locale={locale} /> : loadingTxt)}
          {tab === "alts" && (c ? <AlternativesTable selfId={tl.id} alts={c.alternatives} note={r?.alternatives_note} locale={locale} /> : loadingTxt)}
          {tab === "official" && (aiLoading || aiError || (r && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 font-semibold ${r.useful ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.useful ? L.worth : L.notRec}</span>
                <span className="text-2xl font-bold">{Number.isFinite(r.score) ? r.score : "?"}<span className="text-sm text-slate-500"> / 10</span></span>
              </div>
              <p>{r.verdict || NA}</p>
              {r.data_quality && <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{L.dataQuality}{r.data_quality}</p>}
              <Item L={L} k={L.price} c={fc("price")} e={ev("price")}>{r.price_summary || NA}</Item>
              <Item L={L} k={L.plans} c={fc("plans")} e={ev("plans")}>{r.plans?.length ? <ul className="list-disc pl-5">{r.plans.map((p, i) => <li key={i}><b>{p.name}</b>{locale === "en" ? ": " : "："}{p.price || NA}{p.notes ? (locale === "en" ? ` (${p.notes})` : `（${p.notes}）`) : ""}</li>)}</ul> : NA}</Item>
              <Item L={L} k={L.wrapper} c={fc("is_wrapper")} e={ev("is_wrapper")}>{L.wrapperFull[r.is_wrapper] ?? NA}</Item>
              <Item L={L} k={L.models} c={fc("underlying_models")} e={ev("underlying_models")}>{r.underlying_models?.length ? r.underlying_models.join(L.listSep) : NA}</Item>
              <Item L={L} k={L.summary} c={fc("summary")} e={ev("summary")}><List a={r.summary} /></Item>
              <div className="grid gap-3 sm:grid-cols-2">
                <Item L={L} k={L.pros}><List a={r.pros} /></Item><Item L={L} k={L.cons}><List a={r.cons} /></Item>
              </div>
              <Item L={L} k={L.sources}>{r.sources?.length ? <ul className="list-disc pl-5">{r.sources.map((s, i) => <li key={i} className="break-all">{/^https?:\/\//.test(s) ? <a className="text-indigo-600" href={s} target="_blank" rel="nofollow noopener noreferrer">{s}</a> : s}</li>)}</ul> : NA}</Item>
            </div>
          )))}
        </div>

        {r && (
          <div className="mt-5 border-t pt-3">
            <p className="text-xs text-slate-400">{L.diagTime}{new Date(d!.created_at).toLocaleString(L.dateLocale)}{locale === "en" ? " | " : "｜"}{L.model}{d!.model || NA}{locale === "en" ? " | " : "｜"}{d!.cached ? L.cached : L.fresh}
              {!r.schema_version ? L.oldV1 : r.schema_version < 3 ? L.oldV2 : ""}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="rounded border px-3 py-1 text-xs hover:bg-slate-50" onClick={() => run(true)} disabled={loading}>{L.rediagnose}</button>
              <ReportButton toolId={tl.id} diagnosisId={d!.id ?? null} locale={locale} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const CONF_STYLE: Record<Conf, string> = { high: "bg-emerald-100 text-emerald-800", medium: "bg-amber-100 text-amber-800", low: "bg-rose-100 text-rose-800" };

function Item({ L, k, c, e, children }: { L: L; k: string; c?: Conf; e?: { quote: string; source: string; verified?: boolean }; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 font-medium text-slate-500">{k}
        {c && <span className={`rounded px-1.5 py-0.5 text-[10px] ${CONF_STYLE[c] ?? ""}`}>{L.conf[c] ?? c}</span>}
      </div>
      <div>{children}</div>
      {e?.quote && (
        <details className="mt-1 text-xs text-slate-500">
          <summary className="cursor-pointer">{L.evidence}{e.verified === false ? L.evidenceUnverified : ""}</summary>
          <blockquote className="mt-1 border-l-2 pl-2 italic">{L.dateLocale === "zh-TW" ? `「${e.quote}」` : `“${e.quote}”`}</blockquote>
          {/^https?:\/\//.test(e.source) && <a className="break-all text-indigo-600" href={e.source} target="_blank" rel="noopener noreferrer">{e.source}</a>}
        </details>
      )}
    </div>
  );
}

function ReportButton({ toolId, diagnosisId, locale }: { toolId: string; diagnosisId: number | null; locale: Locale }) {
  const L = t(locale);
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle"); const [e, setE] = useState("");
  const send = async () => {
    setState("sending"); setE("");
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolId, diagnosisId, message: msg }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(trError(locale, j.error) || L.reportFailed);
      setState("done");
    } catch (x) { setE((x as Error).message); setState("error"); }
  };
  if (state === "done") return <span className="text-xs text-emerald-700">{L.reportThanks}</span>;
  if (!open) return <button className="rounded border px-3 py-1 text-xs hover:bg-slate-50" onClick={() => setOpen(true)}>{L.report}</button>;
  return (
    <div className="w-full space-y-2">
      <textarea value={msg} onChange={(x) => setMsg(x.target.value.slice(0, 500))} rows={3} placeholder={L.reportPh}
        className="w-full rounded border border-slate-300 p-2 text-sm" />
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400">{msg.length}/500</span>
        <button disabled={!msg.trim() || state === "sending"} onClick={send} className="rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-50">{state === "sending" ? L.submitting : L.submit}</button>
        <button onClick={() => setOpen(false)} className="underline">{L.cancel}</button>
        {e && <span className="text-red-600">{e}</span>}
      </div>
    </div>
  );
}
