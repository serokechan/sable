"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spun, setSpun] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setSpun(true);
        startTransition(() => {
          router.refresh();
        });
        window.setTimeout(() => setSpun(false), 600);
      }}
      className={`mono inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-neutral-600 hover:text-[var(--ink)] disabled:opacity-60 ${
        spun ? "[&_svg]:rotate-180" : ""
      }`}
      aria-label="Refresh dashboard"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="size-3.5 transition-transform duration-500"
        aria-hidden
      >
        <path
          d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5V6H10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
