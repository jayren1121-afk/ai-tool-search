import { after, NextRequest, NextResponse } from "next/server";
import { getHeat, getMyReview, getMyVotes, getReviews, getStats, pickAlternatives, refreshHeat } from "@/lib/community";
import { checkLimits, clientIp, peekVoterHash, validToolId } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Community } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const toolId = req.nextUrl.searchParams.get("toolId");
  const sort = req.nextUrl.searchParams.get("sort") === "helpful" ? "helpful" : "new";
  if (!validToolId(toolId)) return NextResponse.json({ error: "無效的 toolId" }, { status: 400 });
  if (await checkLimits("community", clientIp(req), [{ name: "min", max: 60, windowSec: 60 }])) return NextResponse.json({ error: "請求過於頻繁" }, { status: 429 });
  const voter = peekVoterHash(req);

  const out: Community = { enabled: true, stats: null, myVote: 0, heat: null, reviews: [], myReview: null, alternatives: [] };
  const [stats, myVotes, heat, reviews, myReview, alts] = await Promise.allSettled([
    getStats(toolId), getMyVotes([toolId], voter), getHeat(toolId), getReviews(toolId, sort, voter), getMyReview(toolId, voter), pickAlternatives(toolId),
  ]);
  if (stats.status === "fulfilled") out.stats = stats.value; else out.enabled = false; // 003 尚未執行
  if (myVotes.status === "fulfilled") out.myVote = (myVotes.value[toolId] ?? 0) as -1 | 0 | 1;
  if (heat.status === "fulfilled") out.heat = heat.value;
  if (reviews.status === "fulfilled") out.reviews = reviews.value;
  if (myReview.status === "fulfilled") out.myReview = myReview.value;
  if (alts.status === "fulfilled") out.alternatives = alts.value.self && alts.value.alts.length ? [alts.value.self, ...alts.value.alts] : [];

  // 熱度過期（>24h）或不存在時於回應後背景刷新
  if (out.enabled && (!out.heat || Date.now() - new Date(out.heat.refreshed_at).getTime() > 86400_000)) {
    after(async () => {
      const { data: t } = await supabaseAdmin().from("ai_tools").select("id,url").eq("id", toolId).maybeSingle();
      if (t) await refreshHeat(t).catch((e) => console.error("refreshHeat", e));
    });
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
