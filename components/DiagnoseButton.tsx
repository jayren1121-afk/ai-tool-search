"use client";
import { useState } from "react";
import type { Tool } from "@/lib/types";
import DiagnosePanel from "./DiagnosePanel";

export default function DiagnoseButton({ tool, label = "AI 即時診斷" }: { tool: Tool; label?: string }) {
  const [sel, setSel] = useState<Tool | null>(null);
  return (
    <>
      <button onClick={() => setSel(tool)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">{label}</button>
      <DiagnosePanel tool={sel} onClose={() => setSel(null)} />
    </>
  );
}
