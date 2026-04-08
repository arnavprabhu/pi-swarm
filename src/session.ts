/**
 * Pi session factory for pi-swarm agents.
 *
 * Creates lightweight Agent instances using pi's auth infrastructure
 * (AuthStorage + ModelRegistry) without the heavy createAgentSession
 * overhead (resource loading, extension discovery, session persistence).
 *
 * This gives us:
 * - Proper auth via pi's AuthStorage (same as `pi /login`)
 * - Env var fallback (GEMINI_API_KEY, OPENAI_API_KEY, etc.)
 * - Model resolution via getModel()
 * - Fast startup (no resource/extension scanning)
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool, ThinkingLevel } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple, getEnvApiKey } from "@mariozechner/pi-ai";
import type { Model, SimpleStreamOptions } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ModelConfig } from "./types.js";
import { logger } from "./utils/logger.js";

// ---------------------------------------------------------------------------
// Shared auth infrastructure (created once, reused across all agents)
// ---------------------------------------------------------------------------

let _authStorage: AuthStorage | null = null;
let _modelRegistry: ModelRegistry | null = null;

function getAuthStorage(): AuthStorage {
  if (!_authStorage) {
    _authStorage = AuthStorage.create();
  }
  return _authStorage;
}

function getModelRegistry(): ModelRegistry {
  if (!_modelRegistry) {
    _modelRegistry = ModelRegistry.create(getAuthStorage());
  }
  return _modelRegistry;
}

/**
 * Create an authenticated stream function using pi's ModelRegistry.
 *
 * This follows the same pattern as pi-coding-agent's SDK:
 * resolve API key + headers from ModelRegistry, then call streamSimple.
 */
function createPiStreamFn() {
  const registry = getModelRegistry();

  return async (model: Model<any>, context: any, options?: SimpleStreamOptions) => {
    const auth = await registry.getApiKeyAndHeaders(model);

    if (!auth.ok) {
      // Fall back to env var
      const envKey = getEnvApiKey(model.provider as any);
      if (envKey) {
        return streamSimple(model, context, { ...options, apiKey: envKey });
      }
      throw new Error(
        `No API key for provider "${model.provider}". ` +
          `Run 'pi /login' or set the appropriate env var in .env`,
      );
    }

    return streamSimple(model, context, {
      ...options,
      apiKey: auth.apiKey,
      headers: auth.headers || options?.headers
        ? { ...auth.headers, ...options?.headers }
        : undefined,
    });
  };
}

// Shared stream function
const piStreamFn = createPiStreamFn();

// ---------------------------------------------------------------------------
// Agent factory
// ---------------------------------------------------------------------------

export interface SwarmAgentOptions {
  /** Agent ID for logging. */
  agentId: string;
  /** System prompt. */
  systemPrompt: string;
  /** Model config. If omitted, uses env defaults. */
  model?: ModelConfig;
  /** Thinking level. Default: "off" */
  thinkingLevel?: ThinkingLevel;
  /** Tools to provide to the agent. */
  tools?: AgentTool<any, any>[];
}

/**
 * Create a lightweight pi-authenticated Agent.
 *
 * Much faster than createAgentSession — no resource loading,
 * no extension discovery, no session persistence.
 */
export function createSwarmAgent(options: SwarmAgentOptions): Agent {
  const {
    agentId,
    systemPrompt,
    model: modelConfig,
    thinkingLevel = "off",
    tools = [],
  } = options;

  logger.info(agentId, "creating_agent", {
    model: modelConfig ? `${modelConfig.provider}/${modelConfig.model}` : "default",
    thinkingLevel,
    toolCount: tools.length,
  });

  let model: Model<any>;
  if (modelConfig) {
    model = (getModel as Function)(modelConfig.provider, modelConfig.model);
  } else {
    // Use env defaults
    const provider = process.env.PROVIDER ?? "google";
    const modelId = process.env.MODEL ?? "gemini-2.5-flash";
    model = (getModel as Function)(provider, modelId);
  }

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      thinkingLevel,
    },
    streamFn: piStreamFn,
  });

  logger.info(agentId, "agent_created", {
    model: `${model.provider}/${model.id}`,
    thinkingLevel,
  });

  return agent;
}

/**
 * Run a one-shot prompt against a lightweight agent.
 *
 * Creates an Agent, sends the prompt, waits for idle, extracts output.
 * No session overhead — just pure agent execution.
 */
export async function runOneShot(
  options: SwarmAgentOptions,
  prompt: string,
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const agent = createSwarmAgent(options);

    await agent.prompt(prompt);
    await agent.waitForIdle();

    // Extract the last assistant message
    const messages = agent.state.messages;
    const lastMsg = [...messages].reverse().find(
      (m) => "role" in m && m.role === "assistant",
    ) as any;

    if (!lastMsg) {
      return { text: "", success: false, error: "No assistant response" };
    }

    if (lastMsg.stopReason === "error") {
      return { text: "", success: false, error: lastMsg.errorMessage ?? "Unknown error" };
    }

    const text = lastMsg.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    return { text, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { text: "", success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Tool definition converter
// ---------------------------------------------------------------------------

/**
 * Convert pi ToolDefinition[] (from defineTool) to AgentTool[] for direct Agent use.
 *
 * The Agent class uses AgentTool, but defineTool creates ToolDefinition
 * (which has an extra `ctx` parameter in execute). We strip that.
 */
export function toAgentTools(toolDefs: ToolDefinition<any, any>[]): AgentTool<any, any>[] {
  return toolDefs.map((def) => ({
    name: def.name,
    label: def.label,
    description: def.description,
    parameters: def.parameters,
    prepareArguments: def.prepareArguments,
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any) => {
      // ToolDefinition.execute takes (toolCallId, params, signal, onUpdate, ctx)
      // AgentTool.execute takes (toolCallId, params, signal, onUpdate)
      // We pass undefined for ctx since we're not in an extension context
      return def.execute(toolCallId, params, signal, onUpdate, undefined as any);
    },
  }));
}
