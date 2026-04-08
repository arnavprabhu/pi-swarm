/**
 * Pi extension entry point.
 *
 * Registers /swarm, /swarm-config, /swarm-status commands and the
 * swarm_delegate tool for use inside pi's interactive CLI.
 *
 * Load with: pi -e ./dist/extension.js
 */

import { Type } from "@mariozechner/pi-ai";
import type { KnownProvider, Model } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { runOrchestrationCycle } from "./orchestrator/orchestrator.js";
import { createDefaultConfig } from "./config.js";
import type { SwarmConfig, ModelConfig } from "./types.js";

let cachedConfig: SwarmConfig | null = null;
let lastCycleResult: string | null = null;

/**
 * Build a ModelConfig from pi's current model.
 * Called at execution time (not import time) so it picks up
 * whatever model the user has selected via pi /model.
 */
function modelFromPi(piModel: Model<any> | undefined): ModelConfig | undefined {
  if (!piModel) return undefined;
  return {
    provider: piModel.provider as KnownProvider,
    model: piModel.id,
  };
}

/**
 * Get or create the swarm config, using pi's current model.
 */
function getConfig(piModel: Model<any> | undefined): SwarmConfig {
  const mc = modelFromPi(piModel);

  // Rebuild config if model changed or first call
  if (!cachedConfig || (mc && cachedConfig.defaults.orchestratorModel.model !== mc.model)) {
    cachedConfig = createDefaultConfig("Pi Swarm", {
      orchestratorModel: mc,
      teamLeadModel: mc,
      workerModel: mc,
    });
  }
  return cachedConfig;
}

export default function piSwarmExtension(pi: ExtensionAPI): void {
  // ----- Tool: swarm_delegate -----
  pi.registerTool(
    defineTool({
      name: "swarm_delegate",
      label: "Swarm Delegate",
      description:
        "Delegate a complex task to the pi-swarm multi-agent orchestration system. " +
        "The CEO agent will decompose the task, delegate to team leads, who spawn specialist workers.",
      parameters: Type.Object({
        task: Type.String({ description: "The high-level task or directive to orchestrate" }),
        context: Type.Optional(Type.String({ description: "Additional context or constraints" })),
        budget: Type.Optional(Type.Number({ description: "Maximum cost budget in dollars" })),
      }),
      execute: async (_toolCallId, args, _signal, _onUpdate, ctx) => {
        // ctx is the ExtensionContext — read pi's current model from it
        const baseConfig = getConfig(ctx?.model);
        // Create a copy to avoid mutating the cached config
        const config = args.budget !== undefined
          ? { ...baseConfig, costBudget: args.budget }
          : baseConfig;

        const result = await runOrchestrationCycle(config, args.task, args.context);
        lastCycleResult = JSON.stringify(result, null, 2);

        const summary = [
          `# Orchestration Complete`,
          ``,
          `**Cycle ID:** ${result.cycleId}`,
          `**Duration:** ${(result.duration / 1000).toFixed(1)}s`,
          `**Teams Involved:** ${result.delegations.length}`,
          `**Total Cost:** $${result.totalCost.toFixed(4)}`,
          ``,
          `## Result`,
          result.companyStatus,
        ].join("\n");

        return {
          content: [{ type: "text" as const, text: summary }],
          details: undefined,
        };
      },
    }),
  );

  // ----- Command: /swarm -----
  pi.registerCommand("swarm", {
    description: "Run a task through the pi-swarm multi-agent pipeline",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify(
          "Usage: /swarm <task description>  Example: /swarm Plan the Q2 product launch",
          "info",
        );
        return;
      }

      // Read pi's current model from the command context
      const config = getConfig(ctx.model);
      ctx.ui.notify(`Swarm starting with ${config.defaults.orchestratorModel.model}...`, "info");

      const result = await runOrchestrationCycle(config, args.trim());
      lastCycleResult = JSON.stringify(result, null, 2);

      pi.sendUserMessage(
        `Swarm orchestration complete (${(result.duration / 1000).toFixed(1)}s, ${result.delegations.length} teams):\n\n${result.companyStatus}`,
      );
    },
  });

  // ----- Command: /swarm-config -----
  pi.registerCommand("swarm-config", {
    description: "Show swarm configuration",
    handler: async (_args, ctx) => {
      const config = getConfig(ctx.model);
      const teams = Object.entries(config.teams)
        .map(([id, t]) => `  ${id}: ${t.lead.name} + ${t.workers.length} workers`)
        .join("\n");

      ctx.ui.notify(
        `Swarm: ${config.name}\n` +
        `Model: ${config.defaults.orchestratorModel.provider}/${config.defaults.orchestratorModel.model}\n` +
        `Budget: ${config.costBudget ? `$${config.costBudget.toFixed(2)}` : "unlimited"}\n` +
        `Teams:\n${teams}`,
        "info",
      );
    },
  });

  // ----- Command: /swarm-status -----
  pi.registerCommand("swarm-status", {
    description: "Show results from the last orchestration cycle",
    handler: async (_args, ctx) => {
      if (!lastCycleResult) {
        ctx.ui.notify("No orchestration cycles have been run yet.", "info");
        return;
      }
      try {
        const parsed = JSON.parse(lastCycleResult);
        ctx.ui.notify(
          `Last cycle: ${parsed.cycleId}\n` +
          `Duration: ${(parsed.duration / 1000).toFixed(1)}s\n` +
          `Teams: ${parsed.delegations?.length ?? 0}`,
          "info",
        );
      } catch {
        ctx.ui.notify("Error parsing last result", "error");
      }
    },
  });
}
