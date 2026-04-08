/**
 * Tools available to team-lead agents.
 *
 * Uses pi's ToolDefinition format for proper integration with
 * createAgentSession's custom tools system.
 */

import { Type } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";
import type { ModelConfig, AgentResult, TeamId } from "../types.js";
import { runWorker } from "../worker/worker.js";
import { getTeamWorkerRoles, workerRoleToConfig } from "../worker/roles.js";
import { createReport } from "../protocol/messages.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

/**
 * Create tool definitions for a team lead agent.
 *
 * Returns pi ToolDefinition[] compatible with createAgentSession's customTools.
 */
export function createTeamLeadToolDefinitions(
  teamId: TeamId,
  leadId: string,
  workerModel: ModelConfig,
  costTracker: CostTracker,
) {
  const workerResults: AgentResult[] = [];

  const spawnWorkerTool = defineTool({
    name: "spawn_worker",
    label: "Spawn Worker",
    description:
      "Spawn an ephemeral worker agent to execute a specific task. Choose the appropriate worker role for the task. The worker will execute and return its result.",
    parameters: Type.Object({
      workerId: Type.String({
        description: "The ID of the worker role to spawn (e.g., 'frontend-eng', 'backend-eng')",
      }),
      task: Type.String({
        description: "The specific task for the worker to execute",
      }),
      context: Type.Optional(
        Type.String({
          description: "Additional context to provide to the worker",
        }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const availableRoles = getTeamWorkerRoles(teamId);
      const role = availableRoles.find((r) => r.id === args.workerId);

      if (!role) {
        const available = availableRoles.map((r) => `${r.id} (${r.name})`).join(", ");
        return {
          content: [{ type: "text" as const, text: `Error: Worker role "${args.workerId}" not found for team "${teamId}". Available roles: ${available}` }],
          details: undefined,
        };
      }

      const workerConfig = workerRoleToConfig(role, workerModel);
      logger.info(leadId, "spawning_worker", { workerId: args.workerId, task: args.task });

      const result = await runWorker(workerConfig, args.task, args.context, costTracker);
      workerResults.push(result);

      return {
        content: [{
          type: "text" as const,
          text: result.success
            ? `Worker ${role.name} completed successfully:\n${result.output}`
            : `Worker ${role.name} failed: ${result.output}`,
        }],
        details: undefined,
      };
    },
  });

  const listWorkersTool = defineTool({
    name: "list_workers",
    label: "List Workers",
    description: "List all available worker roles for this team.",
    parameters: Type.Object({}),
    execute: async () => {
      const roles = getTeamWorkerRoles(teamId);
      return {
        content: [{ type: "text" as const, text: roles.map((r) => `- ${r.id}: ${r.name} — ${r.role}`).join("\n") }],
        details: undefined,
      };
    },
  });

  const reportTool = defineTool({
    name: "report_to_orchestrator",
    label: "Report to Orchestrator",
    description: "Send a structured report back to the orchestrator summarizing your team's work.",
    parameters: Type.Object({
      summary: Type.String({ description: "A one-line summary of the team's work" }),
      body: Type.String({ description: "Detailed report of accomplishments, decisions, and blockers" }),
    }),
    execute: async (_toolCallId, args) => {
      const message = createReport(leadId, "orchestrator", args.summary, args.body, "");
      logger.info(leadId, "report_sent", { summary: args.summary });
      return {
        content: [{ type: "text" as const, text: `Report sent: ${args.summary}` }],
        details: undefined,
      };
    },
  });

  const getResultsTool = defineTool({
    name: "get_worker_results",
    label: "Get Worker Results",
    description: "Retrieve the results from all workers spawned during this session.",
    parameters: Type.Object({}),
    execute: async () => {
      if (workerResults.length === 0) {
        return { content: [{ type: "text" as const, text: "No workers have been spawned yet." }], details: undefined };
      }
      const text = workerResults
        .map((r) => `[${r.success ? "OK" : "FAIL"}] ${r.agentId}: ${r.output.slice(0, 500)}${r.output.length > 500 ? "..." : ""}`)
        .join("\n\n");
      return { content: [{ type: "text" as const, text }], details: undefined };
    },
  });

  return [spawnWorkerTool, listWorkersTool, reportTool, getResultsTool];
}

// Keep backward compat export name
export const createTeamLeadTools = createTeamLeadToolDefinitions;
