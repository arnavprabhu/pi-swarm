/**
 * Tools available to team-lead agents.
 */

import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ModelConfig, AgentResult, TeamId } from "../types.js";
import { runWorker } from "../worker/worker.js";
import { getTeamWorkerRoles, workerRoleToConfig } from "../worker/roles.js";
import { createReport } from "../protocol/messages.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }], details: undefined };
}

/**
 * Create AgentTool[] for a team lead.
 */
export function createTeamLeadToolDefinitions(
  teamId: TeamId,
  leadId: string,
  workerModel: ModelConfig,
  costTracker: CostTracker,
): AgentTool<any, any>[] {
  const workerResults: AgentResult[] = [];

  const spawnWorkerTool: AgentTool<any, any> = {
    name: "spawn_worker",
    label: "Spawn Worker",
    description:
      "Spawn an ephemeral worker agent. Choose the appropriate worker role for the task.",
    parameters: Type.Object({
      workerId: Type.String({
        description: "Worker role ID (e.g., 'frontend-eng', 'backend-eng', 'qa-eng')",
      }),
      task: Type.String({ description: "The specific task for the worker" }),
      context: Type.Optional(Type.String({ description: "Additional context" })),
    }),
    execute: async (_id: string, args: { workerId: string; task: string; context?: string }) => {
      const roles = getTeamWorkerRoles(teamId);
      const role = roles.find((r) => r.id === args.workerId);

      if (!role) {
        const available = roles.map((r) => `${r.id} (${r.name})`).join(", ");
        return text(`Error: Worker "${args.workerId}" not found. Available: ${available}`);
      }

      const config = workerRoleToConfig(role, workerModel);
      logger.info(leadId, "spawning_worker", { workerId: args.workerId, task: args.task });

      const result = await runWorker(config, args.task, args.context, costTracker);
      workerResults.push(result);

      return text(
        result.success
          ? `Worker ${role.name} completed:\n${result.output}`
          : `Worker ${role.name} failed: ${result.output}`,
      );
    },
  };

  const listWorkersTool: AgentTool<any, any> = {
    name: "list_workers",
    label: "List Workers",
    description: "List available worker roles for this team.",
    parameters: Type.Object({}),
    execute: async () => {
      const roles = getTeamWorkerRoles(teamId);
      return text(roles.map((r) => `- ${r.id}: ${r.name} — ${r.role}`).join("\n"));
    },
  };

  const reportTool: AgentTool<any, any> = {
    name: "report_to_orchestrator",
    label: "Report",
    description: "Send a report back to the orchestrator.",
    parameters: Type.Object({
      summary: Type.String({ description: "One-line summary" }),
      body: Type.String({ description: "Detailed report" }),
    }),
    execute: async (_id: string, args: { summary: string; body: string }) => {
      const msg = createReport(leadId, "orchestrator", args.summary, args.body, "");
      logger.info(leadId, "report_sent", { summary: args.summary });
      return text(`Report sent: ${args.summary}`);
    },
  };

  const getResultsTool: AgentTool<any, any> = {
    name: "get_worker_results",
    label: "Results",
    description: "Get results from all spawned workers.",
    parameters: Type.Object({}),
    execute: async () => {
      if (workerResults.length === 0) return text("No workers spawned yet.");
      const t = workerResults
        .map((r) => `[${r.success ? "OK" : "FAIL"}] ${r.agentId}: ${r.output.slice(0, 500)}${r.output.length > 500 ? "..." : ""}`)
        .join("\n\n");
      return text(t);
    },
  };

  return [spawnWorkerTool, listWorkersTool, reportTool, getResultsTool];
}

export const createTeamLeadTools = createTeamLeadToolDefinitions;
