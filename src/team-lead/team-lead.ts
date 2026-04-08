/**
 * Team lead agent factory.
 *
 * Creates and runs a team lead (C-level) agent that can spawn workers,
 * coordinate team work, and report back to the orchestrator.
 */

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { AgentConfig, AgentResult, ModelConfig, TeamId } from "../types.js";
import { createTeamLeadTools } from "./tools.js";
import { resolveApiKey } from "../env.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

/** Extract text and usage from agent transcript. */
function extractOutput(agent: Agent): { text: string; inputTokens: number; outputTokens: number; cost: number } {
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

  const lastAssistant = [...messages].reverse().find(
    (m) => "role" in m && m.role === "assistant",
  ) as AssistantMessage | undefined;

  let text = "";
  if (lastAssistant) {
    text = lastAssistant.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");

    if ((lastAssistant as any).stopReason === "error") {
      throw new Error((lastAssistant as any).errorMessage ?? "Unknown agent error");
    }
  }

  return { text, inputTokens, outputTokens, cost };
}

/**
 * Run a team lead agent.
 */
export async function runTeamLead(
  config: AgentConfig,
  directive: string,
  context?: string,
  workerModel?: ModelConfig,
  costTracker?: CostTracker,
): Promise<AgentResult> {
  const startTime = Date.now();
  const tracker = costTracker ?? new CostTracker();
  const wModel = workerModel ?? config.model;

  logger.info(config.id, "team_lead_spawned", { name: config.name, team: config.team });

  const systemPrompt = context
    ? `${config.systemPrompt}\n\n## Orchestrator Context\n${context}`
    : config.systemPrompt;

  const tools = createTeamLeadTools(
    config.team as TeamId,
    config.id,
    wModel,
    tracker,
  );

  try {
    // Cast needed: pi-swarm is model-agnostic, so provider/model are runtime strings
    const model = (getModel as Function)(config.model.provider, config.model.model);

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools,
        thinkingLevel: config.model.thinkingLevel ?? "off",
      },
      streamFn: streamSimple,
      getApiKey: resolveApiKey,
    });

    await agent.prompt(directive);
    await agent.waitForIdle();

    const duration = Date.now() - startTime;
    const { text, inputTokens, outputTokens, cost: totalCost } = extractOutput(agent);

    tracker.record(config.id, inputTokens, outputTokens, totalCost);

    logger.info(config.id, "team_lead_completed", {
      duration,
      cost: tracker.totalCost,
    });

    return {
      agentId: config.id,
      success: true,
      output: text,
      cost: { input: totalCost * 0.5, output: totalCost * 0.5, total: tracker.totalCost },
      tokensUsed: { input: inputTokens, output: outputTokens },
      duration,
      toolCalls: [],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(config.id, "team_lead_failed", { error: errorMessage });

    return {
      agentId: config.id,
      success: false,
      output: `Team lead ${config.name} failed: ${errorMessage}`,
      cost: { input: 0, output: 0, total: 0 },
      tokensUsed: { input: 0, output: 0 },
      duration,
      toolCalls: [],
    };
  }
}
