// 輕量字典式 i18n（無外部套件）：伺服器與用戶端元件共用，透過 locale prop 傳遞
import { CATEGORIES, PRICING, type Tool } from "./types";
import { FREE_TIER_EN, SUBCATEGORY_EN } from "./i18n-data";

export type Locale = "zh" | "en";
export const LOCALES: Locale[] = ["zh", "en"];
export const DEFAULT_LOCALE: Locale = "zh";
export const LANG_COOKIE = "lang";
export const HTML_LANG: Record<Locale, string> = { zh: "zh-Hant-TW", en: "en" };
export const OG_LOCALE: Record<Locale, string> = { zh: "zh_TW", en: "en_US" };
export const isLocale = (v: unknown): v is Locale => v === "zh" || v === "en";

/* ---------- 路徑 ---------- */
/** 中文維持原網址；英文加上 /en 前綴 */
export const lp = (loc: Locale, path: string) => (loc === "en" ? (path === "/" ? "/en" : `/en${path}`) : path);
export const toolHref = (loc: Locale, id: string) => lp(loc, `/tools/${encodeURIComponent(id)}`);
export const categoryHref = (loc: Locale, k: string) => lp(loc, `/category/${encodeURIComponent(k)}`);
/** 由目前路徑推算語言與「去掉 /en 的中文路徑」 */
export function splitPath(pathname: string): { locale: Locale; base: string } {
  if (pathname === "/en" || pathname.startsWith("/en/")) return { locale: "en", base: pathname.slice(3) || "/" };
  return { locale: "zh", base: pathname || "/" };
}

/* ---------- 分類 ---------- */
export const CATEGORIES_EN: Record<string, string> = {
  chatbot: "Chatbot", image: "Image", video: "Video", audio: "Audio & Voice", music: "Music", coding: "Coding",
  writing_marketing: "Writing & Marketing", productivity: "Productivity", search_research: "Search & Research", design: "Design",
  presentation: "Presentation", agents_automation: "Agents & Automation", translation: "Translation", data_analytics: "Data Analytics",
  education: "Education", legal: "Legal", health: "Health", hr: "HR", sales: "Sales", finance: "Finance",
  seo: "SEO", customer_service: "Customer Service", "3d": "3D", avatar: "Avatar & Digital Human",
};
export const CATEGORY_INTRO_EN: Record<string, string> = {
  chatbot: "General-purpose AI chat assistants and LLM platforms such as ChatGPT, Claude and Gemini. Compare free tiers, subscription prices and underlying models.",
  image: "AI image generation, photo editing, background removal and upscaling tools. Compare output quality, commercial licensing and pricing.",
  video: "AI video generation, editing, captioning and short-form video tools for marketing, social media and creators.",
  audio: "AI text-to-speech (TTS), voice cloning, speech recognition and meeting transcription tools.",
  music: "AI music composition, song generation and soundtrack tools. Compare licensing and subscription plans.",
  coding: "AI coding assistants, AI IDEs, coding agents and app builders that help developers work faster.",
  writing_marketing: "AI writing, paraphrasing, marketing copy and social media content tools.",
  productivity: "AI productivity tools for notes, meeting minutes, scheduling, email and knowledge management.",
  search_research: "AI search engines and academic research tools with cited answers and literature discovery.",
  design: "AI graphic design, UI design, logo and website building tools.",
  presentation: "AI presentation generators, mind maps and visual diagram tools.",
  agents_automation: "AI agents, workflow automation and agent development frameworks.",
  translation: "AI translation, localization and video dubbing tools.",
  data_analytics: "AI data analysis, business intelligence, spreadsheet and data infrastructure tools.",
  education: "AI tutors, language learning, academic writing and tools for teachers.",
  legal: "AI legal research, contract drafting and review tools.",
  health: "Healthcare AI: clinical documentation, medical search and care tools.",
  hr: "AI recruiting, resume, interviewing and talent management tools.",
  sales: "AI sales prospecting, CRM, lead generation and cold email tools.",
  finance: "AI financial research, investment analysis and corporate finance automation tools.",
  seo: "AI SEO content optimization and AI search visibility tracking tools.",
  customer_service: "AI customer service chatbots and support agent platforms.",
  "3d": "AI 3D model generation, motion capture and game asset tools.",
  avatar: "AI digital humans, virtual presenters and face-swap video tools.",
};
export const catName = (loc: Locale, k: string) => (loc === "en" ? CATEGORIES_EN[k] : CATEGORIES[k]) ?? k;
export const PRICING_EN: Record<string, string> = { free: "Free", freemium: "Freemium", paid: "Paid", "open-source": "Open source" };
export const pricingName = (loc: Locale, k: string | null | undefined) => (k ? (loc === "en" ? PRICING_EN[k] : PRICING[k]) ?? k : null);

