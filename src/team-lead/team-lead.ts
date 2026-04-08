/**
 * Team lead agent factory.
 */

import type { AgentConfig, AgentResult, ModelConfig, TeamId } from "../types.js";
import { createSwarmAgent } from "../session.js";
import { createTeamLeadToolDefinitions } from "./tools.js";
import type { TeamLeadToolOptions } from "./tools.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";
import type { CycleTracker } from "../ui/tracker.js";
import type { ProgressLogger } from "../ui/progress.js";

export interface TeamLeadRunOptions {
  costTracker?: CostTracker;
  cycleTracker?: CycleTracker;
  progress?: ProgressLogger;
  parentId?: string;
}

/**
 * Run a team lead agent.
 */
export async function runTeamLead(
  config: AgentConfig,
  directive: string,
  context?: string,
  workerModel?: ModelConfig,
  opts?: TeamLeadRunOptions,
): Promise<AgentResult> {
  const startTime = Date.now();
  const tracker = opts?.costTracker ?? new CostTracker();
  const wModel = workerModel ?? config.model;
  const { cycleTracker, progress, parentId } = opts ?? {};

  // Register in cycle tracker
  const modelShort = config.model.model;
  cycleTracker?.register(config.id, config.name, "team-lead", modelShort, config.team, parentId);
  cycleTracker?.working(config.id);

  logger.info(config.id, "team_lead_spawned", { name: config.name, team: config.team });

  const systemPrompt = context
    ? `${config.systemPrompt}\n\n## Orchestrator Context\n${context}`
    : config.systemPrompt;

  const toolOpts: TeamLeadToolOptions = {
    costTracker: tracker,
    cycleTracker,
    progress,
    leadId: config.id,
  };

  const tools = createTeamLeadToolDefinitions(config.team as TeamId, config.id, wModel, toolOpts);

  try {
    const agent = createSwarmAgent({
      agentId: config.id,
      systemPrompt,
      model: config.model,
      thinkingLevel: config.model.thinkingLevel ?? "off",
      tools,
    });

    await agent.prompt(directive);
    await agent.waitForIdle();

    const duration = Date.now() - startTime;

    const messages = agent.state.messages;
    const lastMsg = [...messages].reverse().find((m) => "role" in m && m.role === "assistant") as any;

    let text = "";
    let error: string | undefined;

    if (lastMsg) {
      text = lastMsg.content?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") ?? "";
      if (lastMsg.stopReason === "error") error = lastMsg.errorMessage ?? "Unknown error";
    }

    if (error) throw new Error(error);

    // Estimate the team lead's own token usage (rough heuristic)
    const leadInputTokens = Math.ceil((systemPrompt.length + directive.length) / 4);
    const leadOutputTokens = Math.ceil(text.length / 4);
    const leadCost = (leadInputTokens / 1000) * 0.01 + (leadOutputTokens / 1000) * 0.03;

    tracker.record(config.id, leadInputTokens, leadOutputTokens, leadCost);

    cycleTracker?.complete(config.id, { duration, cost: leadCost });
    progress?.complete(config.name, "team-lead", duration);
    logger.info(config.id, "team_lead_completed", { duration, cost: tracker.totalCost });

    return {
      agentId: config.id, success: true, output: text,
      cost: { input: (leadInputTokens / 1000) * 0.01, output: (leadOutputTokens / 1000) * 0.03, total: tracker.totalCost },
      tokensUsed: { input: leadInputTokens, output: leadOutputTokens }, duration, toolCalls: [],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    cycleTracker?.error(config.id, errorMessage);
    progress?.failed(config.name, "team-lead", errorMessage);
    logger.error(config.id, "team_lead_failed", { error: errorMessage });

    return {
      agentId: config.id, success: false,
      output: `Team lead ${config.name} failed: ${errorMessage}`,
      cost: { input: 0, output: 0, total: 0 },
      tokensUsed: { input: 0, output: 0 }, duration, toolCalls: [],
    };
  }
}
