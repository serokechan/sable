/**
 * SQLite persistence for the indexer + score API (node:sqlite, single-writer).
 * The DB is a cache/index of public chain data — source of truth is always the chain.
 */

import { DatabaseSync } from "node:sqlite";
import type { ScoreEvent, ScoreMap } from "./types.js";

export interface StoredAgent {
  agent_id: string;
  did: string;
  owner: string;
  metadata_uri: string;
  endpoint: string;
  active: number;
  registered_at: number;
}

export interface StoredEvent {
  id: number;
  block: number;
  ts: number;
  name: string;
  agent_ids: string;
  data: string;
}

export class SableDB {
  readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agents (
        agent_id TEXT PRIMARY KEY,
        did TEXT UNIQUE NOT NULL,
        owner TEXT NOT NULL,
        metadata_uri TEXT NOT NULL DEFAULT '',
        endpoint TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        registered_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        name TEXT NOT NULL,
        agent_ids TEXT NOT NULL DEFAULT '',
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
      CREATE INDEX IF NOT EXISTS idx_events_block ON events(block);
      CREATE TABLE IF NOT EXISTS scores (
        agent_id TEXT PRIMARY KEY,
        did TEXT,
        score INTEGER NOT NULL,
        breakdown TEXT NOT NULL
      );
    `);
  }

  kvGet(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  kvSet(key: string, value: string) {
    this.db
      .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, value);
  }

  lastBlock(): number {
    const v = this.kvGet("last_block");
    return v === null ? -1 : Number(v);
  }

  setLastBlock(block: number) {
    this.kvSet("last_block", String(block));
  }

  upsertAgent(a: {
    agentId: string;
    did: string;
    owner: string;
    metadataUri?: string;
    endpoint?: string;
    active?: boolean;
    registeredAt: number;
  }) {
    this.db
      .prepare(
        `INSERT INTO agents (agent_id, did, owner, metadata_uri, endpoint, active, registered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET
           metadata_uri = excluded.metadata_uri, endpoint = excluded.endpoint, active = excluded.active`,
      )
      .run(
        a.agentId,
        a.did,
        a.owner,
        a.metadataUri ?? "",
        a.endpoint ?? "",
        a.active === false ? 0 : 1,
        a.registeredAt,
      );
  }

  setAgentActive(agentId: string, active: boolean) {
    this.db.prepare("UPDATE agents SET active = ? WHERE agent_id = ?").run(active ? 1 : 0, agentId);
  }

  insertEvent(ev: ScoreEvent, name: string, agentIds: string[]) {
    this.db
      .prepare("INSERT INTO events (block, ts, name, agent_ids, data) VALUES (?, ?, ?, ?, ?)")
      .run(ev.block, ev.ts, name, agentIds.join(","), JSON.stringify(ev));
  }

  allEvents(): ScoreEvent[] {
    const rows = this.db.prepare("SELECT data FROM events ORDER BY id").all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as ScoreEvent);
  }

  recentEvents(limit: number, offset = 0): StoredEvent[] {
    return this.db
      .prepare("SELECT id, block, ts, name, agent_ids, data FROM events ORDER BY id DESC LIMIT ? OFFSET ?")
      .all(limit, offset) as unknown as StoredEvent[];
  }

  agentEvents(did: string, limit = 200): StoredEvent[] {
    const rows = this.db
      .prepare(
        `SELECT e.id, e.block, e.ts, e.name, e.agent_ids, e.data
         FROM events e JOIN agents a ON instr(e.agent_ids, a.agent_id) > 0
         WHERE a.did = ? ORDER BY e.id DESC LIMIT ?`,
      )
      .all(did, limit) as unknown as StoredEvent[];
    return rows;
  }

  replaceScores(scores: ScoreMap) {
    const tx = this.db;
    tx.exec("BEGIN");
    try {
      tx.prepare("DELETE FROM scores").run();
      const ins = tx.prepare("INSERT INTO scores (agent_id, did, score, breakdown) VALUES (?, ?, ?, ?)");
      for (const s of Object.values(scores)) {
        ins.run(s.agentId, s.did, s.score, JSON.stringify(s));
      }
      tx.exec("COMMIT");
    } catch (e) {
      tx.exec("ROLLBACK");
      throw e;
    }
  }

  listAgents(): StoredAgent[] {
    return this.db
      .prepare("SELECT * FROM agents ORDER BY registered_at")
      .all() as unknown as StoredAgent[];
  }

  getAgent(did: string): StoredAgent | undefined {
    return this.db.prepare("SELECT * FROM agents WHERE did = ?").get(did) as
      | StoredAgent
      | undefined;
  }

  getScore(agentId: string): { score: number; breakdown: string } | undefined {
    return this.db.prepare("SELECT score, breakdown FROM scores WHERE agent_id = ?").get(agentId) as
      | { score: number; breakdown: string }
      | undefined;
  }

  getScoreByDid(did: string): { score: number; breakdown: string } | undefined {
    return this.db.prepare("SELECT score, breakdown FROM scores WHERE did = ?").get(did) as
      | { score: number; breakdown: string }
      | undefined;
  }

  countEvents(): number {
    const row = this.db.prepare("SELECT COUNT(*) as c FROM events").get() as { c: number };
    return row.c;
  }

  close() {
    this.db.close();
  }
}
