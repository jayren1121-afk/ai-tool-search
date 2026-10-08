"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES, PRICING, type Conf, type DiagnoseResponse, type EvidenceField, type Tool } from "@/lib/types";

const W: Record<string, string> = { true: "是（套殼第三方模型）", false: "否（自有模型）", partial: "部分使用第三方模型", unknown: "無法確認" };
const NA = "無法確認";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TS_FLAG = "ts_ok";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: Record<string, unknown>) => string;
      remove: (id: string) => void; reset: (id?: string) => void;
    };
  }
}

function loadTurnstile(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const ex = document.getElementById("cf-turnstile-js");
    if (ex) { ex.addEventListener("load", () => resolve()); return; }
    const s = document.createElement("script");
    s.id = "cf-turnstile-js"; s.async = true; s.defer = true;
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload = () => resolve(); s.onerror = () => reject(new Error("無法載入人機驗證"));
    document.head.appendChild(s);
  });
}

export default function DiagnosePanel({ tool, onClose }: { tool: Tool | null; onClose: () => void }) {
  const [shown, setShown] = useState<Tool | null>(null);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [needTs, setNeedTs] = useState(false);
  const tsBox = useRef<HTMLDivElement>(null); const tsId = useRef<string | null>(null);
  const pending = useRef<{ force: boolean } | null>(null);

  useEffect(() => {
    if (tool) { setShown(tool); requestAnimationFrame(() => setOpen(true)); }
    else { setOpen(false); const t = setTimeout(() => setShown(null), 300); return () => clearTimeout(t); }
  }, [tool]);

  const call = useCallback(async (force: boolean, token?: string) => {
    if (!tool) return;
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolId: tool.id, force, turnstileToken: token }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403 && j.turnstile && SITE_KEY) {
        sessionStorage.removeItem(TS_FLAG); pending.current = { force }; setNeedTs(true); return;
      }
      if (!r.ok) throw new Error(j.error || "診斷失敗");
      if (SITE_KEY) sessionStorage.setItem(TS_FLAG, "1");
      setD(j as DiagnoseResponse);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [tool]);

  const run = useCallback((force = false) => {
    if (SITE_KEY && !sessionStorage.getItem(TS_FLAG)) { pending.current = { force }; setNeedTs(true); return; }
    call(force);
  }, [call]);

  // 顯示 Turnstile 小工具（managed 模式，多數情況自動通過）
  useEffect(() => {
    if (!needTs || !SITE_KEY) return;
    let cancelled = false;
    loadTurnstile().then(() => {
      if (cancelled || !tsBox.current || !window.turnstile) return;
      tsId.current = window.turnstile.render(tsBox.current, {
        sitekey: SITE_KEY, appearance: "interaction-only", language: "zh-tw",
        callback: (token: string) => { setNeedTs(false); call(pending.current?.force ?? false, token); },
        "error-callback": () => setErr("人機驗證失敗，請重新整理頁面再試"),
      });
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; if (tsId.current && window.turnstile) { try { window.turnstile.remove(tsId.current); } catch {} tsId.current = null; } };
  }, [needTs, call]);

  useEffect(() => { setD(null); setErr(""); setNeedTs(false); if (tool) run(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);

  if (!shown) return null;
  const t = shown; const r = d?.result;
  const fc = (f: EvidenceField) => r?.field_confidence?.[f];
  const ev = (f: EvidenceField) => r?.evidence?.[f];
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
          <p className="text-sm">{t.description_zh || NA}</p>
          <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500">分類</dt><dd>{CATEGORIES[t.category] ?? t.category}{t.subcategory ? ` / ${t.subcategory}` : ""}</dd>
            <dt className="text-slate-500">計價</dt><dd>{t.pricing_model ? PRICING[t.pricing_model] ?? t.pricing_model : NA}</dd>
            <dt className="text-slate-500">付費方案</dt><dd>{t.paid_plans?.length ? t.paid_plans.map((p) => `${p.name} $${p.price_usd_month ?? "?"}/月`).join("、") : NA}</dd>
            <dt className="text-slate-500">免費方案</dt><dd>{t.free_tier || NA}</dd>
            <dt className="text-slate-500">套殼</dt><dd>{W[t.is_wrapper ?? "unknown"] ?? NA}</dd>
            <dt className="text-slate-500">底層模型</dt><dd>{t.underlying_models || NA}</dd>
            <dt className="text-slate-500">可信度</dt><dd>{t.confidence || NA}（核實：{t.last_verified ?? "無"}）</dd>
          </dl>
        </Section>

        <Section title="AI 診斷">
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠️ AI 自動分析，僅供參考。價格與方案請以官網為準。</p>
          {needTs && <div className="mb-3 text-sm text-slate-500">正在進行人機驗證…<div ref={tsBox} className="mt-2" /></div>}
          {loading && <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-4 rounded bg-slate-200" />)}<p className="text-sm text-slate-500">正在抓取官網並分析…</p></div>}
          {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err} <button className="underline" onClick={() => run()}>重試</button></div>}
          {d?.notice && <div className="mb-3 rounded bg-sky-50 p-2 text-xs text-sky-800">{d.notice}</div>}
          {r && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 font-semibold ${r.useful ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.useful ? "值得使用" : "不太推薦"}</span>
                <span className="text-2xl font-bold">{Number.isFinite(r.score) ? r.score : "?"}<span className="text-sm text-slate-500"> / 10</span></span>
              </div>
              <p>{r.verdict || NA}</p>
              {r.data_quality && <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">資料品質：{r.data_quality}</p>}
              <Item k="價位" c={fc("price")} e={ev("price")}>{r.price_summary || NA}</Item>
              <Item k="訂閱方案" c={fc("plans")} e={ev("plans")}>{r.plans?.length ? <ul className="list-disc pl-5">{r.plans.map((p, i) => <li key={i}><b>{p.name}</b>：{p.price || NA}{p.notes ? `（${p.notes}）` : ""}</li>)}</ul> : NA}</Item>
              <Item k="是否套殼" c={fc("is_wrapper")} e={ev("is_wrapper")}>{W[r.is_wrapper] ?? NA}</Item>
              <Item k="底層模型" c={fc("underlying_models")} e={ev("underlying_models")}>{r.underlying_models?.length ? r.underlying_models.join("、") : NA}</Item>
              <Item k="重點摘要" c={fc("summary")} e={ev("summary")}><List a={r.summary} /></Item>
              <div className="grid gap-3 sm:grid-cols-2">
                <Item k="優點"><List a={r.pros} /></Item><Item k="缺點"><List a={r.cons} /></Item>
              </div>
              <Item k="資料來源">{r.sources?.length ? <ul className="list-disc pl-5">{r.sources.map((s, i) => <li key={i} className="break-all">{/^https?:\/\//.test(s) ? <a className="text-indigo-600" href={s} target="_blank" rel="noopener noreferrer">{s}</a> : s}</li>)}</ul> : NA}</Item>
              <p className="text-xs text-slate-400">診斷時間：{new Date(d!.created_at).toLocaleString("zh-TW")}｜模型：{d!.model || NA}｜{d!.cached ? "快取結果" : "新產生"}
                {!r.schema_version && "｜舊版診斷（無逐欄信心與引用）"}</p>
              <div className="flex flex-wrap gap-2">
                <button className="rounded border px-3 py-1 text-xs hover:bg-slate-50" onClick={() => run(true)} disabled={loading}>重新診斷</button>
                <ReportButton toolId={t.id} diagnosisId={d!.id ?? null} />
              </div>
            </div>
          )}
        </Section>
      </aside>
    </div>
  );
}

const CONF_STYLE: Record<Conf, string> = { high: "bg-emerald-100 text-emerald-800", medium: "bg-amber-100 text-amber-800", low: "bg-rose-100 text-rose-800" };
const CONF_LABEL: Record<Conf, string> = { high: "高可信", medium: "中可信", low: "低可信" };

function Item({ k, c, e, children }: { k: string; c?: Conf; e?: { quote: string; source: string; verified?: boolean }; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 font-medium text-slate-500">{k}
        {c && <span className={`rounded px-1.5 py-0.5 text-[10px] ${CONF_STYLE[c] ?? ""}`}>{CONF_LABEL[c] ?? c}</span>}
      </div>
      <div>{children}</div>
      {e?.quote && (
        <details className="mt-1 text-xs text-slate-500">
          <summary className="cursor-pointer">依據{e.verified === false ? "（未能在網頁中核對）" : ""}</summary>
          <blockquote className="mt-1 border-l-2 pl-2 italic">「{e.quote}」</blockquote>
          {/^https?:\/\//.test(e.source) && <a className="break-all text-indigo-600" href={e.source} target="_blank" rel="noopener noreferrer">{e.source}</a>}
        </details>
      )}
    </div>
  );
}

function ReportButton({ toolId, diagnosisId }: { toolId: string; diagnosisId: number | null }) {
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle"); const [e, setE] = useState("");
  const send = async () => {
    setState("sending"); setE("");
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolId, diagnosisId, message: msg }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "回報失敗");
      setState("done");
    } catch (x) { setE((x as Error).message); setState("error"); }
  };
  if (state === "done") return <span className="text-xs text-emerald-700">已收到回報，謝謝！</span>;
  if (!open) return <button className="rounded border px-3 py-1 text-xs hover:bg-slate-50" onClick={() => setOpen(true)}>回報錯誤</button>;
  return (
    <div className="w-full space-y-2">
      <textarea value={msg} onChange={(x) => setMsg(x.target.value.slice(0, 500))} rows={3} placeholder="哪裡有誤？例如：價格已調整為…（最多 500 字）"
        className="w-full rounded border border-slate-300 p-2 text-sm" />
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400">{msg.length}/500</span>
        <button disabled={!msg.trim() || state === "sending"} onClick={send} className="rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-50">{state === "sending" ? "送出中…" : "送出"}</button>
        <button onClick={() => setOpen(false)} className="underline">取消</button>
        {e && <span className="text-red-600">{e}</span>}
      </div>
    </div>
  );
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="mt-5"><h3 className="mb-2 border-b pb-1 font-semibold text-slate-700">{title}</h3>{children}</section>;
const List = ({ a }: { a?: string[] }) => a?.length ? <ul className="list-disc pl-5">{a.map((x, i) => <li key={i}>{x}</li>)}</ul> : <>{NA}</>;
