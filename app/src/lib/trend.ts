export interface TrendEvent {
  ts: number;
  name: string;
}

export interface DayBucket {
  /** YYYY-MM-DD (UTC) */
  key: string;
  created: number;
  settled: number;
  slashed: number;
  total: number;
}

const DAY_MS = 86_400_000;

/** Bucket task events into UTC days for the last `days` days (including today). */
export function buildDailyBuckets(events: TrendEvent[], nowSec: number, days = 14): DayBucket[] {
  const todayUtc = Math.floor((nowSec * 1000) / DAY_MS) * DAY_MS;
  const buckets: DayBucket[] = [];
  const index = new Map<string, DayBucket>();

  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(todayUtc - i * DAY_MS).toISOString().slice(0, 10);
    const bucket: DayBucket = { key, created: 0, settled: 0, slashed: 0, total: 0 };
    buckets.push(bucket);
    index.set(key, bucket);
  }

  for (const ev of events) {
    const key = new Date(ev.ts * 1000).toISOString().slice(0, 10);
    const bucket = index.get(key);
    if (!bucket) continue;
    if (ev.name === "task_created") bucket.created += 1;
    else if (ev.name === "task_settled") bucket.settled += 1;
    else if (ev.name === "slashed") bucket.slashed += 1;
    else continue;
    bucket.total = bucket.created + bucket.settled;
  }

  return buckets;
}
