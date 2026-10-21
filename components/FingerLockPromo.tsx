import Link from "next/link";
import { FL, FL_PATH } from "@/lib/fingerlock";
import { lp, type Locale } from "@/lib/i18n";

/** 首頁標題與站內檢查之間的入口，外觀比照右側綠色檢查卡。 */
export default function FingerLockPromo({ locale }: { locale: Locale }) {
  const copy = FL[locale];
  return (
    <aside className="home-fingerlock w-full lg:shrink-0" aria-label={copy.promoAria}>
      <div className="flex items-center justify-between gap-2">
        <p>{copy.promoLead}</p>
        <Link href={lp(locale, FL_PATH)} className="home-fingerlock-btn" aria-label={copy.promoAria}>{copy.promoCta}</Link>
      </div>
    </aside>
  );
}
