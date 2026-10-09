"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "登入失敗");
      setPw(""); router.refresh();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-4 text-xl font-bold">管理後台登入</h1>
      <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-600">密碼
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-400" />
        </label>
        {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        <button disabled={busy || !pw} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? "登入中…" : "登入"}</button>
      </form>
    </main>
  );
}
