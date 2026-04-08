/**
 * CEO / Orchestrator agent.
 *
 * The top-level agent that receives high-level directives, decomposes
 * them across teams, and coordinates the full orchestration cycle.
 */

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { CycleResult, SwarmConfig } from "../types.js";
import { createOrchestratorTools } from "./tools.js";
import { resolveApiKey } from "../env.js";
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

/** Extract the last assistant text and usage from agent transcript. */
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
  const { tools, getDelegationResults } = createOrchestratorTools(config, costTracker);

  const userMessage = context
    ? `${directive}\n\n## Additional Context\n${context}`
    : directive;

  try {
    // Cast needed: pi-swarm is model-agnostic, so provider/model are runtime strings
    const model = (getModel as Function)(
      config.orchestrator.model.provider,
      config.orchestrator.model.model,
    );

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools,
        thinkingLevel: config.orchestrator.model.thinkingLevel ?? "off",
      },
      streamFn: streamSimple,
      getApiKey: resolveApiKey,
    });

    await agent.prompt(userMessage);
    await agent.waitForIdle();

    const { text, inputTokens, outputTokens, cost: totalCost } = extractOutput(agent);

    costTracker.record("orchestrator", inputTokens, outputTokens, totalCost);

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
      companyStatus: text,
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
