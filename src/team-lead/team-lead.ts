/**
 * Team lead agent factory.
 *
 * Team leads use pi's createAgentSession with custom tools for
 * spawning workers and reporting to the orchestrator.
 */

import type { AgentConfig, AgentResult, ModelConfig, TeamId } from "../types.js";
import { createSwarmSession } from "../session.js";
import { createTeamLeadToolDefinitions } from "./tools.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

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

  const customTools = createTeamLeadToolDefinitions(
    config.team as TeamId,
    config.id,
    wModel,
    tracker,
  );

  try {
    const session = await createSwarmSession({
      agentId: config.id,
      systemPrompt,
      model: config.model,
      thinkingLevel: config.model.thinkingLevel ?? "off",
      withCodingTools: false,
      customTools,
    });

    await session.prompt(directive);
    await session.agent.waitForIdle();

    const duration = Date.now() - startTime;

    // Extract the last assistant message
    const messages = session.agent.state.messages;
    const lastMsg = [...messages].reverse().find(
      (m) => "role" in m && m.role === "assistant",
    ) as any;

    let text = "";
    let error: string | undefined;

    if (lastMsg) {
      text = lastMsg.content
        ?.filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("") ?? "";

      if (lastMsg.stopReason === "error") {
        error = lastMsg.errorMessage ?? "Unknown error";
      }
    }

    if (error) {
      throw new Error(error);
    }

    logger.info(config.id, "team_lead_completed", { duration });

    return {
      agentId: config.id,
      success: true,
      output: text,
      cost: { input: 0, output: 0, total: tracker.totalCost },
      tokensUsed: { input: 0, output: 0 },
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
