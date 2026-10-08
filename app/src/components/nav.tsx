"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/explorer", label: "Explorer" },
  { href: "/demo", label: "Demo" },
  { href: "/docs", label: "Docs" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Primary">
      {NAV.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
    </nav>
  );
}
