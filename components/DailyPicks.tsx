import Link from "next/link";
import { getTodayPicks } from "@/lib/daily-picks";
import { catName, toolHref, type Locale } from "@/lib/i18n";

const TXT = {
  zh: { title: "每日推薦", empty: "暫時空缺", pros: "優點", cons: "缺點", note: "站長個人見解，僅供參考" },
  en: { title: "Daily picks", empty: "Temporarily empty", pros: "Pros", cons: "Cons", note: "Site owner's personal take" },
};
const lines = (s: string) => s.split(/\n+/).map((x) => x.replace(/^[-•・\s]+/, "").trim()).filter(Boolean).slice(0, 3);

/** 側欄用的精簡每日推薦（伺服器元件；以 sidebarTop 傳入 SearchApp） */
export default async function DailyPicks({ locale }: { locale: Locale }) {
  const T = TXT[locale === "en" ? "en" : "zh"], en = locale === "en";
  const picks = await getTodayPicks();
  return (
    <section aria-labelledby="daily-picks" className="mb-3 border-b border-slate-100 pb-3">
      <p id="daily-picks" className="text-sm font-medium text-slate-800">{T.title}</p>
      {picks.length === 0 ? <p className="mt-1 text-xs text-slate-500">{T.empty}</p> : (
        <ul className="mt-2 space-y-3">
          {picks.map((p) => (
            <li key={p.id} className="text-xs">
              <Link href={toolHref(locale, p.tool_id)} className="text-sm font-semibold text-indigo-700 hover:underline">{p.ai_tools?.name ?? p.tool_id}</Link>
              <span className="ml-1 text-slate-400">{catName(locale, p.category)}</span>
              <p className="mt-2 mb-1"><span className="inline-block rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">{T.pros}</span></p>
              <ul className="list-disc pl-4 text-slate-600">{lines(en ? p.pros_en || p.pros_zh : p.pros_zh).map((x, i) => <li key={i}>{x}</li>)}</ul>
              <p className="mt-2 mb-1"><span className="inline-block rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">{T.cons}</span></p>
              <ul className="list-disc pl-4 text-slate-600">{lines(en ? p.cons_en || p.cons_zh : p.cons_zh).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </li>
          ))}
        </ul>
      )}
      {picks.length > 0 && <p className="mt-2 text-[11px] text-slate-400">{T.note}</p>}
    </section>
  );
}
