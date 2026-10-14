#!/usr/bin/env python3
"""把 results.json 的價格寫進 Supabase 的 price_snapshots（update22）。
- update26：不再人工審核。只要有至少一個真實價格＋來源網址＋擷取時間＋逐字原文（safety.is_publishable），
  一律 review_status='approved'、reviewed=true、decided_by='auto'（包含備援模型、有旗標的）。沒有價格/錯誤的列不寫。
- 你在後台「拒絕」過的內容：同一工具之後出現「內容完全相同」（content_hash 相同）的新快照也維持拒絕；內容變了才重新自動上線。
- 用 (tool_id, fetched_at) 做 upsert：每天重跑不會重複新增。
- 你在後台做過的決定（decided_by='admin'）只要內容沒變（content_hash 相同）就不會被覆蓋；
  內容變了（例如備援模型的結果後來被 Groq 重做）就重新判斷：安全 → 自動上線；否則回到待審核。
環境變數：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（GitHub Secrets）、PRICE_DATA_DIR。沒有設定金鑰就略過（不算失敗）。
用法：python3 publish_prices.py [results.json]"""
import json, os, sys, hashlib, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from safety import is_row, is_safe, is_publishable

PLAN_KEYS = ("name", "price_monthly", "price_yearly_per_month", "price_yearly_total", "price_unclear", "list_price", "list_price_unit", "billing_note", "currency", "is_promo", "evidence_quote")
BATCH = 50

def ts_key(s):
    """把時間字串轉成 UTC 秒數，用來比對資料庫裡的 fetched_at（格式可能不同）"""
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        if d.tzinfo is None: d = d.replace(tzinfo=timezone.utc)
        return int(d.timestamp())
    except Exception:
        return None

def build_row(r):
    ex = r["extracted"]
    plans = [{k: p.get(k) for k in PLAN_KEYS} for p in ex.get("plans") or []]
    free = ex.get("free_tier") or None
    content = dict(plans=plans, free_tier=free, price_summary=ex.get("price_summary"), display_region_note=ex.get("display_region_note"), source_url=r["source_url"])
    h = hashlib.sha256(json.dumps(content, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:32]
    return dict(tool_id=r["id"], **content, fetched_at=r["fetched_at"], evidence=r.get("evidence") or [], status="ok",
                diff_flag=r.get("diff_flag") or {}, content_hash=h, llm_model=f"{r.get('llm_provider', 'groq')}:{r.get('llm_model')}")

def decide(row, safe, existing, now, rejected_hashes=()):
    """回傳 (要寫入的 row 或 None=不用寫, 分類)。
    existing：資料庫中同 (tool_id, fetched_at) 的列或 None；rejected_hashes：這個工具被你在後台拒絕過的內容指紋。
    safe 參數保留相容（現在全部自動上線）。"""
    if existing and existing.get("decided_by") == "admin" and existing.get("content_hash") == row["content_hash"] and existing.get("review_status") in ("approved", "rejected"):
        return None, "admin_kept"  # 你做過決定、內容沒變：完全不動
    if row["content_hash"] in rejected_hashes:   # 同樣內容你拒絕過（例如重抓後日期不同但內容一樣）→ 維持拒絕
        st = dict(review_status="rejected", reviewed=False, decided_by="admin")
        kind = "admin_kept"
    else:
        st = dict(review_status="approved", reviewed=True, decided_by="auto")
        kind = "approved"
    if existing and existing.get("content_hash") == row["content_hash"] and existing.get("review_status") == st["review_status"] and existing.get("decided_by") == st["decided_by"]:
        return None, "unchanged"
    st["reviewed_at"] = now
    return {**row, **st}, kind

class Rest:
    def __init__(self, url, key):
        self.base = url.rstrip("/") + "/rest/v1"; self.key = key
    def req(self, method, path, body=None, headers=None):
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json", "Accept": "application/json"}
        h.update(headers or {})
        data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
        rq = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(rq, timeout=60) as resp:
                t = resp.read().decode()
                return json.loads(t) if t.strip() else None
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code} {method} {path.split('?')[0]}：{e.read().decode()[:300]}") from None
    def get_all(self, path):
        out, off = [], 0
        while True:
            page = self.req("GET", path, headers={"Range-Unit": "items", "Range": f"{off}-{off + 999}"}) or []
            out += page
            if len(page) < 1000: return out
            off += 1000

