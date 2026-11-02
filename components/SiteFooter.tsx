"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { lp, splitPath, t } from "@/lib/i18n";

export const CONTACT_EMAIL = "jayren1121@gmail.com";

/** 全站頁尾：版權、關於我們、隱私權政策、聯絡我們 */
export default function SiteFooter() {
  const { locale, base } = splitPath(usePathname() || "/");
  if (base.startsWith("/admin")) return null;
  const L = t(locale);
  const links = [
    { href: lp(locale, "/about"), label: L.aboutTitle },
    { href: lp(locale, "/privacy"), label: L.privacyTitle },
    { href: lp(locale, "/contact"), label: L.contactTitle },
  ];
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} {L.footerCopy}</span>
        <nav aria-label={L.footerNav} className="flex flex-wrap gap-4">
          {links.map((x) => <Link key={x.href} href={x.href} className="hover:text-indigo-700 hover:underline">{x.label}</Link>)}
        </nav>
        <span>{L.contact}<a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-700 hover:underline">{CONTACT_EMAIL}</a></span>
      </div>
    </footer>
  );
}
