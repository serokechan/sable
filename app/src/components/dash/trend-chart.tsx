import type { DayBucket } from "@/lib/trend";

const VIEW_W = 640;
const VIEW_H = 160;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 28;

export function TrendChart({ buckets, error }: { buckets: DayBucket[]; error?: boolean }) {
  if (error) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-neutral-600">
        Trend unavailable right now.
      </div>
    );
  }

  const max = Math.max(1, ...buckets.map((b) => b.total));
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const slot = innerW / Math.max(1, buckets.length);
  const barW = Math.max(4, slot * 0.55);
  const empty = buckets.every((b) => b.total === 0 && b.slashed === 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-[180px] w-full"
        role="img"
        aria-label="Task activity last 14 days"
      >
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD_T + innerH * (1 - f);
          return (
            <line
              key={f}
              x1={PAD_L}
              x2={VIEW_W - PAD_R}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeDasharray="2 4"
            />
          );
        })}

        {buckets.map((b, i) => {
          const h = (b.total / max) * innerH;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = PAD_T + innerH - h;
          const showLabel = i % 3 === 0 || i === buckets.length - 1;
          return (
            <g key={b.key}>
              <title>{`${b.key}: ${b.created} created · ${b.settled} settled${b.slashed ? ` · ${b.slashed} slashed` : ""}`}</title>
              {b.total > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(2, h)}
                  rx={3}
                  fill="var(--accent)"
                  opacity={0.9}
                />
              )}
              {b.slashed > 0 && (
                <rect
                  x={x}
                  y={PAD_T}
                  width={barW}
                  height={3}
                  rx={1.5}
                  fill="var(--bad)"
                />
              )}
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={VIEW_H - 8}
                  textAnchor="middle"
                  className="mono"
                  fontSize="9"
                  fill="#5c6375"
                >
                  {b.key.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {empty && (
        <p className="-mt-4 text-center text-xs text-neutral-600">
          No task activity in the last {buckets.length} days.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm bg-[var(--accent)]" />
          created + settled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded bg-[var(--bad)]" />
          slash that day
        </span>
      </div>
    </div>
  );
}
