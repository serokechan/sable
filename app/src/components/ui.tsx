"use client";

import type { ScoreBreakdown } from "@sable/core";
import { useEffect, useState } from "react";

export { fmtWei, timeAgo } from "@/lib/format";

const COMPONENT_META: { key: keyof ScoreBreakdown["components"]; label: string; max: number }[] = [
  { key: "reliability", label: "Reliability", max: 300 },
  { key: "activity", label: "Activity depth", max: 250 },
  { key: "stake", label: "Stake (skin in the game)", max: 200 },
  { key: "attestations", label: "Peer attestations (P1)", max: 150 },
  { key: "tenure", label: "Tenure & recency", max: 100 },
];

export function ComponentBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="space-y-2.5">
      {COMPONENT_META.map(({ key, label, max }) => {
        const v = Math.max(0, breakdown.components[key]);
        const pct = Math.min(100, (v / max) * 100);
        return (
          <div key={key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-neutral-500">{label}</span>
              <span className="mono text-neutral-200">
                {v.toFixed(0)} <span className="text-neutral-600">/ {max}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-neutral-500">Slash events</span>
          <span className="mono text-red-400">{breakdown.components.slashPenalty}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-700"
            style={{ width: `${Math.min(100, (-breakdown.components.slashPenalty / 300) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ScoreDial({ score, size = 128 }: { score: number; size?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (score - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1000, Math.max(0, display)) / 1000;
  const hue = pct > 0.66 ? "#34d399" : pct > 0.33 ? "#fbbf24" : "#f87171";

  return (
    <svg width={size} height={size} className="-rotate-90" aria-label={`Score ${score} of 1000`}>
      <defs>
        <filter id="dial-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e2330" strokeWidth="10" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={hue}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        filter="url(#dial-glow)"
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="mono"
        fill={hue}
        fontSize={size * 0.24}
        fontWeight="800"
        letterSpacing="-0.05em"
      >
        {display}
      </text>
    </svg>
  );
}

export function useApi<T>(url: string, intervalMs = 1000): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const json = (await res.json()) as T;
        if (alive) setData(json);
      } catch {
        /* keep last snapshot */
      }
    };
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, intervalMs]);
  return data;
}
