/**
 * Orchestrator-level tools.
 */

import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { AgentResult, SwarmConfig, TeamId } from "../types.js";
import { runTeamLead } from "../team-lead/team-lead.js";
import type { TeamLeadRunOptions } from "../team-lead/team-lead.js";
import { getTeamLeadRole, teamLeadRoleToConfig } from "../team-lead/roles.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";
import type { CycleTracker } from "../ui/tracker.js";
import type { ProgressLogger } from "../ui/progress.js";

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }], details: undefined };
}

export interface OrchestratorToolOptions {
  costTracker: CostTracker;
  cycleTracker?: CycleTracker;
  progress?: ProgressLogger;
}

export function createOrchestratorToolDefinitions(
  config: SwarmConfig,
  opts: OrchestratorToolOptions,
) {
  const { costTracker, cycleTracker, progress } = opts;
  const delegationResults: Map<string, AgentResult> = new Map();

  const delegateTaskTool: AgentTool<any, any> = {
    name: "delegate_task",
    label: "Delegate",
    description: "Delegate a task to a team lead who will spawn workers and return a report.",
    parameters: Type.Object({
      team: Type.String({ description: "Team: 'dev', 'product', 'marketing', 'ops', or 'gtm'" }),
      task: Type.String({ description: "What the team should accomplish" }),
      context: Type.Optional(Type.String({ description: "Additional context" })),
      priority: Type.Optional(Type.String({ description: "p0/p1/p2/p3" })),
    }),
    execute: async (_id: string, args: { team: string; task: string; context?: string; priority?: string }) => {
      const teamId = args.team as TeamId;
      const teamConfig = config.teams[teamId];

      let leadConfig = teamConfig?.lead;
      if (!leadConfig) {
        const role = getTeamLeadRole(teamId);
        if (!role) return text(`Error: Team "${teamId}" not found. Available: ${Object.keys(config.teams).join(", ")}`);
        leadConfig = teamLeadRoleToConfig(role, config.defaults.teamLeadModel);
      }

      if (costTracker.isOverBudget) return text(`Error: Budget exceeded`);

      progress?.delegating("Orchestrator", leadConfig.name, teamId);
      logger.info("orchestrator", "delegating_task", { team: teamId, task: args.task, priority: args.priority ?? "p2" });

      const leadOpts: TeamLeadRunOptions = {
        costTracker,
        cycleTracker,
        progress,
        parentId: "orchestrator",
      };

      const result = await runTeamLead(leadConfig, args.task, args.context, config.defaults.workerModel, leadOpts);
      delegationResults.set(teamId, result);

      return text(
        result.success
          ? `Team ${teamId} (${leadConfig.name}) completed:\n${result.output}\n\n[Duration: ${result.duration}ms]`
          : `Team ${teamId} (${leadConfig.name}) failed:\n${result.output}`,
      );
    },
  };

  const broadcastTool: AgentTool<any, any> = {
    name: "broadcast",
    label: "Broadcast",
    description: "Send a task to multiple teams in parallel.",
    parameters: Type.Object({
      teams: Type.Array(Type.String(), { description: "List of team IDs" }),
      task: Type.String({ description: "Task to broadcast" }),
      context: Type.Optional(Type.String({ description: "Shared context" })),
    }),
    execute: async (_id: string, args: { teams: string[]; task: string; context?: string }) => {
      logger.info("orchestrator", "broadcasting", { teams: args.teams, task: args.task });

      const promises = args.teams.map(async (teamId: string) => {
        const tc = config.teams[teamId];
        let lc = tc?.lead;
        if (!lc) {
          const role = getTeamLeadRole(teamId as TeamId);
          if (!role) return { team: teamId, error: `Not found` };
          lc = teamLeadRoleToConfig(role, config.defaults.teamLeadModel);
        }
        progress?.delegating("Orchestrator", lc.name, teamId);
        const leadOpts: TeamLeadRunOptions = { costTracker, cycleTracker, progress, parentId: "orchestrator" };
        const result = await runTeamLead(lc, args.task, args.context, config.defaults.workerModel, leadOpts);
        delegationResults.set(teamId, result);
        return { team: teamId, result };
      });

      const results = await Promise.all(promises);
      const t = results.map((r) => {
        if ("error" in r && !("result" in r)) return `[${r.team}] Error: ${r.error}`;
        const res = r.result!;
        return `[${r.team}] ${res.success ? "OK" : "FAIL"}: ${res.output.slice(0, 300)}`;
      }).join("\n\n---\n\n");
      return text(t);
    },
  };

  const collectReportsTool: AgentTool<any, any> = {
    name: "collect_reports",
    label: "Reports",
    description: "Retrieve all team reports from this cycle.",
    parameters: Type.Object({}),
    execute: async () => {
      if (delegationResults.size === 0) return text("No delegations yet.");
      const lines = Array.from(delegationResults.entries()).map(
        ([team, r]) => `## ${team.toUpperCase()}\n${r.success ? "Complete" : "Failed"} (${r.duration}ms)\n\n${r.output}`,
      );
      return text(lines.join("\n\n---\n\n"));
    },
  };

  const finishCycleTool: AgentTool<any, any> = {
    name: "finish_cycle",
    label: "Finish",
    description: "Signal the orchestration cycle is complete.",
    parameters: Type.Object({
      summary: Type.String({ description: "Executive summary" }),
      nextSteps: Type.Optional(Type.String({ description: "Next steps" })),
    }),
    execute: async (_id: string, args: { summary: string; nextSteps?: string }) => {
      logger.info("orchestrator", "cycle_finished", { summary: args.summary });
      return text([
        "# Cycle Complete",
        `\n## Summary\n${args.summary}`,
        args.nextSteps ? `\n## Next Steps\n${args.nextSteps}` : "",
      ].join("\n"));
    },
  };

  return {
    tools: [delegateTaskTool, broadcastTool, collectReportsTool, finishCycleTool],
    getDelegationResults: () => new Map(delegationResults),
  };
}

export const createOrchestratorTools = createOrchestratorToolDefinitions;
