"use client";
import { usePathname } from "next/navigation";
import { splitPath } from "@/lib/i18n";

const TEXT = {
  zh: "本站部分連結為推薦連結，透過連結訂閱，本站可能獲得分潤，不影響你的價格。",
  en: "Some links on this site are referral links. If you subscribe through them, this site may earn a commission at no extra cost to you.",
} as const;

/** 全站分潤揭露（推薦連結說明），依網址顯示中文或英文；後台不顯示 */
export default function AffiliateDisclosure() {
  const path = usePathname() || "/";
  if (path.startsWith("/admin")) return null;
  const { locale } = splitPath(path);
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-slate-400">
      {locale === "en" ? TEXT.en : TEXT.zh}
    </div>
  );
}
