# Public Docs Site + Agent Entry Files — Design

**Date:** 2026-09-24  
**Status:** Approved (conversation)  
**Scope:** Human-readable public docs under `/docs` on the Sable app; machine-readable `llms.txt` + `SKILL.md` served from the site. No ops/secrets content.

---

## Goals

1. Other **users** can browse product docs in the running app (multi-page + sidebar).
2. **Other agents** can fetch `llms.txt` and `SKILL.md` over HTTP (and find `SKILL.md` in the repo root).
3. Public surface is **allowlist-only** — never Deployment / Operations / Development / PRD / keys / runbooks.

## Non-goals

- Full docs framework (Docusaurus, Fumadocs, etc.).
- Editing markdown as CMS.
- Exposing raw repo paths or arbitrary files under `docs/`.
- i18n; docs remain English as in source files.

---

## Information architecture

### HTML routes

| Route | Source file (repo) | Notes |
|-------|--------------------|--------|
| `/docs` | generated overview | TOC + short product blurb + links |
| `/docs/api` | `docs/API.md` | full API reference |
| `/docs/scoring` | `docs/SCORING.md` | weights, cold start, determinism |
| `/docs/sdk` | `docs/SDK.md` | `@sable/sdk` usage |
| `/docs/architecture` | `docs/ARCHITECTURE.md` | system design (public) |
| `/docs/skill` | `SKILL.md` (root) | human-readable render of skill file |

Unknown slug → **404**.

### Machine-readable (public HTTP)

| URL | Disk | Content-Type |
|-----|------|----------------|
| `/llms.txt` | `app/public/llms.txt` | `text/plain; charset=utf-8` |
| `/SKILL.md` | `app/public/SKILL.md` | `text/markdown; charset=utf-8` |

Repo root also has `SKILL.md` for clone-based agents. **Single source of truth = root `SKILL.md`**; `app/public/SKILL.md` is a copy kept in sync (build step or explicit copy task — not a silent drift-prone fork).

### Excluded from site (never routed)

- `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/DEVELOPMENT.md`, `docs/PRD.md`, `docs/README.md`, `docs/API.md` extras beyond allowlist, any `*.env*`, bot key JSON, private keys.

---

## Allowlist implementation

Hardcoded allowlist in one module, e.g. `app/src/server/docs.ts` (or `app/src/lib/docs.ts`):

```ts
export const DOCS_ALLOWLIST = [
  { slug: "api", file: "API.md", title: "API" },
  { slug: "scoring", file: "SCORING.md", title: "Scoring" },
  { slug: "sdk", file: "SDK.md", title: "SDK" },
  { slug: "architecture", file: "ARCHITECTURE.md", title: "Architecture" },
  { slug: "skill", file: "../SKILL.md", title: "Skill" }, // relative to docs/ → repo root
] as const;
```

Loader reads **only** by resolving `slug` → allowlist entry → absolute path under repo (or `public/` for skill if preferred). Reject any user-supplied path.

**SKILL source decision:** Prefer loading **root** `SKILL.md` for both `/docs/skill` and a small server route that re-exports it, **or** copy root → `app/public/SKILL.md` and render from `public/`. Choose one and document it; default in plan: **root is source**, copy into `app/public/SKILL.md` when content changes (script or manual sync step in plan), and `/docs/skill` reads the same file the copy came from (root).

---

## Rendering

- Server components (RSC) only — no client JS required for docs body.
- Markdown → HTML via a light library already acceptable in Next (e.g. `marked` or `remark`/`rehype` — pick one in implementation plan; prefer minimal deps).
  - If adding a dep is undesirable: pre-existing patterns none → use `marked` + sanitize (DOMPurify or sanitize-html) **or** a tiny subset renderer. **Must sanitize** before `dangerouslySetInnerHTML`.
- Code blocks: `<pre><code>`, inherit theme mono font; optional syntax highlight **out of scope** (YAGNI).
- Headings: stable `id` slugs for in-page anchors from overview TOC.

### Overview `/docs`

- Title + one-paragraph Sable blurb (same as README one-liner).
- Cards or list linking to each allowlisted page with description.
- Links to `/llms.txt` and `/SKILL.md` for agents (“For LLM agents”).

### Detail layout

