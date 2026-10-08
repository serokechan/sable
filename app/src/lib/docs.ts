import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { getDocsPage, type DocsSlug } from "./docs-meta";

export { DOCS_PAGES, getDocsPage, isDocsSlug, type DocsPageMeta, type DocsSlug } from "./docs-meta";

/** slug → rendered HTML; docs are static until file mtime changes */
const htmlCache = new Map<string, string>();

function repoRoot(): string {
  return path.resolve(process.cwd(), "..");
}

export async function loadDocsMarkdown(slug: DocsSlug): Promise<string> {
  const page = getDocsPage(slug);
  if (!page) throw new Error(`Unknown docs slug: ${slug}`);

  const filePath = page.file.startsWith("@root/")
    ? path.join(repoRoot(), page.file.slice("@root/".length))
    : path.join(repoRoot(), "docs", page.file);

  return readFile(filePath, "utf8");
}

export async function renderDocsMarkdown(slug: DocsSlug): Promise<string> {
  const cached = htmlCache.get(slug);
  if (cached !== undefined) return cached;

  const md = await loadDocsMarkdown(slug);
  marked.setOptions({ gfm: true, breaks: false });
  const html = await marked.parse(md);
  htmlCache.set(slug, html);
  return html;
}
