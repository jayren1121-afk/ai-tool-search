"use client";
import { useState } from "react";
import type { Tool } from "@/lib/types";
import { t, type Locale } from "@/lib/i18n";
import DiagnosePanel from "./DiagnosePanel";

export default function DiagnoseButton({ tool, label, locale = "zh" }: { tool: Tool; label?: string; locale?: Locale }) {
  const [sel, setSel] = useState<Tool | null>(null);
  return (
    <>
      <button onClick={() => setSel(tool)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">{label ?? t(locale).aiDiagnose}</button>
      <DiagnosePanel tool={sel} onClose={() => setSel(null)} locale={locale} />
    </>
  );
}
