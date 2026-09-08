import { Agent, type AgentTool, type ThinkingLevel } from "@earendil-works/pi-agent-core";
import { lazyStream, type AssistantMessage, type Usage } from "@earendil-works/pi-ai";
import { ModelRuntime, ModelRegistry, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AgentResult, ModelConfig } from "./types.js";
import { envModelConfig } from "./env.js";
import { positiveInteger, RunContext, type RunOptions } from "./runtime.js";

let registry: Promise<ModelRegistry> | undefined;
function defaultRegistry(): Promise<ModelRegistry> {
  return registry ??= ModelRuntime.create().then(runtime => new ModelRegistry(runtime)).catch(error => {
    registry = undefined;
    throw error;
  });
}

export interface SwarmAgentOptions extends RunOptions {
  agentId: string;
  systemPrompt: string;
  model?: ModelConfig;
  thinkingLevel?: ThinkingLevel;
  tools?: AgentTool<any, any>[];
  maxTurns?: number;
  runtime?: RunContext;
  onUsage?: (usage: Usage) => void;
  isComplete?: () => boolean;
}

/** Pi's current model runtime initializes asynchronously. */
export async function createSwarmAgent(options: SwarmAgentOptions): Promise<Agent> {
  const runtime = options.runtime ?? new RunContext(options);
  runtime.check();
  const models = options.modelRegistry ?? runtime.options.modelRegistry ?? await defaultRegistry();
  const config = options.model?.model === "placeholder" ? envModelConfig() : options.model ?? envModelConfig();
  const model = config ? models.find(config.provider, config.model) : models.getAvailable()[0];
  if (!model) throw new Error(config
    ? `Unknown model: ${config.provider}/${config.model}`
    : "No authenticated model available. Use pi /login or set PROVIDER, MODEL and an API key.");
  const maxTurns = options.maxTurns ?? 20;
  positiveInteger(maxTurns, "maxTurns");
  let turns = 0;
  return new Agent({
    initialState: {
      systemPrompt: options.systemPrompt, model, tools: options.tools ?? [],
      thinkingLevel: options.thinkingLevel ?? config?.thinkingLevel ?? "off",
    },
    toolExecution: "sequential",
    shouldStopAfterTurn: () => options.isComplete?.() ?? false,
    beforeToolCall: async () => {
      if (options.isComplete?.()) return { block: true, reason: "Agent already finished", terminate: true };
      if (runtime.signal.aborted || runtime.costs.isOverBudget) {
        return { block: true, reason: runtime.status ?? "cancelled", terminate: true };
      }
      return undefined;
    },
    streamFn: (requestModel, context, streamOptions) => lazyStream(requestModel, async () => {
      runtime.check();
      if (turns >= maxTurns) throw new Error("turn_limit");
      const signal = AbortSignal.any([
        runtime.signal,
        ...(options.signal ? [options.signal] : []),
        ...(streamOptions?.signal ? [streamOptions.signal] : []),
      ]);
      const release = await runtime.acquire(signal);
      try {
        turns++;
        const auth = await models.getApiKeyAndHeaders(requestModel);
        signal.throwIfAborted();
        if (!auth.ok) throw new Error(auth.error);
        const provider = models.getProvider(requestModel.provider);
        if (!provider) throw new Error(`Unknown provider: ${requestModel.provider}`);
        const stream = provider.streamSimple(
          auth.baseUrl ? { ...requestModel, baseUrl: auth.baseUrl } : requestModel,
          context, {
            ...streamOptions, signal,
            apiKey: auth.apiKey, env: auth.env, headers: { ...auth.headers, ...streamOptions?.headers },
          },
        );
        // Recording precedes publishing the terminal event to the agent loop.
        return (async function* () {
          try {
            for await (const event of stream) {
              if (event.type === "done" || event.type === "error") {
                const message = event.type === "done" ? event.message : event.error;
                options.onUsage?.(message.usage);
                runtime.record(options.agentId, message.usage);
              }
              yield event;
            }
          } finally { release(); }
        })();
      } catch (error) { release(); throw error; }
    }),
  });
}

export async function runOneShot(options: SwarmAgentOptions, prompt: string) {
  const runtime = options.runtime ?? new RunContext(options);
  const cost = { input: 0, output: 0, total: 0 };
  const tokensUsed = { input: 0, output: 0 };
  const toolCalls: AgentResult["toolCalls"] = [];
  let text = "";
  let error: string | undefined;
  let unsubscribe: (() => void) | undefined;
  let agent: Agent | undefined;
  const abort = () => agent?.abort();
  try {
    runtime.check();
    agent = await createSwarmAgent({
      ...options, runtime,
      onUsage: usage => {
        cost.input += usage.cost.input + usage.cost.cacheRead + usage.cost.cacheWrite;
        cost.output += usage.cost.output;
        cost.total += usage.cost.total;
        tokensUsed.input += usage.input + usage.cacheRead + usage.cacheWrite;
        tokensUsed.output += usage.output;
        options.onUsage?.(usage);
      },
    });
    const args = new Map<string, unknown>();
    unsubscribe = agent.subscribe(event => {
      if (event.type === "tool_execution_start") args.set(event.toolCallId, event.args);
      if (event.type === "tool_execution_end") toolCalls.push({
        name: event.toolName, args: args.get(event.toolCallId), result: JSON.stringify(event.result),
      });
    });
    runtime.signal.addEventListener("abort", abort, { once: true });
    runtime.check();
    await agent.prompt(prompt);
    await agent.waitForIdle();
    const last = [...agent.state.messages].reverse().find((m): m is AssistantMessage => m.role === "assistant");
    text = last?.content.filter(b => b.type === "text").map(b => b.text).join("") ?? "";
    if (!last) error = "No assistant response";
    else if (last.stopReason === "error" || last.stopReason === "aborted") error = last.errorMessage ?? last.stopReason;
    else if (last.stopReason === "length") error = "Response truncated by model output limit";
    else if (last.stopReason === "pending" || last.stopReason === "deferred") error = "Provider response has not completed";
    else if (!text && last.stopReason !== "toolUse") error = "Empty assistant response";
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  } finally {
    unsubscribe?.();
    runtime.signal.removeEventListener("abort", abort);
  }
  const status: NonNullable<AgentResult["status"]> = runtime.status ?? (runtime.signal.aborted ? "cancelled"
    : error?.includes("turn_limit") ? "turn_limit" : error ? "failed" : "completed");
  return { text, success: status === "completed", error: error ?? (status !== "completed" ? status : undefined), cost, tokensUsed, toolCalls, status, model: agent?.state.model };
}

export function toAgentTools(toolDefs: ToolDefinition<any, any>[]): AgentTool<any, any>[] {
  return toolDefs.map(def => ({
    name: def.name, label: def.label, description: def.description, parameters: def.parameters,
    execute: (id, params, signal, onUpdate) => def.execute(id, params, signal, onUpdate, undefined as any),
  }));
}
