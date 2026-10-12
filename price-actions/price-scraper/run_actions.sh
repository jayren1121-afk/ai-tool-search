#!/usr/bin/env bash
# GitHub Actions 每日執行：抓取（只抓還沒抓過的網址）→ AI 整理（提供者鏈）→ 驗證/比對 → 產生 SQL 與報告。
# 不連資料庫、不改網站；所有產出寫到 PRICE_DATA_DIR（price-data 分支）。
# 環境變數：PRICE_DATA_DIR（必填）、RUN_MAX_MIN（AI 整理最晚在開始後幾分鐘停，預設 115）、SCRAPE_MAX_MIN（抓取最多幾分鐘，預設 70）
#           NEW_ROUND=1（開始新一輪：把舊進度移到 archive/日期/，全部重新抓取與整理）
set -uo pipefail
CODE="$(cd "$(dirname "$0")" && pwd)"
: "${PRICE_DATA_DIR:?需要 PRICE_DATA_DIR}"
mkdir -p "$PRICE_DATA_DIR/text"
cd "$CODE"
START=$(date +%s)
export SCRAPE_DEADLINE=$(( START + ${SCRAPE_MAX_MIN:-70}*60 ))
export LLM_DEADLINE=$(( START + ${RUN_MAX_MIN:-115}*60 ))
if [ "${NEW_ROUND:-0}" = "1" ]; then
  A="$PRICE_DATA_DIR/archive/$(date +%Y%m%d-%H%M)"; mkdir -p "$A"
  for f in scrape.jsonl llm.jsonl llm_v1.jsonl results.json report.md price_snapshots_import.sql price_snapshots_approve_safe.sql price_snapshots_review_list.md text; do
    [ -e "$PRICE_DATA_DIR/$f" ] && mv "$PRICE_DATA_DIR/$f" "$A/"
  done
  mkdir -p "$PRICE_DATA_DIR/text"; echo "已開始新一輪，舊資料移到 $A"
fi
if [ -z "${LLM_FIRST:-}" ] && [ -f priority_order.txt ]; then export LLM_FIRST="$(paste -sd, priority_order.txt)"; fi
rm -f "$PRICE_DATA_DIR/llm_run.json"
echo "::group::1. 抓取價格頁"; python3 scrape.py 2>&1 | tee -a "$PRICE_DATA_DIR/scrape.log" | tail -n 40; echo "::endgroup::"
echo "::group::2. AI 整理"; python3 llm.py 2>&1 | tee -a "$PRICE_DATA_DIR/llm.log" | tail -n 60; echo "::endgroup::"
echo "::group::3. 驗證與產生報告/SQL"
python3 final.py && python3 report.py >/dev/null && python3 import_price_snapshots.py "$PRICE_DATA_DIR/results.json" "$PRICE_DATA_DIR"
RC=$?
echo "::endgroup::"
python3 summary.py || true
# log 只保留最後 3000 行，避免分支越來越大
for f in scrape.log llm.log; do [ -f "$PRICE_DATA_DIR/$f" ] && tail -n 3000 "$PRICE_DATA_DIR/$f" > "$PRICE_DATA_DIR/$f.tmp" && mv "$PRICE_DATA_DIR/$f.tmp" "$PRICE_DATA_DIR/$f"; done
exit $RC
