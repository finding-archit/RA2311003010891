import axios, { AxiosInstance } from "axios";

// ─── Valid enum types ────────────────────────────────────────────────────────

export type Stack = "backend" | "frontend";

export type Level = "debug" | "info" | "warn" | "error" | "fatal";

export type BackendPackage =
  | "cache"
  | "controller"
  | "cron_job"
  | "db"
  | "domain"
  | "handler"
  | "repository"
  | "route"
  | "service";

export type FrontendPackage = "api" | "component" | "hook" | "page" | "state" | "style";

export type SharedPackage = "auth" | "config" | "middleware" | "utils";

export type Package = BackendPackage | FrontendPackage | SharedPackage;

// ─── Logger config ───────────────────────────────────────────────────────────

export interface LoggerConfig {
  /** Bearer token for the evaluation service */
  authToken: string;
  /** Base URL of the evaluation service */
  baseUrl?: string;
}

export interface LogResponse {
  logID: string;
  message: string;
}

// ─── Logger class ────────────────────────────────────────────────────────────

class Logger {
  private client: AxiosInstance;

  constructor(private config: LoggerConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl ?? "http://20.207.122.201",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.authToken}`,
      },
      timeout: 10000,
    });
  }

  /**
   * Send a structured log entry to the evaluation service.
   *
   * @param stack   - "backend" | "frontend"
   * @param level   - "debug" | "info" | "warn" | "error" | "fatal"
   * @param pkg     - package identifier (e.g. "handler", "db", "component")
   * @param message - descriptive log message
   * @returns       - Promise resolving to { logID, message }
   */
  /** Max message length enforced by the evaluation service */
  static readonly MAX_MESSAGE_LENGTH = 48;

  async Log(
    stack: Stack,
    level: Level,
    pkg: Package,
    message: string
  ): Promise<LogResponse> {
    // Truncate message to satisfy the 48-char API constraint
    const safeMessage = message.length > Logger.MAX_MESSAGE_LENGTH
      ? message.slice(0, Logger.MAX_MESSAGE_LENGTH)
      : message;

    try {
      const response = await this.client.post<LogResponse>(
        "/evaluation-service/logs",
        {
          stack,
          level,
          package: pkg,
          message: safeMessage,
        }
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const body = error.response?.data;
        throw new Error(
          `[Logger] Failed to send log. HTTP ${status}: ${JSON.stringify(body)}`
        );
      }
      throw new Error(`[Logger] Unexpected error: ${String(error)}`);
    }
  }
}

// ─── Factory & singleton ─────────────────────────────────────────────────────

let _loggerInstance: Logger | null = null;

/**
 * Initialise the singleton logger.
 * Must be called once before using `Log()`.
 */
export function initLogger(config: LoggerConfig): void {
  _loggerInstance = new Logger(config);
}

/**
 * Reusable Log function — matches the required signature:
 *   Log(stack, level, package, message)
 *
 * Throws if initLogger() has not been called first.
 */
export async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<LogResponse> {
  if (!_loggerInstance) {
    throw new Error(
      "[Logger] Logger not initialised. Call initLogger({ authToken }) first."
    );
  }
  return _loggerInstance.Log(stack, level, pkg, message);
}

export { Logger };
export default Log;
