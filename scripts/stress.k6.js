import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";

const errRate = new Rate("errors");
const docLat = new Trend("doc_latency");
const apiLat = new Trend("api_latency");

const PATHS = {
  health: "/api/health",
  agents: "/api/agents",
  events: "/api/events?limit=50",
  score: "/api/agents/did:agent:atlas/score",
  profile: "/api/agents/did:agent:atlas",
  docs: "/docs",
  docsApi: "/docs/api",
  docsScoring: "/docs/scoring",
  docsSdk: "/docs/sdk",
  docsArch: "/docs/architecture",
  docsSkill: "/docs/skill",
  llms: "/llms.txt",
  skillMd: "/SKILL.md",
  leaderboard: "/leaderboard",
  explorer: "/explorer",
};

export const options = {
  scenarios: {
    mixed: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 50),
      timeUnit: "1s",
      duration: __ENV.DURATION || "20s",
      preAllocatedVUs: Number(__ENV.VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 400),
    },
  },
  thresholds: {
    errors: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<2000"],
  },
};

function pick(i) {
  const keys = Object.keys(PATHS);
  // 60% API (heavier SQLite), 40% docs/static
  if (i % 5 < 3) {
    const apiKeys = ["health", "agents", "events", "score", "profile"];
    return PATHS[apiKeys[i % apiKeys.length]];
  }
  const docKeys = ["docs", "docsApi", "docsScoring", "docsSdk", "docsArch", "docsSkill", "llms", "skillMd", "leaderboard", "explorer"];
  return PATHS[docKeys[i % docKeys.length]];
}

export default function () {
  const i = __ITER;
  const path = pick(i);
  const res = http.get(`${BASE}${path}`, {
    headers: { Accept: "text/html,application/json,text/plain,*/*" },
    timeout: "30s",
  });

  const ok = check(res, {
    "status 2xx/3xx": (r) => r.status >= 200 && r.status < 400,
    "not 5xx": (r) => r.status < 500,
    "body non-empty": (r) => r.body && r.body.length > 0,
  });
  errRate.add(!ok);

  if (path.startsWith("/docs") || path === "/llms.txt" || path === "/SKILL.md") {
    docLat.add(res.timings.duration);
  } else {
    apiLat.add(res.timings.duration);
  }
}

export function setup() {
  const h = http.get(`${BASE}/api/health`);
  if (h.status !== 200) {
    throw new Error(`health not ready: ${h.status}`);
  }
  return { health: h.json() };
}

export function teardown() {
  // no-op
}
