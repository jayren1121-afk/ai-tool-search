"""上線規則（update26：全部自動上線）。
- is_publishable：有至少一個真實價格（>0）且有逐字原文、來源網址、擷取時間 → 自動上線（包含備援模型、有旗標的）。
- is_safe：舊的「沒有任何疑點」規則，現在只用來在報告/後台標示「有疑點」，不再決定是否上線。
以下為舊說明：「安全價格」判斷（自動上線用）。import_price_snapshots.py（approve_safe.sql）與 publish_prices.py（寫入資料庫）共用同一條規則。
條件：status=ok、有來源網址與擷取時間、v2 提示詞、Groq 的 gpt-oss-120b（非備援模型）、diff_flag 沒有任何旗標（auto_approvable）。"""
PRIMARY_MODEL = "openai/gpt-oss-120b"

def is_row(r):
    return r.get("status") == "ok" and bool(r.get("extracted")) and bool(r.get("fetched_at")) and bool(r.get("source_url"))

def is_safe(r):
    df = r.get("diff_flag") or {}
    return (is_row(r) and bool(df.get("auto_approvable"))
            and str(r.get("prompt_version", "")).startswith("v2")
            and r.get("llm_model") == PRIMARY_MODEL and r.get("llm_provider", "groq") == "groq"
            and "llm_fallback_model" not in (df.get("flags") or []))

PRICE_FIELDS = ("price_monthly", "price_yearly_per_month", "price_yearly_total", "price_unclear")

def has_real_price(r):
    for p in (r.get("extracted") or {}).get("plans") or []:
        if not isinstance(p, dict): continue
        q = p.get("evidence_quote")
        if not (isinstance(q, str) and q.strip()) or p.get("quote_verified") is False: continue
        for f in PRICE_FIELDS:
            v = p.get(f)
            if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0: return True
    return False

def is_publishable(r):
    """自動上線條件：status=ok、有來源網址(http)與擷取時間、至少一個有逐字原文的真實價格。不看模型、不看旗標。"""
    return is_row(r) and str(r.get("source_url", "")).startswith("http") and has_real_price(r)
