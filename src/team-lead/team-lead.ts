import { randomUUID } from "node:crypto";
import type { AgentConfig, AgentResult, ModelConfig } from "../types.js";
import { createTeamLeadToolDefinitions } from "./tools.js";
import { runConfiguredAgent, type WorkerRunOptions } from "../worker/worker.js";
import { RunContext } from "../runtime.js";

export interface TeamLeadRunOptions extends WorkerRunOptions {
  workers?: AgentConfig[];
}

export async function runTeamLead(
  config: AgentConfig, directive: string, context?: string, workerModel?: ModelConfig, opts: TeamLeadRunOptions = {},
): Promise<AgentResult> {
  const runtime = opts.runtime ?? new RunContext(opts, 10, undefined, opts.costTracker);
  const executionId = randomUUID();
  const workers: AgentResult[] = [];
  let report: string | undefined;
  const tools = createTeamLeadToolDefinitions(config.team ?? "", executionId, workerModel ?? config.model, {
    ...opts, runtime, leadId: executionId, workerResults: workers, onReport: value => { report = value; },
  });
  const result = await runConfiguredAgent({
    ...config,
    systemPrompt: config.systemPrompt + "\nUse list_workers to discover the configured workers. Delegate precisely, then report_to_orchestrator. Workers return text only. Report failures and unsupported actions honestly.",
  }, directive, context, { ...opts, runtime, executionId }, tools, () => report);
  if (result.success && workers.some(w => !w.success)) {
    result.success = false;
    result.status = workers.some(w => w.status === "turn_limit") ? "turn_limit" : "partial";
    result.error = "One or more workers did not complete";
    opts.cycleTracker?.error(executionId, result.error);
  }
  return { ...result, workers, teamCost: result.cost.total + workers.reduce((sum, w) => sum + w.cost.total, 0) };
}
