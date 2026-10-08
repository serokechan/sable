import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** GET /api/events?limit=100 — the raw score-relevant event feed (reputation explorer). */
export async function GET(req: Request) {
  try {
    const { db } = getRuntime();
    const url = new URL(req.url);
    const limit = Math.min(500, Number(url.searchParams.get("limit") ?? 100));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    return NextResponse.json({ events: db.recentEvents(limit, offset) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 503 },
    );
  }
}
