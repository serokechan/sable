export type DocsSlug = "api" | "scoring" | "sdk" | "architecture" | "skill";

export interface DocsPageMeta {
  slug: DocsSlug;
  title: string;
  description: string;
  /** Path relative to repo `docs/`, or special `@root` for SKILL.md */
  file: string;
}

/** Public allowlist only — never expose deployment/ops/development/PRD. */
export const DOCS_PAGES: readonly DocsPageMeta[] = [
  {
    slug: "api",
    title: "API",
    description: "HTTP endpoints, payloads, and error model.",
    file: "API.md",
  },
  {
    slug: "scoring",
    title: "Scoring",
    description: "Weights, cold start, and determinism guarantees.",
    file: "SCORING.md",
  },
  {
    slug: "sdk",
    title: "SDK",
    description: "Trust check and escrow with @sable/sdk.",
    file: "SDK.md",
  },
  {
    slug: "architecture",
    title: "Architecture",
    description: "Contracts, indexer, and system design.",
    file: "ARCHITECTURE.md",
  },
  {
    slug: "skill",
    title: "Skill",
    description: "Agent-facing SKILL.md for LLM integrations.",
    file: "@root/SKILL.md",
  },
] as const;

const SLUGS = new Set<string>(DOCS_PAGES.map((p) => p.slug));

export function isDocsSlug(slug: string): slug is DocsSlug {
  return SLUGS.has(slug);
}

export function getDocsPage(slug: string): DocsPageMeta | null {
  return DOCS_PAGES.find((p) => p.slug === slug) ?? null;
}
