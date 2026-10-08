import { CATEGORIES } from "./types";

export const SITE_NAME = "jAytal AI 工具搜尋";
export const SITE_SHORT = "jAytal";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ai-tool-search.vercel.app").trim().replace(/\/+$/, "");
export const SITE_DESC = "jAytal AI 工具搜尋：收錄近 500 個熱門 AI 工具，依分類比較價格、訂閱方案、免費額度與是否套殼，並可由 AI 即時診斷。";
export const NA = "無法確認";

export const CATEGORY_INTRO: Record<string, string> = {
  chatbot: "ChatGPT、Claude、Gemini 等通用 AI 聊天助理與大型語言模型平台，比較免費額度、訂閱價格與底層模型。",
  image: "AI 繪圖與圖像生成、修圖、去背、放大工具，比較生成品質、商用授權與價格方案。",
  video: "AI 影片生成、剪輯、字幕與短影音工具，適合行銷、社群與創作者。",
  audio: "AI 語音合成（TTS）、聲音複製、語音辨識與會議轉錄工具。",
  music: "AI 作曲、歌曲生成與配樂工具，比較版權與訂閱方案。",
  coding: "AI 程式助理、AI IDE、程式代理與應用建置平台，協助開發者提升效率。",
  writing_marketing: "AI 寫作、改寫、行銷文案與社群內容工具。",
  productivity: "AI 筆記、會議記錄、排程、郵件與知識管理等生產力工具。",
  search_research: "AI 搜尋引擎與學術研究工具，附引用來源的問答與文獻探索。",
  design: "AI 平面設計、UI 設計、Logo 與網站建置工具。",
  presentation: "AI 簡報生成、心智圖與視覺化圖表工具。",
  agents_automation: "AI 代理、工作流程自動化與代理開發框架。",
  translation: "AI 翻譯、在地化與影片配音翻譯工具。",
  data_analytics: "AI 資料分析、商業智慧、試算表與資料基礎設施工具。",
  education: "AI 家教、語言學習、學術寫作與教師工具。",
  legal: "AI 法律研究、合約起草與審查工具。",
  health: "醫療 AI：臨床記錄、醫學搜尋與健康照護工具。",
  hr: "AI 招募、履歷、面試與人才管理工具。",
  sales: "AI 銷售開發、CRM、潛在客戶與冷郵件工具。",
  finance: "AI 金融研究、投資分析與企業財務自動化工具。",
  seo: "AI SEO 內容最佳化與 AI 搜尋可見度追蹤工具。",
  customer_service: "AI 客服機器人與客服代理平台。",
  "3d": "AI 3D 模型生成、動作捕捉與遊戲資產工具。",
  avatar: "AI 數位人、虛擬主播與換臉影片工具。",
};

export const categoryName = (k: string) => CATEGORIES[k] ?? k;
export const toolPath = (id: string) => `/tools/${encodeURIComponent(id)}`;
export const categoryPath = (k: string) => `/category/${encodeURIComponent(k)}`;
export const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
