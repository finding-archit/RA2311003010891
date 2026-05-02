/**
 * test.ts — smoke-test for the logging middleware.
 * Run with:  npm test
 */
import { initLogger, Log } from "./index";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzY5OTM5MSwiaWF0IjoxNzc3Njk4NDkxLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiMWNjMzQ4ZTYtM2Q0Yy00ZTEyLWI1MjEtYmJlYWZiZGM5NGJhIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.O_2INdknGkkZ0UtMZOfYWXPW5zWldryrbWd0DxKViGI";

async function runTests(): Promise<void> {
  initLogger({ authToken: TOKEN });

  const testCases: Array<{
    stack: "backend" | "frontend";
    level: "debug" | "info" | "warn" | "error" | "fatal";
    pkg: string;
    message: string;
  }> = [
    {
      stack: "backend",
      level: "info",
      pkg: "middleware",
      message: "Logging middleware initialised successfully",
    },
    {
      stack: "backend",
      level: "debug",
      pkg: "db",
      message: "Database connection pool created with 10 connections",
    },
    {
      stack: "backend",
      level: "warn",
      pkg: "handler",
      message: "Request payload exceeds recommended size of 1MB",
    },
    {
      stack: "backend",
      level: "error",
      pkg: "handler",
      message: "Received string, expected bool for field 'isActive'",
    },
    {
      stack: "backend",
      level: "fatal",
      pkg: "db",
      message: "Critical database connection failure — all retries exhausted",
    },
    {
      stack: "frontend",
      level: "info",
      pkg: "component",
      message: "NotificationList component mounted with 20 items",
    },
    {
      stack: "frontend",
      level: "error",
      pkg: "api",
      message: "Failed to fetch notifications: 401 Unauthorized",
    },
  ];

  console.log("Running logging middleware tests...\n");

  for (const tc of testCases) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (Log as any)(tc.stack, tc.level, tc.pkg, tc.message);
      console.log(`[PASS] ${tc.level.toUpperCase()} | ${tc.pkg} | logID: ${result.logID}`);
    } catch (err) {
      console.error(`[FAIL] ${tc.level.toUpperCase()} | ${tc.pkg} | ${err}`);
    }
  }

  console.log("\nAll tests complete.");
}

runTests();
