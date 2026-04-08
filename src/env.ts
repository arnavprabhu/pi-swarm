/**
 * Environment configuration loader.
 *
 * Reads .env file (via dotenv) and provides the configured provider,
 * model, and API key resolution for pi-swarm agents.
 */

import { config } from "dotenv";
import { getEnvApiKey, streamSimple } from "@mariozechner/pi-ai";
import type { KnownProvider, Model, SimpleStreamOptions } from "@mariozechner/pi-ai";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { ModelConfig } from "./types.js";

// Load .env file into process.env
config();

/** The provider from .env (defaults to "google"). */
export const ENV_PROVIDER: string = process.env.PROVIDER ?? "google";

/** The model from .env (defaults to "gemini-2.5-flash"). */
export const ENV_MODEL: string = process.env.MODEL ?? "gemini-2.5-flash";

/**
 * Resolve an API key for a given provider.
 * Uses pi-ai's built-in env var mapping (GEMINI_API_KEY, OPENAI_API_KEY, etc.)
 */
export function resolveApiKey(provider: string): string | undefined {
  return getEnvApiKey(provider as KnownProvider);
}

/**
 * Build a ModelConfig from environment variables.
 * Optionally override provider/model for a specific tier.
 */
export function envModelConfig(
  providerOverride?: string,
  modelOverride?: string,
): ModelConfig {
  return {
    provider: (providerOverride ?? ENV_PROVIDER) as KnownProvider,
    model: modelOverride ?? ENV_MODEL,
  };
}

/**
 * Create a stream function that auto-injects the API key.
 *
 * This follows the same pattern as pi-coding-agent's SDK:
 * the streamFn wraps streamSimple and resolves the API key
 * from environment variables before each LLM call.
 *
 * This is the CORRECT way to provide auth to pi-agent-core's Agent.
 */
export function createAuthenticatedStreamFn(): StreamFn {
  return (model: Model<any>, context: any, options?: SimpleStreamOptions) => {
    const apiKey = resolveApiKey(model.provider);
    if (!apiKey) {
      throw new Error(
        `No API key found for provider "${model.provider}". ` +
          `Set the appropriate env var in your .env file. ` +
          `Run: cp .env.example .env`,
      );
    }
    return streamSimple(model, context, {
      ...options,
      apiKey,
    });
  };
}

/** Pre-built authenticated stream function. */
export const authenticatedStreamFn: StreamFn = createAuthenticatedStreamFn();
