import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "AI 工具搜尋", description: "搜尋 AI 工具並由 AI 即時診斷" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-Hant"><body className="bg-slate-50 text-slate-800">{children}</body></html>;
}
