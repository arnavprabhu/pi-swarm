import { randomUUID } from "node:crypto";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AgentConfig, AgentResult } from "../types.js";
import { runOneShot } from "../session.js";
import { RunContext, type RunOptions } from "../runtime.js";
import type { CostTracker } from "../utils/cost-tracker.js";
import type { CycleTracker } from "../ui/tracker.js";
import type { ProgressLogger } from "../ui/progress.js";

export interface WorkerRunOptions extends RunOptions {
  costTracker?: CostTracker;
  cycleTracker?: CycleTracker;
  progress?: ProgressLogger;
  parentId?: string;
  runtime?: RunContext;
  executionId?: string;
}

/** Shared lifecycle for all three tiers. */
export async function runConfiguredAgent(
  config: AgentConfig, task: string, context?: string, opts: WorkerRunOptions = {},
  tools: AgentTool<any, any>[] = [], getOutput?: () => string | undefined,
): Promise<AgentResult> {
  const start = Date.now();
  const executionId = opts.executionId ?? randomUUID();
  const runtime = opts.runtime ?? new RunContext(opts, 10, undefined, opts.costTracker);
  const tracker = opts.cycleTracker;
  tracker?.register(executionId, config.name, config.tier, config.model.model, config.team, opts.parentId);
  tracker?.working(executionId);
  runtime.progress(`${config.name}: working`);
  const result = await runOneShot({
    ...opts, runtime, agentId: executionId,
    systemPrompt: context ? `${config.systemPrompt}\n\nContext:\n${context}` : config.systemPrompt,
    model: config.model, thinkingLevel: config.model.thinkingLevel,
    maxTurns: config.maxTurns ?? (config.tier === "orchestrator" ? 20 : config.tier === "team-lead" ? 10 : 3),
    tools, isComplete: () => getOutput?.() !== undefined,
  }, task);
  const output = getOutput?.() ?? result.text;
  if (result.success && !output.trim()) {
    result.success = false;
    result.status = "failed";
    result.error = "No final response or explicit report";
  }
  const duration = Date.now() - start;
  const tracked = tracker?.get(executionId);
  if (tracked && result.model) tracked.model = result.model.id;
  tracker?.complete(executionId, { cost: result.cost.total, tokens: result.tokensUsed.input + result.tokensUsed.output, duration, outputLength: output.length });
  if (!result.success) {
    tracker?.error(executionId, result.error ?? result.status);
    opts.progress?.failed(config.name, config.tier, result.error ?? result.status);
  } else opts.progress?.complete(config.name, config.tier, duration);
  runtime.progress(`${config.name}: ${result.status} ($${result.cost.total.toFixed(4)})`);
  return {
    agentId: config.id, executionId, success: result.success, status: result.status, error: result.error,
    output: output || result.error || "", cost: result.cost, tokensUsed: result.tokensUsed, duration, toolCalls: result.toolCalls,
  };
}

export async function runWorker(config: AgentConfig, task: string, context?: string, opts?: WorkerRunOptions): Promise<AgentResult> {
  return runConfiguredAgent(config, task, context, opts);
}
