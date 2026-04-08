/**
 * Pi session factory for pi-swarm agents.
 *
 * Uses pi-coding-agent's createAgentSession SDK to create properly
 * authenticated agent sessions with full pi capabilities.
 *
 * This is the CORRECT way to create agents in pi's ecosystem:
 * - Auth is handled by pi's AuthStorage + ModelRegistry
 *   (reads from ~/.pi/agent/auth.json — same as `pi /login`)
 * - Model resolution follows pi's provider priority
 * - Built-in tools (bash, read, write, edit) are available
 * - Retries and error handling follow pi's patterns
 */

import {
  createAgentSession,
  SessionManager,
  codingTools,
  readOnlyTools,
} from "@mariozechner/pi-coding-agent";
import type { AgentSession, CreateAgentSessionOptions } from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { Model } from "@mariozechner/pi-ai";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { ModelConfig } from "./types.js";
import { logger } from "./utils/logger.js";

/**
 * Options for creating a pi-swarm agent session.
 */
export interface SwarmSessionOptions {
  /** Agent ID for logging. */
  agentId: string;
  /** System prompt for this agent. */
  systemPrompt: string;
  /** Model config (provider + model name). If omitted, uses pi's default. */
  model?: ModelConfig;
  /** Thinking level. Default: "off" for workers, configurable for leads/orchestrator. */
  thinkingLevel?: ThinkingLevel;
  /** Whether to include coding tools (bash, write, edit). Default: false for workers. */
  withCodingTools?: boolean;
  /** Working directory for tools. Default: process.cwd() */
  cwd?: string;
  /** Custom tools to add (pi extension ToolDefinition format). */
  customTools?: CreateAgentSessionOptions["customTools"];
}

/**
 * Create an ephemeral pi agent session.
 *
 * Uses SessionManager.inMemory() so the session is not persisted.
 * Auth comes from pi's AuthStorage (same as `pi /login`).
 */
export async function createSwarmSession(options: SwarmSessionOptions): Promise<AgentSession> {
  const {
    agentId,
    systemPrompt,
    model: modelConfig,
    thinkingLevel = "off",
    withCodingTools = false,
    cwd = process.cwd(),
    customTools,
  } = options;

  logger.info(agentId, "creating_session", {
    model: modelConfig ? `${modelConfig.provider}/${modelConfig.model}` : "default",
    thinkingLevel,
    withCodingTools,
  });

  // Resolve model if specified, otherwise let pi auto-detect
  let model: Model<any> | undefined;
  if (modelConfig) {
    try {
      model = (getModel as Function)(modelConfig.provider, modelConfig.model);
    } catch (e) {
      logger.warn(agentId, "model_resolution_fallback", {
        requested: `${modelConfig.provider}/${modelConfig.model}`,
        error: e instanceof Error ? e.message : String(e),
      });
      // Fall through — let pi's model resolver find an available model
    }
  }

  const sessionOptions: CreateAgentSessionOptions = {
    cwd,
    model,
    thinkingLevel,
    tools: withCodingTools ? codingTools : readOnlyTools,
    customTools,
    sessionManager: SessionManager.inMemory(cwd),
  };

  const { session, modelFallbackMessage } = await createAgentSession(sessionOptions);

  if (modelFallbackMessage) {
    logger.warn(agentId, "model_fallback", { message: modelFallbackMessage });
  }

  // Override system prompt
  session.agent.state.systemPrompt = systemPrompt;

  logger.info(agentId, "session_created", {
    model: session.model ? `${session.model.provider}/${session.model.id}` : "none",
    thinkingLevel: session.thinkingLevel,
  });

  return session;
}

/**
 * Run a one-shot prompt against a pi agent session.
 *
 * Creates a session, sends the prompt, waits for completion, and
 * returns the assistant's response text.
 */
export async function runOneShot(
  options: SwarmSessionOptions,
  prompt: string,
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const session = await createSwarmSession(options);

    await session.prompt(prompt);
    await session.agent.waitForIdle();

    // Extract the last assistant message
    const messages = session.agent.state.messages;
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
