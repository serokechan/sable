import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** GET /api/agents/:did/history — every score-relevant event, explorer-linked. */
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
    return NextResponse.json({ did: agent.did, history: db.agentEvents(agent.did, 500) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 503 },
    );
  }
}
