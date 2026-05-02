import express from "express";
import axios from "axios";
import { initLogger, Log } from "../logging_middleware/index";

const app = express();
const PORT = 3001;

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwNDMxMCwiaWF0IjoxNzc3NzAzNDEwLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNTQ1ODdhOWUtMGRkYi00ZjcwLTk3Y2QtMGVlYTUyYTM2OWVhIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.wK_gJOujVIyyujbOk7HxY-i9ZBH6S6TYB0rhZaXRh0E";

const TYPE_WEIGHT: Record<string, number> = {
  Placement: 300,
  Result: 200,
  Event: 100,
};

function getScore(notification: any) {
  const hoursOld = (Date.now() - new Date(notification.Timestamp.replace(" ", "T")).getTime()) / 3600000;
  return TYPE_WEIGHT[notification.Type] + 1 / (1 + hoursOld);
}

app.get("/priority-inbox", async (req, res) => {
  initLogger(TOKEN);
  try {
    await Log("backend", "info", "controller", "Priority inbox API started");
    const response = await axios.get("http://20.207.122.201/evaluation-service/notifications", {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    const notifications = response.data.notifications;
    await Log("backend", "debug", "service", `Fetched ${notifications.length} notifications`);

    const sorted = notifications
      .map((n: any) => ({ ...n, score: getScore(n) }))
      .sort((a: any, b: any) => b.score - a.score);

    const top10 = sorted.slice(0, 10);
    await Log("backend", "info", "controller", "Priority inbox API done");
    res.json({ totalFetched: notifications.length, topPriority: top10 });
  } catch (err) {
    await Log("backend", "error", "controller", String(err).slice(0, 48));
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Priority Inbox API running on http://localhost:${PORT}`);
});
