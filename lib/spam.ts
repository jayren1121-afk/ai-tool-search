// 簡易垃圾內容過濾（評論用）。命中時回傳原因字串，否則 null。
const BANNED = [
  "博弈", "賭場", "娛樂城", "百家樂", "六合彩", "代儲", "代辦貸款", "借貸", "小額貸", "援交", "約砲", "色情", "裸聊", "成人影片",
  "加賴", "加line", "加我line", "私訊領取", "免費領取", "保證獲利", "穩賺", "投資群", "飆股", "虛擬貨幣投資",
  "casino", "viagra", "porn", "xxx", "escort", "betting", "crypto signal", "make money fast", "telegram group",
];
export function spamReason(text: string): string | null {
  const t = text.toLowerCase().replace(/\s+/g, "");
  const links = (text.match(/https?:\/\/|www\.|\.com\b|\.tw\b|\.cc\b|t\.me\//gi) || []).length;
  if (links > 1) return "評論中最多只能包含 1 個連結";
  if (BANNED.some((w) => t.includes(w.replace(/\s+/g, "")))) return "評論包含不允許的內容";
  if (/(.)\1{9,}/u.test(t)) return "請勿輸入大量重複字元";
  const uniq = new Set([...t]).size;
  if (t.length >= 20 && uniq / t.length < 0.15) return "內容重複度過高";
  return null;
}
export const normText = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
