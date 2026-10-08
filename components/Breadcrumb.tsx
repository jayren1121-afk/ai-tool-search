import Link from "next/link";
export default function Breadcrumb({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="麵包屑" className="mb-4 text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {it.href ? <Link href={it.href} className="hover:text-indigo-600 hover:underline">{it.name}</Link> : <span aria-current="page" className="text-slate-700">{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
