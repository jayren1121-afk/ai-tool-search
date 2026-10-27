"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { CATEGORIES, PRICING, type Tool } from "@/lib/types";
import { catName, pricingName, releaseText, t, toolDesc, toolHref, trSub, type Locale } from "@/lib/i18n";
import { buildPriceTip, type PriceTip } from "@/lib/price-tip";
import { protectedPost } from "@/lib/client";
import DiagnosePanel from "./DiagnosePanel";
import FingerLockPromo from "./FingerLockPromo";
import HealthBadge from "./HealthBadge";
import { OnSiteGuardToggle } from "./OnSiteGuard";
import PriceBadge from "./PriceBadge";
import SearchSidebar from "./SearchSidebar";
import VoteSummary from "./VoteSummary";

type HealthEmbed = { status: string; last_checked_at: string | null; moved_type?: string | null; moved_to?: string | null };
type Row = Tool & {
  tool_vote_stats?: { up: number; down: number; score: number } | null;
  tool_health?: HealthEmbed | HealthEmbed[] | null;
  priceTip?: PriceTip;
  relevance?: "direct" | "indirect";
};
type ExternalHit = { title: string; url: string; site: string; snippet: string; priceTip: PriceTip; sig?: string };
type Group = { id: string; title: string; tools: Row[]; external?: ExternalHit[] };
type Api =
  | { mode: "goal"; goalTitle: string; groups: Group[]; external?: ExternalHit[] }
  | { mode: "list"; tools: Row[]; external?: ExternalHit[] };

const COLS = "id,name,url,category,subcategory,description_zh,key_features,pricing_model,free_tier,paid_plans,pricing_url,is_wrapper,underlying_models,company,country,confidence,last_verified,source_urls";
const EN_COLS = ",description_en,key_features_en"; // 需 migration 004；欄位不存在時自動退回
const REL_COLS = ",released_at,released_source"; // 需 migration 005；欄位不存在時自動退回
const HEALTH_COLS = ",tool_health(status,last_checked_at)"; // 官網連線狀態（需 migration 008）；關聯不存在或沒有權限時自動退回，不影響搜尋
const HEALTH_COLS_MOVED = ",tool_health(status,last_checked_at,moved_type,moved_to)"; // 加上「已轉址／已改名」提示（需 migration 009）；欄位不存在時先退回 HEALTH_COLS
type Sort = "name" | "votes" | "newest";
const LIMIT = 20;

function SuggestButton({ hit, query, subNeed, label, sent, listed, fail }: {
  hit: ExternalHit; query: string; subNeed: string | null; label: string; sent: string; listed: string; fail: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "listed">("idle");
  const [err, setErr] = useState("");
  const send = async () => {
    if (!hit.sig || state !== "idle") return;
    setState("busy"); setErr("");
    try {
      const res = await protectedPost<{ state?: string }>("/api/suggestions", {
        url: hit.url, title: hit.title, query, subNeed, sig: hit.sig,
      });
      if (res.ok && res.data.state === "catalog") { setState("listed"); return; }
      if (res.ok) { setState("sent"); return; }
      setState("idle");
      setErr(fail + (res.data.error || res.status));
    } catch (e) {
      setState("idle");
      setErr(fail + (e as Error).message);
    }
  };
  const done = state === "sent" || state === "listed";
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={send} disabled={state !== "idle"} aria-label={label} title={label}
        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-default disabled:opacity-50">
        {state === "busy" ? "…" : "+"}
      </button>
      {state === "sent" && <p className="max-w-40 text-right text-xs text-emerald-700">{sent}</p>}
      {state === "listed" && <p className="max-w-40 text-right text-xs text-slate-600">{listed}</p>}
      {err && !done && <p className="max-w-40 text-right text-xs text-red-700">{err}</p>}
    </div>
  );
}

