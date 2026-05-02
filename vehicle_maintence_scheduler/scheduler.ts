import express from "express";
import axios from "axios";
import { initLogger, Log } from "../logging_middleware/index";

const app = express();
const PORT = 3000;

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwNDMxMCwiaWF0IjoxNzc3NzAzNDEwLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNTQ1ODdhOWUtMGRkYi00ZjcwLTk3Y2QtMGVlYTUyYTM2OWVhIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.wK_gJOujVIyyujbOk7HxY-i9ZBH6S6TYB0rhZaXRh0E";

const api = axios.create({
  baseURL: "http://20.207.122.201",
  headers: { Authorization: `Bearer ${TOKEN}` },
});

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

app.get("/schedule", async (req, res) => {
  initLogger(TOKEN);
  try {
    await Log("backend", "info", "controller", "Scheduler API started");
    const depotsRes = await api.get("/evaluation-service/depots");
    const depots = depotsRes.data.depots;
    const tasksRes = await api.get("/evaluation-service/vehicles");
    const tasks = tasksRes.data.vehicles;

    await Log("backend", "debug", "service", `Fetched ${depots.length} depots and ${tasks.length} tasks`);

    let grandTotal = 0;
    const results = [];

    for (const depot of depots) {
      const picked = knapsack(tasks, depot.MechanicHours);
      const hoursUsed = picked.reduce((sum: number, t: any) => sum + t.Duration, 0);
      const totalImpact = picked.reduce((sum: number, t: any) => sum + t.Impact, 0);
      grandTotal += totalImpact;

      results.push({
        depotID: depot.ID,
        budget: depot.MechanicHours,
        tasksPicked: picked.length,
        hoursUsed,
        totalImpact,
        tasks: picked.map((t: any) => t.TaskID)
      });
      await Log("backend", "info", "service", `Depot ${depot.ID} impact: ${totalImpact}`);
    }

    await Log("backend", "info", "controller", "Scheduler API finished");
    res.json({ grandTotalImpact: grandTotal, depots: results });
  } catch (err) {
    await Log("backend", "error", "controller", String(err).slice(0, 48));
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Scheduler API running on http://localhost:${PORT}`);
});
