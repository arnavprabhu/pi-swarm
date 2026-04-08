/**
 * Ephemeral worker agent factory.
 *
 * Workers are lightweight agents — no session persistence, no memory.
 * They receive a task, execute it, and return a structured result.
 *
 * Uses pi-agent-core's Agent class the same way pi-coding-agent does:
 * custom streamFn with injected API key, proper event handling.
 */

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { AgentConfig, AgentResult } from "../types.js";
import { authenticatedStreamFn } from "../env.js";
import { logger } from "../utils/logger.js";
import { CostTracker } from "../utils/cost-tracker.js";

/** Extract text and usage from the agent transcript. */
function extractOutput(agent: Agent): { text: string; inputTokens: number; outputTokens: number; cost: number; error?: string } {
  const messages = agent.state.messages;
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;

  for (const msg of messages) {
    if ("role" in msg && msg.role === "assistant") {
      const am = msg as AssistantMessage;
      if (am.usage) {
        inputTokens += am.usage.input;
        outputTokens += am.usage.output;
        cost += (am.usage.cost?.input ?? 0) + (am.usage.cost?.output ?? 0);
      }
    }
  }

  // Use the last assistant text as output
  const lastAssistant = [...messages].reverse().find(
    (m) => "role" in m && m.role === "assistant",
  ) as AssistantMessage | undefined;

  let text = "";
  let error: string | undefined;

  if (lastAssistant) {
    text = lastAssistant.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");

    if ((lastAssistant as any).stopReason === "error") {
      error = (lastAssistant as any).errorMessage ?? "Unknown agent error";
    }
  }

  return { text, inputTokens, outputTokens, cost, error };
}

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

  try {
    const model = (getModel as Function)(config.model.provider, config.model.model);

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools: [],
        thinkingLevel: config.model.thinkingLevel ?? "off",
      },
      streamFn: authenticatedStreamFn,
    });

    await agent.prompt(task);
    await agent.waitForIdle();

    const duration = Date.now() - startTime;
    const { text, inputTokens, outputTokens, cost: totalCost, error } = extractOutput(agent);

    if (error) {
      throw new Error(error);
    }

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
      cost: { input: totalCost * 0.5, output: totalCost * 0.5, total: totalCost },
      tokensUsed: { input: inputTokens, output: outputTokens },
      duration,
      toolCalls: [],
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
      toolCalls: [],
    };
  }
}
