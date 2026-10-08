/**
 * Demo stage backend — drives the Atlas/Nova/Rex scenario live (PRD §8).
 * The bots execute through @sable/sdk exactly like third-party integrations.
 */

import { NextResponse } from "next/server";
import fs from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { createBots, PERSONAS, type BotSet } from "@sable/agents";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

const TASK_SPEC = "Summarize these 10 PDFs";
const DELIVERABLE = "10 PDF summaries, cited, ~200 words each";
const TASK_AMOUNT_WEI = 5_000_000_000_000_000_000n; // 5 whole units

interface DemoState {
  taskId: bigint | null;
  phase: "idle" | "posted" | "delivered" | "settled";
  lastVerdicts: {
    nova?: unknown;
    rex?: unknown;
  } | null;
  log: { ts: number; text: string; kind: "info" | "ok" | "reject" }[];
}

interface DemoStateStored {
  taskId: string | null;
  phase: "idle" | "posted" | "delivered" | "settled";
  lastVerdicts: {
    nova?: unknown;
    rex?: unknown;
  } | null;
  log: { ts: number; text: string; kind: "info" | "ok" | "reject" }[];
}

function loadState(): DemoState {
  try {
    const { db } = getRuntime();
    const raw = db.kvGet("demo_state");
    if (raw) {
      const p = JSON.parse(raw) as DemoStateStored;
      return {
        taskId: p.taskId ? BigInt(p.taskId) : null,
        phase: p.phase || "idle",
        lastVerdicts: p.lastVerdicts || null,
        log: p.log || [],
      };
    }
  } catch {
    // fallback
  }
  return { taskId: null, phase: "idle", lastVerdicts: null, log: [] };
}

function saveState(s: DemoState) {
  try {
    const { db } = getRuntime();
    const stored: DemoStateStored = {
      taskId: s.taskId ? s.taskId.toString() : null,
      phase: s.phase,
      lastVerdicts: s.lastVerdicts,
      log: s.log,
    };
    db.kvSet("demo_state", JSON.stringify(stored));
  } catch {
    // ignore
  }
}

function state(): DemoState {
  const g = globalThis as unknown as { __sableDemoState?: DemoState };
  if (!g.__sableDemoState) {
    g.__sableDemoState = loadState();
  }
  return g.__sableDemoState;
}

function bots(): BotSet {
  const { addresses } = getRuntime();
  const rpcUrl = process.env.SABLE_RPC_URL ?? "http://127.0.0.1:8545";
  const scoreApiUrl = process.env.SABLE_SCORE_API_URL ?? "http://127.0.0.1:3000";

  // On Monad testnet the well-known anvil addresses are already EIP-7702
  // delegated — use the fresh demo keys instead when configured.
  const botsFile = process.env.SABLE_BOTS_FILE;
  if (botsFile) {
    try {
      const raw = JSON.parse(fs.readFileSync(botsFile, "utf8")) as {
        atlas: { privateKey: `0x${string}` };
        nova: { privateKey: `0x${string}` };
        rex: { privateKey: `0x${string}` };
      };
      return createBots({
        rpcUrl,
        addresses,
        scoreApiUrl,
        accounts: {
          atlas: privateKeyToAccount(raw.atlas.privateKey),
          nova: privateKeyToAccount(raw.nova.privateKey),
          rex: privateKeyToAccount(raw.rex.privateKey),
        },
      });
    } catch {
      // fall through to default anvil accounts
    }
  }

  return createBots({ rpcUrl, addresses, scoreApiUrl });
}

function pushLog(text: string, kind: DemoState["log"][number]["kind"]) {
  const s = state();
  s.log.unshift({ ts: Date.now(), text, kind });
  s.log = s.log.slice(0, 50);
  saveState(s);
}

export async function GET() {
  const s = state();
  return NextResponse.json({
    phase: s.phase,
    taskId: s.taskId?.toString() ?? null,
    personas: PERSONAS,
    log: s.log,
    lastVerdicts: s.lastVerdicts,
  });
}

export async function POST(req: Request) {
  try {
    const { action } = (await req.json()) as { action: string };
    const set = bots();
    const s = state();

    switch (action) {
      case "reset": {
        s.taskId = null;
        s.phase = "idle";
        s.lastVerdicts = null;
        s.log = [];
        saveState(s);
        return NextResponse.json({ ok: true, phase: s.phase });
      }

      case "post_task": {
        // Step 1 — Atlas posts a task escrowed to Nova
        const novaAgentId = await set.atlas.k.resolveAgentId(PERSONAS.nova.did);
        const taskId = await set.atlas.postTask(PERSONAS.nova.did, TASK_AMOUNT_WEI, TASK_SPEC);
        s.taskId = taskId;
        s.phase = "posted";
        pushLog(`Atlas escrowed 5 units → task #${taskId} (provider agent #${novaAgentId})`, "info");
        saveState(s);
        return NextResponse.json({ ok: true, taskId: taskId.toString(), phase: s.phase });
      }

      case "policy_check_nova": {
        // Step 2 — Atlas's trust policy vets Nova → auto-approve on testnet data
        // (scores are day-0 without anvil time-warp; threshold tuned so Nova passes, Rex fails)
        const minScore = 300;
        const verdict = await set.atlas.vet(PERSONAS.nova.did, minScore);
        s.lastVerdicts = { ...s.lastVerdicts, nova: verdict };
        pushLog(
          `Policy check Nova: ${verdict.score} ≥ ${minScore} → AUTO-APPROVED`,
          verdict.verdict === "pass" ? "ok" : "reject",
        );
        saveState(s);
        return NextResponse.json({ ok: true, verdict });
      }

      case "policy_check_rex": {
        // Plot twist — Rex applies, policy rejects him live
        const minScore = 300;
        const verdict = await set.atlas.vet(PERSONAS.rex.did, minScore);
        s.lastVerdicts = { ...s.lastVerdicts, rex: verdict };
        pushLog(
          `Policy check Rex: ${verdict.score} < ${minScore} → REJECTED (${verdict.reasons.join("; ")})`,
          "reject",
        );
        saveState(s);
        return NextResponse.json({ ok: true, verdict });
      }

      case "nova_work": {
        // Step 3+4 — Nova accepts and delivers
        if (!s.taskId) return NextResponse.json({ error: "no active task" }, { status: 400 });
        await set.nova.accept(s.taskId);
        await set.nova.deliver(s.taskId, DELIVERABLE);
        s.phase = "delivered";
        pushLog(`Nova delivered → deliverable hash onchain (task #${s.taskId})`, "info");
        saveState(s);
        return NextResponse.json({ ok: true, phase: s.phase });
      }

      case "atlas_release": {
        // Step 5 — Atlas verifies and releases; scorer ticks Nova's score within one block
        if (!s.taskId) return NextResponse.json({ error: "no active task" }, { status: 400 });
        await set.atlas.acceptDelivery(s.taskId);
        s.phase = "settled";
        pushLog(`Atlas released escrow → task #${s.taskId} SETTLED — watch the leaderboard`, "ok");
        saveState(s);
        return NextResponse.json({ ok: true, phase: s.phase });
      }

      default:
        return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
