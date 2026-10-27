// 本機意圖與目標拆解（不呼叫任何模型）。中英文觸發詞都寫在這裡，側欄提示詞沿用同一組。
import type { Locale } from "./i18n";

export type SearchTool = {
  id: string;
  name: string;
  url: string;
  category: string;
  subcategory: string | null;
  description_zh: string | null;
  description_en?: string | null;
  key_features?: string[] | null;
  key_features_en?: string[] | null;
  tags?: string[] | null;
  pricing_model: string | null;
  free_tier: string | null;
  paid_plans?: { name?: string | null; price_usd_month?: number | null; notes?: string | null }[] | null;
  pricing_url?: string | null;
};

export type Relevance = "direct" | "indirect";
export type RankedTool<T> = T & { score: number; relevance: Relevance };
export type SearchGroup<T> = { id: string; title: string; tools: RankedTool<T>[] };
export type SearchOutcome<T> =
  | { mode: "goal"; goalId: string; goalTitle: string; groups: SearchGroup<T>[] }
  | { mode: "list"; tools: RankedTool<T>[] };

type Need = {
  id: string;
  title: Record<Locale, string>;
  /** 子分類完全相符 → 直接相關 */
  subs: string[];
  /** 出現在名稱、描述、標籤 → 直接相關 */
  strong: string[];
  /** 較弱的字 → 間接相關 */
  weak: string[];
  /** 分類相符時：indirect 給低分；never 不單靠分類入選 */
  categories: string[];
  categoryOnly: "indirect" | "never";
  limit?: number;
};

type Goal = {
  id: string;
  title: Record<Locale, string>;
  triggers: string[];
  needs: Need[];
};

