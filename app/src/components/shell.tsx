export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-6 py-10 ${className}`}>{children}</div>;
}
