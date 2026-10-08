"use client";

import type { TrustVerdict } from "@sable/sdk";
import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/components/ui";

interface DemoState {
  phase: "idle" | "posted" | "delivered" | "settled";
  taskId: string | null;
  personas: Record<string, { name: string; did: string; emoji: string; blurb: string }>;
  log: { ts: number; text: string; kind: "info" | "ok" | "reject" }[];
  lastVerdicts: { nova?: TrustVerdict; rex?: TrustVerdict } | null;
}

const STEPS: { action: string; label: string; hint: string; needs?: string }[] = [
  {
    action: "post_task",
    label: "Atlas posts a task (5 units)",
    hint: "EscrowHub.create — escrow funded in one tx",
  },
  {
    action: "policy_check_nova",
    label: "Nova applies — policy vet",
    hint: "trust.check(did:agent:nova) — minScore 300",
  },
  {
    action: "nova_work",
    label: "Nova accepts & delivers",
    hint: "EscrowHub.accept → deliver (deliverable hash onchain)",
    needs: "posted",
  },
  {
    action: "atlas_release",
    label: "Atlas verifies & releases",
    hint: "Escrow settles → watch the leaderboard tick",
    needs: "posted",
  },
  {
    action: "policy_check_rex",
    label: "Plot twist: Rex applies",
    hint: "trust.check(did:agent:rex) — expect REJECTED (below 300)",
  },
];

const PHASES = ["idle", "posted", "delivered", "settled"] as const;

export default function DemoPage() {
  const state = useApi<DemoState>("/api/demo", 700);
  const [busy, setBusy] = useState<string | null>(null);

  const fire = async (action: string) => {
    setBusy(action);
    try {
      await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } finally {
      setBusy(null);
    }
  };

  const phase = state?.phase ?? "idle";
  const phaseIdx = PHASES.indexOf(phase as (typeof PHASES)[number]);
  const novaVerdict = state?.lastVerdicts?.nova as TrustVerdict | undefined;
  const rexVerdict = state?.lastVerdicts?.rex as TrustVerdict | undefined;

  return (
    <div className="space-y-6">
      <section className="rise max-w-2xl">
        <p className="label mb-3">Interactive</p>
        <h1 className="display text-3xl sm:text-4xl">Demo stage</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          The 90-second story, one click per beat: escrow → policy → delivery → release → the
          score moves. Then the plot twist.
        </p>
      </section>

      {/* progress track */}
      <div className="rise rise-2 card flex items-center gap-1 p-3">
        {STEPS.map((s, i) => {
          const done = phaseIdx >= [1, 1, 2, 3, 3][i] && phase !== "idle";
          return (
            <div key={s.action} className="flex flex-1 items-center gap-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  done ? "bg-emerald-400" : "bg-neutral-800"
                }`}
              />
            </div>
          );
        })}
        <span className="mono ml-2 shrink-0 text-[10px] uppercase tracking-widest text-neutral-600">
          {phase}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-6">
          <div className="rise rise-2 card space-y-2.5 p-5">
            {STEPS.map((step, i) => {
              const disabled =
                busy !== null ||
                (step.needs === "posted" && phase !== "posted" && phase !== "delivered");
              return (
                <button
                  key={step.action}
                  disabled={disabled}
                  onClick={() => fire(step.action)}
                  className={`group w-full rounded-xl border px-4 py-3.5 text-left transition-all ${
                    disabled
                      ? "cursor-not-allowed border-[var(--line)] opacity-40"
                      : "border-[var(--line)] bg-black/20 hover:border-emerald-700 hover:bg-emerald-950/20 active:scale-[0.99]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span
                        className={`mono flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                          disabled
                            ? "bg-neutral-800 text-neutral-500"
                            : "bg-emerald-400 text-emerald-950"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-neutral-100">{step.label}</span>
                    </span>
                    {busy === step.action && (
                      <span className="mono flex items-center gap-1.5 text-xs text-emerald-300">
                        <span className="inline-block size-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                        executing
                      </span>
                    )}
                  </div>
                  <div className="mono mt-1 pl-9 text-[11px] text-neutral-600">{step.hint}</div>
                </button>
              );
            })}
            <button
              onClick={() => fire("reset")}
              className="mono w-full rounded-xl px-4 py-2 text-xs text-neutral-600 transition-colors hover:text-neutral-400"
            >
              reset stage
            </button>
          </div>

          <div className="space-y-3">
            {novaVerdict && (
              <div
                className={`rise card p-4 ${
                  novaVerdict.verdict === "pass"
                    ? "border-emerald-800/70 bg-emerald-950/30"
                    : "border-red-800/70 bg-red-950/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    Nova —{" "}
                    <span
                      className={
                        novaVerdict.verdict === "pass" ? "text-emerald-300" : "text-red-300"
                      }
                    >
                      {novaVerdict.verdict === "pass" ? "AUTO-APPROVED" : "REJECTED"}
                    </span>
                  </span>
                  <span className="mono text-xl font-bold text-emerald-300">
                    {novaVerdict.score}
                  </span>
                </div>
                <div className="mono mt-1.5 text-xs text-neutral-500">
                  score {novaVerdict.score} ≥ minScore {novaVerdict.minScore} · reliability from
                  settled history
                </div>
              </div>
            )}
            {rexVerdict && (
              <div className="rise card border-red-800/70 bg-red-950/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-red-200">Rex — REJECTED</span>
                  <span className="mono text-xl font-bold text-red-300">{rexVerdict.score}</span>
                </div>
                <div className="mono mt-1.5 text-xs text-red-300/80">
                  {rexVerdict.reasons.join(" · ")}
                </div>
                <p className="mt-2 text-xs text-neutral-400">
                  Trust has a price — Rex must stake and settle tasks to bootstrap.{" "}
                  <Link
                    href={`/agents/${encodeURIComponent("did:agent:rex")}`}
                    className="text-red-300 underline underline-offset-2 hover:text-red-200"
                  >
                    view profile
                  </Link>
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rise rise-3 card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="label">Cast</h2>
              <span className="mono rounded-md border border-[var(--line)] bg-black/30 px-2 py-0.5 text-[11px] text-neutral-500">
                task {state?.taskId ?? "—"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {state
                ? Object.values(state.personas).map((p) => (
                    <Link
                      key={p.did}
                      href={`/agents/${encodeURIComponent(p.did)}`}
                      className="rounded-xl border border-[var(--line)] bg-black/20 p-3.5 transition-all hover:-translate-y-0.5 hover:border-emerald-700"
                    >
                      <div className="text-2xl">{p.emoji}</div>
                      <div className="mt-1.5 text-sm font-bold">{p.name}</div>
                      <div className="mono text-[10px] text-neutral-600">{p.did}</div>
                      <div className="mt-1.5 text-[11px] leading-snug text-neutral-500">
                        {p.blurb}
                      </div>
                    </Link>
                  ))
                : null}
            </div>
          </div>

          <div className="rise rise-3 card p-5">
            <h2 className="label mb-3">Live log</h2>
            <div className="mono max-h-80 space-y-1.5 overflow-y-auto text-xs">
              {!state || state.log.length === 0 ? (
                <p className="py-6 text-center text-neutral-700">No demo actions yet.</p>
              ) : (
                state.log.map((l, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="shrink-0 text-neutral-700">
                      {new Date(l.ts).toLocaleTimeString("en-US", { hour12: false })}
                    </span>
                    <span
                      className={
                        l.kind === "ok"
                          ? "text-emerald-300"
                          : l.kind === "reject"
                            ? "text-red-400"
                            : "text-neutral-400"
                      }
                    >
                      {l.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
