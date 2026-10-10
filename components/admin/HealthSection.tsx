"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type HealthItem = {
  tool_id: string; status: string; consecutive_failures: number; detail: string | null; last_checked_at: string | null; last_http_status: number | null;
  last_final_url: string | null; needs_review: boolean; manual_down: boolean; reviewed_note: string | null; reviewed_at: string | null; snoozed_until: string | null;
  ai_tools: { name: string; url: string } | null;
};
export type HealthStats = { total: number; live: number; down: number; unknown: number; unchecked: number; stale7d: number; snoozed: number };
export type HealthRun = { id: number; started_at: string; finished_at: string | null; status: string; message: string | null; details: { trigger?: string; ms?: number; checked?: number; due?: number } | null };

const tw = (iso: string | null) => (iso ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "—");
const RUN: Record<string, [string, string]> = { ok: ["✅ 完成", "bg-emerald-50 text-emerald-800"], error: ["❌ 失敗", "bg-red-50 text-red-700"], skipped: ["⏭️ 略過", "bg-slate-100 text-slate-700"] };
const ST: Record<string, [string, string]> = { live: ["可連線", "bg-emerald-50 text-emerald-700"], down: ["異常", "bg-red-50 text-red-700"], unknown: ["無法判定", "bg-amber-50 text-amber-800"] };
const host = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };

