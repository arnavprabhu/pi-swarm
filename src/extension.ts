/**
 * Pi extension entry point.
 *
 * When loaded via `pi -e ./dist/extension.js`, this registers
 * tools and commands for interacting with pi-swarm from within pi.
 */

import { Type } from "@mariozechner/pi-ai";
import { runOrchestrationCycle } from "./orchestrator/orchestrator.js";
import { createDefaultConfig } from "./config.js";
import type { ModelConfig, SwarmConfig } from "./types.js";

/** The pi extension context interface (based on pi extension docs). */
interface PiExtensionContext {
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: unknown;
    execute: (args: Record<string, unknown>) => Promise<string>;
  }) => void;
  registerCommand: (cmd: {
    name: string;
    description: string;
    execute: (args: string) => Promise<string>;
  }) => void;
}

let currentConfig: SwarmConfig = createDefaultConfig();
let lastCycleResult: string | null = null;

export default function piSwarmExtension(context: PiExtensionContext): void {
  // ----- Tools -----

  context.registerTool({
    name: "swarm_delegate",
    description:
      "Delegate a complex task to the pi-swarm multi-agent orchestration system. " +
      "The CEO agent will decompose the task, delegate to team leads, who spawn specialist workers. " +
      "Returns a comprehensive report of what every team accomplished.",
    parameters: Type.Object({
      task: Type.String({
        description: "The high-level task or directive to orchestrate",
      }),
      context: Type.Optional(
        Type.String({
          description: "Additional context, constraints, or background info",
        }),
      ),
      budget: Type.Optional(
        Type.Number({
          description: "Maximum cost budget in dollars for this cycle",
        }),
      ),
    }),
    execute: async (args: Record<string, unknown>): Promise<string> => {
      const task = args.task as string;
      const ctx = args.context as string | undefined;
      const budget = args.budget as number | undefined;

      if (budget !== undefined) {
        currentConfig.costBudget = budget;
      }

      const result = await runOrchestrationCycle(currentConfig, task, ctx);
      lastCycleResult = JSON.stringify(result, null, 2);

      const summary = [
        `# Orchestration Complete`,
        ``,
        `**Cycle ID:** ${result.cycleId}`,
        `**Duration:** ${(result.duration / 1000).toFixed(1)}s`,
        `**Total Cost:** $${result.totalCost.toFixed(4)}`,
        `**Teams Involved:** ${result.delegations.length}`,
        ``,
        `## Result`,
        result.companyStatus,
      ].join("\n");

      return summary;
    },
  });

  context.registerTool({
    name: "swarm_status",
    description: "Get the results of the last pi-swarm orchestration cycle.",
    parameters: Type.Object({}),
    execute: async (): Promise<string> => {
      return lastCycleResult ?? "No orchestration cycles have been run yet.";
    },
  });

  // ----- Commands -----

  context.registerCommand({
    name: "swarm",
    description: "Run a task through the pi-swarm multi-agent orchestration pipeline",
    execute: async (input: string): Promise<string> => {
      if (!input.trim()) {
        return "Usage: /swarm <task description>\n\nExample: /swarm Plan and execute the Q2 product launch";
      }

      const result = await runOrchestrationCycle(currentConfig, input.trim());
      lastCycleResult = JSON.stringify(result, null, 2);

      return [
        `Orchestration complete in ${(result.duration / 1000).toFixed(1)}s ($${result.totalCost.toFixed(4)})`,
        ``,
        result.companyStatus,
      ].join("\n");
    },
  });

  context.registerCommand({
    name: "swarm-config",
    description: "Show or update swarm configuration",
    execute: async (input: string): Promise<string> => {
      if (!input.trim() || input.trim() === "show") {
        const teams = Object.entries(currentConfig.teams)
          .map(([id, t]) => `  ${id}: ${t.lead.name} + ${t.workers.length} workers`)
          .join("\n");

        return [
          `# Swarm Configuration`,
          ``,
          `**Name:** ${currentConfig.name}`,
          `**Orchestrator model:** ${currentConfig.defaults.orchestratorModel.provider}/${currentConfig.defaults.orchestratorModel.model}`,
          `**Team lead model:** ${currentConfig.defaults.teamLeadModel.provider}/${currentConfig.defaults.teamLeadModel.model}`,
          `**Worker model:** ${currentConfig.defaults.workerModel.provider}/${currentConfig.defaults.workerModel.model}`,
          `**Max concurrent agents:** ${currentConfig.maxConcurrentAgents ?? "unlimited"}`,
          `**Cost budget:** ${currentConfig.costBudget ? `$${currentConfig.costBudget.toFixed(2)}` : "unlimited"}`,
          ``,
          `**Teams:**`,
          teams,
        ].join("\n");
      }

      // Parse simple key=value updates
      const parts = input.trim().split(/\s+/);
      for (const part of parts) {
        const [key, value] = part.split("=");
        if (key === "budget" && value) {
          currentConfig.costBudget = parseFloat(value);
        } else if (key === "max-agents" && value) {
          currentConfig.maxConcurrentAgents = parseInt(value, 10);
        }
      }

      return `Configuration updated. Use /swarm-config show to verify.`;
    },
  });

  context.registerCommand({
    name: "swarm-status",
    description: "Show results from the last orchestration cycle",
    execute: async (): Promise<string> => {
      return lastCycleResult ?? "No orchestration cycles have been run yet.";
    },
  });
}
