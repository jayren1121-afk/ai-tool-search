import type { Metadata } from "next";
import Link from "next/link";
import { langAlternates, siteName } from "@/lib/site";
import { lp, OG_LOCALE, type Locale } from "@/lib/i18n";

/** 關於我們／隱私權政策／聯絡我們（中英文） */
export type InfoKind = "about" | "privacy" | "contact";
const EMAIL = "jayren1121@gmail.com";
const UPDATED = "2026-11-02";
const A = "text-indigo-700 hover:underline";

const META: Record<InfoKind, Record<Locale, { title: string; desc: string }>> = {
  about: {
    zh: { title: "關於我們", desc: "認識 jAytal AI 工具搜尋：依分類整理 AI 工具的公開資訊，比較價格與方案，結合站內資料庫與網路搜尋結果。" },
    en: { title: "About Us", desc: "About jAytal AI Tool Search: an AI tool directory that organizes public information on AI tools by category, with search across our database and the web." },
  },
  privacy: {
    zh: { title: "隱私權政策", desc: "jAytal AI 工具搜尋的隱私權政策：我們蒐集哪些資料、Cookie 與 Google AdSense 廣告的使用方式，以及如何聯絡我們。" },
    en: { title: "Privacy Policy", desc: "Privacy policy of jAytal AI Tool Search: what data we collect, how cookies and Google AdSense ads are used, and how to contact us." },
  },
  contact: {
    zh: { title: "聯絡我們", desc: "聯絡 jAytal AI 工具搜尋：工具推薦、資料更正與合作洽詢請來信。" },
    en: { title: "Contact Us", desc: "Contact jAytal AI Tool Search for tool suggestions, corrections, and partnership inquiries." },
  },
};

export function infoMetadata(kind: InfoKind, locale: Locale): Metadata {
  const { title, desc } = META[kind][locale];
  const alt = langAlternates(`/${kind}`, locale);
  return {
    title, description: desc, alternates: alt,
    openGraph: { type: "website", siteName: siteName(locale), title, description: desc, url: alt.canonical, locale: OG_LOCALE[locale] },
  };
}

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mb-2 mt-6 text-lg font-semibold">{children}</h2>;
const Mail = () => <a href={`mailto:${EMAIL}`} className={A}>{EMAIL}</a>;
const Ext = ({ href }: { href: string }) => <a href={href} target="_blank" rel="noopener noreferrer" className={A}>{href}</a>;

function About({ locale }: { locale: Locale }) {
  const contact = <Link href={lp(locale, "/contact")} className={A}>{META.contact[locale].title}</Link>;
  if (locale === "en") return (<>
    <p>jAytal AI Tool Search (jaytaimark.com) is an AI tool directory and search site. We organize publicly available information about AI tools by category so you can quickly find, compare, and choose the right tool.</p>
    <H2>What you can do here</H2>
    <ul className="list-disc space-y-1 pl-6">
      <li><strong>Browse by category</strong>: chatbots, image, video, audio, music, coding, writing and marketing, productivity, design, translation, and more.</li>
      <li><strong>Compare tools</strong>: each tool page summarizes its description, pricing and subscription plans, free tier, and underlying models where that information can be confirmed. Anything we cannot confirm is marked as such.</li>
      <li><strong>Search</strong>: search results combine our own tool database with web results from a third-party search service, so you can also discover tools not yet listed.</li>
      <li><strong>Suggest a site</strong>: if a web result looks like a useful AI tool, you can suggest it. Suggestions are reviewed before being added to the directory.</li>
      <li><strong>Community feedback</strong>: visitors can vote and leave short reviews on tool pages, and run an AI-assisted check that summarizes a tool's current status from public sources.</li>
    </ul>
    <H2>How we handle information</H2>
    <p>Prices and plans change often. We periodically re-check tool websites, but always confirm details on the official site before you subscribe. Some links are referral links; they never affect which tools are listed or how they are described.</p>
    <H2>Get in touch</H2>
    <p>Have a tool to recommend or found an error? See {contact}.</p>
  </>);
  return (<>
    <p>jAytal AI 工具搜尋（jaytaimark.com）是一個 AI 工具目錄與搜尋網站。我們依分類整理各種 AI 工具的公開資訊，讓你能快速找到、比較並挑選適合的工具。</p>
    <H2>你可以在這裡做什麼</H2>
    <ul className="list-disc space-y-1 pl-6">
      <li><strong>依分類瀏覽</strong>：聊天助理、繪圖、影片、語音、音樂、程式、寫作行銷、生產力、設計、翻譯等分類。</li>
      <li><strong>比較工具</strong>：每個工具頁整理功能介紹、價格與訂閱方案、免費額度與使用的模型；無法確認的資訊會標示「無法確認」。</li>
      <li><strong>搜尋</strong>：搜尋結果結合站內工具資料庫與第三方搜尋服務提供的網路結果，也能找到尚未收錄的工具。</li>
      <li><strong>推薦網站</strong>：若網路結果中有實用的 AI 工具，可以按建議收錄，經審核後才會加入目錄。</li>
      <li><strong>社群回饋</strong>：訪客可在工具頁投票、留下簡短評論，也能使用 AI 診斷，依公開資料整理工具的最新狀況。</li>
    </ul>
    <H2>資訊說明</H2>
    <p>工具的價格與方案經常變動，我們會定期重新檢查官網，但訂閱前仍請以官方網站為準。本站部分連結為推薦連結，不會影響工具是否收錄或內容描述。</p>
    <H2>聯絡</H2>
    <p>想推薦工具或發現資料有誤？請見{contact}。</p>
  </>);
}

