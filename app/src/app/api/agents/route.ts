import { NextResponse } from "next/server";
import type { ScoreBreakdown } from "@sable/core";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** GET /api/agents — leaderboard: every agent with its live score. */
export async function GET() {
  try {
    const { db } = getRuntime();
    const agents = db.listAgents();

    const rows = agents
      .map((a) => {
        const s = db.getScore(a.agent_id);
        const breakdown: ScoreBreakdown | null = s ? JSON.parse(s.breakdown) : null;
        return {
          agentId: a.agent_id,
          did: a.did,
          owner: a.owner,
          active: a.active === 1,
          registeredAt: a.registered_at,
          score: s?.score ?? 0,
          breakdown,
        };
      })
      .sort((x, y) => y.score - x.score);

    return NextResponse.json({ agents: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 503 },
    );
  }
}
