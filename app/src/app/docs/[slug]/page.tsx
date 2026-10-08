import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS_PAGES, getDocsPage, isDocsSlug } from "@/lib/docs-meta";
import { renderDocsMarkdown } from "@/lib/docs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return DOCS_PAGES.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isDocsSlug(slug)) return { title: "Docs — Sable" };
  const page = getDocsPage(slug)!;
  return {
    title: `${page.title} — Sable docs`,
    description: page.description,
  };
}

export default async function DocsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  if (!isDocsSlug(slug)) notFound();

  let html: string;
  try {
    html = await renderDocsMarkdown(slug);
  } catch (err) {
    console.error("[docs] failed to render", slug, err);
    throw err;
  }

  const page = getDocsPage(slug)!;

  return (
    <article className="docs-prose">
      <p className="mono mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">
        Docs / {page.title}
      </p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
