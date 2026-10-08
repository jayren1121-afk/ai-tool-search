"use client";
import { useEffect } from "react";
import { t, type Locale } from "@/lib/i18n";
import { AlternativesTable, HeatCard, ReviewsSection, useCommunity } from "./Community";
import VoteButtons from "./VoteButtons";

/** 工具頁的站內互動區：投票、熱度、評論、替代方案（即時資料，不受頁面快取影響） */
export default function ToolCommunity({ toolId, locale = "zh" }: { toolId: string; locale?: Locale }) {
  const { data, sort, setSort, loading, err, reload } = useCommunity(toolId, locale);
  const L = t(locale);
  useEffect(() => { // 瀏覽數 +1（伺服器端去重與限流）
    fetch("/api/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolId }), keepalive: true }).catch(() => {});
  }, [toolId]);
  if (err) return <p className="mt-6 text-sm text-slate-500">{L.communityErr}</p>;
  if (!data) return <p className="mt-6 animate-pulse text-sm text-slate-400">{loading ? L.loadingCommunity : ""}</p>;
  return (
    <div className="mt-6 space-y-6">
      {data.enabled && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">{L.likeIt}</h2>
          <VoteButtons toolId={toolId} stats={data.stats} myVote={data.myVote} locale={locale} />
        </section>
      )}
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-2 text-lg font-semibold">{L.heat}</h2><HeatCard heat={data.heat} enabled={data.enabled} locale={locale} /></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-2 text-lg font-semibold">{L.reviews}</h2><ReviewsSection toolId={toolId} c={data} sort={sort} setSort={setSort} reload={reload} locale={locale} /></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-2 text-lg font-semibold">{L.altCompare}</h2><AlternativesTable selfId={toolId} alts={data.alternatives} locale={locale} /></section>
    </div>
  );
}
