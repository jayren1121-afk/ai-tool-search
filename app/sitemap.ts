import type { MetadataRoute } from "next";
import { langAlternates } from "@/lib/site";
import { STATIC_TOOL_IDS } from "@/lib/tool-ids";
import { getAllToolsLite } from "@/lib/tools-server";
import { CATEGORIES } from "@/lib/types";

export const revalidate = 86400;

type Entry = MetadataRoute.Sitemap[number];
/** 每個中文網址都有對應英文網址，兩者都列出並互相標註 hreflang（x-default → 中文） */
function pair(base: string, lastModified: Date, changeFrequency: Entry["changeFrequency"], priority: number): Entry[] {
  const { languages } = langAlternates(base, "zh");
  return [languages["zh-Hant-TW"], languages.en].map((url) => ({ url, lastModified, changeFrequency, priority, alternates: { languages } }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const rows = await getAllToolsLite(); // 無法連線 Supabase 時為 null → 使用靜態清單
  const tools = rows ?? STATIC_TOOL_IDS.map((id) => ({ id, category: "", updated_at: null as string | null }));
  const lastByCat: Record<string, Date> = {};
  for (const x of tools) {
    if (!x.updated_at || !x.category) continue;
    const d = new Date(x.updated_at);
    if (!lastByCat[x.category] || d > lastByCat[x.category]) lastByCat[x.category] = d;
  }
  return [
    ...pair("/", now, "daily", 1),
    ...Object.keys(CATEGORIES).flatMap((k) => pair(`/category/${encodeURIComponent(k)}`, lastByCat[k] ?? now, "weekly", 0.8)),
    ...tools.flatMap((x) => pair(`/tools/${encodeURIComponent(x.id)}`, x.updated_at ? new Date(x.updated_at) : now, "weekly", 0.6)),
  ];
}
