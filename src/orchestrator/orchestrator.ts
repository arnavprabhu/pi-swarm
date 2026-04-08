/**
 * CEO / Orchestrator agent.
 *
 * Uses pi's createAgentSession for proper auth and model handling.
 */

import type { CycleResult, SwarmConfig } from "../types.js";
import { createSwarmSession } from "../session.js";
import { createOrchestratorToolDefinitions } from "./tools.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";
import { randomUUID } from "node:crypto";

/** Build the orchestrator's system prompt. */
function buildOrchestratorPrompt(config: SwarmConfig): string {
  const teamList = Object.entries(config.teams)
    .map(([id, team]) => `- **${team.lead.name}** (${id}): manages ${team.workers.length} workers`)
    .join("\n");

  return `You are the CEO / Orchestrator of "${config.name}".

Your role is to receive high-level directives and coordinate their execution across your leadership team. You delegate tasks to the right team leads, who in turn manage their specialist workers.

## Your Teams
${teamList || "Teams are configured dynamically. Use the delegate_task tool to assign work."}

## Operating Principles
1. **Decompose** — Break complex directives into team-level tasks
2. **Delegate** — Assign each task to the most appropriate team lead
3. **Coordinate** — Handle cross-team dependencies and conflicts
4. **Synthesize** — Collect reports and produce a unified summary
5. **Budget** — Be mindful of costs; each delegation spawns AI agents${config.costBudget ? `\n6. **Budget limit**: $${config.costBudget.toFixed(2)} per cycle` : ""}

## Workflow
1. Analyze the directive
2. Identify which teams need to be involved
3. Use delegate_task for focused work or broadcast for cross-cutting tasks
4. Collect reports and resolve any conflicts
5. Call finish_cycle with a comprehensive summary

Be strategic. Not every task needs every team. Delegate precisely.`;
}

/**
 * Run a full orchestration cycle.
 */
export async function runOrchestrationCycle(
  config: SwarmConfig,
  directive: string,
  context?: string,
): Promise<CycleResult> {
  const cycleId = randomUUID();
  const startTime = Date.now();
  const costTracker = new CostTracker(config.costBudget);

  logger.info("orchestrator", "cycle_started", { cycleId, directive });

  const systemPrompt = buildOrchestratorPrompt(config);
  const { tools: customTools, getDelegationResults } = createOrchestratorToolDefinitions(config, costTracker);

  const userMessage = context
    ? `${directive}\n\n## Additional Context\n${context}`
    : directive;

  try {
    const session = await createSwarmSession({
      agentId: "orchestrator",
      systemPrompt,
      model: config.orchestrator.model,
      thinkingLevel: config.orchestrator.model.thinkingLevel ?? "off",
      withCodingTools: false,
      customTools,
    });

    await session.prompt(userMessage);
    await session.agent.waitForIdle();

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
      logger.error("orchestrator", "orchestrator_error", { error });
    }

    const delegations = Array.from(getDelegationResults().values());
    const duration = Date.now() - startTime;

    logger.info("orchestrator", "cycle_completed", {
      cycleId,
      duration,
      totalCost: costTracker.totalCost,
      teamsInvolved: delegations.length,
    });

    return {
      cycleId,
      timestamp: new Date().toISOString(),
      delegations,
      companyStatus: error ? `Orchestration error: ${error}` : text,
      totalCost: costTracker.totalCost,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("orchestrator", "cycle_failed", { cycleId, error: errorMessage });

    return {
      cycleId,
      timestamp: new Date().toISOString(),
      delegations: [],
      companyStatus: `Orchestration failed: ${errorMessage}`,
      totalCost: costTracker.totalCost,
      duration: Date.now() - startTime,
    };
  }
}
