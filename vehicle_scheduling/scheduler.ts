/**
 * Vehicle Maintenance Scheduler Microservice
 * 
 * Uses 0/1 Knapsack DP to select tasks that maximise total Impact
 * within each depot's MechanicHours budget.
 * 
 * Author: Archit Gupta — RA2311003010891
 */

import axios from "axios";
import { initLogger, Log } from "../src/index";

// ─── Config ─────────────────────────────────────────────────────────────────

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzY5OTM5MSwiaWF0IjoxNzc3Njk4NDkxLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiMWNjMzQ4ZTYtM2Q0Yy00ZTEyLWI1MjEtYmJlYWZiZGM5NGJhIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.O_2INdknGkkZ0UtMZOfYWXPW5zWldryrbWd0DxKViGI";

const BASE_URL = "http://20.207.122.201";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  },
  timeout: 15000,
});

// ─── Types ───────────────────────────────────────────────────────────────────

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
  mechanicHours: number;
  selectedTasks: Vehicle[];
  totalDuration: number;
  totalImpact: number;
}

// ─── Knapsack solver ─────────────────────────────────────────────────────────

/**
 * 0/1 Knapsack DP — O(n * capacity)
 * 
 * @param items    - list of tasks {weight=Duration, value=Impact}
 * @param capacity - MechanicHours budget
 * @returns        - optimal subset of items
 */
function knapsack(items: Vehicle[], capacity: number): Vehicle[] {
  const n = items.length;
  // dp[i][w] = max impact using first i items with capacity w
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    const { Duration: w, Impact: v } = items[i - 1];
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c]; // don't take item i
      if (w <= c) {
        dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w] + v);
      }
    }
  }

  // Backtrack to find selected items
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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  initLogger({ authToken: TOKEN });

  await Log("backend", "info", "service", "Vehicle scheduler service started");

  // 1. Fetch depots
  await Log("backend", "info", "route", "Fetching depots from API");
  const depotsRes = await api.get<{ depots: Depot[] }>(
    "/evaluation-service/depots"
  );
  const depots = depotsRes.data.depots;
  await Log("backend", "info", "service", `Fetched ${depots.length} depots`);
  console.log(`\nFetched ${depots.length} depots`);

  // 2. Fetch vehicles (tasks)
  await Log("backend", "info", "route", "Fetching vehicle tasks from API");
  const vehiclesRes = await api.get<{ vehicles: Vehicle[] }>(
    "/evaluation-service/vehicles"
  );
  const vehicles = vehiclesRes.data.vehicles;
  await Log("backend", "info", "service", `Fetched ${vehicles.length} tasks`);
  console.log(`Fetched ${vehicles.length} tasks\n`);

  // 3. Run Knapsack for each depot
  const results: DepotSchedule[] = [];

  for (const depot of depots) {
    await Log("backend", "debug", "service", `Scheduling depot ${depot.ID}`);

    const selected = knapsack(vehicles, depot.MechanicHours);
    const totalDuration = selected.reduce((s, t) => s + t.Duration, 0);
    const totalImpact = selected.reduce((s, t) => s + t.Impact, 0);

    const schedule: DepotSchedule = {
      depotID: depot.ID,
      mechanicHours: depot.MechanicHours,
      selectedTasks: selected,
      totalDuration,
      totalImpact,
    };
    results.push(schedule);

    await Log(
      "backend",
      "info",
      "service",
      `Depot ${depot.ID}: ${selected.length} tasks, impact=${totalImpact}`
    );
  }

  // 4. Print results
  console.log("=".repeat(70));
  console.log("VEHICLE MAINTENANCE SCHEDULER — RESULTS");
  console.log("=".repeat(70));

  for (const r of results) {
    console.log(`\nDepot ${r.depotID} | Budget: ${r.mechanicHours}h`);
    console.log("-".repeat(70));
    console.log(
      `  Tasks selected : ${r.selectedTasks.length} / ${vehicles.length}`
    );
    console.log(
      `  Hours used     : ${r.totalDuration} / ${r.mechanicHours}`
    );
    console.log(`  Total Impact   : ${r.totalImpact}`);
    console.log(`  Selected Tasks :`);
    for (const t of r.selectedTasks) {
      console.log(
        `    - ${t.TaskID} | Duration: ${t.Duration}h | Impact: ${t.Impact}`
      );
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  const grandTotal = results.reduce((s, r) => s + r.totalImpact, 0);
  for (const r of results) {
    console.log(
      `  Depot ${r.depotID}: ${r.selectedTasks.length} tasks | ${r.totalDuration}h used | Impact: ${r.totalImpact}`
    );
  }
  console.log(`\n  Grand Total Impact: ${grandTotal}`);

  await Log("backend", "info", "service", "Vehicle scheduler completed OK");
  console.log("\nDone.");
}

main().catch(async (err) => {
  await Log("backend", "fatal", "service", String(err).slice(0, 48));
  console.error("Fatal error:", err);
  process.exit(1);
});