/** 工具描述：英文頁面用 description_en，缺少時以名稱與分類組成中性說明（不杜撰） */
export function toolDesc(loc: Locale, x: Pick<Tool, "name" | "category" | "description_zh"> & { description_en?: string | null }) {
  if (loc !== "en") return x.description_zh || null;
  return x.description_en?.trim() || `${x.name} is an AI tool in the ${catName("en", x.category)} category.`;
}
export const toolFeatures = (loc: Locale, x: Pick<Tool, "key_features"> & { key_features_en?: string[] | null }) =>
  loc === "en" ? (Array.isArray(x.key_features_en) ? x.key_features_en : []) : x.key_features || [];

/* ---------- 資料欄位翻譯（英文頁面；查無對應時保留原文） ---------- */
const CJK = /[\u3400-\u9fff]/;
export function trSub(loc: Locale, v: string | null | undefined) { return !v ? v ?? null : loc === "en" ? SUBCATEGORY_EN[v] ?? v : v; }
export function trFree(loc: Locale, v: string | null | undefined) {
  if (!v || loc !== "en") return v ?? null;
  const m = v.match(/^官網頁面提及「(.+)」$/);
  if (m) return `Website mentions “${m[1]}”`;
  return FREE_TIER_EN[v] ?? v;
}
const MODEL_REPL: [RegExp, string][] = [
  [/^官網提及:\s*/, "Mentioned on website: "], [/基於第三方 LLM/g, "based on third-party LLMs"], [/Google 自家模型/g, "Google's own models"],
  [/多家 LLM 與圖像模型/g, "multiple LLMs and image models"], [/多家 LLM/g, "multiple LLMs"], [/任一 LLM/g, "any LLM"],
  [/第三方 LLM \(如 Claude\)/g, "third-party LLMs (e.g. Claude)"], [/排程演算法/g, "scheduling algorithm"], [/擴散模型/g, "diffusion models"],
  [/第三方語音模型/g, "third-party speech models"], [/語音模型/g, "speech models"], [/\s*等開源模型/g, " and other open-source models"], [/\s*等第三方 LLM/g, " and other third-party LLMs"], [/\s*系列/g, " series"], [/\s*等第三方模型/g, " and other third-party models"], [/自家模型/g, "in-house models"], [/第三方語音模型/g, "third-party speech models"], [/開源模型/g, "open-source models"], [/社群模型/g, "community models"], [/第三方模型/g, "third-party models"],
  [/第三方 LLM/g, "third-party LLMs"], [/第三方/g, "third-party"], [/自家/g, "in-house"], [/模型/g, "models"], [/、/g, ", "], [/\s*等$/g, " etc."], [/\s*等(?=\s|$|\))/g, " etc."],
];
export function trModels(loc: Locale, v: string | null | undefined) {
  if (!v || loc !== "en") return v ?? null;
  let s = v; for (const [re, rep] of MODEL_REPL) s = s.replace(re, rep);
  return CJK.test(s) ? v : s;
}
const NOTE_EN: Record<string, string> = {
  "自官網頁面自動擷取，可能為年繳月均價，需人工確認": "Auto-extracted from the website; may be an annual plan's monthly equivalent; needs manual confirmation",
  "依既有知識，未於官網即時確認": "Based on prior knowledge; not confirmed live on the website",
};
export const trNote = (loc: Locale, v: string | null | undefined) => (!v || loc !== "en" ? v ?? null : NOTE_EN[v] ?? v);
const PLAN_NAME_EN: Record<string, string> = { "Microsoft 365 Personal/Family 含 Copilot": "Microsoft 365 Personal/Family with Copilot" };
export const trPlanName = (loc: Locale, v: string) => (loc === "en" ? PLAN_NAME_EN[v] ?? v : v);

