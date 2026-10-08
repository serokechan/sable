"use client";

import { useApi } from "@/components/ui";

interface ScoreResp {
  did: string;
  score: number;
}

export function HeroScoreCard() {
  const nova = useApi<ScoreResp>("/api/agents/did%3Aagent%3Anova/score", 4000);

  return (
    <div>
      <div className="label mb-1">nova · did:agent:nova</div>
      <div className="mono flex items-baseline gap-2 text-xl font-bold text-accent">
        {nova?.score ?? "—"}{" "}
        <span className="text-[11px] font-normal text-neutral-500">live on Monad</span>
      </div>
    </div>
  );
}
