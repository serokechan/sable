"use client";

import { useApi } from "@/components/ui";

interface Health {
  ok: boolean;
  agents: number;
  events: number;
}

interface AgentsResp {
  agents: { score: number }[];
}

export function HeroStats() {
  const health = useApi<Health>("/api/health", 4000);
  const agents = useApi<AgentsResp>("/api/agents", 4000);
  const trusted = agents?.agents.filter((a) => a.score >= 300).length ?? 0;

  const stats = [
    { label: "Agents scored", value: health ? String(health.agents) : "—" },
    { label: "Trusted ≥300", value: agents ? String(trusted) : "—", accent: true },
    { label: "Score-relevant events", value: health ? String(health.events) : "—" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="card px-4 py-4">
          <div className="label mb-1.5">{s.label}</div>
          <div
            className={`mono text-2xl font-bold ${s.accent ? "text-accent" : "text-neutral-100"}`}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