/** 熱度明細標籤（儲存在資料庫的是中文） */
const HEAT_EN: Record<string, string> = {
  "站內瀏覽（30 天）": "Site views (30 days)", "站內投票數": "Site votes", "站內評論數": "Site reviews",
  "AI 診斷次數（30 天）": "AI diagnoses (30 days)", "Hacker News 提及（90 天，以官網網域比對）": "Hacker News mentions (90 days, by website domain)",
  "GitHub Stars": "GitHub stars", "官網未發現 GitHub 專案": "No GitHub project found on website",
  "無法讀取官網，未偵測 GitHub 專案": "Website unreadable; GitHub project not detected", "官網為共用網域，無法比對": "Website uses a shared domain; cannot match",
};
export function trHeat(loc: Locale, v: string | undefined) {
  if (!v || loc !== "en") return v;
  const m = v.match(/^自動偵測：(.+)$/); if (m) return `Auto-detected: ${m[1]}`;
  return HEAT_EN[v] ?? v;
}
/** 口碑來源清單（例如「Hacker News（6 則）」） */
export function trChecked(loc: Locale, v: string) {
  if (loc !== "en") return v;
  return v.replace(/（(\d+) 則）/, " ($1)").replace(/（無法存取，可能被封鎖）/, " (unreachable, possibly blocked)").replace(/（連線失敗）/, " (request failed)")
    .replace(/^口碑來源（全部失敗）$/, "All community sources failed").replace(/^網路搜尋 API/, "Web search API").replace(/^Tavily 搜尋/, "Tavily search").replace(/^Brave 搜尋/, "Brave search");
}
/** API 錯誤訊息（伺服器回傳中文）→ 英文 */
const ERR_EN: Record<string, string> = {
  "無效的 toolId": "Invalid tool ID", "請求過於頻繁": "Too many requests", "來源不被允許": "Origin not allowed",
  "請求格式錯誤或過大": "Malformed or oversized request", "請求格式錯誤": "Malformed request", "參數錯誤": "Invalid parameters",
  "找不到工具": "Tool not found", "找不到評論": "Review not found", "請先完成人機驗證": "Please complete the human verification first",
  "請求過於頻繁，請一分鐘後再試": "Too many requests, please try again in a minute", "今日診斷次數已達上限，請明天再試": "Daily diagnosis limit reached, please try again tomorrow",
  "今日全站診斷額度已用完，請明天再試": "The site's daily diagnosis quota is used up, please try again tomorrow",
  "伺服器未設定任何 LLM API 金鑰": "No LLM API key is configured on the server", "AI 診斷失敗，請稍後再試": "AI diagnosis failed, please try again later",
  "不能對自己的評論按有幫助": "You can't mark your own review as helpful", "操作太頻繁": "Too many actions, slow down", "操作失敗": "Action failed",
  "評論功能尚未啟用": "Reviews are not enabled yet", "投票功能尚未啟用": "Voting is not enabled yet", "投票太頻繁，請稍後再試": "Voting too often, please try again later",
  "投票失敗": "Vote failed", "此網路對該工具的投票數已達上限": "Vote limit for this tool reached from your network",
  "此網路對該工具的評論數已達上限": "Review limit for this tool reached from your network", "與其他評論內容重複": "Duplicate of another review",
  "評論內容需 10–500 字": "Review must be 10–500 characters", "請選擇 1–5 星": "Please choose 1–5 stars", "送出太頻繁，請稍後再試": "Submitting too often, please try again later",
  "送出失敗": "Submit failed", "評論中最多只能包含 1 個連結": "Reviews may contain at most 1 link", "評論包含不允許的內容": "Review contains disallowed content",
  "請勿輸入大量重複字元": "Please don't repeat characters excessively", "內容重複度過高": "Content is too repetitive",
  "回報失敗，請稍後再試": "Report failed, please try again later", "回報次數過多，請稍後再試": "Too many reports, please try again later",
  "無效的 diagnosisId": "Invalid diagnosis ID", "請輸入 1–500 字的說明": "Please enter 1–500 characters",
  "無法載入人機驗證": "Couldn't load human verification", "人機驗證失敗，請重新整理頁面再試": "Human verification failed, please reload and try again",
  "人機驗證逾時": "Human verification timed out", "未設定人機驗證": "Human verification not configured", "載入失敗": "Failed to load",
};
export function trError(loc: Locale, v: string | undefined | null) {
  if (!v) return v ?? "";
  if (loc !== "en") return v;
  return ERR_EN[v] ?? (CJK.test(v) ? "Request failed, please try again later" : v);
}

