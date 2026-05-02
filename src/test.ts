import { initLogger, Log } from "./index";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhZzA1OTVAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMDk3OSwiaWF0IjoxNzc3NzAwMDc5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiYTM2YjU3ZGEtZWE4OS00MjJlLTliZjQtYjY1NjAxNjY3N2JkIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwic3ViIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIn0sImVtYWlsIjoiYWcwNTk1QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJjaGl0IGd1cHRhIiwicm9sbE5vIjoicmEyMzExMDAzMDEwODkxIiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiMDY5MzQzYTktMjZiZS00NWNhLTgyYmQtYWE5MTYwNWQwZmVhIiwiY2xpZW50U2VjcmV0IjoiWE5lUlJkTllzd2pSa3FXTSJ9.0D9OXy3syecYpXYoe8BdtkowgOVhPN0u6wszqgvWGaU";

async function runTests(): Promise<void> {
  initLogger({ authToken: TOKEN });

  const testCases = [
    { stack: "backend" as const, level: "info" as const,  pkg: "middleware" as const, message: "Logging middleware initialised" },
    { stack: "backend" as const, level: "debug" as const, pkg: "db" as const,         message: "DB connection pool created" },
    { stack: "backend" as const, level: "warn" as const,  pkg: "handler" as const,    message: "Request payload too large" },
    { stack: "backend" as const, level: "error" as const, pkg: "handler" as const,    message: "Received string, expected bool" },
    { stack: "backend" as const, level: "fatal" as const, pkg: "db" as const,         message: "Critical DB connection failure" },
  ];

  console.log("Running tests...\n");

  for (const tc of testCases) {
    try {
      const result = await Log(tc.stack, tc.level, tc.pkg, tc.message);
      console.log(`[PASS] ${tc.level.toUpperCase()} | ${tc.pkg} | logID: ${result.logID}`);
    } catch (err) {
      console.error(`[FAIL] ${tc.level.toUpperCase()} | ${tc.pkg} | ${err}`);
    }
  }

  console.log("\nDone.");
}

runTests();
