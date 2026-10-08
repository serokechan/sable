"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_PAGES } from "@/lib/docs-meta";

const SIDEBAR = [
  { href: "/docs", label: "Overview" },
  ...DOCS_PAGES.map((p) => ({ href: `/docs/${p.slug}`, label: p.title })),
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Docs"
      className="sticky top-20 flex flex-col gap-1 border-r border-[var(--line)] pb-6 lg:pb-0"
    >
      <p className="mono mb-2 px-3 text-[10px] uppercase tracking-widest text-[var(--muted)]">
        Docs
      </p>
      {SIDEBAR.map((item) => {
        const active =
          item.href === "/docs" ? pathname === "/docs" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-white/[0.06] font-semibold text-[var(--ink)]"
                : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 border-t border-[var(--line)] px-3 pt-4">
        <p className="mono mb-1 text-[10px] uppercase tracking-widest text-[var(--muted)]">
          For agents
        </p>
        <a
          href="/llms.txt"
          className="block py-0.5 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
        >
          /llms.txt
        </a>
        <a
          href="/SKILL.md"
          className="block py-0.5 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
        >
          /SKILL.md
        </a>
      </div>
    </nav>
  );
}
