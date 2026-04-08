/**
 * Cost tracker for pi-swarm.
 * Aggregates token usage and cost across all agents in an orchestration cycle.
 */

import { logger } from "./logger.js";

export interface CostEntry {
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: string;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private budget: number | undefined;

  constructor(budget?: number) {
    this.budget = budget;
  }

  /** Record a cost entry from an agent run. */
  record(agentId: string, inputTokens: number, outputTokens: number, cost: number): void {
    const entry: CostEntry = {
      agentId,
      inputTokens,
      outputTokens,
      cost,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    logger.debug("cost-tracker", "cost_recorded", entry);
  }

  /** Total cost across all entries. */
  get totalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.cost, 0);
  }

  /** Total input tokens. */
  get totalInputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.inputTokens, 0);
  }

  /** Total output tokens. */
  get totalOutputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.outputTokens, 0);
  }

  /** Check whether the budget has been exceeded. */
  get isOverBudget(): boolean {
    if (this.budget === undefined) return false;
    return this.totalCost >= this.budget;
  }

  /** Remaining budget (undefined if no budget is set). */
  get remaining(): number | undefined {
    if (this.budget === undefined) return undefined;
    return Math.max(0, this.budget - this.totalCost);
  }

  /** Get a per-agent breakdown. */
  breakdown(): Record<string, { inputTokens: number; outputTokens: number; cost: number }> {
    const result: Record<string, { inputTokens: number; outputTokens: number; cost: number }> = {};
    for (const entry of this.entries) {
      if (!result[entry.agentId]) {
        result[entry.agentId] = { inputTokens: 0, outputTokens: 0, cost: 0 };
      }
      result[entry.agentId].inputTokens += entry.inputTokens;
      result[entry.agentId].outputTokens += entry.outputTokens;
      result[entry.agentId].cost += entry.cost;
    }
    return result;
  }

  /** Get all raw entries. */
  getEntries(): ReadonlyArray<CostEntry> {
    return this.entries;
  }

  /** Reset the tracker. */
  reset(): void {
    this.entries = [];
  }

  /** Human-readable summary. */
  summary(): string {
    const lines = [
      `Total cost: $${this.totalCost.toFixed(4)}`,
      `Input tokens: ${this.totalInputTokens.toLocaleString()}`,
      `Output tokens: ${this.totalOutputTokens.toLocaleString()}`,
    ];
    if (this.budget !== undefined) {
      lines.push(`Budget: $${this.budget.toFixed(4)} (remaining: $${this.remaining!.toFixed(4)})`);
    }
    const bd = this.breakdown();
    for (const [agentId, data] of Object.entries(bd)) {
      lines.push(`  ${agentId}: $${data.cost.toFixed(4)} (${data.inputTokens}in / ${data.outputTokens}out)`);
    }
    return lines.join("\n");
  }
}
