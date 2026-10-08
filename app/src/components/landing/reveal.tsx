"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export function Reveal({
  children,
  className = "",
  y = 28,
  stagger = 0,
  delay = 0,
  start = "top 85%",
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  stagger?: number;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const targets: Element | Element[] = stagger > 0 ? Array.from(el.children) : el;
        gsap.from(targets, {
          y,
          opacity: 0,
          duration: 0.85,
          delay,
          ease: "power3.out",
          stagger,
          scrollTrigger: { trigger: el, start, once: true },
        });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
