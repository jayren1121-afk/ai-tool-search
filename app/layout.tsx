import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SITE_DESC, SITE_NAME, SITE_SHORT, SITE_URL } from "@/lib/site";
import HtmlLang from "@/components/HtmlLang";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_SHORT}` },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESC, url: "/", locale: "zh_TW", images: [{ url: "/logo.png", alt: SITE_NAME }] },
  twitter: { card: "summary", title: SITE_NAME, description: SITE_DESC, images: ["/logo.png"] },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

// <html lang> 由 HtmlLang 依網址設定（中文 zh-Hant-TW、/en 為 en）
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <HtmlLang><body className="bg-slate-50 text-slate-800"><SiteHeader />{children}</body></HtmlLang>;
}
