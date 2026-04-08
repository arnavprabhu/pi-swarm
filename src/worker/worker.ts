/**
 * Ephemeral worker agent factory.
 *
 * Workers use pi's createAgentSession under the hood, which gives them:
 * - Proper authentication via pi's AuthStorage
 * - Built-in tools (read for context-only workers)
 * - Retries and error handling from pi's infrastructure
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
      withCodingTools: false, // Workers are text-only by default
    },
    task,
  );

  const duration = Date.now() - startTime;

  if (result.success) {
    // Estimate tokens from text length (rough approximation)
    const outputTokens = Math.ceil(result.text.length / 4);
    const inputTokens = Math.ceil((systemPrompt.length + task.length) / 4);
    const cost = 0; // pi handles cost tracking internally

    if (costTracker) {
      costTracker.record(config.id, inputTokens, outputTokens, cost);
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
