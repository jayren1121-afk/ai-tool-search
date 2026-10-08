/** 清理 NEXT_PUBLIC_SUPABASE_URL：去除空白、結尾的 "/" 與 "/rest/v1" */
export function supabaseUrl(): string {
  let u = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "");
  u = u.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "").replace(/\/+$/, "");
  return u;
}
