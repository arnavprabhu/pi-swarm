/**
 * Tools available to team-lead agents.
 *
 * These tools let team leads spawn workers and communicate results
 * back to the orchestrator.
 */

import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { AgentConfig, AgentResult, ModelConfig, TeamId } from "../types.js";
import { runWorker } from "../worker/worker.js";
import { getTeamWorkerRoles, workerRoleToConfig } from "../worker/roles.js";
import { createReport } from "../protocol/messages.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

/** Helper to create a text tool result. */
function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

/**
 * Create the set of tools for a team lead agent.
 *
 * @param teamId - Which team this lead manages
 * @param leadId - The lead agent's ID (for message attribution)
 * @param workerModel - Model config to use for spawned workers
 * @param costTracker - Shared cost tracker
 * @returns Array of AgentTool definitions
 */
export function createTeamLeadTools(
  teamId: TeamId,
  leadId: string,
  workerModel: ModelConfig,
  costTracker: CostTracker,
): AgentTool<any, any>[] {
  // Collect results from spawned workers
  const workerResults: AgentResult[] = [];

  const spawnWorkerTool: AgentTool<any, any> = {
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
    execute: async (_toolCallId: string, args: { workerId: string; task: string; context?: string }) => {
      const availableRoles = getTeamWorkerRoles(teamId);
      const role = availableRoles.find((r) => r.id === args.workerId);

      if (!role) {
        const available = availableRoles.map((r) => `${r.id} (${r.name})`).join(", ");
        return textResult(
          `Error: Worker role "${args.workerId}" not found for team "${teamId}". Available roles: ${available}`,
        );
      }

      const workerConfig = workerRoleToConfig(role, workerModel);
      logger.info(leadId, "spawning_worker", { workerId: args.workerId, task: args.task });

      const result = await runWorker(workerConfig, args.task, args.context, costTracker);
      workerResults.push(result);

      return textResult(
        result.success
          ? `Worker ${role.name} completed successfully:\n${result.output}`
          : `Worker ${role.name} failed: ${result.output}`,
      );
    },
  };

  const listWorkersTool: AgentTool<any, any> = {
    name: "list_workers",
    label: "List Workers",
    description: "List all available worker roles for this team.",
    parameters: Type.Object({}),
    execute: async () => {
      const roles = getTeamWorkerRoles(teamId);
      return textResult(roles.map((r) => `- ${r.id}: ${r.name} — ${r.role}`).join("\n"));
    },
  };

  const reportToOrchestratorTool: AgentTool<any, any> = {
    name: "report_to_orchestrator",
    label: "Report to Orchestrator",
    description:
      "Send a structured report back to the orchestrator summarizing your team's work and findings.",
    parameters: Type.Object({
      summary: Type.String({
        description: "A one-line summary of the team's work",
      }),
      body: Type.String({
        description: "Detailed report of what was accomplished, decisions made, and any blockers",
      }),
    }),
    execute: async (_toolCallId: string, args: { summary: string; body: string }) => {
      const message = createReport(leadId, "orchestrator", args.summary, args.body, "");
      logger.info(leadId, "report_sent", { summary: args.summary });
      return textResult(`Report sent to orchestrator: ${message.id}\nSummary: ${args.summary}`);
    },
  };

  const getWorkerResultsTool: AgentTool<any, any> = {
    name: "get_worker_results",
    label: "Get Worker Results",
    description: "Retrieve the results from all workers spawned during this session.",
    parameters: Type.Object({}),
    execute: async () => {
      if (workerResults.length === 0) {
        return textResult("No workers have been spawned yet.");
      }
      return textResult(
        workerResults
          .map(
            (r) =>
              `[${r.success ? "OK" : "FAIL"}] ${r.agentId}: ${r.output.slice(0, 500)}${r.output.length > 500 ? "..." : ""}`,
          )
          .join("\n\n"),
      );
    },
  };

  return [spawnWorkerTool, listWorkersTool, reportToOrchestratorTool, getWorkerResultsTool];
}
