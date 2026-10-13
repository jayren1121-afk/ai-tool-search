"""「安全價格」判斷（自動上線用）。import_price_snapshots.py（approve_safe.sql）與 publish_prices.py（寫入資料庫）共用同一條規則。
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
