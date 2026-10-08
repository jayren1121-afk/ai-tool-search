/** 估算 token 數：中日韓字約 1 token/字，其他約 4 字元/token */
export function estTokens(t: string) {
  let n = 0;
  for (const ch of t) n += /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(ch) ? 1 : 0.25;
  return Math.ceil(n);
}
export function truncateTokens(t: string, max: number) {
  let n = 0, i = 0;
  for (; i < t.length && n < max; i++) n += /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(t[i]) ? 1 : 0.25;
  return t.slice(0, i);
}
const safeChar = (c: number) => (c > 31 && c < 0x110000 && c !== 60 && c !== 62 ? String.fromCodePoint(c) : " ");
export function stripHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, h) => safeChar(parseInt(h, 16))).replace(/&#(\d{1,7});/g, (_, d) => safeChar(Number(d)))
    .replace(/&lt;|&gt;/g, " ").replace(/<<<|>>>/g, " ").replace(/\s+/g, " ").trim();
}
export const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** 共用網域（多個產品共用），無法以網域比對 HN 提及 */
const SHARED_HOSTS = new Set(["github.com", "gitlab.com", "huggingface.co", "google.com", "microsoft.com", "apple.com", "apps.apple.com", "play.google.com", "chrome.google.com", "chromewebstore.google.com", "amazon.com", "aws.amazon.com", "x.com", "twitter.com", "youtube.com", "medium.com", "notion.so", "discord.com", "discord.gg", "linkedin.com", "facebook.com", "meta.com", "adobe.com", "canva.com", "zoom.us", "slack.com", "atlassian.com", "salesforce.com", "ibm.com", "nvidia.com", "openai.com"]);
/** 可用於 HN 網域比對的主機名；共用網域或代管子網域回傳 null */
export function distinctHost(u: string): string | null {
  const h = hostOf(u);
  if (!h || SHARED_HOSTS.has(h)) return null;
  if (/\.(github\.io|vercel\.app|netlify\.app|notion\.site|hf\.space|streamlit\.app|pages\.dev)$/.test(h)) return null;
  return h;
}
