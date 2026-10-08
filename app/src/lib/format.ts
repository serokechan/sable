export function fmtWei(wei: string | undefined | null): string {
  if (!wei) return "0";
  const n = Number(BigInt(String(wei))) / 1e18;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
