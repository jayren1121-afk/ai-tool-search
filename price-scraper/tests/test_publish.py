"""離線測試 publish_prices.py（不連真實資料庫）：本機假 Supabase REST 伺服器（記憶體）。
用法：python3 tests/test_publish.py [results.json]（不給就用內建的小範例）"""
import json, os, sys, threading, copy, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import publish_prices as P
from safety import is_safe

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

DB["tools"] = {"a", "b", "c", "d"}
res = [mk("a"), mk("b", safe=False), mk("c", model="nemotron"), mk("d", safe=False), mk("zz")]
r1 = P.publish(res, api); assert r1["written"] == 4 and r1["missing"] == ["zz"], r1
assert st("a")["review_status"] == "approved" and st("a")["reviewed"] is True and st("a")["source_url"] and st("a")["fetched_at"]
assert st("b")["review_status"] == "pending" and st("b")["reviewed"] is False and st("c")["review_status"] == "pending"
# 1) 每日重跑：不重複、不寫入
n = len(DB["snap"]); r2 = P.publish(res, api); assert r2["written"] == 0 and len(DB["snap"]) == n, r2
# 2) 後台核准 b、拒絕 d → 重跑保留
st("b").update(review_status="approved", reviewed=True, decided_by="admin"); st("d").update(review_status="rejected", reviewed=False, decided_by="admin")
r3 = P.publish(res, api); assert r3["stats"]["admin_kept"] == 2 and st("b")["reviewed"] and st("d")["review_status"] == "rejected", r3
# 3) 備援模型 c 後來被 Groq 重做且安全 → 自動上線
res[2] = mk("c", price=12.0); r4 = P.publish(res, api); assert st("c")["review_status"] == "approved" and st("c")["decided_by"] == "auto", r4
# 4) b 內容變了（仍有旗標）→ 回到待審核
res[1] = mk("b", safe=False, price=99.0); P.publish(res, api); assert st("b")["review_status"] == "pending" and st("b")["reviewed"] is False
# 5) 真實資料（選填）
if len(sys.argv) > 1:
    real = json.load(open(sys.argv[1])); DB["tools"] = {r["id"] for r in real}; DB["snap"] = {}
    rr = P.publish(real, api); print("真實 results.json：", rr["stats"], "安全", rr["safe_total"], "待審", rr["review_total"])
    assert rr["safe_total"] == sum(1 for r in real if is_safe(r)); assert P.publish(real, api)["written"] == 0
    assert all(v["source_url"].startswith("http") and v["fetched_at"] for v in DB["snap"].values())
print("OK：publish_prices 測試全部通過")
