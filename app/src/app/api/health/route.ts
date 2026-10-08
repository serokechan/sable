import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db, addresses } = getRuntime();
    return NextResponse.json({
      ok: true,
      chainId: addresses.chainId,
      agentRegistry: addresses.agentRegistry,
      stakeVault: addresses.stakeVault,
      escrowHub: addresses.escrowHub,
      agents: db.listAgents().length,
      events: db.countEvents(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 503 },
    );
  }
}
