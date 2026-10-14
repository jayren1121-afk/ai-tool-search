"""離線測試 publish_prices.py（不連真實資料庫）：本機假 Supabase REST 伺服器（記憶體）。
用法：python3 tests/test_publish.py [results.json]（不給就用內建的小範例）"""
import json, os, sys, threading, copy, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import publish_prices as P
from safety import is_safe, is_publishable

def mk(i, safe=True, model="openai/gpt-oss-120b", price=10.0, flags=None):
    flags = flags if flags is not None else ([] if safe else ["has_promo"])
    return dict(id=i, name=i, status="ok", source_url=f"https://{i}.example/pricing", fetched_at="2026-10-12T13:24:51+08:00",
                extracted=dict(plans=[dict(name="Pro", price_monthly=price, currency="USD", is_promo=False, evidence_quote=f"Pro ${price}/month")], free_tier=None, price_summary=None, display_region_note=None),
                evidence=[dict(evidence_quote=f"Pro ${price}/month", plan="Pro")], llm_model=model, llm_provider="groq" if model == "openai/gpt-oss-120b" else "openrouter", prompt_version="v2",
                diff_flag=dict(flags=flags + ([] if model == "openai/gpt-oss-120b" else ["llm_fallback_model"]), auto_approvable=not flags and model == "openai/gpt-oss-120b"))
DB = {"tools": set(), "snap": {}}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, obj=None):
        b = json.dumps(obj).encode() if obj is not None else b""
        self.send_response(code); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        assert self.headers["apikey"] == "KEY"
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path.endswith("/ai_tools"): return self.send(200, [{"id": t} for t in sorted(DB["tools"])])
        ids = q["tool_id"][0][4:-1].split(",")
        return self.send(200, [dict(tool_id=k[0], fetched_at=v["fetched_at"], content_hash=v["content_hash"], review_status=v["review_status"], decided_by=v["decided_by"]) for k, v in DB["snap"].items() if k[0] in ids])
    def do_POST(self):
        assert "on_conflict=tool_id,fetched_at" in self.path and "merge-duplicates" in self.headers["Prefer"]
        rows = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        assert len({tuple(sorted(r)) for r in rows}) == 1, "批次內欄位必須一致"
        for r in rows:
            assert r["tool_id"] in DB["tools"]
            k = (r["tool_id"], P.ts_key(r["fetched_at"])); DB["snap"][k] = {**DB["snap"].get(k, {}), **r}
        self.send(201)
srv = ThreadingHTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
api = P.Rest(f"http://127.0.0.1:{srv.server_port}", "KEY")
st = lambda i: DB["snap"][(i, P.ts_key("2026-10-12T13:24:51+08:00"))]

DB["tools"] = {"a", "b", "c", "d", "e", "f"}
nop = mk("e"); nop["extracted"]["plans"][0]["price_monthly"] = None      # 沒有價格 → 不上線
noq = mk("f"); noq["extracted"]["plans"][0]["evidence_quote"] = ""       # 沒有逐字原文 → 不上線
res = [mk("a"), mk("b", safe=False), mk("c", model="nemotron"), mk("d", safe=False), mk("zz"), nop, noq]
r1 = P.publish(res, api); assert r1["written"] == 4 and r1["missing"] == ["zz"] and r1["skipped_no_price"] == 2, r1
for i in "abcd": assert st(i)["review_status"] == "approved" and st(i)["reviewed"] is True and st(i)["decided_by"] == "auto" and st(i)["source_url"] and st(i)["fetched_at"], (i, st(i))
assert ("e", P.ts_key("2026-10-12T13:24:51+08:00")) not in DB["snap"] and ("f", P.ts_key("2026-10-12T13:24:51+08:00")) not in DB["snap"]
assert r1["flagged_total"] == 3 and "llm_fallback_model" in st("c")["diff_flag"]["flags"]   # 備援/有旗標也上線，但旗標保留
# 1) 每日重跑：不重複、不寫入
n = len(DB["snap"]); r2 = P.publish(res, api); assert r2["written"] == 0 and len(DB["snap"]) == n, r2
# 2) 後台拒絕 d → 重跑保留拒絕
st("d").update(review_status="rejected", reviewed=False, decided_by="admin")
r3 = P.publish(res, api); assert r3["stats"]["admin_kept"] == 1 and st("d")["review_status"] == "rejected", r3
# 2b) d 重新抓取（日期不同）但內容一樣 → 新快照也維持拒絕
d2 = mk("d", safe=False); d2["fetched_at"] = "2026-11-12T10:00:00+08:00"
P.publish(res + [d2], api); k2 = ("d", P.ts_key(d2["fetched_at"]))
assert DB["snap"][k2]["review_status"] == "rejected" and DB["snap"][k2]["reviewed"] is False, DB["snap"][k2]
# 2c) d 內容變了 → 重新自動上線
d3 = mk("d", safe=False, price=15.0); d3["fetched_at"] = "2026-12-12T10:00:00+08:00"
P.publish(res + [d2, d3], api); assert DB["snap"][("d", P.ts_key(d3["fetched_at"]))]["review_status"] == "approved"
# 3) 備援模型 c 後來被 Groq 重做 → 內容更新、仍自動上線
res[2] = mk("c", price=12.0); r4 = P.publish(res, api); assert st("c")["review_status"] == "approved" and st("c")["decided_by"] == "auto" and "llm_fallback_model" not in st("c")["diff_flag"]["flags"], r4
# 4) 以前待審核（pending）的列 → 自動改成上線
k = ("b", P.ts_key("2026-10-12T13:24:51+08:00")); DB["snap"][k].update(review_status="pending", reviewed=False, decided_by=None)
P.publish(res, api); assert st("b")["review_status"] == "approved"
# 5) 真實資料（選填）
if len(sys.argv) > 1:
    real = json.load(open(sys.argv[1])); DB["tools"] = {r["id"] for r in real}; DB["snap"] = {}
    rr = P.publish(real, api); print("真實 results.json：", rr["stats"], "上線", rr["published_total"], "其中有旗標", rr["flagged_total"], "無價格略過", rr["skipped_no_price"])
    assert rr["published_total"] == sum(1 for r in real if is_publishable(r)); assert P.publish(real, api)["written"] == 0
    assert all(v["source_url"].startswith("http") and v["fetched_at"] for v in DB["snap"].values())
print("OK：publish_prices 測試全部通過")
