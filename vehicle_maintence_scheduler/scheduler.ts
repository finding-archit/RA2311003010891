import axios from "axios";
import { initLogger, Log } from "../logging_middleware/index";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMjU4OCwiaWF0IjoxNzc3NzAxNjg4LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNTE3NzgyMDQtZGUyZi00MTY3LTlmZTktMzk4ZTI5MjZjYmJmIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.0q3R6PNzM9dvJHNSnOhbOQdslXu8bAydF6tx7bNM29I";

const api = axios.create({
  baseURL: "http://20.207.122.201",
  headers: { Authorization: `Bearer ${TOKEN}` },
});

// 0/1 Knapsack - picks tasks that maximise impact within hour budget
function knapsack(tasks: any[], budget: number) {
  const n = tasks.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(budget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let hours = 0; hours <= budget; hours++) {
      dp[i][hours] = dp[i - 1][hours];
      if (tasks[i - 1].Duration <= hours) {
        dp[i][hours] = Math.max(dp[i][hours], dp[i - 1][hours - tasks[i - 1].Duration] + tasks[i - 1].Impact);
      }
    }
  }

  // trace back which tasks were picked
  const picked = [];
  let remaining = budget;
  for (let i = n; i >= 1; i--) {
    if (dp[i][remaining] !== dp[i - 1][remaining]) {
      picked.push(tasks[i - 1]);
      remaining -= tasks[i - 1].Duration;
    }
  }

  return picked;
}

async function main() {
  initLogger(TOKEN);
  await Log("backend", "info", "service", "Scheduler started");

  const depotsRes = await api.get("/evaluation-service/depots");
  const depots = depotsRes.data.depots;

  const tasksRes = await api.get("/evaluation-service/vehicles");
  const tasks = tasksRes.data.vehicles;

  console.log(`\nDepots: ${depots.length} | Tasks: ${tasks.length}\n`);
  console.log("=".repeat(60));

  let grandTotal = 0;

  for (const depot of depots) {
    const picked = knapsack(tasks, depot.MechanicHours);
    const hoursUsed = picked.reduce((sum: number, t: any) => sum + t.Duration, 0);
    const totalImpact = picked.reduce((sum: number, t: any) => sum + t.Impact, 0);
    grandTotal += totalImpact;

    console.log(`\nDepot ${depot.ID} | Budget: ${depot.MechanicHours}h`);
    console.log(`  Tasks picked : ${picked.length}/${tasks.length}`);
    console.log(`  Hours used   : ${hoursUsed}/${depot.MechanicHours}`);
    console.log(`  Total impact : ${totalImpact}`);

    await Log("backend", "info", "service", `Depot ${depot.ID} impact: ${totalImpact}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Grand Total Impact: ${grandTotal}`);
  await Log("backend", "info", "service", "Scheduler finished");
}

main().catch(console.error);
