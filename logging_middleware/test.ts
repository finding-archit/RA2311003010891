import { initLogger, Log } from "./index";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMTM2OCwiaWF0IjoxNzc3NzAwNDY4LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiZjMxYTE3YTEtOGYxYS00MDVhLWJhYTAtNWRkZjA5Mjc3Y2RmIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.5W5EXxfP7lRmL3zhNvKqp8rwcJDyf_f4mVqcLNnuBMg";

async function main() {
  initLogger(TOKEN);

  const tests = [
    { level: "info",  pkg: "middleware", message: "Logger initialised" },
    { level: "debug", pkg: "db",         message: "DB connection established" },
    { level: "warn",  pkg: "handler",    message: "Request payload too large" },
    { level: "error", pkg: "handler",    message: "Received string, expected bool" },
    { level: "fatal", pkg: "db",         message: "DB connection failed" },
  ];

  for (const t of tests) {
    try {
      const result = await Log("backend", t.level, t.pkg, t.message);
      console.log(`PASS | ${t.level} | ${t.pkg} | ${result.logID}`);
    } catch (err) {
      console.error(`FAIL | ${t.level} | ${t.pkg} | ${err}`);
    }
  }
}

main();
