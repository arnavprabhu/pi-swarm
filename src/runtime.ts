import { CostTracker } from "./utils/cost-tracker.js";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { Usage } from "@earendil-works/pi-ai";
import type { RunStatus } from "./types.js";

export interface RunOptions {
  signal?: AbortSignal;
  modelRegistry?: ModelRegistry;
  onProgress?: (message: string) => void;
}

export function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}

/** Slots cover model requests, never waits for child agents. */
export class RunContext {
  readonly costs: CostTracker;
  readonly signal: AbortSignal;
  readonly controller = new AbortController();
  private active = 0;
  private waiters = new Set<() => void>();
  status?: RunStatus;

  constructor(readonly options: RunOptions = {}, readonly limit = 10, budget?: number, costs?: CostTracker) {
    positiveInteger(limit, "maxConcurrentAgents");
    if (budget !== undefined && (!Number.isFinite(budget) || budget < 0)) {
      throw new Error("costBudget must be finite and nonnegative");
    }
    this.costs = costs ?? new CostTracker(budget);
    this.signal = options.signal ? AbortSignal.any([options.signal, this.controller.signal]) : this.controller.signal;
  }

  check(): void {
    if (this.costs.isOverBudget && !this.signal.aborted) this.stop("budget_exceeded");
    if (this.signal.aborted) throw new Error(this.status ?? "cancelled");
  }

  stop(status: RunStatus): void {
    if (this.signal.aborted) return;
    this.status = status;
    this.controller.abort();
  }

  async acquire(signal: AbortSignal): Promise<() => void> {
    this.check();
    signal.throwIfAborted();
    while (this.active >= this.limit) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.waiters.delete(wake);
          signal.removeEventListener("abort", abort);
        };
        const wake = () => { cleanup(); resolve(); };
        const abort = () => { cleanup(); reject(new Error("cancelled")); };
        this.waiters.add(wake);
        signal.addEventListener("abort", abort, { once: true });
      });
      this.check();
      signal.throwIfAborted();
    }
    this.active++;
    return () => {
      this.active--;
      this.waiters.values().next().value?.();
    };
  }

  record(id: string, usage: Usage): void {
    this.costs.record(id, usage.input + usage.cacheRead + usage.cacheWrite, usage.output, usage.cost.total);
    if (this.costs.isOverBudget) this.stop("budget_exceeded");
  }

  progress(message: string): void { this.options.onProgress?.(message); }
}
