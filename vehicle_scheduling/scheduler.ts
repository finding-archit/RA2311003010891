import axios from "axios";
import { initLogger, Log } from "../src/index";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMDk3OSwiaWF0IjoxNzc3NzAwMDc5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiYTM2YjU3ZGEtZWE4OS00MjJlLTliZjQtYjY1NjAxNjY3N2JkIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.0D9OXy3syecYpXYoe8BdtkowgOVhPN0u6wszqgvWGaU";

const api = axios.create({
  baseURL: "http://20.207.122.201",
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 15000,
});

interface Depot {
  ID: number;
  MechanicHours: number;
}

interface Vehicle {
  TaskID: string;
  Duration: number;
  Impact: number;
}

interface DepotSchedule {
  depotID: number;
  budget: number;
  tasks: Vehicle[];
  hoursUsed: number;
  totalImpact: number;
}

function knapsack(items: Vehicle[], capacity: number): Vehicle[] {
  const n = items.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration: w, Impact: v } = items[i - 1];
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];
      if (w <= c) dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w] + v);
    }
  }

  const selected: Vehicle[] = [];
  let c = capacity;
  for (let i = n; i >= 1; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      selected.push(items[i - 1]);
      c -= items[i - 1].Duration;
    }
  }
  return selected.reverse();
}

async function main(): Promise<void> {
  initLogger({ authToken: TOKEN });

  await Log("backend", "info", "service", "Vehicle scheduler started");

  const depotsRes = await api.get<{ depots: Depot[] }>("/evaluation-service/depots");
  const depots = depotsRes.data.depots;

  const vehiclesRes = await api.get<{ vehicles: Vehicle[] }>("/evaluation-service/vehicles");
  const vehicles = vehiclesRes.data.vehicles;

  await Log("backend", "info", "service", `Fetched ${depots.length} depots, ${vehicles.length} tasks`);
  console.log(`\nFetched ${depots.length} depots | ${vehicles.length} tasks\n`);

  const results: DepotSchedule[] = [];

  for (const depot of depots) {
    const selected = knapsack(vehicles, depot.MechanicHours);
    results.push({
      depotID: depot.ID,
      budget: depot.MechanicHours,
      tasks: selected,
      hoursUsed: selected.reduce((s, t) => s + t.Duration, 0),
      totalImpact: selected.reduce((s, t) => s + t.Impact, 0),
    });
  }

  console.log("=".repeat(70));
  console.log("VEHICLE MAINTENANCE SCHEDULER — RESULTS");
  console.log("=".repeat(70));

  for (const r of results) {
    console.log(`\nDepot ${r.depotID} | Budget: ${r.budget}h`);
    console.log("-".repeat(70));
    console.log(`  Tasks    : ${r.tasks.length} / ${vehicles.length}`);
    console.log(`  Hours    : ${r.hoursUsed} / ${r.budget}`);
    console.log(`  Impact   : ${r.totalImpact}`);
    for (const t of r.tasks) {
      console.log(`    - ${t.TaskID} | ${t.Duration}h | Impact: ${t.Impact}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  for (const r of results) {
    console.log(`  Depot ${r.depotID}: ${r.tasks.length} tasks | ${r.hoursUsed}h | Impact: ${r.totalImpact}`);
  }
  const total = results.reduce((s, r) => s + r.totalImpact, 0);
  console.log(`\n  Grand Total Impact: ${total}`);

  await Log("backend", "info", "service", "Vehicle scheduler completed");
}

main().catch(async (err) => {
  await Log("backend", "fatal", "service", String(err).slice(0, 48));
  console.error(err);
  process.exit(1);
});
