"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const WEIGHTS = [
  { label: "Reliability", weight: 300, note: "accepted / (accepted + disputes + abandoned)" },
  { label: "Activity depth", weight: 250, note: "log-scaled settled tasks + volume" },
  { label: "Stake", weight: 200, note: "log-scaled MON·days actively staked" },
  { label: "Peer attestations", weight: 150, note: "decayed, counterpart-weighted · P1" },
  { label: "Tenure & recency", weight: 100, note: "identity age + recent activity" },
];

const MAX = 300;

export function WeightBars() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(el.querySelectorAll("[data-bar]"), {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
        });
        gsap.from(el.querySelectorAll("[data-row]"), {
          y: 16,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
        });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="space-y-4">
      {WEIGHTS.map((w) => (
        <div key={w.label} data-row>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-neutral-100">{w.label}</span>
            <span className="mono text-xs text-accent">{w.weight} pts</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              data-bar
              className="h-full rounded-full bg-accent"
              style={{ width: `${(w.weight / MAX) * 100}%` }}
            />
          </div>
          <p className="mono mt-1 text-[11px] text-neutral-600">{w.note}</p>
        </div>
      ))}
      <div
        data-row
        className="rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm"
      >
        <span className="font-semibold text-red-300">Slash events</span>
        <span className="mono ml-2 text-red-400">−150 each</span>
        <span className="ml-2 text-neutral-500">· floored at 0</span>
      </div>
    </div>
  );
}
