#!/usr/bin/env python3
"""把 full/results.json 轉成 Supabase SQL（只產生檔案，不連資料庫）。

用法：python3 import_price_snapshots.py [results.json] [輸出資料夾]
產出：
  1) price_snapshots_import.sql        — UPSERT，reviewed 一律 false（只含 status='ok' 的工具）。先在 Supabase SQL Editor 執行這份。
  2) price_snapshots_approve_safe.sql  — 只核准「diff_flag 無任何旗標、證據驗證通過」的工具（reviewed=true）。預設不自動執行；請先抽查再手動執行。
  3) price_snapshots_review_list.md    — 需要人工逐筆核對的清單（有旗標者）與核准範本。
核准其他工具：用範本 update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = '...' and fetched_at = '...';
"""
import json, sys, os, re
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json")
out = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(src))
res = json.load(open(src, encoding="utf-8"))
os.makedirs(out, exist_ok=True)

def lit(v):
    if v is None: return "null"
    return "'" + str(v).replace("\x00", "").replace("'", "''") + "'"
def jlit(v): return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"

rows = [r for r in res if r.get("status") == "ok" and r.get("extracted") and r.get("fetched_at") and r.get("source_url")]
imp = ["-- price_snapshots 匯入（reviewed=false；不會自動公開）。需先執行 supabase_migration_007_price_snapshots.sql",
       f"-- 來源：{os.path.basename(src)}，共 {len(rows)} 筆。同一 (tool_id, fetched_at) 重複匯入會更新內容並把 reviewed 重設為 false。",
       "begin;"]
safe, flagged = [], []
for r in rows:
    ex = r["extracted"]
    plans = [{k: p.get(k) for k in ("name", "price_monthly", "price_yearly_per_month", "price_yearly_total", "price_unclear", "list_price", "list_price_unit", "billing_note", "currency", "is_promo", "evidence_quote")} for p in ex["plans"]]
    free = ex.get("free_tier")
    ev = r.get("evidence") or []
    df = r.get("diff_flag") or {}
    imp.append(
        "insert into public.price_snapshots (tool_id, plans, free_tier, price_summary, display_region_note, source_url, fetched_at, evidence, status, diff_flag, reviewed)\n"
        f"select {lit(r['id'])}, {jlit(plans)}, {jlit(free) if free else 'null'}, {lit(ex.get('price_summary'))}, {lit(ex.get('display_region_note'))}, {lit(r['source_url'])}, {lit(r['fetched_at'])}::timestamptz, {jlit(ev)}, 'ok', {jlit(df)}, false\n"
        f"where exists (select 1 from public.ai_tools where id = {lit(r['id'])})\n"
        "on conflict (tool_id, fetched_at) do update set plans = excluded.plans, free_tier = excluded.free_tier, price_summary = excluded.price_summary, display_region_note = excluded.display_region_note,\n"
        "  source_url = excluded.source_url, evidence = excluded.evidence, status = excluded.status, diff_flag = excluded.diff_flag, reviewed = false, reviewed_at = null;")
    # 批次核准清單：無旗標、v2 提示詞、120b 模型、證據驗證全過（有任何被丟棄的欄位會帶 dropped_fields 旗標）
    ok_safe = df.get("auto_approvable") and str(r.get("prompt_version", "")).startswith("v2") and r.get("llm_model") == "openai/gpt-oss-120b" and r.get("llm_provider", "groq") == "groq" and "llm_fallback_model" not in (df.get("flags") or [])
    (safe if ok_safe else flagged).append(r)
imp.append("commit;")
open(os.path.join(out, "price_snapshots_import.sql"), "w", encoding="utf-8").write("\n".join(imp) + "\n")

ap = ["-- 核准「沒有任何旗標」的快照（reviewed=true）。預設不要直接執行：請先看 price_snapshots_review_list.md 並抽查幾筆。",
      "-- 條件：v2 提示詞 + gpt-oss-120b、無價格變動>50%、無方案名稱差異、無促銷價、非共用價格頁、非美元以外幣別、所有價格數字都在證據原文內。",
      "begin;"]
for r in safe:
    ap.append(f"update public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = {lit(r['id'])} and fetched_at = {lit(r['fetched_at'])}::timestamptz;  -- {r['name']}")
ap.append("commit;")
open(os.path.join(out, "price_snapshots_approve_safe.sql"), "w", encoding="utf-8").write("\n".join(ap) + "\n")

md = [f"# 價格快照人工覆核清單\n", f"- 可批次核准（無旗標）：{len(safe)} 筆（見 price_snapshots_approve_safe.sql）\n- 需人工覆核（有旗標）：{len(flagged)} 筆\n",
      "核准單筆範本：\n```sql\nupdate public.price_snapshots set reviewed = true, reviewed_at = now() where tool_id = '工具id' and fetched_at = '擷取時間'::timestamptz;\n```\n",
      "不要的快照：`delete from public.price_snapshots where tool_id = '工具id' and reviewed = false;`\n", "## 有旗標的工具\n"]
for r in flagged:
    df = r.get("diff_flag") or {}
    md.append(f"- **{r['id']}**（{r['name']}）旗標：{', '.join(df.get('flags', [])) or '—'}；{'; '.join(df.get('details', []))}；來源 {r['source_url']}；擷取 {r['fetched_at']}")
open(os.path.join(out, "price_snapshots_review_list.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
print(f"import: {len(rows)} 筆；可批次核准 {len(safe)}；需覆核 {len(flagged)} -> {out}")