const SHORT_VIDEO: Need[] = [
  { id: "script", title: { zh: "腳本", en: "Script" }, subs: ["行銷文案", "文案"], strong: ["腳本", "文案", "script", "copywriting"], weak: ["寫作", "writing"], categories: ["writing_marketing"], categoryOnly: "never", limit: 6 },
  { id: "footage", title: { zh: "畫面與影片素材", en: "Footage" }, subs: ["影片生成"], strong: ["影片生成", "生成影片", "text-to-video", "text to video", "video generation", "video generator"], weak: ["圖像生成"], categories: ["video"], categoryOnly: "never", limit: 10 },
  { id: "editing", title: { zh: "剪輯", en: "Editing" }, subs: ["影片編輯", "短影音剪輯"], strong: ["剪輯", "video edit", "capcut"], weak: ["編輯"], categories: ["video"], categoryOnly: "never", limit: 6 },
  { id: "music", title: { zh: "音樂", en: "Music" }, subs: ["配樂", "音樂生成", "作曲"], strong: ["配樂", "soundtrack", "music", "歌曲"], weak: ["song"], categories: ["music"], categoryOnly: "indirect", limit: 8 },
  { id: "sfx", title: { zh: "音效", en: "Sound effects" }, subs: [], strong: ["音效", "sound effect", "sound effects", "sfx", "foley", "環境音"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
  { id: "voiceover", title: { zh: "配音", en: "Voiceover" }, subs: ["語音合成", "文字轉語音", "聲音複製"], strong: ["配音", "旁白", "voiceover", "voice-over", "text-to-speech", "tts"], weak: ["語音"], categories: ["audio"], categoryOnly: "never", limit: 6 },
  { id: "captions", title: { zh: "字幕", en: "Captions" }, subs: ["字幕", "字幕配音"], strong: ["字幕", "caption", "captions", "subtitle", "subtitles"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
];

const GOALS: Goal[] = [
  { id: "short_video", title: { zh: "短影片", en: "Short video" }, triggers: ["短影片", "短視頻", "短影音", "短片", "make a short video", "short video", "short-form", "reels", "shorts"], needs: SHORT_VIDEO },
  {
    id: "presentation", title: { zh: "簡報", en: "Presentation" },
    triggers: ["做簡報", "簡報", "投影片", "make a presentation", "presentation", "powerpoint", "slides"],
    needs: [
      { id: "slides", title: { zh: "簡報", en: "Slides" }, subs: ["簡報生成", "簡報", "簡報設計", "簡報協作"], strong: ["簡報", "slides", "powerpoint", "presentation"], weak: [], categories: ["presentation"], categoryOnly: "never", limit: 6 },
      { id: "slide_art", title: { zh: "配圖", en: "Images" }, subs: ["圖像生成", "設計生成"], strong: ["圖像生成", "配圖"], weak: [], categories: ["image"], categoryOnly: "never", limit: 4 },
    ],
  },
  {
    id: "podcast", title: { zh: "Podcast", en: "Podcast" },
    triggers: ["podcast", "播客", "做 podcast"],
    needs: [
      { id: "record", title: { zh: "錄製與剪輯", en: "Record and edit" }, subs: ["Podcast", "音訊編輯", "音訊處理"], strong: ["podcast", "播客"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "transcript", title: { zh: "逐字稿", en: "Transcript" }, subs: ["會議轉錄", "轉錄", "語音辨識"], strong: ["逐字稿", "transcript", "transcription"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "bed", title: { zh: "配樂", en: "Music bed" }, subs: ["配樂"], strong: ["配樂"], weak: [], categories: ["music"], categoryOnly: "indirect", limit: 4 },
      { id: "host", title: { zh: "配音", en: "Voice" }, subs: ["語音合成", "文字轉語音"], strong: ["配音", "voiceover", "tts"], weak: [], categories: [], categoryOnly: "never", limit: 4 },
    ],
  },
  {
    id: "image", title: { zh: "圖像", en: "Image" },
    triggers: ["畫一張圖", "做一張圖", "生成圖", "生圖", "繪圖", "畫圖", "generate an image", "text to image", "text-to-image", "ai image"],
    needs: [
      { id: "gen", title: { zh: "圖像生成", en: "Image generation" }, subs: ["圖像生成", "圖像模型", "開源圖像模型"], strong: ["圖像生成", "text-to-image", "image generation"], weak: [], categories: ["image"], categoryOnly: "never", limit: 6 },
      { id: "edit", title: { zh: "修圖", en: "Photo editing" }, subs: ["圖片編輯"], strong: ["修圖", "去背", "photo edit"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "upscale", title: { zh: "放大", en: "Upscale" }, subs: [], strong: ["放大", "upscale", "upscaling"], weak: [], categories: [], categoryOnly: "never", limit: 4 },
    ],
  },
  {
    id: "build_app", title: { zh: "寫程式", en: "Coding" },
    triggers: ["寫程式", "寫一個程式", "做一個網站", "做一個 app", "write code", "build an app", "build a website"],
    needs: [
      { id: "assistant", title: { zh: "程式助理", en: "Coding assistant" }, subs: ["程式助理", "AI IDE", "IDE 助理", "程式補全"], strong: ["程式助理", "coding assistant", "github copilot"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "agent", title: { zh: "程式代理", en: "Coding agent" }, subs: ["程式代理", "CLI 代理", "開源代理", "自主工程師"], strong: ["程式代理", "coding agent"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "builder", title: { zh: "應用建置", en: "App builder" }, subs: ["應用建置", "UI 生成"], strong: ["應用建置", "app builder"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
    ],
  },
  {
    id: "song", title: { zh: "歌曲", en: "Song" },
    triggers: ["做一首歌", "寫一首歌", "寫歌", "做音樂", "make a song", "make music"],
    needs: [
      { id: "track", title: { zh: "音樂生成", en: "Music generation" }, subs: ["音樂生成"], strong: ["音樂生成", "music generation", "歌曲", "song"], weak: [], categories: ["music"], categoryOnly: "never", limit: 6 },
      { id: "score", title: { zh: "配樂", en: "Soundtrack" }, subs: ["配樂", "作曲"], strong: ["配樂", "soundtrack"], weak: [], categories: [], categoryOnly: "never", limit: 4 },
      { id: "master", title: { zh: "母帶", en: "Mastering" }, subs: ["母帶"], strong: ["母帶", "mastering"], weak: [], categories: [], categoryOnly: "never", limit: 4 },
    ],
  },
  {
    id: "voiceover", title: { zh: "配音", en: "Voiceover" },
    triggers: ["配音", "旁白", "voiceover", "voice over", "voice-over"],
    needs: [
      { id: "tts", title: { zh: "語音合成", en: "Text to speech" }, subs: ["語音合成", "文字轉語音", "聲音複製"], strong: ["語音合成", "text-to-speech", "tts", "配音"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "dub", title: { zh: "影片配音", en: "Dubbing" }, subs: ["影片配音", "字幕配音"], strong: ["配音", "dubbing"], weak: [], categories: ["translation"], categoryOnly: "never", limit: 4 },
      { id: "caps", title: { zh: "字幕", en: "Captions" }, subs: ["字幕"], strong: ["字幕", "caption", "subtitle"], weak: [], categories: [], categoryOnly: "never", limit: 4 },
    ],
  },
  {
    id: "sound_effects", title: { zh: "音效", en: "Sound effects" },
    triggers: ["音效", "sound effects", "sound effect", "sfx", "foley"],
    needs: [
      { id: "sfx", title: { zh: "音效", en: "Sound effects" }, subs: [], strong: ["音效", "sound effect", "sound effects", "sfx", "foley", "環境音"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "near_music", title: { zh: "相近的配樂", en: "Related music" }, subs: ["配樂", "音樂生成"], strong: [], weak: [], categories: ["music"], categoryOnly: "indirect", limit: 4 },
      { id: "near_audio", title: { zh: "相近的音訊處理", en: "Related audio tools" }, subs: ["音訊編輯", "音訊處理", "音訊增強", "降噪"], strong: [], weak: [], categories: [], categoryOnly: "never", limit: 4 },
    ],
  },
  {
    id: "meeting", title: { zh: "會議紀錄", en: "Meeting notes" },
    triggers: ["會議逐字稿", "會議紀錄", "會議筆記", "逐字稿", "meeting transcript", "meeting notes"],
    needs: [
      { id: "transcript", title: { zh: "逐字稿", en: "Transcript" }, subs: ["會議轉錄", "轉錄", "語音辨識"], strong: ["逐字稿", "transcript", "transcription"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "notes", title: { zh: "會議筆記", en: "Notes" }, subs: ["會議筆記", "筆記"], strong: ["會議", "meeting notes"], weak: [], categories: ["productivity"], categoryOnly: "never", limit: 6 },
    ],
  },
  {
    id: "word_excel", title: { zh: "Word 轉 Excel", en: "Word to Excel" },
    triggers: ["word 轉 excel", "word 轉成 excel", "word to excel", "word 轉試算表"],
    needs: [
      { id: "sheet", title: { zh: "試算表", en: "Spreadsheets" }, subs: ["試算表"], strong: ["試算表", "excel", "spreadsheet"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "office", title: { zh: "辦公套件", en: "Office suite" }, subs: ["辦公套件"], strong: ["excel", "spreadsheet", "microsoft word", "office"], weak: [], categories: [], categoryOnly: "never", limit: 4 },
    ],
  },
  {
    id: "cutout", title: { zh: "去背", en: "Background removal" },
    triggers: ["去背", "去背景", "remove a background", "remove background", "background removal"],
    needs: [
      { id: "cut", title: { zh: "去背", en: "Background removal" }, subs: [], strong: ["去背", "去背景", "remove background", "background removal"], weak: [], categories: [], categoryOnly: "never", limit: 6 },
      { id: "edit", title: { zh: "圖片編輯", en: "Photo editing" }, subs: ["圖片編輯"], strong: ["修圖"], weak: [], categories: [], categoryOnly: "never", limit: 4 },
    ],
  },
];

/** 側欄「試試這些」。文字本身就是目標觸發詞，點下去會走出對應的分組。 */
export const SEARCH_PROMPTS: { zh: string; en: string }[] = [
  { zh: "我要做一個短影片", en: "Make a short video" },
  { zh: "音效", en: "Sound effects" },
  { zh: "做簡報", en: "Make a presentation" },
  { zh: "配音", en: "Voiceover" },
  { zh: "去背", en: "Remove a background" },
  { zh: "會議逐字稿", en: "Meeting transcript" },
  { zh: "Word 轉 Excel", en: "Word to Excel" },
  { zh: "寫程式", en: "Write code" },
  { zh: "做一首歌", en: "Make a song" },
];

const INTENT_RULES: { words: string[]; categories?: string[]; subs?: string[]; pricing?: string[] }[] = [
  { words: ["免費", "免錢", "不用錢", "免費版", "free", "gratis", "free tier"], pricing: ["free", "freemium", "open-source"] },
  { words: ["繪圖", "畫圖", "生圖", "圖片", "image"], categories: ["image"] },
  { words: ["影片", "視頻", "video"], categories: ["video"] },
  { words: ["音樂", "歌曲", "music", "song"], categories: ["music"] },
  { words: ["簡報", "投影片", "slides", "presentation"], categories: ["presentation"] },
  { words: ["翻譯", "translate", "translation"], categories: ["translation"] },
  { words: ["寫程式", "coding"], categories: ["coding"] },
  { words: ["試算表", "excel", "spreadsheet"], subs: ["試算表"] },
  { words: ["配音", "voiceover"], subs: ["語音合成", "文字轉語音"] },
  { words: ["音效", "sound effect", "sound effects", "sfx"], subs: [] },
];

const STOP = new Set(["的", "了", "我", "要", "想", "做", "一個", "幫", "請", "a", "an", "the", "to", "for", "me", "i", "want", "make", "create", "and"]);

export function normalizeQuery(q: string): string {
  return q.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 中文與含空白的片語用包含。單一拉丁詞用整詞，避免 script 命中 description、word 命中 filler-word。 */
export function textHas(hay: string, needle: string): boolean {
  const n = needle.toLowerCase();
  if (!n) return false;
  if (/[\u3400-\u9fff]/.test(n) || n.includes(" ")) return hay.includes(n);
  return new RegExp(`(^|[^a-z0-9])${escapeRe(n)}([^a-z0-9]|$)`, "i").test(hay);
}

/** 名稱、描述、標籤、功能。子分類另計，不放進這段，避免「文案」被「電商文案」這個標籤重複加分。 */
function prose(t: SearchTool): string {
  return [t.name, t.description_zh, t.description_en, ...(t.tags || []), ...(t.key_features || []), ...(t.key_features_en || [])].filter(Boolean).join(" ").toLowerCase();
}

function blob(t: SearchTool): string {
  return [
    t.name, t.subcategory, t.description_zh, t.description_en,
    ...(t.tags || []), ...(t.key_features || []), ...(t.key_features_en || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function matchGoal(query: string): Goal | null {
  const text = normalizeQuery(query);
  if (!text) return null;
  let best: { goal: Goal; len: number } | null = null;
  for (const goal of GOALS) {
    for (const trigger of goal.triggers) {
      const n = normalizeQuery(trigger);
      if (n && textHas(text, n) && (!best || n.length > best.len)) best = { goal, len: n.length };
    }
  }
  return best?.goal ?? null;
}

function rankNeed<T extends SearchTool>(tools: T[], need: Need): RankedTool<T>[] {
  const ranked: RankedTool<T>[] = [];
  for (const t of tools) {
    const hay = prose(t);
    const strongHits = need.strong.filter((k) => textHas(hay, k.toLowerCase())).length;
    const weakHits = need.weak.filter((k) => textHas(hay, k.toLowerCase())).length;
    const sub = !!t.subcategory && need.subs.includes(t.subcategory);
    const cat = need.categories.includes(t.category);
    let score = 0;
    if (strongHits) score += 28 + (strongHits - 1) * 6;
    if (sub) score += 24;
    if (weakHits) score += 8;
    if (cat && (strongHits || sub)) score += 8;
    else if (cat && need.categoryOnly === "indirect") score += 8;
    if (score <= 0) continue;
    const relevance: Relevance = strongHits > 0 || sub ? "direct" : "indirect";
    ranked.push({ ...t, score, relevance });
  }
  ranked.sort((a, b) => (a.relevance === b.relevance ? 0 : a.relevance === "direct" ? -1 : 1) || b.score - a.score || a.name.localeCompare(b.name, "zh-Hant"));
  return ranked.slice(0, need.limit ?? 6);
}

function tokensOf(query: string): string[] {
  return normalizeQuery(query).split(" ").filter((w) => w.length > 1 && !STOP.has(w));
}

function scoreKeyword<T extends SearchTool>(t: T, query: string, tokens: string[]): number {
  const hay = blob(t);
  const name = t.name.toLowerCase();
  const norm = normalizeQuery(query);
  let score = 0;
  if (name === norm) score += 50;
  for (const tok of tokens) {
    if (name === tok) score += 40;
    else if (textHas(name, tok)) score += 22;
    if (t.subcategory && textHas(t.subcategory.toLowerCase(), tok)) score += 16;
    else if (textHas(hay, tok)) score += 8;
  }
  for (const rule of INTENT_RULES) {
    if (!rule.words.some((w) => textHas(norm, normalizeQuery(w)))) continue;
    if (rule.categories?.includes(t.category)) score += 18;
    if (t.subcategory && rule.subs?.includes(t.subcategory)) score += 16;
    if (rule.pricing?.includes(t.pricing_model || "")) score += 12;
  }
  return score;
}

export function searchCatalog<T extends SearchTool>(tools: T[], query: string, opts: { locale: Locale; category?: string; pricing?: string }): SearchOutcome<T> {
  const category = opts.category || "";
  const pricing = opts.pricing || "";
  const pool = tools.filter((t) => (!category || t.category === category) && (!pricing || t.pricing_model === pricing));
  const goal = matchGoal(query);
  if (goal) {
    return {
      mode: "goal",
      goalId: goal.id,
      goalTitle: goal.title[opts.locale],
      groups: goal.needs.map((need) => ({ id: need.id, title: need.title[opts.locale], tools: rankNeed(pool, need) })),
    };
  }
  const tokens = tokensOf(query);
  const list = pool.map((t) => ({ ...t, score: scoreKeyword(t, query, tokens), relevance: "direct" as const }))
    .filter((t) => t.score >= 12)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-Hant"))
    .slice(0, 40);
  return { mode: "list", tools: list };
}

/** 站外結果跟哪個子需求最像。分數愈高愈像；0 分的不回傳。 */
export function externalNeedScores(goalId: string, hay: string): { id: string; score: number }[] {
  const goal = GOALS.find((g) => g.id === goalId);
  if (!goal) return [];
  const text = hay.toLowerCase();
  const scored: { id: string; score: number }[] = [];
  for (const need of goal.needs) {
    let score = 0;
    for (const k of need.strong) if (textHas(text, k.toLowerCase())) score += 3;
    for (const k of need.weak) if (textHas(text, k.toLowerCase())) score += 1;
    if (textHas(text, need.title.zh.toLowerCase())) score += 2;
    if (need.title.en !== need.title.zh && textHas(text, need.title.en.toLowerCase())) score += 2;
    if (score > 0) scored.push({ id: need.id, score });
  }
  return scored;
}
