// 報告模式的 CSP 只記錄、不擋請求。HSTS 與 Vercel 目前送出的值相同。
// AdSense 自動廣告會用到這些來源。*.google.com 已含 adservice.google.com 與
// fundingchoicesmessages.google.com；*.googlesyndication.com 已含 pagead2 與 tpc。
// 仍寫上個別主機，方便對照 AdSense 要求。*.doubleclick.net 只比對一層子網域，
// 廣告 iframe 在 googleads.g.doubleclick.net，所以另外允許 *.g.doubleclick.net。
const adsenseSources = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://*.g.doubleclick.net",
  "https://*.google.com",
  "https://*.gstatic.com",
  "https://adservice.google.com",
  "https://tpc.googlesyndication.com",
  "https://fundingchoicesmessages.google.com",
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com " + adsenseSources,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + adsenseSources,
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com " + adsenseSources,
  "frame-src https://challenges.cloudflare.com " + adsenseSources,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }, { source: "/", headers: securityHeaders }];
  },
};

export default nextConfig;
