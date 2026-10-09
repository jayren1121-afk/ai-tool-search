"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { CATEGORIES, PRICING, type Tool } from "@/lib/types";
import { catName, pricingName, releaseText, t, toolDesc, toolHref, trSub, type Locale } from "@/lib/i18n";
import DiagnosePanel from "./DiagnosePanel";
import VoteSummary from "./VoteSummary";

type Row = Tool & { tool_vote_stats?: { up: number; down: number; score: number } | null };

const COLS = "id,name,url,category,subcategory,description_zh,key_features,pricing_model,free_tier,paid_plans,pricing_url,is_wrapper,underlying_models,company,country,confidence,last_verified,source_urls";
const EN_COLS = ",description_en,key_features_en"; // 需 migration 004；欄位不存在時自動退回
const REL_COLS = ",released_at,released_source"; // 需 migration 005；欄位不存在時自動退回
type Sort = "name" | "votes" | "newest";
const LIMIT = 20;

export default function SearchApp({ locale = "zh" }: { locale?: Locale }) {
  const L = t(locale);
  const sb = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [pm, setPm] = useState("");
  const [rows, setRows] = useState<Row[]>([]); const [sort, setSort] = useState<Sort>("name"); const [votesOn, setVotesOn] = useState(true); const [relOn, setRelOn] = useState(true);
  const [enOn, setEnOn] = useState(locale === "en"); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [sel, setSel] = useState<Tool | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true); setErr("");
      const term = q.trim().replace(/[,()%*\\:'"]/g, " ").replace(/\s+/g, " ").trim();
      const build = (withVotes: boolean, withEn: boolean, withRel: boolean) => {
        let query = sb.from("ai_tools").select(`${COLS}${withEn ? EN_COLS : ""}${withRel ? REL_COLS : ""}${withVotes ? ",tool_vote_stats(up,down,score)" : ""}`).limit(LIMIT);
        query = withVotes && sort === "votes"
          ? query.order("tool_vote_stats(score)", { ascending: false, nullsFirst: false }).order("name")
          : withRel && sort === "newest"
            ? query.order("released_at", { ascending: false, nullsFirst: false }).order("name") // 推出日期新到舊，未知的排最後，同日依名稱
            : query.order("name");
        if (cat) query = query.eq("category", cat);
        if (pm) query = query.eq("pricing_model", pm);
        if (term) {
          const fts = term.split(" ").join(" & ");
          query = query.or(`search_tsv.fts(simple).${fts},name.ilike.*${term}*,description_zh.ilike.*${term}*,subcategory.ilike.*${term}*${withEn ? `,description_en.ilike.*${term}*` : ""}`);
        }
        return query;
      };
      let v = votesOn, e = enOn, r = relOn;
      let { data, error } = await build(v, e, r);
      if (error && r && error.code === "42703" && /released/.test(error.message || "")) { r = false; setRelOn(false); if (sort === "newest") setSort("name"); ({ data, error } = await build(v, e, r)); } // 推出日期欄位尚未建立（migration 005）
      if (error && e && error.code === "42703") { e = false; setEnOn(false); ({ data, error } = await build(v, e, r)); } // 英文欄位尚未建立
      if (error && v) { // 投票資料表尚未建立（或查詢失敗）→ 退回不含投票的查詢
        if (/^(PGRST2|42)/.test(error.code || "")) setVotesOn(false);
        v = false; ({ data, error } = await build(v, e, r));
      }
      if (error) setErr(L.queryFailed + error.message); else setRows((data as unknown as Row[]) || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, cat, pm, sb, sort, votesOn, enOn, relOn, L.queryFailed]);

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-1 flex items-center gap-3 text-2xl font-bold"><img src="/logo.png" alt="jAytal" className="h-10 w-10 rounded-xl" />{L.siteName}</h1>
      <p className="mb-4 text-sm text-slate-500">{L.heroSub}</p>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-slate-50/95 px-4 py-2 backdrop-blur">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.searchPh} aria-label={L.searchPh}
          className="min-w-0 flex-[1_1_240px] rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2" aria-label={L.allCats}>
          <option value="">{L.allCats}</option>
          {Object.keys(CATEGORIES).map((k) => <option key={k} value={k}>{catName(locale, k)}</option>)}
        </select>
        {(votesOn || relOn) && <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-slate-300 px-2 py-2" aria-label={L.sortLabel}>
          <option value="name">{L.sortName}</option>{votesOn && <option value="votes">{L.sortVotes}</option>}{relOn && <option value="newest">{L.sortNewest}</option>}
        </select>}
        <select value={pm} onChange={(e) => setPm(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2" aria-label={L.allPricing}>
          <option value="">{L.allPricing}</option>
          {Object.keys(PRICING).map((k) => <option key={k} value={k}>{pricingName(locale, k)}</option>)}
        </select>
      </div>
      <div className="mb-2 text-sm text-slate-500">{loading ? L.searching : `${L.results(rows.length)}${rows.length === LIMIT ? L.resultsCap(LIMIT) : ""}`}</div>
      {err && <div className="mb-3 rounded bg-red-50 p-3 text-red-700">{err}</div>}
      <ul className="space-y-3">
        {rows.map((x) => (
          <li key={x.id} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <Link href={toolHref(locale, x.id)} className="font-semibold text-indigo-700 hover:underline">{x.name}</Link>
              <a href={x.url} target="_blank" rel="nofollow noopener noreferrer" className="ml-2 text-xs text-slate-400 hover:text-indigo-600">{L.website}</a>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-indigo-50 px-2 py-0.5">{catName(locale, x.category)}</span>
                {x.subcategory && <span className="rounded bg-slate-100 px-2 py-0.5">{trSub(locale, x.subcategory)}</span>}
                {x.pricing_model && <span className="rounded bg-emerald-50 px-2 py-0.5">{pricingName(locale, x.pricing_model)}</span>}
              </div>
              <p className="mt-2 text-sm text-slate-600">{toolDesc(locale, x)}</p>
              {releaseText(locale, x.released_at, x.released_source) && <p className="mt-1 text-xs text-slate-400" title={L.releasedHint}>{L.released}{locale === "en" ? ": " : "："}{releaseText(locale, x.released_at, x.released_source)}</p>}
              {votesOn && <VoteSummary up={x.tool_vote_stats?.up} down={x.tool_vote_stats?.down} className="mt-2" locale={locale} />}
            </div>
            <button onClick={() => setSel(x)} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">{L.diagnose}</button>
          </li>
        ))}
      </ul>
      <DiagnosePanel tool={sel} onClose={() => setSel(null)} locale={locale} />
    </main>
  );
}
