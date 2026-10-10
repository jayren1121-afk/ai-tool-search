"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { releaseText } from "@/lib/i18n";
import HealthSection, { type HealthItem, type HealthRun, type HealthStats } from "./HealthSection";
import { CATEGORIES } from "@/lib/types";

export type PendingTool = {
  id: string; name: string; url: string; category: string; subcategory: string | null; description_zh: string | null; description_en: string | null;
  pricing_model: string | null; tags: string[] | null; released_at: string | null; released_source: string | null;
  discovery_source: string | null; discovery_url: string | null; added_at: string | null;
};
export type JobRun = { id: number; started_at: string; finished_at: string | null; status: string; message: string | null; details: { trigger?: string; sources?: Record<string, string>; tried?: { url: string; result: string }[] } | null };

const SRC: Record<string, string> = { hn: "Hacker News", github: "GitHub", producthunt: "Product Hunt" };
const STATUS: Record<string, [string, string]> = {
  added: ["✅ 成功新增 1 筆待審核", "bg-emerald-50 text-emerald-800"], none: ["ℹ️ 沒有符合條件的新候選", "bg-slate-100 text-slate-700"],
  skipped: ["⏭️ 今天已新增過，略過", "bg-slate-100 text-slate-700"], error: ["❌ 失敗", "bg-red-50 text-red-700"],
};
const tw = (iso: string | null) => (iso ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "—");

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function Card({ t, onDone }: { t: PendingTool; onDone: (msg: string) => void }) {
  const [f, setF] = useState({ name: t.name, category: t.category, description_zh: t.description_zh ?? "", description_en: t.description_en ?? "", released_at: t.released_at ?? "" });
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const act = async (action: "publish" | "reject") => {
    if (action === "reject" && !confirm(`確定刪除「${t.name}」？之後不會再被自動找回來。`)) return;
    setBusy(action); setErr("");
    try { await post("/api/admin/tools", { action, id: t.id, edits: f }); onDone(action === "publish" ? `已上架：${f.name}` : `已刪除：${t.name}`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };
  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-indigo-400";
  return (
    <li className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{t.name}</h2>
        <a href={t.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm text-indigo-600 underline">{t.url}</a>
      </div>
      <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-1 text-sm">
        <dt className="text-slate-500">推出日期</dt><dd>{releaseText("zh", t.released_at, t.released_source) ?? "未知"}</dd>
        <dt className="text-slate-500">發現來源</dt>
        <dd>{t.discovery_url ? <a href={t.discovery_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-indigo-600 underline">{SRC[t.discovery_source ?? ""] ?? t.discovery_source ?? "連結"}</a> : SRC[t.discovery_source ?? ""] ?? "—"}</dd>
        <dt className="text-slate-500">發現時間</dt><dd>{tw(t.added_at)}</dd>
        <dt className="text-slate-500">計價</dt><dd>{t.pricing_model ?? "未寫明"}</dd>
        <dt className="text-slate-500">標籤</dt><dd>{(t.tags ?? []).join("、") || "—"}</dd>
        <dt className="text-slate-500">id</dt><dd className="break-all font-mono text-xs">{t.id}</dd>
      </dl>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-600">名稱<input value={f.name} onChange={set("name")} maxLength={80} className={input} /></label>
        <label className="text-sm text-slate-600">分類
          <select value={f.category} onChange={set("category")} className={input}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}（{k}）</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600 sm:col-span-2">繁中描述<textarea value={f.description_zh} onChange={set("description_zh")} rows={3} maxLength={300} className={input} /></label>
        <label className="text-sm text-slate-600 sm:col-span-2">英文描述<textarea value={f.description_en} onChange={set("description_en")} rows={3} maxLength={500} className={input} /></label>
        <label className="text-sm text-slate-600">推出日期（YYYY-MM-DD，可留空；修改後來源會標為「人工確認」）
          <input type="date" value={f.released_at} onChange={set("released_at")} className={input} />
        </label>
      </div>
      {err && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => act("publish")} disabled={!!busy} className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white disabled:opacity-50 sm:flex-none">{busy === "publish" ? "上架中…" : "上架"}</button>
        <button onClick={() => act("reject")} disabled={!!busy} className="flex-1 rounded-lg border border-red-300 px-4 py-3 font-medium text-red-700 disabled:opacity-50 sm:flex-none">{busy === "reject" ? "刪除中…" : "刪除"}</button>
      </div>
    </li>
  );
}

export type HealthData = { items: HealthItem[]; stats: HealthStats | null; runs: HealthRun[]; error: string | null };

export default function AdminPanel({ pending, runs, setupError, health }: { pending: PendingTool[]; runs: JobRun[]; setupError: string | null; health?: HealthData }) {
  const router = useRouter();
  const [msg, setMsg] = useState(""); const [running, setRunning] = useState(false);
  const last = runs[0];
  const logout = async () => { await post("/api/admin/logout", {}).catch(() => {}); router.refresh(); };
  const runNow = async () => {
    setRunning(true); setMsg("執行中，約需 10–60 秒…");
    try { const j = await post("/api/admin/run", {}); setMsg(`執行完成：${j.message}`); router.refresh(); }
    catch (e) { setMsg(`執行失敗：${(e as Error).message}`); } finally { setRunning(false); }
  };
  const done = (m: string) => { setMsg(m); router.refresh(); };
  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">管理後台・待審核工具</h1>
        <button onClick={logout} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">登出</button>
      </div>
      {setupError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{setupError}</p>}

      <section className="mb-4 rounded-xl bg-white p-4 text-sm shadow-sm">
        <h2 className="mb-2 font-semibold">今日排程狀態</h2>
        {last ? (
          <>
            <p className={`rounded-lg px-3 py-2 ${STATUS[last.status]?.[1] ?? "bg-slate-100"}`}>{STATUS[last.status]?.[0] ?? last.status}{last.message ? `：${last.message}` : ""}</p>
            <p className="mt-2 text-slate-500">最近一次執行：{tw(last.started_at)}（台灣時間，{last.details?.trigger === "admin" ? "手動" : "自動排程"}）</p>
            {last.details?.sources && <p className="mt-1 text-slate-500">候選來源：{Object.entries(last.details.sources).map(([k, v]) => `${SRC[k] ?? k} ${v}`).join("；")}</p>}
            {!!last.details?.tried?.length && <details className="mt-1 text-slate-500"><summary className="cursor-pointer">嘗試過的候選（{last.details.tried.length}）</summary>
              <ul className="mt-1 list-disc pl-5">{last.details.tried.map((x, i) => <li key={i} className="break-all">{x.url}：{x.result}</li>)}</ul></details>}
            {runs.length > 1 && <details className="mt-1 text-slate-500"><summary className="cursor-pointer">更早的紀錄</summary>
              <ul className="mt-1 list-disc pl-5">{runs.slice(1).map((r) => <li key={r.id}>{tw(r.started_at)}：{STATUS[r.status]?.[0] ?? r.status}{r.message ? `（${r.message}）` : ""}</li>)}</ul></details>}
          </>
        ) : <p className="text-slate-500">尚無執行紀錄（排程每天台灣時間上午 10:17 左右執行一次）。</p>}
        <button onClick={runNow} disabled={running} className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50 sm:w-auto">{running ? "執行中…" : "立即執行一次自動發現"}</button>
        <p className="mt-1 text-xs text-slate-400">每天最多自動新增 1 筆；今天已新增過時會顯示「略過」。</p>
      </section>

      {health && <HealthSection items={health.items} stats={health.stats} runs={health.runs} error={health.error} />}

      {msg && <p className="mb-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">{msg}</p>}
      {pending.length === 0 ? <p className="rounded-xl bg-white p-4 text-slate-500 shadow-sm">目前沒有待審核的工具。</p> : (
        <ul className="space-y-4">{pending.map((t) => <Card key={t.id} t={t} onDone={done} />)}</ul>
      )}
      <p className="mt-6 text-xs text-slate-400">「上架」後工具頁、英文頁與 sitemap 會在幾分鐘內更新；「刪除」只是標記為不採用，之後不會再被自動發現。</p>
    </main>
  );
}
