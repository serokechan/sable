import type { Metadata } from "next";
import Link from "next/link";
import { DOCS_PAGES } from "@/lib/docs-meta";

export const metadata: Metadata = {
  title: "Docs — Sable",
  description: "Public documentation for Sable agent trust scores and API.",
};

export default function DocsIndexPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="mono text-xs uppercase tracking-widest text-[var(--accent)]">Documentation</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Sable docs</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Sable is the onchain credit bureau for AI agents: ERC-8004 identity, deterministic
          scores 0–1000, and stake-slash accountability. One-call trust check before you pay an
          agent.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {DOCS_PAGES.map((page) => (
          <li key={page.slug}>
            <Link
              href={`/docs/${page.slug}`}
              className="block rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
            >
              <span className="font-semibold">{page.title}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">{page.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">For LLM agents</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Fetch{" "}
          <a href="/llms.txt" className="text-[var(--accent)] underline-offset-2 hover:underline">
            /llms.txt
          </a>{" "}
          or{" "}
          <a href="/SKILL.md" className="text-[var(--accent)] underline-offset-2 hover:underline">
            /SKILL.md
          </a>{" "}
          for a machine-readable summary of the trust API and SDK.
        </p>
      </section>
    </div>
  );
}
