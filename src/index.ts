import axios, { AxiosInstance } from "axios";

export type Stack = "backend";

export type Level = "debug" | "info" | "warn" | "error" | "fatal";

export type Package =
  | "cache"
  | "controller"
  | "cron_job"
  | "db"
  | "domain"
  | "handler"
  | "repository"
  | "route"
  | "service"
  | "auth"
  | "config"
  | "middleware"
  | "utils";

export interface LoggerConfig {
  authToken: string;
  baseUrl?: string;
}

export interface LogResponse {
  logID: string;
  message: string;
}

class Logger {
  private client: AxiosInstance;
  private static readonly MAX_MSG_LEN = 48;

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

  async Log(stack: Stack, level: Level, pkg: Package, message: string): Promise<LogResponse> {
    const msg = message.length > Logger.MAX_MSG_LEN ? message.slice(0, Logger.MAX_MSG_LEN) : message;
    try {
      const res = await this.client.post<LogResponse>("/evaluation-service/logs", {
        stack,
        level,
        package: pkg,
        message: msg,
      });
      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(`[Logger] HTTP ${error.response?.status}: ${JSON.stringify(error.response?.data)}`);
      }
      throw new Error(`[Logger] ${String(error)}`);
    }
  }
}

let _instance: Logger | null = null;

export function initLogger(config: LoggerConfig): void {
  _instance = new Logger(config);
}

export async function Log(stack: Stack, level: Level, pkg: Package, message: string): Promise<LogResponse> {
  if (!_instance) throw new Error("[Logger] Call initLogger() first.");
  return _instance.Log(stack, level, pkg, message);
}

export { Logger };
export default Log;
