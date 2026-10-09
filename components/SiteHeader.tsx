"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HTML_LANG, LANG_COOKIE, lp, splitPath, t, type Locale } from "@/lib/i18n";

/** 全站頁首：網站名稱 + 語言切換（連到對應語言的同一頁，並記住選擇） */
export default function SiteHeader() {
  const { locale, base } = splitPath(usePathname() || "/");
  const other: Locale = locale === "en" ? "zh" : "en";
  const href = lp(other, base);
  const L = t(locale);
  const remember = () => { document.cookie = `${LANG_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`; };
  return (
    <header className="border-b border-slate-200 bg-white/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 text-sm">
        <Link href={lp(locale, "/")} className="font-semibold text-slate-700 hover:text-indigo-700">{L.siteName}</Link>
        {!base.startsWith("/admin") && <a href={href} hrefLang={HTML_LANG[other]} lang={HTML_LANG[other]} onClick={remember} title={L.switchLabel}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50">🌐 {L.switchTo}</a>}
      </div>
    </header>
  );
}