- **Sidebar** (sticky): Overview, API, Scoring, SDK, Architecture, Skill; active state.
- **Main:** `h1` from first heading or page title; rendered markdown.
- **Global nav:** add `{ href: "/docs", label: "Docs" }` to `app/src/components/nav.tsx`.
- Layout: own shell under `app/src/app/docs/layout.tsx` (not nested under `(dash)` unless visual parity demands it — prefer separate so marketing/docs chrome stays simple).
- Theme: existing CSS variables (`--ink`, `--muted`, purple accent `#a855f7`); **no gradients**.

---

## `llms.txt` content (static file)

`app/public/llms.txt`:

```text
# Sable — Agent Credit Bureau

> ERC-8004 identity + deterministic score 0–1000 + stake-slash. One-call trust check for agent-to-agent commerce on Monad.

Human docs: /docs
API: /docs/api
Scoring: /docs/scoring
SDK: /docs/sdk
Skill (agents): /SKILL.md
Score endpoint: GET /api/agents/:did/score
Health: GET /api/health

No private keys. Public docs only.
```

(Exact wording refined in implementation; must stay secret-free.)

---

## `SKILL.md` content (public)

Root `SKILL.md` — agent-facing skill document:

- **Name / description:** use Sable to trust-check and escrow with agent DIDs.
- **When to use:** hirer gating, score queries, demo integration.
- **Key APIs:** `GET /api/agents/:did/score`, `GET /api/health`, SDK `check` / `createEscrow` snippets.
- **Scoring summary:** weights table pointer, cold-start 190, slash −150.
- **Testnet:** chainId 10143, public RPC URL (not secrets).
- **Explicitly omit:** private keys, deploy commands with PK, faucet wallet ops, internal file paths for secrets, OPERATIONS incidents.

`app/public/SKILL.md` = byte-identical copy of root (sync rule above).

---

## Data flow

```
Browser  GET /docs/api
  → app/docs/[slug]/page.tsx
  → allowlist lookup
  → fs.readFile(docs/API.md)
  → markdown → sanitize → HTML
  → docs layout (sidebar) + content

Agent    GET /llms.txt | /SKILL.md
  → static files in app/public/ (Next serves public/)
```

Indexer/API unaffected.

---

## Error handling

| Case | Behavior |
|------|----------|
| Unknown `/docs/*` slug | Next 404 page |
| Allowlisted file missing on disk | 500 + console.error (dev: clear message) |
| Markdown empty | Render empty body + title |
| Sanitizer strips everything | Still return shell, not crash |

---

## Testing / verification

Manual (no e2e harness assumed):

1. `GET /docs`, each subpage → **200**, sidebar active state.
2. `GET /docs/deployment` (not allowlisted) → **404**.
3. `GET /llms.txt`, `/SKILL.md` → 200, correct content-type, no `PRIVATE`/`0x` key patterns.
4. Grep built output / response body for `DEPLOYER_PRIVATE_KEY` and `testnet-bots` → **no match**.
5. Nav shows Docs; theme consistent (no gradient regression).
6. Optional: unit test allowlist rejects unknown slug (`bun run test` in core not required — app-level only if a test file is added).

---

## Security / secrecy rules

- Allowlist only; never `req.url` → path join without map.
- Do not copy OPERATIONS/DEPLOYMENT/PRD into `public/`.
- `llms.txt` / `SKILL.md` / HTML: **scan for secrets** before commit (manual grep step in plan).
- Repo already gitignores `.env*` and `testnet-bots.json` — keep it that way.

---

## File map (planned)

| Action | Path |
|--------|------|
| Create | `SKILL.md` (repo root) |
| Create | `app/public/llms.txt` |
| Create | `app/public/SKILL.md` (copy) |
| Create | `app/src/lib/docs.ts` (allowlist + loader) |
| Create | `app/src/app/docs/layout.tsx` |
| Create | `app/src/app/docs/page.tsx` |
| Create | `app/src/app/docs/[slug]/page.tsx` |
| Modify | `app/src/components/nav.tsx` (+ Docs) |
| Optional | markdown render helper `app/src/lib/markdown.ts` |

No changes to packages/core, contracts, or indexer.

---

## Success criteria

- User opens **Docs** in nav, reads API/Scoring/SDK/Architecture/Skill with sidebar.
- Agent `GET /llms.txt` and `/SKILL.md` gets complete public trust/SDK summary.
- Zero deployment/ops/secret content on HTTP surface.
