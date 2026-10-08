"use client";
import { usePathname } from "next/navigation";
import { HTML_LANG, splitPath } from "@/lib/i18n";

/** 依網址決定 <html lang>（/en 開頭為英文），伺服器端渲染時即輸出正確屬性，不影響靜態快取 */
export default function HtmlLang({ children }: { children: React.ReactNode }) {
  const { locale } = splitPath(usePathname() || "/");
  return <html lang={HTML_LANG[locale]}>{children}</html>;
}
