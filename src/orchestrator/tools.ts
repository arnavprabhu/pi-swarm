/**
 * Orchestrator-level tools using pi's ToolDefinition format.
 */

import { Type } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";
import type { AgentResult, SwarmConfig, TeamId } from "../types.js";
import { runTeamLead } from "../team-lead/team-lead.js";
import { getTeamLeadRole, teamLeadRoleToConfig } from "../team-lead/roles.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

/**
 * Create tool definitions for the orchestrator agent.
 */
export function createOrchestratorToolDefinitions(config: SwarmConfig, costTracker: CostTracker) {
  const delegationResults: Map<string, AgentResult> = new Map();

  const delegateTaskTool = defineTool({
    name: "delegate_task",
    label: "Delegate Task",
    description:
      "Delegate a task to a specific team lead. The team lead will decompose the work, spawn workers, and return a report.",
    parameters: Type.Object({
      team: Type.String({
        description: "The team to delegate to: 'dev', 'product', 'marketing', 'ops', or 'gtm'",
      }),
      task: Type.String({
        description: "Clear description of what the team should accomplish",
      }),
      context: Type.Optional(
        Type.String({ description: "Additional context or constraints" }),
      ),
      priority: Type.Optional(
        Type.String({ description: "Priority: 'p0' (critical), 'p1' (high), 'p2' (medium), 'p3' (low)" }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const teamId = args.team as TeamId;
      const teamConfig = config.teams[teamId];

      let leadConfig = teamConfig?.lead;
      if (!leadConfig) {
        const role = getTeamLeadRole(teamId);
        if (!role) {
          return {
            content: [{ type: "text" as const, text: `Error: Team "${teamId}" not found. Available: ${Object.keys(config.teams).join(", ")}` }],
            details: undefined,
          };
        }
        leadConfig = teamLeadRoleToConfig(role, config.defaults.teamLeadModel);
      }

      if (costTracker.isOverBudget) {
        return {
          content: [{ type: "text" as const, text: `Error: Budget exceeded ($${costTracker.totalCost.toFixed(4)})` }],
          details: undefined,
        };
      }

      logger.info("orchestrator", "delegating_task", { team: teamId, task: args.task, priority: args.priority ?? "p2" });

      const result = await runTeamLead(
        leadConfig,
        args.task,
        args.context,
        config.defaults.workerModel,
        costTracker,
      );

      delegationResults.set(teamId, result);

      return {
        content: [{
          type: "text" as const,
          text: result.success
            ? `Team ${teamId} (${leadConfig.name}) completed:\n${result.output}\n\n[Duration: ${result.duration}ms]`
            : `Team ${teamId} (${leadConfig.name}) failed:\n${result.output}`,
        }],
        details: undefined,
      };
    },
  });

  const broadcastTool = defineTool({
    name: "broadcast",
    label: "Broadcast",
    description: "Send a task to multiple teams simultaneously. All execute in parallel.",
    parameters: Type.Object({
      teams: Type.Array(Type.String({ description: "Team ID" }), { description: "List of team IDs" }),
      task: Type.String({ description: "The task to broadcast" }),
      context: Type.Optional(Type.String({ description: "Shared context" })),
    }),
    execute: async (_toolCallId, args) => {
      logger.info("orchestrator", "broadcasting", { teams: args.teams, task: args.task });

      const promises = args.teams.map(async (teamId: string) => {
        const teamConfig = config.teams[teamId];
        let leadConfig = teamConfig?.lead;
        if (!leadConfig) {
          const role = getTeamLeadRole(teamId as TeamId);
          if (!role) return { team: teamId, error: `Team "${teamId}" not found` };
          leadConfig = teamLeadRoleToConfig(role, config.defaults.teamLeadModel);
        }

        const result = await runTeamLead(leadConfig, args.task, args.context, config.defaults.workerModel, costTracker);
        delegationResults.set(teamId, result);
        return { team: teamId, result };
      });

      const results = await Promise.all(promises);
      const text = results
        .map((r) => {
          if ("error" in r && !("result" in r)) return `[${r.team}] Error: ${r.error}`;
          const res = r.result!;
          return `[${r.team}] ${res.success ? "OK" : "FAIL"}: ${res.output.slice(0, 300)}${res.output.length > 300 ? "..." : ""}`;
        })
        .join("\n\n---\n\n");

      return { content: [{ type: "text" as const, text }], details: undefined };
    },
  });

  const collectReportsTool = defineTool({
    name: "collect_reports",
    label: "Collect Reports",
    description: "Retrieve all reports from team leads during this cycle.",
    parameters: Type.Object({}),
    execute: async () => {
      if (delegationResults.size === 0) {
        return { content: [{ type: "text" as const, text: "No delegations yet." }], details: undefined };
      }
      const lines = Array.from(delegationResults.entries()).map(
        ([team, r]) => `## ${team.toUpperCase()}\nStatus: ${r.success ? "Complete" : "Failed"}\nDuration: ${r.duration}ms\n\n${r.output}`,
      );
      return { content: [{ type: "text" as const, text: lines.join("\n\n---\n\n") }], details: undefined };
    },
  });

  const finishCycleTool = defineTool({
    name: "finish_cycle",
    label: "Finish Cycle",
    description: "Signal that the orchestration cycle is complete with a summary.",
    parameters: Type.Object({
      summary: Type.String({ description: "Executive summary of the cycle" }),
      nextSteps: Type.Optional(Type.String({ description: "Recommended next steps" })),
    }),
    execute: async (_toolCallId, args) => {
      logger.info("orchestrator", "cycle_finished", { summary: args.summary });
      const text = [
        "# Orchestration Cycle Complete",
        `\n## Summary\n${args.summary}`,
        args.nextSteps ? `\n## Next Steps\n${args.nextSteps}` : "",
        `\n## Cost\n${costTracker.summary()}`,
      ].join("\n");
      return { content: [{ type: "text" as const, text }], details: undefined };
    },
  });

  return {
    tools: [delegateTaskTool, broadcastTool, collectReportsTool, finishCycleTool],
    getDelegationResults: () => new Map(delegationResults),
  };
}

// Keep backward compat
export const createOrchestratorTools = createOrchestratorToolDefinitions;
