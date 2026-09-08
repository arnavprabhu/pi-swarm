import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runOrchestrationCycle } from "./orchestrator/orchestrator.js";
import { createDefaultConfig } from "./config.js";
import type { CycleResult } from "./types.js";
import { toolResult } from "./utils/tool-helpers.js";

export default function piSwarmExtension(pi: ExtensionAPI): void {
  let active: { controller: AbortController; done: Promise<CycleResult> } | undefined;
  let last: CycleResult | undefined;
  let generation = 0;

  function configFor(ctx: ExtensionContext) {
    if (!ctx.model) throw new Error("Select an authenticated model with /model before starting a swarm.");
    const model = { provider: ctx.model.provider, model: ctx.model.id, thinkingLevel: ctx.thinkingLevel ?? pi.getThinkingLevel() };
    return createDefaultConfig("Pi Swarm", { orchestratorModel: model, teamLeadModel: model, workerModel: model });
  }
  function summary(result: CycleResult): string {
    return `Swarm: ${result.status} · ${(result.duration / 1000).toFixed(1)}s · ${result.delegations.length} delegations · estimated $${result.totalCost.toFixed(4)}\n\n${result.companyStatus}`;
  }
  async function run(ctx: ExtensionContext, task: string, context?: string, budget?: number,
    signal?: AbortSignal, update?: (message: string) => void): Promise<CycleResult> {
    if (active) throw new Error("A swarm is already running. Use /swarm-cancel first.");
    const config = configFor(ctx);
    config.costBudget = budget;
    const controller = new AbortController();
    const currentGeneration = generation;
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const onProgress = (message: string) => {
      if (currentGeneration !== generation) return;
      if (ctx.mode === "tui") {
        ctx.ui.setStatus("swarm", message);
        ctx.ui.setWidget("swarm", [message, "Use /swarm-cancel to stop."]);
      }
      update?.(message);
    };
    const done = runOrchestrationCycle(config, task, context, {
      signal: combined, modelRegistry: ctx.modelRegistry, onProgress,
      showProgress: false, showTree: false,
    });
    active = { controller, done };
    try {
      const result = await done;
      if (currentGeneration === generation) last = result;
      return result;
    } finally {
      active = undefined;
      if (ctx.mode === "tui") {
        ctx.ui.setStatus("swarm", undefined);
        ctx.ui.setWidget("swarm", undefined);
      }
    }
  }
  async function cancel() {
    const pending = active;
    pending?.controller.abort();
    await pending?.done.catch(() => undefined);
  }
  const reset = async () => { generation++; await cancel(); last = undefined; };
  pi.on("session_before_switch", reset);
  pi.on("session_before_fork", reset);
  pi.on("session_before_tree", reset);
  pi.on("session_shutdown", reset);

  pi.registerTool({
    name: "swarm_delegate", label: "Swarm Delegate",
    description: "Delegate analysis and text generation to a specialist swarm. Workers cannot browse, edit files, or execute code.",
    parameters: Type.Object({
      task: Type.String({ minLength: 1 }), context: Type.Optional(Type.String()),
      budget: Type.Optional(Type.Number({ minimum: 0 })),
    }),
    execute: async (_id, args, signal, onUpdate, ctx) => {
      const result = await run(ctx, args.task, args.context, args.budget, signal,
        message => onUpdate?.(toolResult(message)));
      if (result.status !== "completed") throw new Error(summary(result));
      return { content: toolResult(summary(result)).content, details: result };
    },
  });
  pi.registerCommand("swarm", {
    description: "Analyze a task with a specialist swarm",
    handler: async (args, ctx) => {
      if (!args.trim()) { ctx.ui.notify("Usage: /swarm <task>", "info"); return; }
      const currentGeneration = generation;
      const work = run(ctx, args.trim(), undefined, undefined, ctx.signal).then(async result => {
        if (currentGeneration === generation) await pi.sendMessage({
          customType: "swarm-result", content: summary(result), display: true, details: result,
        }, { triggerTurn: false });
      }).catch(error => {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      });
      // Pi queues TUI input until command handlers return; keep cancel/status usable.
      if (ctx.mode !== "tui") await work;
    },
  });
  pi.registerCommand("swarm-cancel", {
    description: "Cancel the active swarm and its workers",
    handler: async (_args, ctx) => {
      const running = !!active;
      await cancel();
      ctx.ui.notify(running ? "Swarm cancelled." : "No swarm is running.", "info");
    },
  });
  pi.registerCommand("swarm-config", {
    description: "Show the swarm's current model and teams",
    handler: async (_args, ctx) => {
      try {
        const config = configFor(ctx);
        ctx.ui.notify([
          `Model: ${config.orchestrator.model.provider}/${config.orchestrator.model.model}`,
          `Thinking: ${config.orchestrator.model.thinkingLevel}`,
          `Concurrent requests: ${config.maxConcurrentAgents}; budget: unlimited`,
          ...Object.entries(config.teams).map(([id, t]) => `${id}: ${t.lead.name}, ${t.workers.length} workers`),
        ].join("\n"), "info");
      } catch (error) { ctx.ui.notify(String(error), "error"); }
    },
  });
  pi.registerCommand("swarm-status", {
    description: "Show the active swarm or last result",
    handler: async (_args, ctx) => {
      ctx.ui.notify(active ? "Swarm running. Use /swarm-cancel to stop." : last ? summary(last) : "No swarm has run in this session.", "info");
    },
  });
}