function Privacy({ locale }: { locale: Locale }) {
  if (locale === "en") return (<>
    <p className="text-sm text-slate-500">Last updated: {UPDATED}</p>
    <p>This policy explains what information jAytal AI Tool Search (jaytaimark.com, "this site") collects and how it is used. You can use this site without creating an account.</p>
    <H2>Information we collect</H2>
    <ul className="list-disc space-y-1 pl-6">
      <li><strong>Search queries</strong>: the keywords you search are processed to return results and may be cached temporarily. Queries may be sent to a third-party web search API to retrieve external results.</li>
      <li><strong>Site suggestions, votes, and reviews</strong>: content you submit (suggested URLs and titles, ratings, review text) is stored in our database, hosted by Supabase.</li>
      <li><strong>Technical data</strong>: to prevent abuse, we process IP addresses for rate limiting and store them only in hashed form where possible. Our hosting provider, Vercel, may record standard server logs (such as IP address, browser type, and request time) and anonymous usage statistics.</li>
      <li><strong>Bot protection</strong>: some forms may use a human verification service (Cloudflare Turnstile), which processes data under its own privacy policy.</li>
    </ul>
    <H2>Cookies</H2>
    <p>This site uses a few functional cookies, for example to remember your language choice, to keep votes from being counted twice, and to remember a completed human verification. You can block or delete cookies in your browser settings, though some features may not work properly.</p>
    <H2>Advertising (Google AdSense)</H2>
    <ul className="list-disc space-y-1 pl-6">
      <li>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.</li>
      <li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet.</li>
      <li>You may opt out of personalized advertising by visiting Google Ads Settings: <Ext href="https://adssettings.google.com" />.</li>
      <li>Learn how Google uses information from sites that use its services: <Ext href="https://policies.google.com/technologies/ads" />.</li>
    </ul>
    <H2>Third-party links and search results</H2>
    <p>External web search results come from third-party APIs. Links to other websites are governed by those websites' own privacy policies. Some links on this site are referral links; if you subscribe through them, this site may earn a commission at no extra cost to you.</p>
    <H2>Changes to this policy</H2>
    <p>We may update this policy from time to time. The date at the top shows the latest revision.</p>
    <H2>Contact</H2>
    <p>For privacy questions or requests, email <Mail />.</p>
  </>);
  return (<>
    <p className="text-sm text-slate-500">最後更新：{UPDATED}</p>
    <p>本政策說明 jAytal AI 工具搜尋（jaytaimark.com，以下稱「本站」）蒐集哪些資訊以及如何使用。使用本站不需要註冊帳號。</p>
    <H2>我們蒐集的資訊</H2>
    <ul className="list-disc space-y-1 pl-6">
      <li><strong>搜尋關鍵字</strong>：你輸入的關鍵字會用來產生搜尋結果，並可能暫時快取；為取得站外結果，關鍵字可能會傳送給第三方網路搜尋 API。</li>
      <li><strong>推薦網站、投票與評論</strong>：你送出的內容（建議的網址與標題、評分、評論文字）會儲存在由 Supabase 託管的資料庫中。</li>
      <li><strong>技術資料</strong>：為防止濫用，我們會使用 IP 位址做流量限制，並盡可能只保存雜湊後的值。網站主機服務商 Vercel 可能記錄一般伺服器紀錄（如 IP 位址、瀏覽器類型、請求時間）與匿名的使用統計。</li>
      <li><strong>防機器人驗證</strong>：部分表單可能使用人機驗證服務（Cloudflare Turnstile），其資料處理依該服務的隱私權政策。</li>
    </ul>
    <H2>Cookie</H2>
    <p>本站使用少量功能性 Cookie，例如記住你選擇的語言、避免重複投票、記住已完成的人機驗證。你可以在瀏覽器設定中封鎖或刪除 Cookie，但部分功能可能無法正常運作。</p>
    <H2>廣告（Google AdSense）</H2>
    <ul className="list-disc space-y-1 pl-6">
      <li>包括 Google 在內的第三方廠商會使用 Cookie，根據使用者先前造訪本站或其他網站的紀錄來放送廣告。</li>
      <li>Google 使用廣告 Cookie，讓 Google 及其合作夥伴能依據使用者造訪本站和（或）網際網路上其他網站的情況，向使用者放送廣告。</li>
      <li>你可以前往 Google 廣告設定停用個人化廣告：<Ext href="https://adssettings.google.com" />。</li>
      <li>了解 Google 如何使用合作網站的資訊：<Ext href="https://policies.google.com/technologies/ads" />。</li>
    </ul>
    <H2>第三方連結與搜尋結果</H2>
    <p>站外網路搜尋結果來自第三方 API。前往其他網站後，適用該網站的隱私權政策。本站部分連結為推薦連結，透過連結訂閱，本站可能獲得分潤，不影響你的價格。</p>
    <H2>政策修訂</H2>
    <p>本政策可能不定期更新，最新修訂日期以頁首標示為準。</p>
    <H2>聯絡我們</H2>
    <p>有任何隱私權相關問題或請求，請來信 <Mail />。</p>
  </>);
}

