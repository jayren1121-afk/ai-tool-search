import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 預渲染時不要丟例外：Preview 建置未必有 NEXT_PUBLIC_SUPABASE_*，首頁仍須能產出。
// 沒有設定時回傳 null，搜尋當下再顯示錯誤，而不是在 render 裡讓整個 build 失敗。
export function supabaseBrowser(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key);
}