/* ---------- 介面字串 ---------- */
const zh = {
  siteName: "jAytal AI 工具搜尋", home: "首頁", unknown: "無法確認", unverified: "未核實", loading: "載入中…",
  langName: "中文", switchTo: "English", switchLabel: "Switch to English",
  // 首頁 / 搜尋
  heroSub: "搜尋 AI 工具，點「診斷」由 AI 即時分析價位與訂閱方案。",
  searchPh: "搜尋名稱、描述，例如：影片、Claude、簡報…", allCats: "所有分類", allPricing: "所有計價", sortLabel: "排序",
  sortName: "依名稱", sortVotes: "好評優先", searching: "搜尋中…", results: (n: number) => `${n} 筆結果`,
  resultsCap: (n: number) => `（最多顯示 ${n} 筆，請輸入更精確的關鍵字）`, queryFailed: "查詢失敗：", website: "官網 ↗", diagnose: "診斷",
  browseCats: "依分類瀏覽 AI 工具", homeNote: "資料由公開網頁自動整理，AI 診斷僅供參考，價格請以官網為準。",
  footerCopy: "jAytal AI 工具搜尋", contact: "聯絡我們：",
  // 投票
  votes: "站內使用者投票", noVotes: "尚無投票", good: (p: number) => `${p}% 好評`, goodVotes: (p: number, n: number) => `${p}% 好評（${n} 票）`,
  firstVote: "成為第一個投票的人", voteFailed: "投票失敗",
  // 工具頁
  toolTitle: (n: string) => `${n} 價格、方案與評價`, aiDiagnose: "AI 即時診斷", visitSite: "前往官網 ↗", pricingPlans: "價格與方案",
  pricingModel: "計價模式", paidPlans: "付費方案", freeTier: "免費方案", pricingPage: "價格頁", perMonth: "/月",
  modelTech: "公司資訊", wrapper: "是否套殼", models: "底層模型", company: "公司", lastVerified: "最後核實",
  toolDisclaimer: "⚠️ 本頁資料由公開網頁自動整理，價格與方案可能已變動，請以官網為準；「AI 即時診斷」為 AI 自動分析，僅供參考；使用者評論為個人意見。",
  otherInCat: (c: string) => `其他${c}工具`, allInCat: (c: string) => `查看全部${c}工具 →`, toolNotFound: "找不到此工具",
  wrapperFull: { true: "是（使用第三方模型）", false: "否（自有模型）", partial: "部分使用第三方模型", unknown: "無法確認" } as Record<string, string>,
  wrapperShort: { true: "是", false: "否（自有模型）", partial: "部分" } as Record<string, string>,
  // 分類頁
  catTitle: (c: string) => `${c} AI 工具推薦與價格比較`, catH1: (c: string) => `${c} AI 工具`, catCount: (n: number) => `共 ${n} 個工具・價格與方案以官網為準`,
  otherCats: "其他分類", catNotFound: "找不到此分類",
  // 社群
  likeIt: "你覺得好用嗎？", heat: "熱度", reviews: "使用者評論", altCompare: "替代方案比較", communityErr: "社群資料暫時無法載入。", loadingCommunity: "載入使用者評價…",
  heatOff: "熱度功能尚未啟用。", heatPending: "熱度資料計算中，稍後重新開啟即可看到（每日更新一次）。",
  heatRel: "相對熱度（0–100），依下列真實數據計算，非實際流量", heatSrc: "來源", heatVal: "數值", heatPts: "分數",
  heatUpdated: (d: string) => `更新時間：${d}（每日最多更新一次）。Google 搜尋趨勢沒有官方 API，因此未納入。`,
  buzzOld: "此為舊版診斷，尚未包含網路口碑；可按下方「重新診斷」取得（距上次診斷需超過 24 小時）。",
  overall: "整體風評：", praise: "常見稱讚", complaints: "常見抱怨",
  buzzNote: (n: number, c: string) => `僅根據實際抓到的 ${n} 則公開討論片段由 AI 歸納；已查詢：${c}。討論可能不具代表性。`, none: "無", listSep: "、",
  noAlts: "同分類中沒有可比較的替代方案。", altTool: "工具", altPricing: "計價", altMin: "最低月費", altFree: "免費方案", altWrapper: "套殼", altGood: "好評",
  aiCompare: "AI 比較：", aiCompareNote: "（僅依上表資料庫欄位）", altFoot: "價格僅列出經核實的方案；表格資料來自本站資料庫，請以各官網為準。",
  stars: (n: number) => `${n} 星`, noReviews: "尚無評論", reviewCount: (n: number) => `（${n} 則評論）`, sortNew: "最新", sortHelpful: "最有幫助",
  editMine: "編輯我的評論", reviewDisclaimer: "評論為使用者個人意見，不代表本站立場。不當內容可按「回報錯誤」通知管理員。",
  myReview: "我的評論", helpful: (n: number) => `👍 有幫助（${n}）`, actionFailed: "操作失敗",
  editReview: "編輯評論", writeReview: "寫評論", useCasePh: "使用情境（選填），例如：寫行銷文案、課堂作業", contentPh: "分享你的實際使用心得（10–500 字）",
  submit: "送出", submitting: "送出中…", cancel: "取消", updated: "已更新評論", thanks: "感謝你的評論！", submitFailed: "送出失敗",
  // 診斷面板
  tabBuzz: "口碑", tabHeat: "熱度", tabReviews: "評論", tabAlts: "替代方案", tabOfficial: "官網最新資訊",
  close: "關閉", dbData: "資料庫資料", category: "分類", pricing: "計價", wrapperS: "套殼",
  aiDisclaimer: "⚠️ AI 自動分析，僅供參考。價格與方案請以官網為準。", analyzing: "正在抓取官網並分析…（約 10–30 秒）", retry: "重試",
  diagFailed: "診斷失敗", worth: "值得使用", notRec: "不太推薦", dataQuality: "資料品質：", price: "價位", plans: "訂閱方案", summary: "重點摘要",
  pros: "優點", cons: "缺點", sources: "資料來源", evidence: "依據", evidenceUnverified: "（未能在網頁中核對）",
  conf: { high: "高可信", medium: "中可信", low: "低可信" } as Record<string, string>,
  diagTime: "AI 診斷時間：", model: "模型：", cached: "快取結果", fresh: "新產生", oldV1: "｜舊版診斷（無逐欄信心與引用）", oldV2: "｜舊版診斷（無替代方案說明）",
  diagBanner: (d: string) => `📅 此為 ${d} 的診斷結果（結果保留 7 天，期間內所有人看到的都是這一份）。想了解最新狀況，請按下方「重新診斷」。`, dateFmt: (t: string) => { const x = new Date(t); return `${x.getFullYear()} 年 ${x.getMonth() + 1} 月 ${x.getDate()} 日`; },
  rediagnose: "重新診斷", report: "回報錯誤", reportThanks: "已收到回報，謝謝！", reportPh: "哪裡有誤？例如：價格已調整為…（最多 500 字）", reportFailed: "回報失敗",
  dateLocale: "zh-TW", breadcrumb: "麵包屑",
  // v10 推出日期／最新上架
  sortNewest: "最新上架", released: "推出日期",
  releasedHint: "依公開來源可查到的最早日期，不一定是官方正式發售日",
  relSrc: { github_created: "GitHub 建立日", hn_post: "最早公開討論日", wikidata_p577: "Wikidata", wikidata_p571: "Wikidata", wikidata: "Wikidata", producthunt_launch: "Product Hunt 上架日", manual: "人工確認" } as Record<string, string>,
};
type Dict = typeof zh;
const en: Dict = {
  siteName: "jAytal AI Tool Search", home: "Home", unknown: "Unknown", unverified: "Not verified", loading: "Loading…",
  langName: "English", switchTo: "中文", switchLabel: "切換為繁體中文",
  heroSub: "Search AI tools and click “Diagnose” for a live AI analysis of pricing, plans and plans.",
  searchPh: "Search names or descriptions, e.g. video, Claude, slides…", allCats: "All categories", allPricing: "All pricing", sortLabel: "Sort",
  sortName: "By name", sortVotes: "Top rated", searching: "Searching…", results: (n) => `${n} result${n === 1 ? "" : "s"}`,
  resultsCap: (n) => ` (showing up to ${n}; try a more specific keyword)`, queryFailed: "Search failed: ", website: "Website ↗", diagnose: "Diagnose",
  browseCats: "Browse AI tools by category", homeNote: "Data is compiled automatically from public web pages. AI diagnoses are for reference only; check official websites for current prices.",
  footerCopy: "jAytal AI Tool Search", contact: "Contact: ",
  votes: "Votes from site users", noVotes: "No votes yet", good: (p) => `${p}% positive`, goodVotes: (p, n) => `${p}% positive (${n} vote${n === 1 ? "" : "s"})`,
  firstVote: "Be the first to vote", voteFailed: "Vote failed",
  toolTitle: (n) => `${n} Pricing, Plans & Reviews`, aiDiagnose: "Live AI Diagnosis", visitSite: "Visit website ↗", pricingPlans: "Pricing & Plans",
  pricingModel: "Pricing model", paidPlans: "Paid plans", freeTier: "Free tier", pricingPage: "Pricing page", perMonth: "/mo",
  modelTech: "Company info", wrapper: "Wrapper?", models: "Underlying models", company: "Company", lastVerified: "Last verified",
  toolDisclaimer: "⚠️ This page is compiled automatically from public web pages. Prices and plans may have changed, so check the official website. “Live AI Diagnosis” is an automated AI analysis for reference only. User reviews are personal opinions.",
  otherInCat: (c) => `Other ${c} tools`, allInCat: (c) => `See all ${c} tools →`, toolNotFound: "Tool not found",
  wrapperFull: { true: "Yes (uses third-party models)", false: "No (own models)", partial: "Partly uses third-party models", unknown: "Unknown" },
  wrapperShort: { true: "Yes", false: "No (own model)", partial: "Partly" },
  catTitle: (c) => `Best ${c} AI Tools: Pricing & Comparison`, catH1: (c) => `${c} AI Tools`, catCount: (n) => `${n} tools · check official websites for current prices and plans`,
  otherCats: "Other categories", catNotFound: "Category not found",
  likeIt: "Do you find it useful?", heat: "Popularity", reviews: "User Reviews", altCompare: "Alternatives Compared", communityErr: "Community data is temporarily unavailable.", loadingCommunity: "Loading user ratings…",
  heatOff: "Popularity is not enabled yet.", heatPending: "Popularity is being calculated; reopen later to see it (updated once a day).",
  heatRel: "Relative popularity (0–100) computed from the real data below; not actual traffic", heatSrc: "Source", heatVal: "Value", heatPts: "Points",
  heatUpdated: (d) => `Updated: ${d} (at most once a day). Google Trends has no official API, so it is not included.`,
  buzzOld: "This is an older diagnosis without community buzz; press “Re-diagnose” below to get it (requires 24 hours since the last diagnosis).",
  overall: "Overall sentiment: ", praise: "Common praise", complaints: "Common complaints",
  buzzNote: (n, c) => `Summarized by AI only from the ${n} public discussion snippets actually retrieved. Checked: ${c}. Discussions may not be representative.`, none: "none", listSep: ", ",
  noAlts: "No comparable alternatives in the same category.", altTool: "Tool", altPricing: "Pricing", altMin: "From /mo", altFree: "Free tier", altWrapper: "Wrapper", altGood: "Positive",
  aiCompare: "AI comparison: ", aiCompareNote: " (based only on the database fields above)", altFoot: "Only verified prices are listed. Table data comes from this site's database; check each official website.",
  stars: (n) => `${n} star${n === 1 ? "" : "s"}`, noReviews: "No reviews yet", reviewCount: (n) => ` (${n} review${n === 1 ? "" : "s"})`, sortNew: "Newest", sortHelpful: "Most helpful",
  editMine: "Edit my review", reviewDisclaimer: "Reviews are users' personal opinions and do not represent this site. Use “Report an error” to flag inappropriate content.",
  myReview: "My review", helpful: (n) => `👍 Helpful (${n})`, actionFailed: "Action failed",
  editReview: "Edit review", writeReview: "Write a review", useCasePh: "Use case (optional), e.g. marketing copy, coursework", contentPh: "Share your real experience (10–500 characters)",
  submit: "Submit", submitting: "Submitting…", cancel: "Cancel", updated: "Review updated", thanks: "Thanks for your review!", submitFailed: "Submit failed",
  tabBuzz: "Buzz", tabHeat: "Popularity", tabReviews: "Reviews", tabAlts: "Alternatives", tabOfficial: "Latest from website",
  close: "Close", dbData: "Database record", category: "Category", pricing: "Pricing", wrapperS: "Wrapper",
  aiDisclaimer: "⚠️ Automated AI analysis for reference only. Check the official website for prices and plans.", analyzing: "Fetching the website and analyzing… (about 10–30 seconds)", retry: "Retry",
  diagFailed: "Diagnosis failed", worth: "Worth using", notRec: "Not recommended", dataQuality: "Data quality: ", price: "Price", plans: "Plans", summary: "Key points",
  pros: "Pros", cons: "Cons", sources: "Sources", evidence: "Evidence", evidenceUnverified: " (could not be matched on the page)",
  conf: { high: "High confidence", medium: "Medium confidence", low: "Low confidence" },
  diagTime: "Diagnosed: ", model: "Model: ", cached: "cached", fresh: "new", oldV1: " | older diagnosis (no per-field confidence or quotes)", oldV2: " | older diagnosis (no alternatives note)",
  diagBanner: (d: string) => `📅 This is the diagnosis from ${d} (results are kept for 7 days and shared by everyone during that time). For the latest status, press “Re-diagnose” below.`, dateFmt: (t: string) => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  rediagnose: "Re-diagnose", report: "Report an error", reportThanks: "Report received, thank you!", reportPh: "What's wrong? e.g. the price changed to… (max 500 characters)", reportFailed: "Report failed",
  dateLocale: "en-US", breadcrumb: "Breadcrumb",
  sortNewest: "Newest releases", released: "Released",
  releasedHint: "Earliest date found in public sources; not necessarily the official launch date",
  relSrc: { github_created: "GitHub repo created", hn_post: "first public discussion", wikidata_p577: "Wikidata", wikidata_p571: "Wikidata", wikidata: "Wikidata", producthunt_launch: "Product Hunt launch", manual: "manually confirmed" },
};
export const DICT: Record<Locale, Dict> = { zh, en };
export const t = (loc: Locale = "zh") => DICT[loc] ?? zh;

/** 「推出日期：2024-03-01（GitHub 建立日）」；沒有日期回傳 null */
export function releaseText(loc: Locale, date: string | null | undefined, src: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const L = t(loc);
  const label = src ? L.relSrc[src] ?? src : "";
  return `${date.slice(0, 10)}${label ? (loc === "en" ? ` (${label})` : `（${label}）`) : ""}`;
}