function Contact({ locale }: { locale: Locale }) {
  if (locale === "en") return (<>
    <p>Email: <Mail /></p>
    <p className="mt-3">Feel free to write to us about:</p>
    <ul className="mt-2 list-disc space-y-1 pl-6">
      <li><strong>Tool suggestions</strong>: an AI tool you think should be listed.</li>
      <li><strong>Corrections</strong>: outdated pricing, plans, or descriptions on any tool page.</li>
      <li><strong>Partnership inquiries</strong>: collaboration or other business questions.</li>
    </ul>
    <p className="mt-3">Please include the tool name or page link so we can respond faster.</p>
  </>);
  return (<>
    <p>電子郵件：<Mail /></p>
    <p className="mt-3">歡迎來信：</p>
    <ul className="mt-2 list-disc space-y-1 pl-6">
      <li><strong>工具推薦</strong>：你認為值得收錄的 AI 工具。</li>
      <li><strong>資料更正</strong>：工具頁上過時的價格、方案或介紹。</li>
      <li><strong>合作洽詢</strong>：合作或其他商務問題。</li>
    </ul>
    <p className="mt-3">來信時請附上工具名稱或頁面連結，方便我們更快處理。</p>
  </>);
}

export default function InfoPageView({ kind, locale }: { kind: InfoKind; locale: Locale }) {
  const Body = kind === "about" ? About : kind === "privacy" ? Privacy : Contact;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <article className="rounded-xl bg-white p-6 leading-relaxed text-slate-700 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-slate-800">{META[kind][locale].title}</h1>
        <Body locale={locale} />
      </article>
    </main>
  );
}
