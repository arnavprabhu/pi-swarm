/**
 * Ephemeral worker agent factory.
 *
 * Workers are the simplest agents — no session persistence, no memory.
 * They receive a task, execute it, and return a structured result.
 */

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import type { AgentConfig, AgentResult } from "../types.js";
import { logger } from "../utils/logger.js";
import { CostTracker } from "../utils/cost-tracker.js";

/** Extract text content from the last assistant message in an Agent's state. */
function extractAgentOutput(agent: Agent): { text: string; inputTokens: number; outputTokens: number; cost: number } {
  const messages = agent.state.messages;
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;

  for (const msg of messages) {
    if ("role" in msg && msg.role === "assistant") {
      const assistantMsg = msg as import("@mariozechner/pi-ai").AssistantMessage;
      for (const block of assistantMsg.content) {
        if (block.type === "text") {
          text += block.text;
        }
      }
      if (assistantMsg.usage) {
        inputTokens += assistantMsg.usage.input;
        outputTokens += assistantMsg.usage.output;
        cost += (assistantMsg.usage.cost?.input ?? 0) + (assistantMsg.usage.cost?.output ?? 0);
      }
    }
  }

  return { text, inputTokens, outputTokens, cost };
}

/**
 * Run an ephemeral worker agent.
 *
 * @param config - The worker's configuration (role, model, system prompt, etc.)
 * @param task - The task to execute (becomes the user message)
 * @param context - Additional context to prepend to the system prompt
 * @param costTracker - Optional cost tracker to record spend
 * @returns AgentResult with the worker's output
 */
export async function runWorker(
  config: AgentConfig,
  task: string,
  context?: string,
  costTracker?: CostTracker,
): Promise<AgentResult> {
  const startTime = Date.now();
  const toolCalls: AgentResult["toolCalls"] = [];

  logger.info(config.id, "worker_spawned", { name: config.name, role: config.role });

  const systemPrompt = context
    ? `${config.systemPrompt}\n\n## Context\n${context}`
    : config.systemPrompt;

  try {
    // Cast needed: pi-swarm is model-agnostic, so provider/model are runtime strings
    const model = (getModel as Function)(config.model.provider, config.model.model);

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools: [], // Workers get no tools by default — they reason and produce text
        thinkingLevel: config.model.thinkingLevel ?? "off",
      },
      streamFn: streamSimple,
    });

    // Run the agent with the task as the user message
    await agent.prompt(task);
    await agent.waitForIdle();

    const duration = Date.now() - startTime;
    const { text, inputTokens, outputTokens, cost: totalCost } = extractAgentOutput(agent);

    if (costTracker) {
      costTracker.record(config.id, inputTokens, outputTokens, totalCost);
    }

    logger.info(config.id, "worker_completed", {
      duration,
      inputTokens,
      outputTokens,
      cost: totalCost,
    });

    return {
      agentId: config.id,
      success: true,
      output: text,
      cost: {
        input: totalCost * 0.5, // approximate split
        output: totalCost * 0.5,
        total: totalCost,
      },
      tokensUsed: { input: inputTokens, output: outputTokens },
      duration,
      toolCalls,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(config.id, "worker_failed", { error: errorMessage, duration });

    return {
      agentId: config.id,
      success: false,
      output: `Worker ${config.name} failed: ${errorMessage}`,
      cost: { input: 0, output: 0, total: 0 },
      tokensUsed: { input: 0, output: 0 },
      duration,
      toolCalls,
    };
  }
}
