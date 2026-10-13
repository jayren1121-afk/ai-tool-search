"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Plan = { name: string | null; price_monthly: number | null; price_yearly_per_month: number | null; price_yearly_total: number | null; price_unclear?: number | null; list_price?: number | null; billing_note: string | null; currency: string | null; is_promo: boolean; evidence_quote: string };
export type PriceReviewItem = {
  id: number; tool_id: string; plans: Plan[]; free_tier: { available: boolean | null; limits: string | null; evidence_quote: string | null } | null;
  source_url: string; fetched_at: string; diff_flag: { flags?: string[]; details?: string[] } | null; llm_model: string | null; review_status: string;
  ai_tools: { name: string } | null;
};
export type PriceReviewData = { items: PriceReviewItem[]; counts: { pending: number; approved: number; rejected: number } | null; error: string | null };

const tw = (iso: string) => new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
const SYM: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", TWD: "NT$" };
const money = (n: number | null | undefined, cur: string | null) => (n == null ? null : `${cur ? (SYM[cur] ?? cur + " ") : "$"}${n}`);
const safe = (u: string) => (/^https?:\/\//i.test(u) ? u : null);
/** 旗標的中文說明（為什麼沒有自動上線） */
const FLAG: Record<string, string> = {
  llm_fallback_model: "用備援 AI 整理（之後 Groq 重做若沒問題會自動上線）", old_prompt: "舊版整理規則", price_change: "和原本資料差很多（>50%）", name_diff: "方案名稱和原本不同",
  has_promo: "含促銷價", shared_page: "和其他工具共用同一個價格頁", non_usd: "不是美元", dropped_fields: "有部分數字找不到原文、已丟棄", price_near_quote: "價格只在原文附近找到",
  name_missing: "有方案沒有名稱", label_name: "方案名稱像標籤（例如 Most popular）", name_not_in_quote: "方案名稱不在原文中", name_far_from_price: "方案名稱離價格很遠",
  price_unclear: "看不出是月付還是年付", zero_price: "出現 0 元", abnormal_price: "價格異常高", non_subscription_hint: "可能不是訂閱價（API 用量等）",
  yearly_gt_monthly: "年付比月付貴", yearly_total_mismatch: "年付總額對不上", period_ambiguous_toggle: "月付／年付切換不明",
};

async function post(body: unknown) {
  const r = await fetch("/api/admin/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function Row({ it, onDone }: { it: PriceReviewItem; onDone: (m: string) => void }) {
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const name = it.ai_tools?.name ?? it.tool_id;
  const src = safe(it.source_url);
  const act = async (action: "approve" | "reject") => {
    setBusy(action); setErr("");
    let ok = false;
    try { await post({ action, id: it.id }); ok = true; } catch (e) { setErr((e as Error).name === "TimeoutError" ? "連線逾時，請重新整理確認" : (e as Error).message); } finally { setBusy(""); }
    if (ok) onDone(action === "approve" ? `已核准並上線：${name}` : `已拒絕（網站不顯示）：${name}`);
  };
  const flags = it.diff_flag?.flags ?? [];
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold text-slate-900">{name}</span>
        <span className="font-mono text-xs text-slate-500">{it.tool_id}</span>
        {it.review_status === "rejected" && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">已拒絕</span>}
      </div>
      <p className="mt-1 text-sm">來源：{src ? <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-slate-900 underline">{it.source_url}</a> : it.source_url}</p>
      <p className="text-sm text-slate-600">擷取時間：{tw(it.fetched_at)}（台灣時間）{it.llm_model ? `；整理模型：${it.llm_model}` : ""}</p>
      {flags.length > 0 && <p className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-900">需要人工看的原因：{flags.map((f) => FLAG[f] ?? f).join("；")}</p>}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="py-1 pr-2 font-medium">方案</th><th className="py-1 pr-2 font-medium">建議價格</th><th className="py-1 font-medium">官網原文（逐字）</th></tr></thead>
          <tbody>
            {it.plans.slice(0, 10).map((p, i) => {
              const parts = [money(p.price_monthly, p.currency) && `月付 ${money(p.price_monthly, p.currency)}`, money(p.price_yearly_per_month, p.currency) && `年付每月 ${money(p.price_yearly_per_month, p.currency)}`,
                money(p.price_yearly_total, p.currency) && `年付總額 ${money(p.price_yearly_total, p.currency)}`, money(p.price_unclear, p.currency) && `${money(p.price_unclear, p.currency)}（未註明月/年）`,
                money(p.list_price, p.currency) && `原價 ${money(p.list_price, p.currency)}`, p.is_promo && "促銷"].filter(Boolean);
              return (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="py-1 pr-2 font-medium">{p.name ?? <span className="text-red-700">（沒有名稱，網站不會顯示）</span>}</td>
                  <td className="py-1 pr-2">{parts.join("；") || "—"}{p.billing_note ? <span className="block text-xs text-slate-500">{p.billing_note}</span> : null}</td>
                  <td className="py-1 text-xs text-slate-700">“{p.evidence_quote}”</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {it.free_tier && it.free_tier.available != null && <p className="mt-1 text-sm">免費方案：{it.free_tier.available ? it.free_tier.limits || "有" : "無"}{it.free_tier.evidence_quote ? <span className="text-xs text-slate-600">（原文：“{it.free_tier.evidence_quote}”）</span> : null}</p>}
      {!!it.diff_flag?.details?.length && <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">詳細比對說明</summary><ul className="mt-1 list-disc pl-5">{it.diff_flag.details.map((d, i) => <li key={i} className="break-words">{d}</li>)}</ul></details>}
      {err && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button onClick={() => act("approve")} disabled={!!busy} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:flex-none">{busy === "approve" ? "處理中…" : "核准上線"}</button>
        {it.review_status !== "rejected" && <button onClick={() => act("reject")} disabled={!!busy} className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 sm:flex-none">{busy === "reject" ? "處理中…" : "拒絕（不顯示）"}</button>}
      </div>
    </li>
  );
}

/** 後台「價格審核」：每日自動更新中沒有自動上線的價格（有旗標或用備援 AI）。核准 = 網站顯示；拒絕 = 不顯示 */
export default function PriceReviewSection({ data }: { data: PriceReviewData }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const done = (m: string) => { setMsg(m); router.refresh(); };
  return (
    <section className="mb-4 rounded-xl bg-white p-4 text-sm shadow-sm">
      <h2 className="mb-2 font-semibold text-slate-900">價格審核</h2>
      <p className="text-slate-600">每天自動抓官網價格：沒有任何疑點的會自動上線；下面是需要你確認的。請對照「官網原文」和來源網址，正確就按「核准上線」，不對就按「拒絕」。</p>
      {data.counts && <p className="mt-1 text-slate-500">待審核 {data.counts.pending} 筆；已上線 {data.counts.approved} 筆；已拒絕 {data.counts.rejected} 筆（每個工具只列最新一筆）</p>}
      {data.error && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-800">{data.error}</p>}
      {msg && <p className="mt-2 rounded-lg bg-slate-100 p-3 text-slate-800">{msg}</p>}
      {!data.error && (data.items.length === 0 ? <p className="mt-2 text-slate-500">目前沒有待審核的價格。</p> : <ul className="mt-3 space-y-3">{data.items.map((it) => <Row key={it.id} it={it} onDone={done} />)}</ul>)}
    </section>
  );
}
