"use client";
import { type ReactNode, useEffect } from "react";
import type Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let generation = 0;
    let instance: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    const stop = () => {
      generation++;
      if (tick) {
        gsap.ticker.remove(tick);
        tick = null;
      }
      if (instance) {
        instance.destroy();
        instance = null;
      }
    };

    const update = async () => {
      stop();
      if (disposed || preference.matches) return;
      const currentGeneration = generation;
      try {
        const LenisClass = (await import("lenis")).default;
        if (disposed || preference.matches || currentGeneration !== generation) return;
        instance = new LenisClass({
          duration: 1.5,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: "vertical",
          gestureOrientation: "vertical",
          smoothWheel: true,
          wheelMultiplier: 1,
          touchMultiplier: 2,
          infinite: false,
        });

        instance.on("scroll", ScrollTrigger.update);
        tick = (time: number) => {
          instance?.raf(time * 1000);
        };
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.refresh();
      } catch (e) {
        console.warn("Lenis not available:", e);
      }
    };

    void update();
    preference.addEventListener("change", update);

    return () => {
      disposed = true;
      preference.removeEventListener("change", update);
      stop();
    };
  }, []);

  return <>{children}</>;
}

export default SmoothScroll;
