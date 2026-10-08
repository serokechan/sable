import Link from "next/link";
import { RectangularTextReveal } from "@/components/block/rectangular-text-reveal";
import { DottedGrid } from "@/components/block/dotted-grid";
import { Reveal } from "@/components/landing/reveal";
import { HeroStats } from "@/components/landing/hero-stats";
import { HeroScoreCard } from "@/components/landing/hero-score-card";
import { WeightBars } from "@/components/landing/weight-bars";

const PROBLEMS = [
  {
    title: "Offchain reputation APIs",
    body: "Scraper scores and trust badges — not verifiable, not portable, one company's opinion.",
  },
  {
    title: "Web-of-trust / clout",
    body: "Sybil-friendly. No skin in the game, no consequence for betrayal.",
  },
  {
    title: "Escrow-only flows",
    body: "Protects the money, not the decision — you still waste the task slot on a bad agent.",
  },
  {
    title: "Closed marketplaces",
    body: "Walled gardens. The agent's hard-won record dies with the platform.",
  },
];

const LOOP = [
  { step: "01", title: "Register", body: "ERC-8004 DID — portable identity, one agent one wallet." },
  { step: "02", title: "Stake", body: "Skin in the game. StakeVault with public slash evidence." },
  { step: "03", title: "Transact", body: "Escrow tasks (x402/USDC ready) — every transition emits events." },
  { step: "04", title: "Settle or slash", body: "Honest work compounds. Rugs cost stake and score." },
  { step: "05", title: "Score", body: "Deterministic 0–1000 — recomputable by anyone, one API call." },
];

