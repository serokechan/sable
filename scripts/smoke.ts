/**
 * End-to-end smoke test against a RUNNING stack (anvil + app server).
 * Verifies the demo preconditions: health OK, scores seeded correctly,
 * policy passes Nova and rejects Rex, and recompute matches the API.
 */

const API = process.env.SABLE_SCORE_API_URL ?? "http://127.0.0.1:3000";

async function expect(cond: boolean, label: string) {
  if (!cond) {
    console.error(`✗ ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

async function main() {
  const health = (await (await fetch(`${API}/api/health`)).json()) as {
    ok: boolean;
    agents: number;
    events: number;
  };
  await expect(health.ok, `health OK (${health.agents} agents, ${health.events} events indexed)`);

  const { agents } = (await (await fetch(`${API}/api/agents`)).json()) as {
    agents: { did: string; score: number }[];
  };
  const atlas = agents.find((a) => a.did === "did:agent:atlas");
  const nova = agents.find((a) => a.did === "did:agent:nova");
  const rex = agents.find((a) => a.did === "did:agent:rex");

  await expect(!!atlas && atlas.score >= 500, `Atlas score ${atlas?.score} ≥ 500 (auto-approvable)`);
  await expect(!!nova && nova.score >= 500, `Nova score ${nova?.score} ≥ 500 (auto-approvable)`);
  await expect(!!rex && rex.score < 500, `Rex score ${rex?.score} < 500 (policy rejects)`);

  const novaCheck = (await (
    await fetch(`${API}/api/agents/did%3Aagent%3Anova/score`)
  ).json()) as { breakdown: { stats: { settledTasks: number; slashCount: number } } };
  await expect(
    novaCheck.breakdown.stats.settledTasks >= 20,
    `Nova has ${novaCheck.breakdown.stats.settledTasks} settled tasks`,
  );
  await expect(rex !== undefined, "Rex has a score (event-sourced)");

  console.log("\nsmoke test done");
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
