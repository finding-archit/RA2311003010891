import axios from "axios";
import { initLogger, Log } from "../src/index";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMDk3OSwiaWF0IjoxNzc3NzAwMDc5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiYTM2YjU3ZGEtZWE4OS00MjJlLTliZjQtYjY1NjAxNjY3N2JkIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.0D9OXy3syecYpXYoe8BdtkowgOVhPN0u6wszqgvWGaU";

const TOP_N = 10;

type NotificationType = "Placement" | "Result" | "Event";

interface RawNotification {
  ID: string;
  Type: NotificationType;
  Message: string;
  Timestamp: string;
}

interface ScoredNotification extends RawNotification {
  score: number;
  hoursOld: number;
}

// Type weights: Placement > Result > Event
const TYPE_WEIGHT: Record<NotificationType, number> = {
  Placement: 300,
  Result: 200,
  Event: 100,
};

function computeScore(n: RawNotification): ScoredNotification {
  const hoursOld = (Date.now() - new Date(n.Timestamp.replace(" ", "T")).getTime()) / 3600000;
  const score = TYPE_WEIGHT[n.Type] + 1 / (1 + hoursOld);
  return { ...n, score, hoursOld };
}

class MinHeap {
  private heap: ScoredNotification[] = [];

  constructor(private maxSize: number) {}

  push(item: ScoredNotification): void {
    if (this.heap.length < this.maxSize) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
    } else if (item.score > this.heap[0].score) {
      this.heap[0] = item;
      this.siftDown(0);
    }
  }

  toSortedArray(): ScoredNotification[] {
    return [...this.heap].sort((a, b) => b.score - a.score);
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.heap[p].score <= this.heap[i].score) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].score < this.heap[min].score) min = l;
      if (r < n && this.heap[r].score < this.heap[min].score) min = r;
      if (min === i) break;
      [this.heap[min], this.heap[i]] = [this.heap[i], this.heap[min]];
      i = min;
    }
  }
}

async function main(): Promise<void> {
  initLogger({ authToken: TOKEN });

  await Log("backend", "info", "service", "Priority inbox service started");

  const api = axios.create({
    baseURL: "http://20.207.122.201",
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: 15000,
  });

  const res = await api.get<{ notifications: RawNotification[] }>("/evaluation-service/notifications");
  const raw = res.data.notifications;

  await Log("backend", "info", "service", `Fetched ${raw.length} notifications`);
  console.log(`\nFetched ${raw.length} notifications\n`);

  const heap = new MinHeap(TOP_N);
  for (const n of raw) heap.push(computeScore(n));

  const top = heap.toSortedArray();

  console.log("=".repeat(74));
  console.log(`PRIORITY INBOX — TOP ${TOP_N} NOTIFICATIONS`);
  console.log("=".repeat(74));
  console.log(`  ${"Rank".padEnd(5)} ${"Type".padEnd(12)} ${"Score".padEnd(10)} ${"Age(h)".padEnd(9)} Message`);
  console.log("-".repeat(74));
  top.forEach((n, i) => {
    console.log(`  ${ `#${i+1}`.padEnd(5)} ${n.Type.padEnd(12)} ${n.score.toFixed(4).padEnd(10)} ${n.hoursOld.toFixed(1).padEnd(9)} ${n.Message}`);
  });
  console.log("=".repeat(74));
  console.log("\n  score = typeWeight + 1/(1+hoursOld)");
  console.log("  Weights: Placement=300, Result=200, Event=100");

  await Log("backend", "info", "service", "Priority inbox computed OK");
  console.log("\nDone.");
}

main().catch(async (err) => {
  await Log("backend", "fatal", "service", String(err).slice(0, 48));
  console.error(err);
  process.exit(1);
});
