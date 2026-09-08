import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AgentResult, SwarmConfig } from "../types.js";
import { runTeamLead } from "../team-lead/team-lead.js";
import type { WorkerRunOptions } from "../worker/worker.js";
import { RunContext } from "../runtime.js";
import { toolResult as text } from "../utils/tool-helpers.js";

export interface OrchestratorToolOptions extends WorkerRunOptions {}

export function createOrchestratorToolDefinitions(config: SwarmConfig, opts: OrchestratorToolOptions) {
  const runtime = opts.runtime ?? new RunContext(opts, config.maxConcurrentAgents, config.costBudget, opts.costTracker);
  const results = new Map<string, AgentResult>();
  let summary: string | undefined;
  async function delegate(team: string, task: string, context?: string) {
    runtime.check();
    const selected = config.teams[team];
    if (!selected) throw new Error(`Unknown team. Available: ${Object.keys(config.teams).join(", ")}`);
    const result = await runTeamLead(selected.lead, task, context, config.defaults.workerModel, {
      ...opts, runtime, workers: selected.workers, parentId: opts.executionId,
    });
    results.set(result.executionId!, result);
    const report = `Team ${team} [${result.status}]:\n${result.output}`;
    if (!result.success) throw new Error(report);
    return text(report);
  }
  const tools: AgentTool<any, any>[] = [{
    name: "delegate_task", label: "Delegate", description: `Delegate analysis to a configured team: ${Object.keys(config.teams).join(", ")}.`,
    parameters: Type.Object({
      team: Type.String({ minLength: 1 }), task: Type.String({ minLength: 1 }),
      context: Type.Optional(Type.String()), priority: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const args = params as { team: string; task: string; context?: string };
      return delegate(args.team, args.task, args.context);
    },
  }, {
    name: "broadcast", label: "Broadcast", description: "Delegate a shared task to several configured teams concurrently.",
    parameters: Type.Object({
      teams: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
      task: Type.String({ minLength: 1 }), context: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const args = params as { teams: string[]; task: string; context?: string };
      // Settle every branch before returning, retaining results even if another branch fails.
      const replies = await Promise.allSettled(args.teams.map((team: string) => delegate(team, args.task, args.context)));
      const report = replies.map(reply => reply.status === "fulfilled"
        ? reply.value.content[0].text : String(reply.reason)).join("\n\n");
      if (replies.some(reply => reply.status === "rejected")) throw new Error(report);
      return text(report);
    },
  }, {
    name: "collect_reports", label: "Reports", description: "Read every delegation result, including repeated assignments.",
    parameters: Type.Object({}),
    execute: async () => text([...results.values()].map(r =>
      `[${r.status}] ${r.agentId}: ${r.output}\nTeam estimate: $${r.teamCost?.toFixed(4)}`).join("\n\n") || "No delegations yet."),
  }, {
    name: "finish_cycle", label: "Finish", description: "Finish the cycle with a summary, including any failures or limitations.",
    parameters: Type.Object({
      summary: Type.String({ minLength: 1 }), nextSteps: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const args = params as { summary: string; nextSteps?: string };
      summary = args.summary + (args.nextSteps ? `\n\nNext steps:\n${args.nextSteps}` : "");
      return { ...text(summary!), terminate: true };
    },
  }];
  return { tools, getDelegationResults: () => new Map(results), getSummary: () => summary };
}
