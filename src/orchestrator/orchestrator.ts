/**
 * CEO / Orchestrator agent.
 */

import type { CycleResult, SwarmConfig } from "../types.js";
import { createSwarmAgent } from "../session.js";
import { createOrchestratorToolDefinitions } from "./tools.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";
import { CycleTracker } from "../ui/tracker.js";
import { ProgressLogger } from "../ui/progress.js";
import { printTree } from "../ui/tree.js";
import { randomUUID } from "node:crypto";

/** Options for controlling orchestration behavior. */
export interface OrchestrationOptions {
  /** Show the live progress output. Default: true */
  showProgress?: boolean;
  /** Print the team tree after cycle. Default: true */
  showTree?: boolean;
  /** Suppress the default JSONL logger. Default: true when showProgress is true */
  suppressLogger?: boolean;
}

function buildOrchestratorPrompt(config: SwarmConfig): string {
  const teamList = Object.entries(config.teams)
    .map(([id, team]) => `- **${team.lead.name}** (${id}): manages ${team.workers.length} workers`)
    .join("\n");

  return `You are the CEO / Orchestrator of "${config.name}".

Your role is to receive high-level directives and coordinate their execution across your leadership team.

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
 * Run a full orchestration cycle with UI.
 */
export async function runOrchestrationCycle(
  config: SwarmConfig,
  directive: string,
  context?: string,
  uiOpts?: OrchestrationOptions,
): Promise<CycleResult> {
  const cycleId = randomUUID();
  const startTime = Date.now();
  const costTracker = new CostTracker(config.costBudget);

  const showProgress = uiOpts?.showProgress ?? true;
  const showTree = uiOpts?.showTree ?? true;
  const suppressLogger = uiOpts?.suppressLogger ?? showProgress;

  // Fully suppress JSONL logger when progress UI is active
  // (errors are shown via the ProgressLogger's colored format instead)
  const prevLogLevel = logger.getLevel();
  if (suppressLogger) {
    logger.setEnabled(false);
  }

  // Create UI components
  const cycleTracker = new CycleTracker(config.name);
  cycleTracker.cycleId = cycleId;
  const progress = new ProgressLogger(showProgress);

  // Register orchestrator in tracker
  const orchModel = config.orchestrator.model.model;
  cycleTracker.register("orchestrator", "Orchestrator", "orchestrator", orchModel);
  cycleTracker.working("orchestrator");

  progress.cycleStart(directive);
  logger.info("orchestrator", "cycle_started", { cycleId, directive });

  const systemPrompt = buildOrchestratorPrompt(config);
  const { tools, getDelegationResults } = createOrchestratorToolDefinitions(config, {
    costTracker,
    cycleTracker,
    progress,
  });

  const userMessage = context ? `${directive}\n\n## Additional Context\n${context}` : directive;

  try {
    const agent = createSwarmAgent({
      agentId: "orchestrator",
      systemPrompt,
      model: config.orchestrator.model,
      thinkingLevel: config.orchestrator.model.thinkingLevel ?? "off",
      tools,
    });

    await agent.prompt(userMessage);
    await agent.waitForIdle();

    const messages = agent.state.messages;
    const lastMsg = [...messages].reverse().find((m) => "role" in m && m.role === "assistant") as any;

    let text = "";
    let error: string | undefined;

    if (lastMsg) {
      text = lastMsg.content?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") ?? "";
      if (lastMsg.stopReason === "error") error = lastMsg.errorMessage ?? "Unknown error";
    }

    if (error) {
      // Show via progress logger (colored) instead of raw JSONL
      progress.failed("Orchestrator", "orchestrator", error);
      cycleTracker.error("orchestrator", error);
    }

    const delegations = Array.from(getDelegationResults().values());
    const duration = Date.now() - startTime;

    if (!error) cycleTracker.complete("orchestrator", { duration });
    progress.cycleEnd(duration, delegations.length);

    // Print the team tree
    if (showTree) {
      printTree(cycleTracker);
    }

    logger.info("orchestrator", "cycle_completed", {
      cycleId, duration, totalCost: costTracker.totalCost, teamsInvolved: delegations.length,
    });

    // Restore logger after our final log
    if (suppressLogger) {
      logger.setEnabled(true);
      logger.setLevel(prevLogLevel);
    }

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
    const duration = Date.now() - startTime;

    cycleTracker.error("orchestrator", errorMessage);
    progress.failed("Orchestrator", "orchestrator", errorMessage);

    if (showTree) printTree(cycleTracker);
    if (suppressLogger) {
      logger.setEnabled(true);
      logger.setLevel(prevLogLevel);
    }

    logger.error("orchestrator", "cycle_failed", { cycleId, error: errorMessage });

    return {
      cycleId, timestamp: new Date().toISOString(), delegations: [],
      companyStatus: `Orchestration failed: ${errorMessage}`,
      totalCost: costTracker.totalCost, duration,
    };
  }
}
