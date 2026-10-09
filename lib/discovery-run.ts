import "server-only";
import { discover, type LLM, type Outcome, type PendingRow, type Store } from "./discovery";
import { callProviderJSON, providerOrder } from "./llm";
import { supabaseAdmin } from "./supabase-admin";

const env = (k: string) => (process.env[k] || "").trim();

/** 依既有供應商順序呼叫 LLM（主要供應商失敗時改用下一個），整體受 timeoutMs 限制 */
function makeLLM(): LLM | null {
  const order = providerOrder();
  if (!order.length) return null;
  return async (system, user, timeoutMs) => {
    const end = Date.now() + timeoutMs;
    const errs: string[] = [];
    for (const p of order) {
      const ms = end - Date.now();
      if (ms < 3000) break;
      try { return await callProviderJSON(p, system, user, ms); }
      catch (e) { errs.push(`${p}: ${(e as Error).message}`.slice(0, 120)); }
    }
    throw new Error(errs.join("；") || "逾時");
  };
}

function supabaseStore(): Store {
  const db = supabaseAdmin();
  return {
    async existing() {
      const { data, error } = await db.from("ai_tools").select("id,url,discovery_url").limit(5000);
      if (error) throw new Error(`讀取工具清單失敗：${error.message}`);
      return (data ?? []) as { id: string; url: string; discovery_url: string | null }[];
    },
    async addedToday() {
      const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
      const { count, error } = await db.from("ai_tools").select("id", { count: "exact", head: true }).not("discovery_source", "is", null).gte("added_at", today);
      if (error) throw new Error(`檢查今日新增失敗：${error.message}`);
      return (count ?? 0) > 0;
    },
    async insertPending(row: PendingRow) {
      const { error } = await db.from("ai_tools").insert({ ...row, key_features: [], key_features_en: [], paid_plans: [], platforms: [] });
      if (error) throw new Error(`寫入資料庫失敗：${error.message}`);
    },
  };
}

/** 執行一次自動發現並寫入 job_runs；整體最多約 52 秒（Vercel 函式上限 60 秒） */
export async function runDiscovery(trigger: "cron" | "admin"): Promise<Outcome> {
  const started = new Date().toISOString();
  const base: Outcome = { status: "error", message: "", tried: [], sources: {}, candidates: 0 };
  let result: Outcome;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Outcome>((resolve) => { timer = setTimeout(() => resolve({ ...base, message: "整體執行逾時（52 秒）" }), 52_000); });
    result = await Promise.race([discover({ env, store: supabaseStore(), llm: makeLLM(), deadlineMs: 46_000, log: (m) => console.info("discover", m) }), timeout]);
    clearTimeout(timer);
  } catch (e) {
    result = { ...base, message: (e as Error).message.slice(0, 300) };
  }
  const { error } = await supabaseAdmin().from("job_runs").insert({
    job: "discover", started_at: started, finished_at: new Date().toISOString(), status: result.status, message: result.message.slice(0, 500),
    details: { trigger, sources: result.sources, candidates: result.candidates, tried: result.tried.slice(0, 10), added_id: result.added?.id ?? null },
  });
  if (error) console.error("job_runs insert", error.message);
  // 清理舊紀錄（登入失敗 30 天、排程紀錄 180 天）
  if (trigger === "cron") {
    const db = supabaseAdmin(), d = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
    await Promise.allSettled([
      db.from("job_runs").delete().eq("job", "admin_login_fail").lt("started_at", d(30)),
      db.from("job_runs").delete().eq("job", "discover").lt("started_at", d(180)),
    ]);
  }
  return result;
}
