import "server-only";
import { batchSizeFor, nextHealth, pickBatch, runBatch, type CheckResult, type HealthRow } from "./health";
import { isMissingColumn } from "./published";
import { supabaseAdmin } from "./supabase-admin";

export type HealthOutcome = {
  status: "ok" | "error" | "skipped";
  message: string;
  checked: number; batch: number; due: number; total: number; stale7d: number;
  counts: Record<string, number>;
};
const EMPTY = { checked: 0, batch: 0, due: 0, total: 0, stale7d: 0, counts: {} as Record<string, number> };
const MISSING_TABLE = "官網檢查資料表不存在，請先在 Supabase 執行 supabase_migration_008_tool_health.sql";
const isMissingTable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /tool_health/.test(e.message || "") && /(does not exist|schema cache|relationship)/i.test(e.message || ""));

/**
 * 執行一批官網健康檢查（最久沒檢查的 90–110 個）並寫入 tool_health 與 job_runs（job = 'health'）。
 * 整體約 45 秒內結束（Vercel 函式上限 60 秒）；來不及的工具留給下一次（它們仍是「最久沒檢查」）。
 * 只讀取 published 的工具，只寫入 tool_health 與 job_runs。
 */
export async function runHealthCheck(trigger: "cron" | "admin"): Promise<HealthOutcome> {
  const started = new Date(), t0 = Date.now();
  const db = supabaseAdmin();
  const finish = async (o: HealthOutcome, extra: Record<string, unknown> = {}, record = true): Promise<HealthOutcome> => {
    if (record) {
      const { error } = await db.from("job_runs").insert({
        job: "health", started_at: started.toISOString(), finished_at: new Date().toISOString(), status: o.status, message: o.message.slice(0, 500),
        details: { trigger, checked: o.checked, batch: o.batch, due: o.due, total: o.total, stale7d: o.stale7d, counts: o.counts, ms: Date.now() - t0, ...extra },
      });
      if (error) console.error("job_runs insert", error.message);
    }
    return o;
  };
  try {
    // 後台連按：90 秒內剛執行過就不再跑（排程不受影響）
    if (trigger === "admin") {
      const { data } = await db.from("job_runs").select("started_at").eq("job", "health").gte("started_at", new Date(Date.now() - 90_000).toISOString()).limit(1);
      if (data?.length) return { ...EMPTY, status: "skipped", message: "剛剛才執行過，請等 1～2 分鐘再試" };
    }
    // 1) 已上架工具（service_role 會略過 RLS，所以必須自己過濾 published）
    let tools: { id: string; url: string }[] = [];
    for (const filter of [true, false]) {
      let q = db.from("ai_tools").select("id,url").limit(5000);
      if (filter) q = q.eq("status", "published");
      const r = await q;
      if (r.error && filter && isMissingColumn(r.error)) continue; // migration 005 尚未執行：沒有待審核資料，可不過濾
      if (r.error) return await finish({ ...EMPTY, status: "error", message: `讀取工具清單失敗：${r.error.message}` });
      tools = ((r.data ?? []) as { id: string; url: string | null }[]).filter((t): t is { id: string; url: string } => !!t.url && /^https?:\/\//i.test(t.url));
      break;
    }
    // 2) 既有檢查紀錄
    const hr = await db.from("tool_health").select("tool_id,last_checked_at").limit(5000);
    if (hr.error) return await finish({ ...EMPTY, status: "error", message: isMissingTable(hr.error) ? MISSING_TABLE : `讀取檢查紀錄失敗：${hr.error.message}` });
    const checked = new Map<string, string | null>((hr.data ?? []).map((r: { tool_id: string; last_checked_at: string | null }) => [r.tool_id, r.last_checked_at]));
    const now = new Date();
    const stale7d = tools.filter((t) => { const c = checked.get(t.id); return !c || Date.parse(c) < now.getTime() - 7 * 86400_000; }).length;
    const size = batchSizeFor(tools.length);
    const { batch, due } = pickBatch(tools, checked, now, size);
    if (!batch.length) return await finish({ ...EMPTY, total: tools.length, stale7d, due, status: "ok", message: "目前沒有需要檢查的工具（都在 20 小時內檢查過）" }, {}, trigger === "cron");

    // 3) 檢查（併發 8、同網域序列、整批限速；28 秒後不再開始新的檢查）
    const { results, skipped } = await runBatch(batch, { concurrency: 8, deadlineAt: t0 + 28_000 });

    // 4) 整批網路都壞掉（例如函式本身斷網）時不要寫入失敗，避免誤判
    const all = [...results.values()];
    const netFail = all.filter((r) => r.kind === "fail" && r.netKind && ["dns", "refused", "timeout", "reset", "other"].includes(r.netKind)).length;
    if (all.length >= 20 && netFail / all.length >= 0.7) {
      return await finish({ ...EMPTY, total: tools.length, stale7d, due, batch: batch.length, status: "error", message: `${all.length} 個檢查中有 ${netFail} 個連線失敗，疑似檢查環境網路異常，本次不寫入結果` }, { sample: all.slice(0, 5).map((r) => r.detail) });
    }

    // 5) 寫入前重新讀取整列（避免覆蓋這段期間後台的人工標記），算出新狀態後整列 upsert
    const ids = [...results.keys()];
    const cur = new Map<string, HealthRow>();
    for (let i = 0; i < ids.length; i += 100) {
      const r = await db.from("tool_health").select("*").in("tool_id", ids.slice(i, i + 100));
      if (r.error) return await finish({ ...EMPTY, total: tools.length, stale7d, due, batch: batch.length, status: "error", message: `讀取檢查紀錄失敗：${r.error.message}` });
      for (const row of (r.data ?? []) as HealthRow[]) cur.set(row.tool_id, row);
    }
    const rows: HealthRow[] = ids.map((id) => ({ ...nextHealth(cur.get(id) ?? null, results.get(id) as CheckResult, now), tool_id: id }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await db.from("tool_health").upsert(rows.slice(i, i + 100), { onConflict: "tool_id" });
      if (error) return await finish({ ...EMPTY, total: tools.length, stale7d, due, batch: batch.length, status: "error", message: `寫入檢查結果失敗：${error.message}` });
    }

    const counts: Record<string, number> = { live: 0, down: 0, unknown: 0, review: 0, failed_once: 0, thin: 0 };
    for (const r of rows) {
      counts[r.status]++;
      if (r.needs_review) counts.review++;
      if (r.consecutive_failures > 0 && r.status !== "down") counts.failed_once++;
      if (r.check_signature === "thin") counts.thin++;
    }
    const msg = `檢查 ${rows.length} 個：可連線 ${counts.live}、異常 ${counts.down}、無法判定 ${counts.unknown}（其中待人工確認 ${counts.review}、失敗累計中 ${counts.failed_once}）` + (skipped.length ? `；${skipped.length} 個因時間不足留待下次` : "") + `；超過 7 天未檢查 ${Math.max(0, stale7d - rows.length)} 個`;
    const out = await finish({ status: "ok", message: msg, checked: rows.length, batch: batch.length, due, total: tools.length, stale7d, counts }, {
      skipped: skipped.length,
      problems: rows.filter((r) => r.status !== "live" || r.needs_review).slice(0, 25).map((r) => ({ id: r.tool_id, status: r.status, review: r.needs_review, fails: r.consecutive_failures, detail: r.detail })),
    });
    if (trigger === "cron") {
      await Promise.allSettled([db.from("job_runs").delete().eq("job", "health").lt("started_at", new Date(Date.now() - 90 * 86400_000).toISOString())]);
    }
    return out;
  } catch (e) {
    return await finish({ ...EMPTY, status: "error", message: (e as Error).message.slice(0, 300) });
  }
}
