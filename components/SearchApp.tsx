"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { CATEGORIES, PRICING, type Tool } from "@/lib/types";
import DiagnosePanel from "./DiagnosePanel";

const COLS = "id,name,url,category,subcategory,description_zh,key_features,pricing_model,free_tier,paid_plans,pricing_url,is_wrapper,underlying_models,company,country,confidence,last_verified,source_urls";

export default function SearchApp() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [pm, setPm] = useState("");
  const [rows, setRows] = useState<Tool[]>([]); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [sel, setSel] = useState<Tool | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true); setErr("");
      let query = sb.from("ai_tools").select(COLS).order("name").limit(100);
      if (cat) query = query.eq("category", cat);
      if (pm) query = query.eq("pricing_model", pm);
      const term = q.trim().replace(/[,()%*\\:'"]/g, " ").replace(/\s+/g, " ").trim();
      if (term) {
        const fts = term.split(" ").join(" & ");
        query = query.or(`search_tsv.fts(simple).${fts},name.ilike.*${term}*,description_zh.ilike.*${term}*,subcategory.ilike.*${term}*`);
      }
      const { data, error } = await query;
      if (error) setErr("查詢失敗：" + error.message); else setRows((data as unknown as Tool[]) || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, cat, pm, sb]);

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-1 flex items-center gap-3 text-2xl font-bold"><img src="/logo.png" alt="jAytal" className="h-10 w-10 rounded-xl" />AI 工具搜尋</h1>
      <p className="mb-4 text-sm text-slate-500">搜尋 AI 工具，點「診斷」由 AI 即時分析價位、方案與是否套殼。</p>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-slate-50/95 px-4 py-2 backdrop-blur">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋名稱、描述，例如：影片、Claude、簡報…"
          className="min-w-0 flex-[1_1_240px] rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2">
          <option value="">所有分類</option>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={pm} onChange={(e) => setPm(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2">
          <option value="">所有計價</option>
          {Object.entries(PRICING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="mb-2 text-sm text-slate-500">{loading ? "搜尋中…" : `${rows.length} 筆結果${rows.length === 100 ? "（最多顯示 100 筆）" : ""}`}</div>
      {err && <div className="mb-3 rounded bg-red-50 p-3 text-red-700">{err}</div>}
      <ul className="space-y-3">
        {rows.map((t) => (
          <li key={t.id} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 hover:underline">{t.name}</a>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-indigo-50 px-2 py-0.5">{CATEGORIES[t.category] ?? t.category}</span>
                {t.subcategory && <span className="rounded bg-slate-100 px-2 py-0.5">{t.subcategory}</span>}
                {t.pricing_model && <span className="rounded bg-emerald-50 px-2 py-0.5">{PRICING[t.pricing_model] ?? t.pricing_model}</span>}
              </div>
              <p className="mt-2 text-sm text-slate-600">{t.description_zh}</p>
            </div>
            <button onClick={() => setSel(t)} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">診斷</button>
          </li>
        ))}
      </ul>
      <DiagnosePanel tool={sel} onClose={() => setSel(null)} />
    </main>
  );
}
