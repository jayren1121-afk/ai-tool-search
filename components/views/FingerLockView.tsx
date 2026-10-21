import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import FingerLockStepper from "@/components/FingerLockStepper";
import FingerLockVerify from "@/components/FingerLockVerify";
import { FL, FL_LINKS, FL_PATH } from "@/lib/fingerlock";
import { HTML_LANG, lp, OG_LOCALE, t, type Locale } from "@/lib/i18n";
import { jsonLd, langAlternates, siteName, SITE_URL } from "@/lib/site";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export function fingerlockMetadata(locale: Locale): Metadata {
  const copy = FL[locale];
  const alt = langAlternates(FL_PATH, locale);
  return {
    title: copy.metaTitle,
    description: copy.metaDesc,
    alternates: alt,
    applicationName: siteName(locale),
    openGraph: {
      type: "website", siteName: siteName(locale), title: copy.metaTitle, description: copy.metaDesc,
      url: alt.canonical, locale: OG_LOCALE[locale], images: [{ url: "/fingerlock/setup-form.png", alt: copy.title }],
    },
    twitter: { card: "summary_large_image", title: copy.metaTitle, description: copy.metaDesc, images: ["/fingerlock/setup-form.png"] },
  };
}

export default function FingerLockView({ locale }: { locale: Locale }) {
  const copy = FL[locale];
  const L = t(locale);
  const pageUrl = SITE_URL + lp(locale, FL_PATH);
  const ld = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication",
      name: "FingerLock", url: pageUrl, downloadUrl: FL_LINKS.exe, description: copy.metaDesc,
      applicationCategory: "SecurityApplication", operatingSystem: "Windows 10, Windows 11",
      inLanguage: HTML_LANG[locale], isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", url: FL_LINKS.exe },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList", inLanguage: HTML_LANG[locale],
      itemListElement: [
        { "@type": "ListItem", position: 1, name: L.home, item: SITE_URL + lp(locale, "/") },
        { "@type": "ListItem", position: 2, name: "FingerLock", item: pageUrl },
      ],
    },
  ];

  return (
    <main className="fingerlock-page mx-auto max-w-3xl p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Breadcrumb locale={locale} items={[{ name: L.home, href: lp(locale, "/") }, { name: "FingerLock" }]} />
      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h1>{copy.title}</h1>
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          {copy.badges.map((b) => <span key={b} className="rounded bg-emerald-50 px-2 py-0.5">{b}</span>)}
        </div>
        <p className="mt-3 text-slate-700">{copy.lede}</p>
        <div className="fingerlock-actions">
          <a className="fingerlock-download fingerlock-download-primary" href={FL_LINKS.exe} {...ext}>{copy.downloadExe}</a>
          <p className="fingerlock-meta">{copy.fileMeta}</p>
          <div className="fingerlock-secondary">
            <a className="fingerlock-manual-btn" href={FL_LINKS.manualZh} {...ext}>{copy.manualShortZh}</a>
            <a className="fingerlock-manual-btn" href={FL_LINKS.manualEn} {...ext}>{copy.manualShortEn}</a>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">{copy.smartScreen}</p>
        <FingerLockVerify locale={locale} />

        <h2 className="mt-6 text-lg font-semibold">{copy.featuresTitle}</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
          {copy.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </article>

      <section className="mt-6" aria-labelledby="fl-quick">
        <h2 id="fl-quick" className="mb-3 text-lg font-semibold">{copy.quickTitle}</h2>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <FingerLockStepper locale={locale} />
          <aside className="fingerlock-manuals rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="fl-manuals">
            <h2 id="fl-manuals" className="text-lg font-semibold">{copy.manualsTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{copy.manualsLead}</p>
            <a className="fingerlock-download" href={FL_LINKS.manualZh} {...ext}>{copy.manualZh}</a>
            <a className="fingerlock-download" href={FL_LINKS.manualEn} {...ext}>{copy.manualEn}</a>
          </aside>
        </div>
      </section>

      <section className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-amber-800" aria-labelledby="fl-warn">
        <h2 id="fl-warn" className="text-base font-semibold">{copy.disclaimerTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {copy.disclaimer.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
    </main>
  );
}
