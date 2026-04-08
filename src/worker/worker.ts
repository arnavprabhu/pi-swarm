/**
 * Ephemeral worker agent factory.
 */

import type { AgentConfig, AgentResult } from "../types.js";
import { runOneShot } from "../session.js";
import { logger } from "../utils/logger.js";
import { CostTracker } from "../utils/cost-tracker.js";
import type { CycleTracker } from "../ui/tracker.js";
import type { ProgressLogger } from "../ui/progress.js";

export interface WorkerRunOptions {
  costTracker?: CostTracker;
  cycleTracker?: CycleTracker;
  progress?: ProgressLogger;
  parentId?: string;
}

/**
 * Run an ephemeral worker agent.
 */
export async function runWorker(
  config: AgentConfig,
  task: string,
  context?: string,
  opts?: WorkerRunOptions,
): Promise<AgentResult> {
  const startTime = Date.now();
  const { costTracker, cycleTracker, progress, parentId } = opts ?? {};

  // Register in cycle tracker
  cycleTracker?.register(
    config.id, config.name, "worker",
    `${config.model.provider}/${config.model.model}`.replace(/.*\//, ""),
    config.team, parentId,
  );
  cycleTracker?.working(config.id);

  logger.info(config.id, "worker_spawned", { name: config.name, role: config.role });

  const systemPrompt = context
    ? `${config.systemPrompt}\n\n## Context\n${context}`
    : config.systemPrompt;

  const result = await runOneShot(
    {
      agentId: config.id,
      systemPrompt,
      model: config.model,
      thinkingLevel: config.model.thinkingLevel ?? "off",
      tools: [],
    },
    task,
  );

  const duration = Date.now() - startTime;

  if (result.success) {
    const outputTokens = Math.ceil(result.text.length / 4);
    const inputTokens = Math.ceil((systemPrompt.length + task.length) / 4);

    // Estimate cost (rough heuristic: $0.01 per 1K input, $0.03 per 1K output)
    const estimatedCost = (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03;

    costTracker?.record(config.id, inputTokens, outputTokens, estimatedCost);
    cycleTracker?.complete(config.id, { duration, outputLength: result.text.length, cost: estimatedCost });
    progress?.complete(config.name, "worker", duration, `${result.text.length} chars`);

    logger.info(config.id, "worker_completed", { duration, outputLength: result.text.length });

    return {
      agentId: config.id,
      success: true,
      output: result.text,
      cost: { input: (inputTokens / 1000) * 0.01, output: (outputTokens / 1000) * 0.03, total: estimatedCost },
      tokensUsed: { input: inputTokens, output: outputTokens },
      duration,
      toolCalls: [],
    };
  } else {
    cycleTracker?.error(config.id, result.error ?? "Unknown error");
    progress?.failed(config.name, "worker", result.error ?? "Unknown error");

    logger.error(config.id, "worker_failed", { error: result.error, duration });

    return {
      agentId: config.id,
      success: false,
      output: `Worker ${config.name} failed: ${result.error}`,
      cost: { input: 0, output: 0, total: 0 },
      tokensUsed: { input: 0, output: 0 },
      duration,
      toolCalls: [],
    };
  }
}
