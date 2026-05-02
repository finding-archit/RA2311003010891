/**
 * priority_inbox.ts — Stage 6: Campus Notifications Priority Inbox
 *
 * Fetches notifications from the evaluation API and computes the top-N
 * most important unread notifications using a min-heap ranked by:
 *   score = typeWeight + recencyScore
 *
 *   typeWeight: Placement=300, Result=200, Event=100
 *   recencyScore = 1 / (1 + hoursOld)  (decays towards 0 as age increases)
 *
 * The min-heap maintains the top-N efficiently — O(log N) per insertion.
 *
 * Author: Archit Gupta — RA2311003010891
 */

import axios from "axios";
import { initLogger, Log } from "../src/index";

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzY5OTM5MSwiaWF0IjoxNzc3Njk4NDkxLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiMWNjMzQ4ZTYtM2Q0Yy00ZTEyLWI1MjEtYmJlYWZiZGM5NGJhIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.O_2INdknGkkZ0UtMZOfYWXPW5zWldryrbWd0DxKViGI";

const TOP_N = 10; // number of priority notifications to display

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationType = "Placement" | "Result" | "Event";

interface RawNotification {
  ID: string;
  Type: NotificationType;
  Message: string;
  Timestamp: string;
}

interface ScoredNotification extends RawNotification {
  score: number;
  typeWeight: number;
  recencyScore: number;
  hoursOld: number;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Type priority weights — Placement > Result > Event */
const TYPE_WEIGHT: Record<NotificationType, number> = {
  Placement: 300,
  Result: 200,
  Event: 100,
};

/**
 * Compute the priority score for a notification.
 * score = typeWeight + recencyScore
 * recencyScore = 1 / (1 + hoursOld)  — decays from ~1 (fresh) towards 0 (old)
 */
function computeScore(notification: RawNotification): ScoredNotification {
  const typeWeight = TYPE_WEIGHT[notification.Type] ?? 0;
  const ts = new Date(notification.Timestamp.replace(" ", "T")).getTime();
  const now = Date.now();
  const hoursOld = Math.max(0, (now - ts) / (1000 * 60 * 60));
  const recencyScore = 1 / (1 + hoursOld);
  const score = typeWeight + recencyScore;

  return { ...notification, score, typeWeight, recencyScore, hoursOld };
}

// ─── Min-Heap ─────────────────────────────────────────────────────────────────

/**
 * A min-heap of ScoredNotification keyed by `score`.
 * Keeps the top-N highest scoring items by evicting the minimum when full.
 */
class MinHeap {
  private heap: ScoredNotification[] = [];

  constructor(private readonly maxSize: number) {}

  get size(): number {
    return this.heap.length;
  }

  get min(): ScoredNotification | undefined {
    return this.heap[0];
  }

  push(item: ScoredNotification): void {
    if (this.heap.length < this.maxSize) {
      this.heap.push(item);
      this._bubbleUp(this.heap.length - 1);
    } else if (item.score > this.heap[0].score) {
      // Replace minimum with new item
      this.heap[0] = item;
      this._siftDown(0);
    }
  }

  /** Returns items sorted from highest to lowest score */
  toSortedArray(): ScoredNotification[] {
    return [...this.heap].sort((a, b) => b.score - a.score);
  }

  private _bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent].score <= this.heap[idx].score) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  private _siftDown(idx: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.heap[left].score < this.heap[smallest].score) smallest = left;
      if (right < n && this.heap[right].score < this.heap[smallest].score) smallest = right;
      if (smallest === idx) break;
      [this.heap[smallest], this.heap[idx]] = [this.heap[idx], this.heap[smallest]];
      idx = smallest;
    }
  }
}

// ─── API ─────────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: "http://20.207.122.201",
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 15000,
});

async function fetchNotifications(): Promise<RawNotification[]> {
  const res = await api.get<{ notifications: RawNotification[] }>(
    "/evaluation-service/notifications"
  );
  return res.data.notifications;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  initLogger({ authToken: TOKEN });

  await Log("backend", "info", "service", "Priority inbox service started");

  // 1. Fetch notifications
  await Log("backend", "info", "route", "Fetching notifications from API");
  const raw = await fetchNotifications();
  await Log("backend", "info", "service", `Fetched ${raw.length} notifications`);
  console.log(`\nFetched ${raw.length} notifications from API`);

  // 2. Score each notification
  const scored = raw.map(computeScore);
  await Log("backend", "debug", "service", `Scored ${scored.length} notifications`);

  // 3. Build top-N via min-heap
  const heap = new MinHeap(TOP_N);
  for (const n of scored) {
    heap.push(n);
  }

  const top = heap.toSortedArray();

  // 4. Print results
  console.log("\n" + "=".repeat(74));
  console.log(`  PRIORITY INBOX — TOP ${TOP_N} NOTIFICATIONS`);
  console.log("=".repeat(74));
  console.log(
    `  ${"Rank".padEnd(5)} ${"Type".padEnd(12)} ${"Score".padEnd(10)} ${"Age (h)".padEnd(10)} Message`
  );
  console.log("-".repeat(74));

  top.forEach((n, i) => {
    const rank = `#${i + 1}`;
    const age = n.hoursOld.toFixed(1);
    const score = n.score.toFixed(4);
    console.log(
      `  ${rank.padEnd(5)} ${n.Type.padEnd(12)} ${score.padEnd(10)} ${age.padEnd(10)} ${n.Message}`
    );
  });

  console.log("=".repeat(74));
  console.log(`\n  Scoring formula: score = typeWeight + 1/(1+hoursOld)`);
  console.log(`  Type weights: Placement=300, Result=200, Event=100`);

  // 5. Detailed breakdown
  console.log("\n" + "=".repeat(74));
  console.log("  DETAILED BREAKDOWN");
  console.log("=".repeat(74));
  top.forEach((n, i) => {
    console.log(`\n  #${i + 1} — ${n.Type} | Score: ${n.score.toFixed(6)}`);
    console.log(`       ID        : ${n.ID}`);
    console.log(`       Message   : ${n.Message}`);
    console.log(`       Timestamp : ${n.Timestamp}`);
    console.log(`       Age       : ${n.hoursOld.toFixed(2)}h`);
    console.log(`       TypeWeight: ${n.typeWeight}`);
    console.log(`       Recency   : ${n.recencyScore.toFixed(6)}`);
  });

  await Log("backend", "info", "service", "Priority inbox computed OK");
  console.log("\nDone.");
}

main().catch(async (err) => {
  await Log("backend", "fatal", "service", String(err).slice(0, 48));
  console.error("Fatal error:", err);
  process.exit(1);
});
