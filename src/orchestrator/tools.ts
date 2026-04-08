/**
 * Orchestrator-level tools.
 *
 * These tools let the orchestrator delegate to team leads, broadcast
 * to multiple teams, collect reports, and finish cycles.
 */

import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { AgentResult, ModelConfig, SwarmConfig, TeamId } from "../types.js";
import { runTeamLead } from "../team-lead/team-lead.js";
import { getTeamLeadRole, teamLeadRoleToConfig } from "../team-lead/roles.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

/** Helper to create a text tool result. */
function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

/**
 * Create the set of tools available to the orchestrator agent.
 */
export function createOrchestratorTools(config: SwarmConfig, costTracker: CostTracker) {
  const delegationResults: Map<string, AgentResult> = new Map();

  const delegateTaskTool: AgentTool<any, any> = {
    name: "delegate_task",
    label: "Delegate Task",
    description:
      "Delegate a task to a specific team lead. The team lead will decompose the work, spawn workers, and return a report. Use this for focused, single-team tasks.",
    parameters: Type.Object({
      team: Type.String({
        description: "The team to delegate to: 'dev', 'product', 'marketing', 'ops', or 'gtm'",
      }),
      task: Type.String({
        description: "Clear description of what the team should accomplish",
      }),
      context: Type.Optional(
        Type.String({
          description: "Additional context, constraints, or background information",
        }),
      ),
      priority: Type.Optional(
        Type.String({
          description: "Priority level: 'p0' (critical), 'p1' (high), 'p2' (medium), 'p3' (low)",
        }),
      ),
    }),
    execute: async (
      _toolCallId: string,
      args: { team: string; task: string; context?: string; priority?: string },
    ) => {
      const teamId = args.team as TeamId;
      const teamConfig = config.teams[teamId];

      let leadConfig = teamConfig?.lead;
      if (!leadConfig) {
        const role = getTeamLeadRole(teamId);
        if (!role) {
          return textResult(
            `Error: Team "${teamId}" not found. Available teams: ${Object.keys(config.teams).join(", ")}`,
          );
        }
        leadConfig = teamLeadRoleToConfig(role, config.defaults.teamLeadModel);
      }

      if (costTracker.isOverBudget) {
        return textResult(
          `Error: Cost budget exceeded ($${costTracker.totalCost.toFixed(4)} / $${config.costBudget?.toFixed(4)}). Cannot delegate.`,
        );
      }

      logger.info("orchestrator", "delegating_task", {
        team: teamId,
        task: args.task,
        priority: args.priority ?? "p2",
      });

      const result = await runTeamLead(
        leadConfig,
        args.task,
        args.context,
        config.defaults.workerModel,
        costTracker,
      );

      delegationResults.set(teamId, result);

      return textResult(
        result.success
          ? `Team ${teamId} (${leadConfig.name}) completed:\n${result.output}\n\n[Cost: $${result.cost.total.toFixed(4)}, Duration: ${result.duration}ms]`
          : `Team ${teamId} (${leadConfig.name}) failed:\n${result.output}`,
      );
    },
  };

  const broadcastTool: AgentTool<any, any> = {
    name: "broadcast",
    label: "Broadcast",
    description:
      "Send a task to multiple teams simultaneously. All teams execute in parallel. Use this for cross-cutting initiatives like quarterly planning or company-wide announcements.",
    parameters: Type.Object({
      teams: Type.Array(
        Type.String({ description: "Team ID" }),
        { description: "List of team IDs to broadcast to" },
      ),
      task: Type.String({
        description: "The task or directive to broadcast to all specified teams",
      }),
      context: Type.Optional(
        Type.String({
          description: "Shared context for all teams",
        }),
      ),
    }),
    execute: async (
      _toolCallId: string,
      args: { teams: string[]; task: string; context?: string },
    ) => {
      logger.info("orchestrator", "broadcasting", { teams: args.teams, task: args.task });

      const promises = args.teams.map(async (teamId) => {
        const teamConfig = config.teams[teamId];
        let leadConfig = teamConfig?.lead;
        if (!leadConfig) {
          const role = getTeamLeadRole(teamId as TeamId);
          if (!role) return { team: teamId, error: `Team "${teamId}" not found` };
          leadConfig = teamLeadRoleToConfig(role, config.defaults.teamLeadModel);
        }

        const result = await runTeamLead(
          leadConfig,
          args.task,
          args.context,
          config.defaults.workerModel,
          costTracker,
        );

        delegationResults.set(teamId, result);
        return { team: teamId, result };
      });

      const results = await Promise.all(promises);

      const text = results
        .map((r) => {
          if ("error" in r) return `[${r.team}] Error: ${r.error}`;
          const res = r.result!;
          return `[${r.team}] ${res.success ? "OK" : "FAIL"}: ${res.output.slice(0, 300)}${res.output.length > 300 ? "..." : ""}`;
        })
        .join("\n\n---\n\n");

      return textResult(text);
    },
  };

  const collectReportsTool: AgentTool<any, any> = {
    name: "collect_reports",
    label: "Collect Reports",
    description: "Retrieve all reports collected from team leads during this orchestration cycle.",
    parameters: Type.Object({}),
    execute: async () => {
      if (delegationResults.size === 0) {
        return textResult("No delegations have been made yet.");
      }

      const lines: string[] = [];
      for (const [team, result] of delegationResults) {
        lines.push(
          `## ${team.toUpperCase()}\nStatus: ${result.success ? "Complete" : "Failed"}\nCost: $${result.cost.total.toFixed(4)}\nDuration: ${result.duration}ms\n\n${result.output}`,
        );
      }
      return textResult(lines.join("\n\n---\n\n"));
    },
  };

  const resolveConflictTool: AgentTool<any, any> = {
    name: "resolve_conflict",
    label: "Resolve Conflict",
    description:
      "Arbitrate when two teams have conflicting priorities or dependencies. Provide your decision and reasoning.",
    parameters: Type.Object({
      teamA: Type.String({ description: "First team in the conflict" }),
      teamB: Type.String({ description: "Second team in the conflict" }),
      conflict: Type.String({ description: "Description of the conflict" }),
      decision: Type.String({ description: "Your decision and reasoning" }),
    }),
    execute: async (
      _toolCallId: string,
      args: { teamA: string; teamB: string; conflict: string; decision: string },
    ) => {
      logger.info("orchestrator", "conflict_resolved", {
        teams: [args.teamA, args.teamB],
        conflict: args.conflict,
      });
      return textResult(
        `Conflict between ${args.teamA} and ${args.teamB} resolved.\nConflict: ${args.conflict}\nDecision: ${args.decision}`,
      );
    },
  };

  const finishCycleTool: AgentTool<any, any> = {
    name: "finish_cycle",
    label: "Finish Cycle",
    description:
      "Signal that the orchestration cycle is complete. Provide a final summary of all work done, decisions made, and next steps.",
    parameters: Type.Object({
      summary: Type.String({
        description: "Executive summary of the entire orchestration cycle",
      }),
      nextSteps: Type.Optional(
        Type.String({
          description: "Recommended next steps or follow-up actions",
        }),
      ),
    }),
    execute: async (_toolCallId: string, args: { summary: string; nextSteps?: string }) => {
      logger.info("orchestrator", "cycle_finished", { summary: args.summary });

      const totalCost = costTracker.totalCost;
      const breakdown = costTracker.summary();

      return textResult(
        [
          "# Orchestration Cycle Complete",
          "",
          `## Summary\n${args.summary}`,
          args.nextSteps ? `\n## Next Steps\n${args.nextSteps}` : "",
          `\n## Cost Breakdown\n${breakdown}`,
        ].join("\n"),
      );
    },
  };

  return {
    tools: [delegateTaskTool, broadcastTool, collectReportsTool, resolveConflictTool, finishCycleTool] as AgentTool<any, any>[],
    getDelegationResults: () => new Map(delegationResults),
  };
}
