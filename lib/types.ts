export type Plan = { name: string; price_usd_month: number | null; notes: string | null };
export type Tool = {
  id: string; name: string; url: string; category: string; subcategory: string | null;
  description_zh: string | null; key_features: string[]; pricing_model: string | null;
  free_tier: string | null; paid_plans: Plan[]; pricing_url: string | null;
  is_wrapper: string | null; underlying_models: string | null; company: string | null;
  country: string | null; confidence: string | null; last_verified: string | null; source_urls: string[];
};
export type Conf = "high" | "medium" | "low";
export type EvidenceField = "price" | "plans" | "is_wrapper" | "underlying_models" | "summary";
export type Evidence = { quote: string; source: string; verified?: boolean };
export type Diagnosis = {
  useful: boolean; score: number; verdict: string; price_summary: string;
  plans: { name: string; price: string; notes: string }[];
  is_wrapper: "true" | "false" | "partial" | "unknown"; underlying_models: string[];
  summary: string[]; pros: string[]; cons: string[]; sources: string[];
  // v2 新增欄位（舊快取可能沒有，UI 需容錯）
  field_confidence?: Partial<Record<EvidenceField, Conf>>;
  evidence?: Partial<Record<EvidenceField, Evidence>>;
  data_quality?: string;
  schema_version?: number;
};
export type DiagnoseResponse = {
  result: Diagnosis; model: string; created_at: string; cached: boolean; id?: number | null; notice?: string;
};
export const CATEGORIES: Record<string, string> = {
  chatbot: "聊天機器人", image: "圖像", video: "影片", audio: "音訊/語音", music: "音樂", coding: "程式開發",
  writing_marketing: "寫作/行銷", productivity: "生產力", search_research: "搜尋/研究", design: "設計",
  presentation: "簡報", agents_automation: "代理/自動化", translation: "翻譯", data_analytics: "資料分析",
  education: "教育", legal: "法律", health: "醫療", hr: "人資", sales: "銷售", finance: "金融",
  seo: "SEO", customer_service: "客服", "3d": "3D", avatar: "虛擬人",
};
export const PRICING: Record<string, string> = { free: "免費", freemium: "免費增值", paid: "付費", "open-source": "開源" };
