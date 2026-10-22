"use client";

import { usePathname } from "next/navigation";

// AdSense 驗證爬蟲只看 HTML。App Router 的 next/script 會把網址放進 __next_s，爬蟲認不得，所以用原始 script。
const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2417527837622782";

/** FingerLock 下載頁不放廣告腳本；其餘頁面（含首頁）在伺服器輸出的 <head> 裡帶這段標籤 */
function isFingerLockDownload(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/tools/fingerlock" || path === "/en/tools/fingerlock";
}

export default function AdSenseScript() {
  if (isFingerLockDownload(usePathname() || "/")) return null;
  return <script async src={ADSENSE_SRC} crossOrigin="anonymous" />;
}
