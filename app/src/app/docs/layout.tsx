import { DocsSidebar } from "@/components/docs-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row lg:gap-10">
      <aside className="lg:w-48 lg:shrink-0">
        <DocsSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
