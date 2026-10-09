import "server-only";

/** PostgREST / Postgres「欄位不存在」錯誤（migration 尚未執行） */
export const isMissingColumn = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42703" || /column .*does not exist/i.test(e.message || ""));

type Res<T> = { data: T | null; error: { code?: string; message?: string } | null };

/**
 * service_role 會略過 RLS，所以讀取 ai_tools 時必須自己加上 status='published'，避免待審核／已拒絕的工具外洩。
 * build(true) = 加上 status 過濾的查詢；若 migration 005 尚未執行（status 欄位不存在）就改用 build(false)
 * ——那時資料庫裡也不可能有待審核的資料，所以退回不過濾是安全的。
 */
export async function withPublished<T>(build: (filter: boolean) => PromiseLike<Res<T>>): Promise<Res<T>> {
  const r = await build(true);
  if (r.error && isMissingColumn(r.error)) return build(false);
  return r;
}