async function post(body: unknown) {
  const r = await fetch("/api/admin/health", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function Row({ h, onDone }: { h: HealthItem; onDone: (m: string) => void }) {
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const name = h.ai_tools?.name ?? h.tool_id, url = h.ai_tools?.url ?? "";
  const moved = h.last_final_url && host(h.last_final_url) !== host(url) ? h.last_final_url : null;
  const act = async (action: "ok" | "down" | "skip") => {
    let note = "";
    if (action !== "skip") { const n = prompt(action === "ok" ? `確認「${name}」官網正常。備註（可留空）：` : `確認「${name}」官網異常。備註（可留空）：`, ""); if (n === null) return; note = n; }
    setBusy(action); setErr("");
    try { await post({ action, id: h.tool_id, note }); onDone(action === "ok" ? `已確認正常：${name}` : action === "down" ? `已標記為異常：${name}` : `已略過 7 天：${name}`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };
  const [stText, stCls] = ST[h.status] ?? [h.status, "bg-slate-100"];
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{name}</span>
        <span className={`rounded px-2 py-0.5 text-xs ${stCls}`}>{stText}{h.manual_down ? "（已人工確認異常）" : ""}</span>
        {h.needs_review && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">待人工確認</span>}
      </div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm text-indigo-600 underline">{url}</a>}
      <dl className="mt-1 grid grid-cols-[6.5rem_1fr] gap-y-0.5 text-sm">
        <dt className="text-slate-500">原因</dt><dd>{h.detail ?? "—"}{h.last_http_status ? <span className="text-slate-400">（HTTP {h.last_http_status}）</span> : null}</dd>
        <dt className="text-slate-500">連續失敗</dt><dd>{h.consecutive_failures} 次{h.status !== "down" && h.consecutive_failures > 0 ? "（滿 3 次且不同天才標為異常）" : ""}</dd>
        <dt className="text-slate-500">最後檢查</dt><dd>{tw(h.last_checked_at)}</dd>
        {moved && <><dt className="text-slate-500">轉址目的地</dt><dd><a href={moved} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-indigo-600 underline">{moved}</a></dd></>}
        {h.reviewed_at && <><dt className="text-slate-500">人工備註</dt><dd>{h.reviewed_note ?? "—"}（{tw(h.reviewed_at)}）</dd></>}
      </dl>
      {err && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => act("ok")} disabled={!!busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy === "ok" ? "處理中…" : "確認正常"}</button>
        {!h.manual_down && <button onClick={() => act("down")} disabled={!!busy} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{busy === "down" ? "處理中…" : "確認異常"}</button>}
        <button onClick={() => act("skip")} disabled={!!busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 disabled:opacity-50">{busy === "skip" ? "處理中…" : "略過 7 天"}</button>
      </div>
    </li>
  );
}

export default function HealthSection({ items, stats, runs, error }: { items: HealthItem[]; stats: HealthStats | null; runs: HealthRun[]; error: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState(""); const [running, setRunning] = useState(false);
  const last = runs[0];
  const runNow = async () => {
    setRunning(true); setMsg("檢查中，約需 20–50 秒…");
    try { const j = await post({ action: "run" }); setMsg(`執行${j.status === "error" ? "失敗" : "完成"}：${j.message}`); router.refresh(); }
    catch (e) { setMsg(`執行失敗：${(e as Error).message}`); } finally { setRunning(false); }
  };
  const done = (m: string) => { setMsg(m); router.refresh(); };
  return (
    <section id="health" className="mb-4 rounded-xl bg-white p-4 text-sm shadow-sm">
      <h2 className="mb-2 text-base font-semibold">官網檢查</h2>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p> : (
        <>
          {stats && (
            <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
              <span>可連線 <b className="text-emerald-700">{stats.live}</b></span>
              <span>異常 <b className="text-red-700">{stats.down}</b></span>
              <span>無法判定 <b className="text-amber-700">{stats.unknown}</b></span>
              <span>尚未檢查 <b>{stats.unchecked}</b></span>
              <span className="text-slate-500">共 {stats.total} 個已上架工具；超過 7 天未檢查 {stats.stale7d} 個</span>
            </p>
          )}
          {last ? (
            <>
              <p className={`rounded-lg px-3 py-2 ${RUN[last.status]?.[1] ?? "bg-slate-100"}`}>{RUN[last.status]?.[0] ?? last.status}{last.message ? `：${last.message}` : ""}</p>
              <p className="mt-1 text-slate-500">最近一次執行：{tw(last.started_at)}（台灣時間，{last.details?.trigger === "admin" ? "手動" : "自動排程"}）</p>
              {runs.length > 1 && <details className="mt-1 text-slate-500"><summary className="cursor-pointer">更早的紀錄</summary>
                <ul className="mt-1 list-disc pl-5">{runs.slice(1).map((r) => <li key={r.id}>{tw(r.started_at)}：{RUN[r.status]?.[0] ?? r.status}{r.message ? `（${r.message}）` : ""}</li>)}</ul></details>}
            </>
          ) : <p className="text-slate-500">尚無執行紀錄（排程每天台灣時間中午前後執行一次，每次檢查約 90–110 個最久沒檢查的工具）。</p>}
          <button onClick={runNow} disabled={running} className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50 sm:w-auto">{running ? "檢查中…" : "立即執行一次官網檢查"}</button>
          <p className="mt-1 text-xs text-slate-400">每按一次最多檢查一批（約 90–110 個，最久沒檢查的優先）；20 小時內檢查過的不會重複檢查。</p>
          {msg && <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-indigo-800">{msg}</p>}

          <h3 className="mt-4 font-semibold">需要人工檢查（{items.length}{stats?.snoozed ? `；另有 ${stats.snoozed} 個已略過` : ""}）</h3>
          {items.length === 0 ? <p className="mt-1 text-slate-500">目前沒有需要人工檢查的工具。</p> : <ul className="mt-2 space-y-3">{items.map((h) => <Row key={h.tool_id} h={h} onDone={done} />)}</ul>}
          <p className="mt-3 text-xs text-slate-400">
            「確認正常」：標為可連線，之後同樣的狀況不會再放回清單（出現新的狀況或新的失敗才會再出現）。「確認異常」：鎖定顯示為異常，直到自動檢查看到網站恢復。「略過 7 天」：只是暫時從清單隱藏，不改變前台顯示。
            前台只顯示「官網可連線」「官網異常」；無法判定的不顯示標籤。
          </p>
        </>
      )}
    </section>
  );
}
