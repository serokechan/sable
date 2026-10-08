import { NextResponse } from "next/server";
import type { ScoreBreakdown } from "@sable/core";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** GET /api/agents/:did — full agent profile: identity + score + history. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ did: string }> },
) {
  try {
    const { did } = await params;
    const { db } = getRuntime();
    const agent = db.getAgent(decodeURIComponent(did));
    if (!agent) {
      return NextResponse.json({ error: "agent not found" }, { status: 404 });
    }
    const s = db.getScore(agent.agent_id);
    const breakdown: ScoreBreakdown | null = s ? JSON.parse(s.breakdown) : null;
    const history = db.agentEvents(decodeURIComponent(did), 200);

    return NextResponse.json({
      agent: {
        agentId: agent.agent_id,
        did: agent.did,
        owner: agent.owner,
        metadataUri: agent.metadata_uri,
        endpoint: agent.endpoint,
        active: agent.active === 1,
        registeredAt: agent.registered_at,
      },
      score: s?.score ?? 0,
      breakdown,
      history,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 503 },
    );
  }
}
