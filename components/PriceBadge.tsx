"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { PriceTip } from "@/lib/price-tip";

/** 計價標籤的說明卡。滑鼠懸停、鍵盤聚焦、觸控點一下都能打開，Esc 或點外面會關上。 */
export default function PriceBadge({ label, tip }: { label: string; tip: PriceTip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const stuck = useRef(0);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (Date.now() - stuck.current < 600) return; setOpen(false); }}>
      <button type="button" className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800 outline-none ring-emerald-400 focus-visible:ring-2"
        aria-expanded={open} aria-describedby={open ? id : undefined}
        onClick={() => { stuck.current = Date.now(); setOpen((v) => !v); }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
        {label}
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs leading-5 text-slate-700 shadow-sm">
          {tip.lines.length === 0 && tip.note && <span className="block">{tip.note}</span>}
          {tip.lines.map((line, i) => (
            <span key={i} className="mb-1 block">
              {line.label ? <span className="font-medium text-slate-900">{line.label}: </span> : null}{line.text}
            </span>
          ))}
          {tip.lines.length > 0 && tip.note && <span className="mt-1 block text-slate-500">{tip.note}</span>}
        </span>
      )}
    </span>
  );
}