export default function SearchApp({ locale = "zh", children }: { locale?: Locale; children?: React.ReactNode }) {
  const L = t(locale);
  const sb = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [pm, setPm] = useState("");
  const [rows, setRows] = useState<Row[]>([]); const [sort, setSort] = useState<Sort>("name"); const [votesOn, setVotesOn] = useState(true); const [relOn, setRelOn] = useState(true); const [healthOn, setHealthOn] = useState(true); const [movedOn, setMovedOn] = useState(true);
  const [enOn, setEnOn] = useState(locale === "en"); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [sel, setSel] = useState<Tool | null>(null); const [count, setCount] = useState(LIMIT); // 目前要顯示幾筆（每按一次「載入更多」增加 20）
  const [api, setApi] = useState<Api | null>(null);
  const text = q.trim();
  const browse = !text && !!(cat || pm); // 只選分類或計價時，沿用原本的資料庫排序
  useEffect(() => { setCount(LIMIT); }, [q, cat, pm, sort]);

  useEffect(() => {
    if (!browse) { if (!text) { setRows([]); setErr(""); setLoading(false); } return; }
    if (!sb) {
      setRows([]); setLoading(false);
      setErr(L.queryFailed + (locale === "en" ? "search is not configured" : "尚未設定搜尋服務"));
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true); setErr(""); setApi(null);
      const build = (withVotes: boolean, withEn: boolean, withRel: boolean, withHealth: boolean, withMoved: boolean) => {
        let query = sb.from("ai_tools").select(`${COLS}${withEn ? EN_COLS : ""}${withRel ? REL_COLS : ""}${withHealth ? (withMoved ? HEALTH_COLS_MOVED : HEALTH_COLS) : ""}${withVotes ? ",tool_vote_stats(up,down,score)" : ""}`).range(0, count); // 多抓 1 筆，用來判斷是否還有更多結果
        query = withVotes && sort === "votes"
          ? query.order("tool_vote_stats(score)", { ascending: false, nullsFirst: false }).order("name")
          : withRel && sort === "newest"
            ? query.order("released_at", { ascending: false, nullsFirst: false }).order("name") // 推出日期新到舊，未知的排最後，同日依名稱
            : query.order("name");
        if (cat) query = query.eq("category", cat);
        if (pm) query = query.eq("pricing_model", pm);
        return query;
      };
      let v = votesOn, e = enOn, r = relOn, h = healthOn, m = movedOn;
      let { data, error } = await build(v, e, r, h, m);
      if (error && r && error.code === "42703" && /released/.test(error.message || "")) { r = false; setRelOn(false); if (sort === "newest") setSort("name"); ({ data, error } = await build(v, e, r, h, m)); } // 推出日期欄位尚未建立（migration 005）
      if (error && h && m && /tool_health|moved_(type|to)/.test(`${error.message} ${error.details ?? ""}`)) { m = false; setMovedOn(false); ({ data, error } = await build(v, e, r, h, m)); } // 轉址／改名欄位尚未建立（migration 009）：先退回只含狀態的標籤查詢
      if (error && h && /tool_health/.test(`${error.message} ${error.details ?? ""}`)) { h = false; setHealthOn(false); ({ data, error } = await build(v, e, r, h, m)); } // 官網檢查資料表／關聯尚未建立（migration 008）：退回不含標籤的查詢
      if (error && e && error.code === "42703") { e = false; setEnOn(false); ({ data, error } = await build(v, e, r, h, m)); } // 英文欄位尚未建立
      if (error && v) { // 投票資料表尚未建立（或查詢失敗）→ 退回不含投票的查詢
        if (/^(PGRST2|42)/.test(error.code || "")) setVotesOn(false);
        v = false; ({ data, error } = await build(v, e, r, h, m));
      }
      if (error) setErr(L.queryFailed + error.message); else setRows((data as unknown as Row[]) || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [cat, pm, sb, sort, votesOn, enOn, relOn, healthOn, movedOn, count, browse, text, locale, L.queryFailed]);

  useEffect(() => {
    if (!text) { setApi(null); return; }
    const timer = setTimeout(async () => {
      setLoading(true); setErr(""); setRows([]);
      try {
        const params = new URLSearchParams({ q: text, locale });
        if (cat) params.set("cat", cat);
        if (pm) params.set("pm", pm);
        const r = await fetch(`/api/search?${params}`);
        const data = await r.json();
        if (!r.ok) { setApi(null); setErr(L.queryFailed + (data.error || r.status)); }
        else setApi(data as Api);
      } catch {
        setApi(null);
        setErr(L.queryFailed + (locale === "en" ? "network error" : "網路錯誤"));
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, cat, pm, locale, L.queryFailed]);

  const usePrompt = (value: string) => { setCat(""); setPm(""); setQ(value); };

  const externalBlock = (hits: ExternalHit[] | undefined, heading: boolean, subNeed: string | null) => {
    if (!hits?.length) return null;
    return (
      <div className="mt-3">
        {heading && <h3 className="mb-1 text-sm font-semibold text-slate-800">{L.external}</h3>}
        <p className="mb-2 text-xs text-slate-500">{L.externalNote}</p>
        <ul className="space-y-3">
          {hits.map((h) => (
            <li key={h.url} className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4">
              <div className="min-w-0 flex-1">
                <a href={h.url} target="_blank" rel="nofollow noopener noreferrer" className="font-semibold text-indigo-700 hover:underline">{h.title}</a>
                <span className="ml-2 text-xs text-slate-400">{h.site}</span>
                <div className="mt-1"><PriceBadge label={L.priceBadge} tip={h.priceTip} /></div>
                {h.snippet && <p className="mt-2 text-sm text-slate-600">{h.snippet}</p>}
              </div>
              {h.sig && <SuggestButton hit={h} query={text} subNeed={subNeed} label={L.suggestAdmin} sent={L.suggestSent} listed={L.suggestListed} fail={L.suggestFail} />}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const card = (x: Row) => {
    const tip = x.priceTip ?? buildPriceTip(locale, x, null);
    const priceLabel = pricingName(locale, x.pricing_model) || (tip.source !== "none" ? L.priceBadge : "");
    const votes = Array.isArray(x.tool_vote_stats) ? x.tool_vote_stats[0] : x.tool_vote_stats;
    return (
      <li key={x.id} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <Link href={toolHref(locale, x.id)} className="font-semibold text-indigo-700 hover:underline">{x.name}</Link>
          <a href={x.url} target="_blank" rel="nofollow noopener noreferrer" className="ml-2 text-xs text-slate-400 hover:text-indigo-600">{L.website}</a>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            <span className="rounded bg-indigo-50 px-2 py-0.5">{catName(locale, x.category)}</span>
            {x.subcategory && <span className="rounded bg-slate-100 px-2 py-0.5">{trSub(locale, x.subcategory)}</span>}
            {priceLabel && <PriceBadge label={priceLabel} tip={tip} />}
            {x.relevance === "indirect" && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">{L.indirect}</span>}
          </div>
          <p className="mt-2 text-sm text-slate-600">{toolDesc(locale, x)}</p>
          {releaseText(locale, x.released_at, x.released_source) && <p className="mt-1 text-xs text-slate-400" title={L.releasedHint}>{L.released}{locale === "en" ? ": " : "："}{releaseText(locale, x.released_at, x.released_source)}</p>}
          {healthOn && <HealthBadge health={Array.isArray(x.tool_health) ? x.tool_health[0] : x.tool_health} locale={locale} className="mt-2" />}
          {votesOn && <VoteSummary up={votes?.up} down={votes?.down} className="mt-2" locale={locale} />}
        </div>
        <button onClick={() => setSel(x)} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">{L.diagnose}</button>
      </li>
    );
  };

  const list = api?.mode === "list" ? api.tools : rows;
  const grouped = api?.mode === "goal" ? api : null;
  const externalCount = text
    ? (grouped
      ? grouped.groups.reduce((n, g) => n + (g.external?.length || 0), 0) + (grouped.external?.length || 0)
      : (api?.mode === "list" ? api.external?.length || 0 : 0))
    : 0;
  const shown = (text ? (grouped ? grouped.groups.reduce((n, g) => n + g.tools.length, 0) : list.length) : Math.min(rows.length, count)) + externalCount;

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="home-title flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0 lg:flex-1">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold"><img src="/logo.png" alt="jAytal" className="h-10 w-10 shrink-0 rounded-xl" /><span className="min-w-0">{L.siteName}</span></h1>
          <p className="text-sm text-slate-500">{L.heroSub}</p>
        </div>
        <FingerLockPromo locale={locale} />
        <OnSiteGuardToggle />
      </div>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        <SearchSidebar locale={locale} query={q} onPrompt={usePrompt} />
        <div className="min-w-0">
          <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-slate-50/95 px-4 py-2 backdrop-blur">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.searchPh} aria-label={L.searchPh}
              className="min-w-0 flex-[1_1_240px] rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400" />
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2" aria-label={L.allCats}>
              <option value="">{L.allCats}</option>
              {Object.keys(CATEGORIES).map((k) => <option key={k} value={k}>{catName(locale, k)}</option>)}
            </select>
            {(votesOn || relOn) && <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={!!text} title={text ? L.sortRelevance : undefined} className="rounded-lg border border-slate-300 px-2 py-2 disabled:opacity-50" aria-label={L.sortLabel}>
              <option value="name">{L.sortName}</option>{votesOn && <option value="votes">{L.sortVotes}</option>}{relOn && <option value="newest">{L.sortNewest}</option>}
            </select>}
            <select value={pm} onChange={(e) => setPm(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2" aria-label={L.allPricing}>
              <option value="">{L.allPricing}</option>
              {Object.keys(PRICING).map((k) => <option key={k} value={k}>{pricingName(locale, k)}</option>)}
            </select>
          </div>
          {(text || browse) ? (
            <>
              <div className="mb-2 text-sm text-slate-500">{loading && shown === 0 ? L.searching : L.results(shown) + (!text && rows.length > count ? L.resultsMore : "")}</div>
              {grouped && <p className="mb-3 text-sm text-slate-600">{L.goalLead(grouped.goalTitle)}</p>}
              {err && <div className="mb-3 rounded bg-red-50 p-3 text-red-700">{err}</div>}
              {grouped ? (
                <div className="space-y-6">
                  {grouped.groups.map((g) => (
                    <section key={g.id} aria-labelledby={`need-${g.id}`}>
                      <h2 id={`need-${g.id}`} className="mb-2 text-base font-semibold">{g.title}</h2>
                      {g.tools.length === 0 && <p className="text-sm text-slate-500">{L.groupEmpty}</p>}
                      {g.tools.length > 0 && <ul className="space-y-3">{g.tools.map(card)}</ul>}
                      {externalBlock(g.external, true, g.id)}
                    </section>
                  ))}
                  {(grouped.external?.length || 0) > 0 && (
                    <section aria-label={L.external}>
                      <h2 className="mb-2 text-base font-semibold">{L.external}</h2>
                      {externalBlock(grouped.external, false, null)}
                    </section>
                  )}
                </div>
              ) : (
                <>
                  <ul className="space-y-3">{(text ? list : rows.slice(0, count)).map(card)}</ul>
                  {text && api?.mode === "list" && (api.external?.length || 0) > 0 && (
                    <section className="mt-6" aria-label={L.external}>
                      <h2 className="mb-2 text-base font-semibold">{L.external}</h2>
                      {externalBlock(api.external, false, null)}
                    </section>
                  )}
                </>
              )}
              {!text && rows.length > count && (
                <div className="mt-4 text-center">
                  <button onClick={() => setCount((c) => c + LIMIT)} disabled={loading} className="rounded-lg border border-indigo-300 bg-white px-5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{loading ? L.searching : L.loadMore}</button>
                </div>
              )}
            </>
          ) : children}
        </div>
      </div>
      <DiagnosePanel tool={sel} onClose={() => setSel(null)} locale={locale} />
    </main>
  );
}
