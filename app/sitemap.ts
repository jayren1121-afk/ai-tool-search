import type { MetadataRoute } from "next";
import { categoryPath, SITE_URL, toolPath } from "@/lib/site";
import { STATIC_TOOL_IDS } from "@/lib/tool-ids";
import { getAllToolsLite } from "@/lib/tools-server";
import { CATEGORIES } from "@/lib/types";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const rows = await getAllToolsLite(); // 無法連線 Supabase 時為 null → 使用靜態清單
  const tools = rows ?? STATIC_TOOL_IDS.map((id) => ({ id, category: "", updated_at: null as string | null }));
  const lastByCat: Record<string, Date> = {};
  for (const t of tools) {
    if (!t.updated_at || !t.category) continue;
    const d = new Date(t.updated_at);
    if (!lastByCat[t.category] || d > lastByCat[t.category]) lastByCat[t.category] = d;
  }
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...Object.keys(CATEGORIES).map((k) => ({ url: SITE_URL + categoryPath(k), lastModified: lastByCat[k] ?? now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...tools.map((t) => ({ url: SITE_URL + toolPath(t.id), lastModified: t.updated_at ? new Date(t.updated_at) : now, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
