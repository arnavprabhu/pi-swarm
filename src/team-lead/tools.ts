import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AgentConfig, ModelConfig, AgentResult, TeamId } from "../types.js";
import { runWorker, type WorkerRunOptions } from "../worker/worker.js";
import { getTeamWorkerRoles, workerRoleToConfig } from "../worker/roles.js";
import { toolResult as text } from "../utils/tool-helpers.js";

export interface TeamLeadToolOptions extends WorkerRunOptions {
  leadId: string;
  workers?: AgentConfig[];
  workerResults?: AgentResult[];
  onReport?: (report: string) => void;
}

export function createTeamLeadToolDefinitions(
  teamId: TeamId, leadId: string, workerModel: ModelConfig, opts: TeamLeadToolOptions,
): AgentTool<any, any>[] {
  const workers = opts.workers ?? getTeamWorkerRoles(teamId).map(role => workerRoleToConfig(role, workerModel));
  const results = opts.workerResults ?? [];
  return [{
    name: "spawn_worker", label: "Spawn Worker",
    description: "Ask a configured specialist to analyze a task and return text. Workers cannot access files, execute code, or browse.",
    parameters: Type.Object({
      workerId: Type.String({ minLength: 1 }), task: Type.String({ minLength: 1 }),
      context: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const args = params as { workerId: string; task: string; context?: string };
      opts.runtime?.check();
      const worker = workers.find(w => w.id === args.workerId);
      if (!worker) throw new Error(`Unknown worker. Available: ${workers.map(w => w.id).join(", ")}`);
      const result = await runWorker(worker, args.task, args.context, { ...opts, executionId: undefined, parentId: leadId });
      results.push(result);
      if (!result.success) throw new Error(result.output);
      return text(result.output);
    },
  }, {
    name: "list_workers", label: "List Workers", description: "List this team's configured workers.",
    parameters: Type.Object({}),
    execute: async () => text(workers.map(w => `${w.id}: ${w.name} — ${w.role}`).join("\n")),
  }, {
    name: "report_to_orchestrator", label: "Report", description: "Finish this team's work with a report.",
    parameters: Type.Object({ summary: Type.String({ minLength: 1 }), body: Type.String({ minLength: 1 }) }),
    execute: async (_id, params) => {
      const args = params as { summary: string; body: string };
      const report = `${args.summary}\n\n${args.body}`;
      opts.onReport?.(report);
      return { ...text(report), terminate: true };
    },
  }, {
    name: "get_worker_results", label: "Results", description: "Read all worker results.",
    parameters: Type.Object({}),
    execute: async () => text(results.length ? results.map(r => `[${r.status}] ${r.agentId}: ${r.output}`).join("\n\n") : "No workers spawned."),
  }];
}