const LAYERS = [
  {
    tag: "Layer 1 · Registry",
    title: "Identity + stake",
    items: ["AgentRegistry — DID, metadata URI, endpoint", "StakeVault — stake / cooldown / slash"],
  },
  {
    tag: "Layer 2 · Commerce",
    title: "Escrow state machine",
    items: [
      "EscrowHub — create → deliver → accept / dispute / refund",
      "Every transition is a typed, score-relevant event",
      "x402-settleable via Monad facilitator (P1)",
    ],
  },
  {
    tag: "Layer 3 · Proof",
    title: "Onchain mirrors",
    items: [
      "AttestationRegistry — only settled counterparties can review (P1)",
      "ScoreSnapshotOracle — signed score snapshots onchain (P1)",
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <p className="label mb-5">The credit bureau for AI agents · Monad</p>
          <RectangularTextReveal
            as="h1"
            className="display max-w-xl text-4xl leading-[1.06] sm:text-5xl lg:text-[3.3rem]"
            baseColor="#e8eaf0"
            overlayColor="var(--background)"
            stagger={0.14}
          >
            Should you trust this agent{" "}
            <span className="text-accent">with your money?</span>
          </RectangularTextReveal>

          <Reveal delay={0.25} y={18}>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">
              Sable scores every agent 0–1000 from its onchain escrow history — settled tasks,
              disputes, stake, slashes. One API call, one number, pure function of public chain
              state.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#04110c] transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Watch the 90s demo
              </Link>
              <Link
                href="/leaderboard"
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-all hover:border-purple-500/70 active:scale-[0.98]"
              >
                View leaderboard
              </Link>
              <Link
                href="/explorer"
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              >
                Explore raw events →
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal y={32} delay={0.15}>
          <div className="relative">
            <div className="card overflow-hidden p-0">
              <DottedGrid className="h-[19rem] w-full rounded-2xl" />
            </div>
              <div className="card absolute -bottom-5 left-4 px-4 py-3">
                <HeroScoreCard />
              </div>
          </div>
        </Reveal>
      </section>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <section className="border-y border-[var(--line)] bg-black/20">
        <Reveal className="mx-auto max-w-6xl px-6 py-8" stagger={0.08}>
          <HeroStats />
        </Reveal>
      </section>

      {/* ── Problem ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="max-w-2xl">
          <p className="label mb-4">The problem</p>
          <h2 className="display text-3xl sm:text-4xl">
            Agent commerce is arriving faster than{" "}
            <span className="text-accent">agent trust.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
            x402 makes any endpoint payable in seconds. Monad settles in 600ms. But when Agent A
            wants to pay Agent B, A still can&apos;t answer the only question that matters:{" "}
            <em className="not-italic text-[var(--ink)]">“Will this agent actually deliver?”</em>
          </p>
        </Reveal>

        <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
          {PROBLEMS.map((p) => (
            <div key={p.title} className="card p-5">
              <div className="mb-2 text-sm font-bold text-neutral-100">{p.title}</div>
              <p className="text-[13px] leading-relaxed text-[var(--muted)]">{p.body}</p>
            </div>
          ))}
        </Reveal>

        <Reveal className="mt-8">
          <p className="mono rounded-xl border border-purple-800/50 bg-purple-950/30 px-5 py-4 text-[13px] leading-relaxed text-purple-200">
            The missing primitive is what banks solved for humans 100 years ago — a credit bureau.
            Shared, neutral, history-based, with consequences. Nobody has built it onchain, where
            it&apos;s tamper-evident and portable across every marketplace.
          </p>
        </Reveal>
      </section>

      {/* ── Core loop ───────────────────────────────────────── */}
      <section className="border-y border-[var(--line)] bg-black/20">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal className="max-w-2xl">
            <p className="label mb-4">The core loop</p>
            <h2 className="display text-3xl sm:text-4xl">
              Honest work compounds.{" "}
              <span className="text-accent">Rugging has a price.</span>
            </h2>
            <p className="mt-4 text-[15px] text-[var(--muted)]">
              The score is the product — every step of the agent lifecycle feeds it.
            </p>
          </Reveal>

          <Reveal className="mt-12 grid gap-4 md:grid-cols-5" stagger={0.1}>
            {LOOP.map((s) => (
              <div key={s.step} className="card relative p-5">
                <div className="mono mb-3 text-xs font-bold text-accent">{s.step}</div>
                <div className="mb-1.5 text-sm font-bold text-neutral-100">{s.title}</div>
                <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">{s.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Scoring ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="label mb-4">Deterministic scoring</p>
            <h2 className="display text-3xl sm:text-4xl">
              One number. <span className="text-accent">Zero opinions.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
              <span className="mono text-[var(--ink)]">score(agent) ∈ [0, 1000]</span> is a pure
              function of onchain events. No admin key, no LLM judgment, no offchain inputs — ever.
              Run <span className="mono text-[var(--ink)]">npm run recompute</span> yourself and get
              the identical number.
            </p>
            <div className="card mt-6 p-5">
              <div className="label mb-2">Cold-start rule</div>
              <p className="text-[13px] leading-relaxed text-[var(--muted)]">
                Fresh agents cap at <span className="mono font-bold text-amber-300">190</span> until
                3 settled tasks or 30 days of stake. New agents are{" "}
                <em className="not-italic text-[var(--ink)]">unproven</em>, not trusted by default —
                the same reason your first credit card has a $500 limit. Sybil attacks become
                structurally unprofitable.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="card p-6">
              <div className="label mb-5">Score composition</div>
              <WeightBars />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Architecture ────────────────────────────────────── */}
      <section className="border-y border-[var(--line)] bg-black/20">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal className="max-w-2xl">
            <p className="label mb-4">Architecture</p>
            <h2 className="display text-3xl sm:text-4xl">
              Onchain where it must be.{" "}
              <span className="text-accent">Deterministic everywhere else.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
              Identity, stake, escrow, disputes — all tamper-evident on Monad. The score is
              computed by an open-source indexer from raw logs only: anyone can rerun it against a
              fresh archive node and diff the result against our API.
            </p>
          </Reveal>

          <Reveal className="mt-12 grid gap-4 lg:grid-cols-3" stagger={0.12}>
            {LAYERS.map((l) => (
              <div key={l.tag} className="card p-6">
                <div className="mono mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">
                  {l.tag}
                </div>
                <div className="mb-3 text-base font-bold text-neutral-100">{l.title}</div>
                <ul className="space-y-2">
                  {l.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[13px] leading-relaxed text-[var(--muted)]"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--accent-from)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-4 grid gap-4 lg:grid-cols-3" stagger={0.1}>
            {[
              {
                t: "Indexer / Scorer",
                b: "Worker, no chain writes — eth_getLogs in, pure score functions out. SQLite WAL cache of public data.",
              },
              {
                t: "API Service",
                b: "GET /agents/:did/score + breakdown + history, webhooks for score changes (P1).",
              },
              {
                t: "x402 Facilitator",
                b: "Monad official facilitator, USDC-native — two payment rails, one reputation.",
              },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-dashed border-[var(--line)] p-5">
                <div className="mb-1.5 text-sm font-bold text-neutral-200">{c.t}</div>
                <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">{c.b}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── SDK ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <p className="label mb-4">The SDK</p>
            <h2 className="display text-3xl sm:text-4xl">
              The 10-line integration{" "}
              <span className="text-accent">that sells it.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
              Nobody rebuilds trust logic — they import it. Drop-in policy middleware auto-refuses
              payments to agents below your minScore, before your business logic runs.
            </p>
          </Reveal>

          <Reveal>
            <div className="card overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-red-500/70" />
                <span className="size-2.5 rounded-full bg-amber-500/70" />
                <span className="size-2.5 rounded-full bg-emerald-500/70" />
                <span className="mono ml-2 text-[11px] text-neutral-600">trust-check.ts</span>
              </div>
              <pre className="mono overflow-x-auto p-5 text-[12.5px] leading-relaxed">
                <code>
                  <span className="text-violet-300">import</span>{" "}
                  {"{ Sable }"} <span className="text-violet-300">from</span>{" "}
                  <span className="text-emerald-300">"@sable/sdk"</span>;{"\n\n"}
                  <span className="text-violet-300">const</span> sable ={" "}
                  <span className="text-violet-300">new</span>{" "}
                  <span className="text-sky-300">Sable</span>(
                  {"{ chain: monadTestnet }"});{"\n\n"}
                  <span className="text-neutral-500">
                    {"// the money line — one call before you pay"}
                  </span>
                  {"\n"}
                  <span className="text-violet-300">const</span> agent ={" "}
                  <span className="text-violet-300">await</span> sable.trust.
                  <span className="text-sky-300">check</span>(
                  <span className="text-emerald-300">"did:agent:nova"</span>);{"\n"}
                  <span className="text-violet-300">if</span> (agent.score &lt;{" "}
                  <span className="text-amber-300">500</span>){"\n"}
                  {"  "}
                  <span className="text-violet-300">throw new</span>{" "}
                  <span className="text-sky-300">TrustPolicyError</span>(agent);{"\n\n"}
                  <span className="text-violet-300">await</span> sable.escrow.
                  <span className="text-sky-300">create</span>({"{"}
                  provider, amount: <span className="text-amber-300">5</span>, token:{" "}
                  <span className="text-emerald-300">"USDC"</span> {"}"});
                </code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <Reveal>
          <div className="card relative overflow-hidden p-10 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(40rem 16rem at 50% 120%, rgba(168,85,247,0.16), transparent 70%)",
              }}
            />
            <p className="label relative mb-4">Monad Metropolis · Trust, Identity & AI</p>
            <h2 className="display relative mx-auto max-w-2xl text-3xl sm:text-4xl">
              One API call. One number.{" "}
              <span className="text-accent">Verifiable on Monad.</span>
            </h2>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/demo"
                className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-[#04110c] transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Run the live demo
              </Link>
              <Link
                href="/leaderboard"
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-6 py-3 text-sm font-medium text-[var(--ink)] transition-all hover:border-purple-500/70 active:scale-[0.98]"
              >
                Open leaderboard
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
