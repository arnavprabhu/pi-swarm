/**
 * Structured logger for pi-swarm agent events.
 * Outputs JSONL-compatible lines for replay and debugging.
 */

import type { LogLevel, LogEntry } from "../types.js";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private minLevel: LogLevel;
  private entries: LogEntry[] = [];
  private enabled: boolean = true;

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  /** Enable or disable all logging output. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Get the current minimum log level. */
  getLevel(): LogLevel {
    return this.minLevel;
  }

  /** Set the minimum log level. */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** Log a debug message. */
  debug(agentId: string, event: string, data?: unknown): void {
    this.log("debug", agentId, event, data);
  }

  /** Log an info message. */
  info(agentId: string, event: string, data?: unknown): void {
    this.log("info", agentId, event, data);
  }

  /** Log a warning. */
  warn(agentId: string, event: string, data?: unknown): void {
    this.log("warn", agentId, event, data);
  }

  /** Log an error. */
  error(agentId: string, event: string, data?: unknown): void {
    this.log("error", agentId, event, data);
  }

  /** Return all captured log entries. */
  getEntries(): ReadonlyArray<LogEntry> {
    return this.entries;
  }

  /** Clear captured entries. */
  clear(): void {
    this.entries = [];
  }

  /** Export entries as JSONL string. */
  toJsonl(): string {
    return this.entries.map((e) => JSON.stringify(e)).join("\n");
  }

  // ---

  private log(level: LogLevel, agentId: string, event: string, data?: unknown): void {
    if (!this.enabled) return;
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      agentId,
      event,
      data,
    };

    this.entries.push(entry);

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${agentId}]`;
    const msg = data ? `${prefix} ${event} ${JSON.stringify(data)}` : `${prefix} ${event}`;

    switch (level) {
      case "error":
        console.error(msg);
        break;
      case "warn":
        console.warn(msg);
        break;
      default:
        console.log(msg);
    }
  }
}

/** Shared default logger instance. */
export const logger = new Logger("info");
