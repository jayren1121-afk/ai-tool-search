"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MOVED_MAX, validateMoved } from "@/lib/health-moved";

export type HealthItem = {
  tool_id: string; status: string; consecutive_failures: number; detail: string | null; last_checked_at: string | null; last_http_status: number | null;
  last_final_url: string | null; needs_review: boolean; manual_down: boolean; reviewed_note: string | null; reviewed_at: string | null; snoozed_until: string | null;
  ai_tools: { name: string; url: string } | null;
  moved_type?: string | null; moved_to?: string | null; // 公開的「已轉址／已改名」提示（需 migration 009）
};
export type HealthStats = { total: number; live: number; down: number; unknown: number; unchecked: number; stale7d: number; snoozed: number };
export type HealthRun = { id: number; started_at: string; finished_at: string | null; status: string; message: string | null; details: { trigger?: string; ms?: number; checked?: number; due?: number } | null };

const tw = (iso: string | null) => (iso ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "—");
const RUN: Record<string, [string, string]> = { ok: ["✅ 完成", "bg-emerald-50 text-emerald-800"], error: ["❌ 失敗", "bg-red-50 text-red-700"], skipped: ["⏭️ 略過", "bg-slate-100 text-slate-700"] };
const ST: Record<string, [string, string]> = { live: ["可連線", "bg-emerald-50 text-emerald-700"], down: ["異常", "bg-red-50 text-red-700"], unknown: ["無法判定", "bg-amber-50 text-amber-800"] };
const host = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };

async function post(body: unknown, timeoutMs = 30_000) {
  // 加上逾時：就算連線卡住，也會丟出錯誤讓按鈕恢復，不會永遠停在「處理中…」
  const r = await fetch("/api/admin/health", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

const errText = (e: unknown) => ((e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError" ? "連線逾時，請稍後按「重新整理」確認是否已儲存" : (e as Error)?.message || "發生錯誤");
type MovedState = { type: string; to: string };
const movedInit = (h: HealthItem): MovedState => ({ type: h.moved_type === "moved" || h.moved_type === "renamed" ? h.moved_type : "none", to: h.moved_to ?? "" });
const MOVED_LABEL: Record<string, string> = { moved: "已轉址", renamed: "已改名" };

/** 選填：公開頁面額外顯示「官網已搬到…／此工具已改名為…」。內容只以文字顯示。選「無」並儲存即可清除。 */
function MovedFields({ value, onChange, disabled }: { value: MovedState; onChange: (v: MovedState) => void; disabled?: boolean }) {
  return (
    <fieldset className="mt-2 rounded-lg bg-slate-50 p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">（選填）公開頁面的額外提示</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">類型
          <select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })} className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="none">無（不顯示）</option>
            <option value="moved">已轉址（官網搬家）</option>
            <option value="renamed">已改名</option>
          </select>
        </label>
        {value.type !== "none" && (
          <input value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} maxLength={MOVED_MAX} inputMode={value.type === "moved" ? "url" : "text"}
            placeholder={value.type === "moved" ? "新網址，例如 https://example.com" : "新名稱"} aria-label={value.type === "moved" ? "新網址" : "新名稱"}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:min-w-[16rem]" />
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {value.type === "none" ? "選「已轉址」或「已改名」後，公開網站會在官網狀態旁多顯示一行；選「無」再儲存就是清除。" : value.type === "moved" ? `公開網站會顯示「官網已搬到 新網址」。網址必須以 http:// 或 https:// 開頭，最多 ${MOVED_MAX} 字。` : `公開網站會顯示「此工具已改名為 新名稱」。最多 ${MOVED_MAX} 字。`}
      </p>
    </fieldset>
  );
}

/** 已經設定了轉址／改名、但不在「需要人工檢查」清單的工具：讓你事後修改或清除 */
function MovedRow({ h, onDone }: { h: HealthItem; onDone: (m: string) => void }) {
  const [mv, setMv] = useState<MovedState>(movedInit(h)); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { setMv(movedInit(h)); }, [h.moved_type, h.moved_to]); // eslint-disable-line react-hooks/exhaustive-deps -- 伺服器資料更新後同步輸入框
  const name = h.ai_tools?.name ?? h.tool_id;
  const save = async () => {
    const v = validateMoved(mv.type, mv.to); if (!v.ok) { setErr(v.error); return; }
    setBusy(true); setErr("");
    let ok = false;
    try { await post({ action: "moved", id: h.tool_id, movedType: mv.type, movedTo: mv.to }); ok = true; }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); } // 不論成功失敗，一定先恢復按鈕
    if (ok) try { onDone(v.type ? `已儲存「${name}」的${MOVED_LABEL[v.type]}提示` : `已清除「${name}」的轉址／改名提示`); } catch { /* 重新整理失敗不影響已儲存的結果 */ }
  };
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{name}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{MOVED_LABEL[h.moved_type ?? ""] ?? h.moved_type}：{h.moved_to}</span>
      </div>
      <MovedFields value={mv} onChange={setMv} disabled={busy} />
      {err && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <button onClick={save} disabled={busy} className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">{busy ? "儲存中…" : "儲存（選「無」即清除）"}</button>
    </li>
  );
}

