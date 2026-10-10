import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SITE_DESC, SITE_NAME, SITE_SHORT, SITE_URL } from "@/lib/site";
import { Inter, Noto_Sans_TC } from "next/font/google";
import HtmlLang from "@/components/HtmlLang";
import SiteHeader from "@/components/SiteHeader";

// 字體：display swap、限制子集與字重；Noto Sans TC 為 unicode-range 切片，只會下載頁面實際用到的字
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });
const noto = Noto_Sans_TC({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap", preload: false, variable: "--font-noto-tc" });

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
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5eed8" };

// <html lang> 由 HtmlLang 依網址設定（中文 zh-Hant-TW、/en 為 en）
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <HtmlLang><body className={`${inter.variable} ${noto.variable} bg-slate-50 text-slate-800`}><SiteHeader />{children}</body></HtmlLang>;
}
