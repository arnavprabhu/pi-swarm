import { randomUUID } from "node:crypto";
import type { CycleResult, SwarmConfig } from "../types.js";
import { createOrchestratorToolDefinitions } from "./tools.js";
import { runConfiguredAgent } from "../worker/worker.js";
import { RunContext, positiveInteger, type RunOptions } from "../runtime.js";
import { CycleTracker } from "../ui/tracker.js";
import { ProgressLogger } from "../ui/progress.js";
import { printTree } from "../ui/tree.js";

export interface OrchestrationOptions extends RunOptions {
  showProgress?: boolean;
  showTree?: boolean;
  /** Retained for compatibility. Cycle execution no longer changes the global logger. */
  suppressLogger?: boolean;
}

function validate(config: SwarmConfig, directive: string): void {
  if (!directive.trim()) throw new Error("Directive must not be empty");
  for (const [id, team] of Object.entries(config.teams)) {
    if (!id.trim()) throw new Error("Team IDs must not be empty");
    if (new Set(team.workers.map(w => w.id)).size !== team.workers.length) throw new Error(`Duplicate worker IDs in ${id}`);
  }
  for (const agent of [config.orchestrator, ...Object.values(config.teams).flatMap(t => [t.lead, ...t.workers])]) {
    if (!agent.id.trim()) throw new Error("Agent IDs must not be empty");
    if (agent.maxTurns !== undefined) positiveInteger(agent.maxTurns, "maxTurns");
    if (agent.tools?.length) throw new Error("Configured tool names are unsupported; swarm workers return text only");
  }
}

export async function runOrchestrationCycle(
  config: SwarmConfig, directive: string, context?: string, options: OrchestrationOptions = {},
): Promise<CycleResult> {
  validate(config, directive);
  const start = Date.now();
  const cycleId = randomUUID();
  const runtime = new RunContext(options, config.maxConcurrentAgents ?? 10, config.costBudget);
  const cycleTracker = new CycleTracker(config.name);
  cycleTracker.cycleId = cycleId;
  const progress = new ProgressLogger(options.showProgress ?? true);
  const executionId = randomUUID();
  const { tools, getDelegationResults, getSummary } = createOrchestratorToolDefinitions(config, {
    ...options, runtime, cycleTracker, progress, executionId,
  });
  const teams = Object.entries(config.teams).map(([id, t]) => `${id}: ${t.lead.name} (${t.workers.length} workers)`).join("\n");
  const prompt = [
    config.orchestrator.systemPrompt,
    `You coordinate ${config.name}. Configured teams:\n${teams}`,
    "Decompose the directive, delegate precisely, collect reports, and finish_cycle with a useful synthesis.",
    "Workers analyze and generate text. They cannot browse, edit files, or execute commands. Do not claim those actions occurred.",
    "Use completed reports as evidence. State failures and uncertainty. Not every task needs every team.",
  ].filter(Boolean).join("\n\n");
  progress.cycleStart(directive);
  const result = await runConfiguredAgent({ ...config.orchestrator, systemPrompt: prompt },
    directive, context, { ...options, runtime, cycleTracker, progress, executionId }, tools, getSummary);
  const delegations = [...getDelegationResults().values()];
  const status = runtime.status ?? (runtime.signal.aborted ? "cancelled"
    : result.status !== "completed" ? result.status!
    : delegations.some(d => d.status === "turn_limit") ? "turn_limit"
    : delegations.some(d => !d.success) ? "partial" : "completed");
  const duration = Date.now() - start;
  if (status !== "completed") cycleTracker.error(executionId, result.error ?? status);
  if (status === "completed") progress.cycleEnd(duration, delegations.length);
  else progress.failed(config.orchestrator.name, "orchestrator", status);
  if (options.showTree ?? true) printTree(cycleTracker);
  return {
    cycleId, timestamp: new Date().toISOString(), status,
    error: result.error ?? (status !== "completed" ? status : undefined),
    delegations, companyStatus: getSummary() ?? result.output,
    totalCost: runtime.costs.totalCost, duration,
  };
}
