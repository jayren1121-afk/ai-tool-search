"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminDailyPick = {
  id: string; pick_date: string; tool_id: string; category: string;
  pros_zh: string; cons_zh: string; pros_en: string; cons_en: string;
  status: "draft" | "approved" | "rejected"; ai_tools?: { name: string } | null;
};
export type DailyPicksData = { items: AdminDailyPick[]; error: string | null };

const STATUS = { draft: "草稿", approved: "已核准", rejected: "已拒絕" } as const;
const FIELDS = [["pros_zh", "優點（中）"], ["cons_zh", "缺點（中）"], ["pros_en", "Pros (EN)"], ["cons_en", "Cons (EN)"]] as const;

function Card({ p, onMsg }: { p: AdminDailyPick; onMsg: (m: string) => void }) {
  const router = useRouter();
  const [f, setF] = useState({ pros_zh: p.pros_zh, cons_zh: p.cons_zh, pros_en: p.pros_en, cons_en: p.cons_en });
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState(p.status);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const act = async (action: "save" | "approve" | "reject") => {
    setBusy(action);
    try {
      const r = await fetch("/api/admin/daily-picks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: p.id, edits: action === "reject" ? undefined : f }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const text = action === "approve" ? "已核准，首頁約幾分鐘內更新" : action === "reject" ? "已拒絕" : "已儲存";
      if (action === "approve") setStatus("approved");
      else if (action === "reject") setStatus("rejected");
      setNote({ ok: true, text: `✓ ${text}` });
      onMsg(`${p.ai_tools?.name ?? p.tool_id}：${text}`);
      router.refresh();
    } catch (e) { const m = `失敗：${(e as Error).message}`; setNote({ ok: false, text: m }); onMsg(m); } finally { setBusy(""); }
  };
  return (
    <li className={`rounded-xl bg-white p-4 shadow-sm ${status === "approved" ? "ring-2 ring-emerald-400" : status === "rejected" ? "opacity-60" : ""}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <a href={`/tools/${encodeURIComponent(p.tool_id)}`} target="_blank" className="font-semibold text-indigo-700 hover:underline">{p.ai_tools?.name ?? p.tool_id}</a>
        <span className="text-xs text-slate-500">{p.category}・<span className={`rounded-full px-2 py-0.5 font-medium ${status === "approved" ? "bg-emerald-100 text-emerald-700" : status === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{STATUS[status]}</span></span>
      </div>
      {FIELDS.map(([k, label]) => (
        <label key={k} className="mb-2 block text-sm">{label}
          <textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
        </label>
      ))}
      <div className="flex gap-2">
        <button disabled={!!busy || status === "approved"} onClick={() => act("approve")} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy === "approve" ? "處理中…" : status === "approved" ? "已通過" : "通過"}</button>
        <button disabled={!!busy} onClick={() => act("save")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">只儲存</button>
        <button disabled={!!busy} onClick={() => act("reject")} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">拒絕</button>
      </div>
      {note && <p className={`mt-2 text-sm font-medium ${note.ok ? "text-emerald-700" : "text-red-700"}`}>{note.text}</p>}
    </li>
  );
}

export default function DailyPicksSection({ data }: { data?: DailyPicksData }) {
  const [msg, setMsg] = useState("");
  if (!data) return null;
  const byDate = new Map<string, AdminDailyPick[]>();
  for (const p of data.items) byDate.set(p.pick_date, [...(byDate.get(p.pick_date) ?? []), p]);
  return (
    <section className="mb-4" aria-label="Daily picks">
      <h2 className="mb-2 text-lg font-semibold">每日推薦審核（Daily picks）</h2>
      {data.error && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{data.error}</p>}
      {msg && <p className="mb-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">{msg}</p>}
      {!data.error && data.items.length === 0 && <p className="rounded-xl bg-white p-4 text-slate-500 shadow-sm">目前沒有每日推薦草稿。</p>}
      {[...byDate.entries()].map(([d, list]) => (
        <div key={d} className="mb-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-600">{d}</h3>
          <ul className="space-y-3">{list.map((p) => <Card key={p.id} p={p} onMsg={setMsg} />)}</ul>
        </div>
      ))}
    </section>
  );
}
