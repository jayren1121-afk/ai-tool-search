"use client";
import Link from "next/link";
import { CATEGORIES } from "@/lib/types";
import { categoryHref, catName, t, type Locale } from "@/lib/i18n";
import { SEARCH_PROMPTS } from "@/lib/search-intent";

function Body({ locale, query, onPrompt }: { locale: Locale; query: string; onPrompt: (q: string) => void }) {
  const L = t(locale);
  return (
    <div className="mt-2 space-y-4">
      <div>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{L.suggestPrompts}</h2>
        <ul className="space-y-0.5">
          {SEARCH_PROMPTS.map((p) => {
            const text = locale === "en" ? p.en : p.zh;
            const on = query.trim() === text;
            return (
              <li key={p.zh}>
                <button type="button" onClick={() => onPrompt(text)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${on ? "bg-indigo-50 font-medium text-indigo-800" : "text-indigo-700 hover:bg-indigo-50"}`}>
                  {text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{L.suggestCats}</h2>
        <ul className="space-y-0.5">
          {Object.keys(CATEGORIES).map((k) => (
            <li key={k}>
              <Link href={categoryHref(locale, k)} className="block rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 hover:text-indigo-700">{catName(locale, k)}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 左側建議。手機收在一列裡，寬螢幕固定在搜尋框旁邊並可捲動。 */
export default function SearchSidebar({ locale, query, onPrompt }: { locale: Locale; query: string; onPrompt: (q: string) => void }) {
  const L = t(locale);
  return (
    <div>
      <details className="search-suggest mb-3 rounded-xl bg-white p-3 shadow-sm lg:hidden">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">{L.sidebarToggle}</summary>
        <Body locale={locale} query={query} onPrompt={onPrompt} />
      </details>
      <aside className="hidden lg:sticky lg:top-2 lg:block lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto lg:rounded-xl lg:bg-white lg:p-3 lg:shadow-sm" aria-label={L.sidebarToggle}>
        <p className="text-sm font-medium text-slate-800">{L.sidebarToggle}</p>
        <Body locale={locale} query={query} onPrompt={onPrompt} />
      </aside>
    </div>
  );
}
