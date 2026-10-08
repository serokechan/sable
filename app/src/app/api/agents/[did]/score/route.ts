import { NextResponse } from "next/server";
import type { ScoreBreakdown } from "@sable/core";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** GET /api/agents/:did/score — the one-call trust check. Deterministic + recomputable. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ did: string }> },
) {
  try {
    const { did } = await params;
    const { db } = getRuntime();
    const agent = db.getAgent(decodeURIComponent(did));
    const s = agent
      ? db.getScore(agent.agent_id)
      : (() => {
          const byDid = db.getScoreByDid(decodeURIComponent(did));
          return byDid;
        })();

    if (!s) {
      return NextResponse.json({ error: "no score for agent" }, { status: 404 });
    }
    const breakdown: ScoreBreakdown = JSON.parse(s.breakdown);

    return NextResponse.json({
      did: decodeURIComponent(did),
      score: s.score,
      breakdown,
      blockHeight: breakdown.computedAtBlock,
      recomputeable: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 503 },
    );
  }
}
