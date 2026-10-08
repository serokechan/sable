import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyBuckets } from "./trend.js";

// 2026-01-15T12:00:00Z
const NOW = 1768488000;

test("returns fixed-length buckets ending today (UTC)", () => {
  const buckets = buildDailyBuckets([], NOW, 14);
  assert.equal(buckets.length, 14);
  assert.equal(buckets[buckets.length - 1].key, "2026-01-15");
  assert.equal(buckets[0].key, "2026-01-02");
  assert.ok(buckets.every((b) => b.total === 0));
});

test("counts created / settled / slashed into matching day", () => {
  const day = (iso: string, name: string, tsOffset = 43200) => ({
    ts: Math.floor(new Date(iso).getTime() / 1000) + tsOffset,
    name,
  });
  const buckets = buildDailyBuckets(
    [
      day("2026-01-15", "task_created"),
      day("2026-01-15", "task_settled"),
      day("2026-01-15", "slashed"),
      day("2026-01-10", "task_created"),
      day("2026-01-10", "task_settled"),
      day("2026-01-01", "task_created"), // outside window
      day("2026-01-15", "registered"), // ignored
    ],
    NOW,
    14,
  );
  const today = buckets[buckets.length - 1];
  assert.equal(today.created, 1);
  assert.equal(today.settled, 1);
  assert.equal(today.slashed, 1);
  assert.equal(today.total, 2);

  const jan10 = buckets.find((b) => b.key === "2026-01-10");
  assert.ok(jan10);
  assert.equal(jan10.total, 2);
  assert.equal(jan10.slashed, 0);

  assert.ok(buckets.every((b) => b.key !== "2026-01-01"));
});

test("total ignores slash-only days for bar height but keeps slash flag", () => {
  const ts = Math.floor(new Date("2026-01-14").getTime() / 1000) + 43200;
  const buckets = buildDailyBuckets([{ ts, name: "slashed" }], NOW, 14);
  const d = buckets.find((b) => b.key === "2026-01-14");
  assert.ok(d);
  assert.equal(d.total, 0);
  assert.equal(d.slashed, 1);
});
