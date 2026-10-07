"use client";
import { useEffect, useState } from "react";
import { CATEGORIES, PRICING, type Diagnosis, type Tool } from "@/lib/types";

const W: Record<string, string> = { true: "是（套殼第三方模型）", false: "否（自有模型）", partial: "部分", unknown: "未確認" };

export default function DiagnosePanel({ tool, onClose }: { tool: Tool | null; onClose: () => void }) {
  const [shown, setShown] = useState<Tool | null>(null);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<{ result: Diagnosis; model: string; created_at: string; cached: boolean } | null>(null);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");

  useEffect(() => {
    if (tool) { setShown(tool); requestAnimationFrame(() => setOpen(true)); }
    else { setOpen(false); const t = setTimeout(() => setShown(null), 300); return () => clearTimeout(t); }
  }, [tool]);

  const run = async (force = false) => {
    if (!tool) return;
    setLoading(true); setErr(""); if (force) setD(null);
    try {
      const r = await fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolId: tool.id, force }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "診斷失敗"); setD(j);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { setD(null); if (tool) run(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);

  if (!shown) return null;
  const t = shown; const r = d?.result;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside className={`absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl transition-transform duration-300 ease-out
        md:left-auto md:top-0 md:h-full md:max-h-none md:w-[480px] md:rounded-none md:rounded-l-2xl
        ${open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}`}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 md:hidden" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">{t.name}</h2>
            <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 break-all">{t.url}</a>
          </div>
          <button onClick={onClose} aria-label="關閉" className="rounded-full px-3 py-1 text-xl text-slate-500 hover:bg-slate-100">×</button>
        </div>

        <Section title="資料庫資料">
          <p className="text-sm">{t.description_zh}</p>
          <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500">分類</dt><dd>{CATEGORIES[t.category] ?? t.category}{t.subcategory ? ` / ${t.subcategory}` : ""}</dd>
            <dt className="text-slate-500">計價</dt><dd>{t.pricing_model ? PRICING[t.pricing_model] : "未確認"}</dd>
            <dt className="text-slate-500">付費方案</dt><dd>{t.paid_plans?.length ? t.paid_plans.map((p) => `${p.name} $${p.price_usd_month ?? "?"}/月`).join("、") : "未確認"}</dd>
            <dt className="text-slate-500">免費方案</dt><dd>{t.free_tier ?? "未確認"}</dd>
            <dt className="text-slate-500">套殼</dt><dd>{W[t.is_wrapper ?? "unknown"]}</dd>
            <dt className="text-slate-500">底層模型</dt><dd>{t.underlying_models ?? "未確認"}</dd>
            <dt className="text-slate-500">可信度</dt><dd>{t.confidence}（核實：{t.last_verified ?? "無"}）</dd>
          </dl>
        </Section>

        <Section title="Gemini 診斷">
          {loading && <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-4 rounded bg-slate-200" />)}<p className="text-sm text-slate-500">正在抓取官網並分析…</p></div>}
          {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err} <button className="underline" onClick={() => run()}>重試</button></div>}
          {r && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 font-semibold ${r.useful ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.useful ? "值得使用" : "不太推薦"}</span>
                <span className="text-2xl font-bold">{r.score}<span className="text-sm text-slate-500"> / 10</span></span>
              </div>
              <p>{r.verdict}</p>
              <Item k="價位">{r.price_summary}</Item>
              <Item k="訂閱方案">{r.plans?.length ? <ul className="list-disc pl-5">{r.plans.map((p, i) => <li key={i}><b>{p.name}</b>：{p.price}{p.notes ? `（${p.notes}）` : ""}</li>)}</ul> : "未確認"}</Item>
              <Item k="是否套殼">{W[r.is_wrapper] ?? r.is_wrapper}{r.underlying_models?.length ? `｜底層模型：${r.underlying_models.join("、")}` : ""}</Item>
              <Item k="重點摘要"><List a={r.summary} /></Item>
              <div className="grid gap-3 sm:grid-cols-2">
                <Item k="優點"><List a={r.pros} /></Item><Item k="缺點"><List a={r.cons} /></Item>
              </div>
              <Item k="資料來源"><ul className="list-disc pl-5">{r.sources?.map((s, i) => <li key={i} className="break-all">{/^https?:/.test(s) ? <a className="text-indigo-600" href={s} target="_blank" rel="noopener noreferrer">{s}</a> : s}</li>)}</ul></Item>
              <p className="text-xs text-slate-400">模型 {d!.model}｜{d!.cached ? "快取" : "新產生"}於 {new Date(d!.created_at).toLocaleString("zh-TW")}
                <button className="ml-2 underline" onClick={() => run(true)}>重新診斷</button></p>
            </div>
          )}
        </Section>
      </aside>
    </div>
  );
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="mt-5"><h3 className="mb-2 border-b pb-1 font-semibold text-slate-700">{title}</h3>{children}</section>;
const Item = ({ k, children }: { k: string; children: React.ReactNode }) => <div><div className="font-medium text-slate-500">{k}</div><div>{children}</div></div>;
const List = ({ a }: { a?: string[] }) => <ul className="list-disc pl-5">{(a || []).map((x, i) => <li key={i}>{x}</li>)}</ul>;
