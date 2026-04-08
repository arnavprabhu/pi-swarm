/**
 * Pi extension entry point.
 *
 * Registers /swarm, /swarm-config, /swarm-status commands and the
 * swarm_delegate tool for use inside pi's interactive CLI.
 *
 * Load with: pi -e ./dist/extension.js
 */

import { Type } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { runOrchestrationCycle } from "./orchestrator/orchestrator.js";
import { createDefaultConfig } from "./config.js";
import type { SwarmConfig } from "./types.js";

let currentConfig: SwarmConfig = createDefaultConfig();
let lastCycleResult: string | null = null;

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
      execute: async (_toolCallId, args) => {
        if (args.budget !== undefined) {
          currentConfig.costBudget = args.budget;
        }

        const result = await runOrchestrationCycle(currentConfig, args.task, args.context);
        lastCycleResult = JSON.stringify(result, null, 2);

        const summary = [
          `# Orchestration Complete`,
          ``,
          `**Cycle ID:** ${result.cycleId}`,
          `**Duration:** ${(result.duration / 1000).toFixed(1)}s`,
          `**Teams Involved:** ${result.delegations.length}`,
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

      ctx.ui.notify("Starting swarm orchestration...", "info");

      const result = await runOrchestrationCycle(currentConfig, args.trim());
      lastCycleResult = JSON.stringify(result, null, 2);

      // Feed the result back to the agent as a user message
      pi.sendUserMessage(
        `Swarm orchestration complete (${(result.duration / 1000).toFixed(1)}s, ${result.delegations.length} teams):\n\n${result.companyStatus}`,
      );
    },
  });

  // ----- Command: /swarm-config -----
  pi.registerCommand("swarm-config", {
    description: "Show swarm configuration",
    handler: async (_args, ctx) => {
      const teams = Object.entries(currentConfig.teams)
        .map(([id, t]) => `  ${id}: ${t.lead.name} + ${t.workers.length} workers`)
        .join("\n");

      const info = [
        `Swarm: ${currentConfig.name}`,
        `Orchestrator: ${currentConfig.defaults.orchestratorModel.provider}/${currentConfig.defaults.orchestratorModel.model}`,
        `Team leads: ${currentConfig.defaults.teamLeadModel.provider}/${currentConfig.defaults.teamLeadModel.model}`,
        `Workers: ${currentConfig.defaults.workerModel.provider}/${currentConfig.defaults.workerModel.model}`,
        `Budget: ${currentConfig.costBudget ? `$${currentConfig.costBudget.toFixed(2)}` : "unlimited"}`,
        `Teams:\n${teams}`,
      ].join("\n");

      ctx.ui.notify(info, "info");
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
          `Last cycle: ${parsed.cycleId}\nDuration: ${(parsed.duration / 1000).toFixed(1)}s\nTeams: ${parsed.delegations?.length ?? 0}\n\n${parsed.companyStatus?.slice(0, 500) ?? "No summary"}`,
          "info",
        );
      } catch {
        ctx.ui.notify(lastCycleResult.slice(0, 500), "info");
      }
    },
  });
}
