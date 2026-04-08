/**
 * Ephemeral worker agent factory.
 *
 * Workers use a lightweight pi-authenticated Agent (no session overhead).
 * They receive a task, execute it, and return text output.
 */

import type { AgentConfig, AgentResult } from "../types.js";
import { runOneShot } from "../session.js";
import { logger } from "../utils/logger.js";
import { CostTracker } from "../utils/cost-tracker.js";

/**
 * Run an ephemeral worker agent.
 */
export async function runWorker(
  config: AgentConfig,
  task: string,
  context?: string,
  costTracker?: CostTracker,
): Promise<AgentResult> {
  const startTime = Date.now();

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
      tools: [], // Workers are text-only
    },
    task,
  );

  const duration = Date.now() - startTime;

  if (result.success) {
    const outputTokens = Math.ceil(result.text.length / 4);
    const inputTokens = Math.ceil((systemPrompt.length + task.length) / 4);

    if (costTracker) {
      costTracker.record(config.id, inputTokens, outputTokens, 0);
    }

    logger.info(config.id, "worker_completed", { duration, outputLength: result.text.length });

    return {
      agentId: config.id,
      success: true,
      output: result.text,
      cost: { input: 0, output: 0, total: 0 },
      tokensUsed: { input: inputTokens, output: outputTokens },
      duration,
      toolCalls: [],
    };
  } else {
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
