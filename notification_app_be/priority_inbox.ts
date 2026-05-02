import axios from "axios";
import { initLogger, Log } from "../logging_middleware/index";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMjU4OCwiaWF0IjoxNzc3NzAxNjg4LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNTE3NzgyMDQtZGUyZi00MTY3LTlmZTktMzk4ZTI5MjZjYmJmIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.0q3R6PNzM9dvJHNSnOhbOQdslXu8bAydF6tx7bNM29I";

const TYPE_WEIGHT: Record<string, number> = {
  Placement: 300,
  Result: 200,
  Event: 100,
};

function getScore(notification: any) {
  const hoursOld = (Date.now() - new Date(notification.Timestamp.replace(" ", "T")).getTime()) / 3600000;
  return TYPE_WEIGHT[notification.Type] + 1 / (1 + hoursOld);
}

async function main() {
  initLogger(TOKEN);
  await Log("backend", "info", "service", "Priority inbox started");

  const res = await axios.get("http://20.207.122.201/evaluation-service/notifications", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const notifications = res.data.notifications;
  console.log(`\nFetched ${notifications.length} notifications\n`);

  // Score and sort — highest score = highest priority
  const sorted = notifications
    .map((n: any) => ({ ...n, score: getScore(n) }))
    .sort((a: any, b: any) => b.score - a.score);

  const top10 = sorted.slice(0, 10);

  console.log("=".repeat(65));
  console.log("TOP 10 PRIORITY NOTIFICATIONS");
  console.log("=".repeat(65));
  console.log(`  ${"#".padEnd(4)} ${"Type".padEnd(12)} ${"Score".padEnd(10)} Message`);
  console.log("-".repeat(65));

  top10.forEach((n: any, i: number) => {
    console.log(`  ${`#${i + 1}`.padEnd(4)} ${n.Type.padEnd(12)} ${n.score.toFixed(2).padEnd(10)} ${n.Message}`);
  });

  console.log("=".repeat(65));
  console.log("\n  Scoring: Placement=300, Result=200, Event=100  +  recency bonus");

  await Log("backend", "info", "service", "Priority inbox done");
}

main().catch(console.error);