function Row({ h, onDone, movedReady }: { h: HealthItem; onDone: (m: string) => void; movedReady: boolean }) {
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [mv, setMv] = useState<MovedState>(movedInit(h));
  useEffect(() => { setMv(movedInit(h)); }, [h.moved_type, h.moved_to]); // eslint-disable-line react-hooks/exhaustive-deps -- 伺服器資料更新後同步輸入框（key 只用 tool_id，不會因資料改變而重建元件）
  const name = h.ai_tools?.name ?? h.tool_id, url = h.ai_tools?.url ?? "";
  const moved = h.last_final_url && host(h.last_final_url) !== host(url) ? h.last_final_url : null;
  const act = async (action: "ok" | "down" | "skip" | "moved") => {
    let note = "";
    let extra: Record<string, unknown> = {};
    if (movedReady && action !== "skip") { // 先檢查轉址／改名欄位（填錯就不用再填備註）
      const v = validateMoved(mv.type, mv.to); if (!v.ok) { setErr(v.error); return; }
      extra = { movedType: mv.type, movedTo: mv.to };
    }
    if (action === "ok" || action === "down") { const n = prompt(action === "ok" ? `確認「${name}」官網正常。備註（可留空）：` : `確認「${name}」官網異常。備註（可留空）：`, ""); if (n === null) return; note = n; }
    setBusy(action); setErr("");
    let ok = false;
    try { await post({ action, id: h.tool_id, note, ...extra }); ok = true; }
    catch (e) { setErr(errText(e)); } finally { setBusy(""); } // 不論成功失敗，一定先恢復按鈕（之後 router.refresh 讓這列卸載也不會留下卡住的狀態）
    if (ok) try { onDone(action === "ok" ? `已確認正常：${name}` : action === "down" ? `已標記為異常：${name}` : action === "moved" ? (extra.movedType && extra.movedType !== "none" ? `已儲存轉址／改名提示並結案：${name}` : `已清除轉址／改名提示：${name}`) : `已略過 7 天：${name}`); } catch { /* 重新整理失敗不影響已完成的動作 */ }
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
      {movedReady && <MovedFields value={mv} onChange={setMv} disabled={!!busy} />}
      {err && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => act("ok")} disabled={!!busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy === "ok" ? "處理中…" : "確認正常"}</button>
        {!h.manual_down && <button onClick={() => act("down")} disabled={!!busy} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{busy === "down" ? "處理中…" : "確認異常"}</button>}
        <button onClick={() => act("skip")} disabled={!!busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 disabled:opacity-50">{busy === "skip" ? "處理中…" : "略過 7 天"}</button>
        {movedReady && <button onClick={() => act("moved")} disabled={!!busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 disabled:opacity-50">{busy === "moved" ? "處理中…" : "只儲存轉址／改名提示"}</button>}
      </div>
    </li>
  );
}

export default function HealthSection({ items, stats, runs, error, movedReady = false, moved = [] }: { items: HealthItem[]; stats: HealthStats | null; runs: HealthRun[]; error: string | null; movedReady?: boolean; moved?: HealthItem[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState(""); const [running, setRunning] = useState(false);
  const last = runs[0];
  const runNow = async () => {
    setRunning(true); setMsg("檢查中，約需 20–50 秒…");
    try { const j = await post({ action: "run" }, 90_000); setMsg(`執行${j.status === "error" ? "失敗" : "完成"}：${j.message}`); router.refresh(); }
    catch (e) { setMsg(`執行失敗：${errText(e)}`); } finally { setRunning(false); }
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
          {items.length === 0 ? <p className="mt-1 text-slate-500">目前沒有需要人工檢查的工具。</p> : <ul className="mt-2 space-y-3">{items.map((h) => <Row key={h.tool_id} h={h} onDone={done} movedReady={movedReady} />)}</ul>}
          {!movedReady && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-amber-800">想使用「已轉址／已改名」提示，請先在 Supabase 執行 supabase_migration_009_tool_health_moved.sql。</p>}
          {movedReady && moved.length > 0 && (
            <>
              <h3 className="mt-4 font-semibold">已設定「已轉址／已改名」提示的工具（{moved.length}）</h3>
              <p className="mt-1 text-xs text-slate-500">這些工具目前在公開頁面顯示轉址／改名提示；要修改或清除，在這裡操作（選「無」再儲存即清除）。</p>
              <ul className="mt-2 space-y-3">{moved.map((h) => <MovedRow key={h.tool_id} h={h} onDone={done} />)}</ul>
            </>
          )}
          <p className="mt-3 text-xs text-slate-400">
            「確認正常」：標為可連線，之後同樣的狀況不會再放回清單（出現新的狀況或新的失敗才會再出現）。「確認異常」：鎖定顯示為異常，直到自動檢查看到網站恢復。「略過 7 天」：只是暫時從清單隱藏，不改變前台顯示。
            前台只顯示「官網可連線」「官網異常」；無法判定的不顯示標籤。
          </p>
        </>
      )}
    </section>
  );
}
