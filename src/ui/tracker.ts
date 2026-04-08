/**
 * Cycle tracker — collects agent lifecycle events during orchestration.
 */

import type { AgentTier } from "../types.js";

export interface TrackedAgent {
  id: string;
  name: string;
  tier: AgentTier;
  team?: string;
  model: string;
  parentId?: string;
  status: "idle" | "working" | "complete" | "error";
  cost: number;
  tokens: number;
  duration: number;
  outputLength: number;
  error?: string;
  startedAt?: number;
}

export class CycleTracker {
  private agents: Map<string, TrackedAgent> = new Map();
  private _startTime: number = Date.now();
  private _cycleId: string = "";
  private _name: string = "pi-swarm";

  constructor(name?: string) {
    if (name) this._name = name;
  }

  get startTime(): number { return this._startTime; }
  get cycleId(): string { return this._cycleId; }
  get name(): string { return this._name; }
  set cycleId(id: string) { this._cycleId = id; }

  /** Register an agent in the tracker. */
  register(id: string, name: string, tier: AgentTier, model: string, team?: string, parentId?: string): void {
    this.agents.set(id, {
      id, name, tier, team, model, parentId,
      status: "idle", cost: 0, tokens: 0, duration: 0, outputLength: 0,
    });
  }

  /** Mark an agent as working. */
  working(id: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = "working";
      agent.startedAt = Date.now();
    }
  }

  /** Mark an agent as complete. */
  complete(id: string, opts?: { cost?: number; tokens?: number; duration?: number; outputLength?: number }): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = "complete";
      if (opts?.cost !== undefined) agent.cost = opts.cost;
      if (opts?.tokens !== undefined) agent.tokens = opts.tokens;
      if (opts?.duration !== undefined) agent.duration = opts.duration;
      if (opts?.outputLength !== undefined) agent.outputLength = opts.outputLength;
    }
  }

  /** Mark an agent as errored. */
  error(id: string, error: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = "error";
      agent.error = error;
      if (agent.startedAt) agent.duration = Date.now() - agent.startedAt;
    }
  }

  /** Get a single tracked agent. */
  get(id: string): TrackedAgent | undefined {
    return this.agents.get(id);
  }

  /** Get all tracked agents. */
  getAll(): TrackedAgent[] {
    return Array.from(this.agents.values());
  }

  /** Get children of a given parent. */
  getChildren(parentId: string): TrackedAgent[] {
    return this.getAll().filter((a) => a.parentId === parentId);
  }

  /** Get the root agent (orchestrator). */
  getRoot(): TrackedAgent | undefined {
    return this.getAll().find((a) => a.tier === "orchestrator");
  }

  /** Total cost across all agents. */
  get totalCost(): number {
    return this.getAll().reduce((sum, a) => sum + a.cost, 0);
  }

  /** Total elapsed time. */
  get elapsed(): number {
    return Date.now() - this._startTime;
  }
}
