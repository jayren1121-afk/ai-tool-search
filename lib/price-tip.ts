// 搜尋卡片的價格說明。只複述已有欄位，不推估沒寫明的額度、浮水印或商用授權。
import type { Locale } from "./i18n";
import type { SearchTool } from "./search-intent";

export type TipPlan = {
  name?: string | null;
  price_monthly?: number | null;
  price_yearly_per_month?: number | null;
  price_yearly_total?: number | null;
  currency?: string | null;
  is_promo?: boolean;
};

export type TipSnapshot = {
  plans?: TipPlan[] | null;
  free_tier?: { available?: boolean | null; limits?: string | null } | null;
  fetched_at?: string | null;
  source_url?: string | null;
};

export type PriceTip = {
  source: "snapshot" | "catalog" | "none";
  confirmed: boolean;
  lines: { label: string; text: string }[];
  note: string | null;
};

const SYM: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", TWD: "NT$", KRW: "₩" };

const COPY = {
  zh: {
    free: "免費額度", paid: "付費價格",
    freeYes: "有免費方案", freeNo: "無免費方案（頁面未列出）",
    missing: "官網資料未寫明",
    watermark: "浮水印與商用授權：官網資料未寫明",
    unconfirmed: "此價格來自站內目錄，尚未用已核准的官網快照核對。",
    confirmed: (d: string) => `已核准的官網價格，截至 ${d}。`,
    none: "沒有可顯示的價格資料。",
    promo: "促銷", perMonth: "/月", perMonthYear: "/月（年繳）", perYear: "/年", from: "起",
  },
  en: {
    free: "Free tier", paid: "Paid price",
    freeYes: "A free plan is listed", freeNo: "No free plan is listed on the page",
    missing: "Not stated on the pricing page",
    watermark: "Watermark and commercial use: not stated on the pricing page",
    unconfirmed: "This price is from the site catalog and has not been checked against an approved pricing-page snapshot.",
    confirmed: (d: string) => `Approved official price, as of ${d}.`,
    none: "No price details to show.",
    promo: "promo", perMonth: "/mo", perMonthYear: "/mo, billed yearly", perYear: "/yr", from: " and up",
  },
};

function money(n: number, currency: string | null | undefined): string {
  const sym = currency ? (SYM[currency] ?? `${currency} `) : "$";
  const num = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${sym}${num}`;
}

function taipeiDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function watermarkLine(locale: Locale, text: string): string | null {
  if (/浮水印|watermark|商用|commercial/i.test(text)) return null;
  return COPY[locale].watermark;
}

function pickSnapshotPrice(locale: Locale, plans: TipPlan[]): string | null {
  const C = COPY[locale];
  const priced = plans.filter((p) => p.price_monthly != null || p.price_yearly_per_month != null || p.price_yearly_total != null);
  if (!priced.length) return null;
  const regular = priced.filter((p) => !p.is_promo);
  const pool = regular.length ? regular : priced;
  const promoOnly = !regular.length;
  const monthly = pool.filter((p) => typeof p.price_monthly === "number");
  const yearlyPm = pool.filter((p) => typeof p.price_yearly_per_month === "number");
  const yearly = pool.filter((p) => typeof p.price_yearly_total === "number");
  const chosen = monthly.length ? monthly : yearlyPm.length ? yearlyPm : yearly;
  const best = chosen.reduce((a, b) => {
    const av = (a.price_monthly ?? a.price_yearly_per_month ?? a.price_yearly_total) as number;
    const bv = (b.price_monthly ?? b.price_yearly_per_month ?? b.price_yearly_total) as number;
    return bv < av ? b : a;
  });
  const amount = (best.price_monthly ?? best.price_yearly_per_month ?? best.price_yearly_total) as number;
  const unit = best.price_monthly != null ? C.perMonth : best.price_yearly_per_month != null ? C.perMonthYear : C.perYear;
  const name = (best.name || "").trim();
  const more = chosen.length > 1 ? C.from : "";
  const promo = promoOnly ? ` (${C.promo})` : "";
  return `${name ? `${name} ` : ""}${money(amount, best.currency)}${unit}${more}${promo}`.trim();
}

function pickCatalogPrice(locale: Locale, plans: SearchTool["paid_plans"]): string | null {
  const C = COPY[locale];
  const priced = (plans || []).filter((p) => typeof p.price_usd_month === "number" && (p.price_usd_month as number) >= 0);
  if (!priced.length) return null;
  const best = priced.reduce((a, b) => ((b.price_usd_month as number) < (a.price_usd_month as number) ? b : a));
  const name = (best.name || "").trim();
  const more = priced.length > 1 ? C.from : "";
  return `${name ? `${name} ` : ""}${money(best.price_usd_month as number, "USD")}${C.perMonth}${more}`.trim();
}

function snapshotUseful(s: TipSnapshot | null | undefined): s is TipSnapshot {
  if (!s) return false;
  if (s.free_tier && s.free_tier.available != null) return true;
  return (s.plans || []).some((p) => p.price_monthly != null || p.price_yearly_per_month != null || p.price_yearly_total != null);
}

/** 先用已核准快照；沒有才用目錄的 free_tier / paid_plans，並標成尚未核對。 */
export function buildPriceTip(locale: Locale, tool: Pick<SearchTool, "free_tier" | "paid_plans">, snapshot: TipSnapshot | null): PriceTip {
  const C = COPY[locale];
  if (snapshotUseful(snapshot)) {
    const lines: { label: string; text: string }[] = [];
    const free = snapshot.free_tier;
    if (free && free.available === true) lines.push({ label: C.free, text: (free.limits || "").trim() || C.freeYes });
    else if (free && free.available === false) lines.push({ label: C.free, text: C.freeNo });
    const paid = pickSnapshotPrice(locale, snapshot.plans || []);
    if (paid) lines.push({ label: C.paid, text: paid });
    else if (!lines.length) lines.push({ label: C.paid, text: C.missing });
    const joined = lines.map((l) => l.text).join(" ");
    const extra = watermarkLine(locale, joined);
    if (extra) lines.push({ label: "", text: extra });
    const day = snapshot.fetched_at ? taipeiDay(snapshot.fetched_at) : "";
    return { source: "snapshot", confirmed: true, lines, note: day ? C.confirmed(day) : null };
  }
  const freeText = (tool.free_tier || "").trim();
  const paid = pickCatalogPrice(locale, tool.paid_plans);
  if (!freeText && !paid) return { source: "none", confirmed: false, lines: [], note: C.none };
  const lines: { label: string; text: string }[] = [];
  if (freeText) lines.push({ label: C.free, text: freeText });
  if (paid) lines.push({ label: C.paid, text: paid });
  const extra = watermarkLine(locale, lines.map((l) => l.text).join(" "));
  if (extra) lines.push({ label: "", text: extra });
  return { source: "catalog", confirmed: false, lines, note: C.unconfirmed };
}

/** 站外搜尋結果不在目錄裡，不推測它的價格。 */
export function externalPriceTip(locale: Locale): PriceTip {
  const text = locale === "en" ? "This site has no price for this website." : "本站沒有這個網站的價格";
  return { source: "none", confirmed: false, lines: [], note: text };
}
