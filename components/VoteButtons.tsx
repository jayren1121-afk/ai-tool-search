"use client";
import { useEffect, useState } from "react";
import { protectedPost } from "@/lib/client";
import { pctGood, type VoteStats } from "@/lib/types";
import { t, type Locale } from "@/lib/i18n";

export default function VoteButtons({ toolId, stats, myVote, onChange, locale = "zh" }: { toolId: string; stats: VoteStats | null; myVote: -1 | 0 | 1; onChange?: (s: VoteStats, v: -1 | 0 | 1) => void; locale?: Locale }) {
  const L = t(locale);
  const [s, setS] = useState({ up: stats?.up ?? 0, down: stats?.down ?? 0 });
  const [mine, setMine] = useState<-1 | 0 | 1>(myVote);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { setS({ up: stats?.up ?? 0, down: stats?.down ?? 0 }); setMine(myVote); }, [stats, myVote]);

  const cast = async (v: -1 | 1) => {
    if (busy) return;
    const next: -1 | 0 | 1 = mine === v ? 0 : v; // 再按一次取消
    const prev = { s, mine };
    const ns = { up: s.up - (mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0), down: s.down - (mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0) };
    setS(ns); setMine(next); setBusy(true); setErr(""); // 樂觀更新
    try {
      const { ok, data } = await protectedPost<{ stats?: VoteStats }>("/api/vote", { toolId, vote: next });
      if (!ok) throw new Error(data.error || L.voteFailed);
      if (data.stats) { setS({ up: data.stats.up, down: data.stats.down }); onChange?.(data.stats, next); }
    } catch (e) { setS(prev.s); setMine(prev.mine); setErr((e as Error).message); } finally { setBusy(false); }
  };
  const pct = pctGood(s.up, s.down);
  const btn = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition ${on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 hover:bg-slate-50"}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button aria-pressed={mine === 1} className={btn(mine === 1)} onClick={() => cast(1)} disabled={busy}>👍 {s.up}</button>
      <button aria-pressed={mine === -1} className={btn(mine === -1)} onClick={() => cast(-1)} disabled={busy}>👎 {s.down}</button>
      <span className="text-sm text-slate-500">{pct !== null ? L.goodVotes(pct, s.up + s.down) : L.firstVote}</span>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