def publish(res, api, now=None):
    now = now or datetime.now(timezone.utc).isoformat()
    rows = [r for r in res if is_publishable(r)]
    skipped = sum(1 for r in res if is_row(r) and not is_publishable(r))
    tool_ids = {t["id"] for t in api.get_all("/ai_tools?select=id")}
    rows_in = [r for r in rows if r["id"] in tool_ids]
    missing = sorted({r["id"] for r in rows} - tool_ids)
    ex = {}
    ids = sorted({r["id"] for r in rows_in})
    for i in range(0, len(ids), 100):
        q = urllib.parse.quote(",".join(ids[i:i + 100]), safe=",-_.")
        for e in api.get_all(f"/price_snapshots?select=tool_id,fetched_at,content_hash,review_status,decided_by&tool_id=in.({q})"):
            ex[(e["tool_id"], ts_key(e["fetched_at"]))] = e
    rej = {}
    for e in ex.values():
        if e.get("review_status") == "rejected" and e.get("decided_by") == "admin" and e.get("content_hash"): rej.setdefault(e["tool_id"], set()).add(e["content_hash"])
    stats = {"approved": 0, "pending": 0, "unchanged": 0, "admin_kept": 0}
    writes, flagged = [], 0
    for r in rows_in:
        safe = is_safe(r); flagged += 0 if safe else 1
        w, kind = decide(build_row(r), safe, ex.get((r["id"], ts_key(r["fetched_at"]))), now, rej.get(r["id"], ()))
        stats[kind] += 1
        if w: writes.append(w)
    for i in range(0, len(writes), BATCH):
        api.req("POST", "/price_snapshots?on_conflict=tool_id,fetched_at", writes[i:i + BATCH], {"Prefer": "resolution=merge-duplicates,return=minimal"})
    return dict(stats=stats, written=len(writes), total=len(rows), missing=missing, published_total=len(rows_in), flagged_total=flagged, skipped_no_price=skipped)

def main():
    base = os.path.abspath(os.environ.get("PRICE_DATA_DIR") or os.path.dirname(os.path.abspath(__file__)))
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base, "results.json")
    url = (os.environ.get("SUPABASE_URL") or "").strip(); key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    summ = os.environ.get("GITHUB_STEP_SUMMARY")
    def out(lines):
        txt = "\n".join(lines) + "\n"; print(txt)
        if summ:
            with open(summ, "a", encoding="utf-8") as f: f.write(txt)
    if not url or not key:
        out(["## 價格上線：略過", "", "尚未設定 GitHub Secrets：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（設定後下次執行就會自動上線）。"]); return 0
    if not os.path.exists(src):
        out(["## 價格上線：略過", "", "這次沒有產生 results.json（可能抓取或整理失敗），資料庫沒有任何變更。"]); return 0
    try:
        r = publish(json.load(open(src, encoding="utf-8")), Rest(url, key))
    except Exception as e:
        msg = str(e)
        if "price_snapshots" in msg and ("PGRST205" in msg or "42P01" in msg or "review_status" in msg or "content_hash" in msg or "PGRST204" in msg):
            msg += "\n→ 請先在 Supabase SQL Editor 執行 supabase_migration_010_price_publish.sql"
        out(["## 價格上線：失敗", "", "```", msg[:800], "```"]); return 1
    s = r["stats"]
    lines = ["## 價格上線結果", "",
             f"- 自動上線：{r['published_total']} 筆（本次新寫入 {s['approved']}；其中 {r['flagged_total']} 筆有疑點旗標或用備援 AI，也已上線，可到 /admin「價格」區塊拒絕）",
             f"- 沒有可用價格、略過：{r['skipped_no_price']} 筆",
             f"- 已經是最新、不用寫：{s['unchanged']} 筆；你在後台決定過且內容沒變（保留你的決定，含拒絕）：{s['admin_kept']} 筆",
             f"- 本次實際寫入資料庫：{r['written']} 筆"]
    if r["missing"]: lines.append(f"- 網站資料庫沒有這些工具，略過：{', '.join(r['missing'][:30])}{' …' if len(r['missing']) > 30 else ''}")
    out(lines)
    try:
        open(os.path.join(base, "publish_log.md"), "w", encoding="utf-8").write(f"# 最近一次價格上線（{datetime.now().strftime('%Y-%m-%d %H:%M')}）\n\n" + "\n".join(lines[2:]) + "\n")
    except Exception: pass
    return 0

if __name__ == "__main__":
    sys.exit(main())
