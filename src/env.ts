/**
 * Environment configuration loader.
 *
 * Reads .env file (via dotenv) and provides the configured provider,
 * model, and API key resolution for pi-swarm agents.
 */

import { config } from "dotenv";
import { getEnvApiKey } from "@mariozechner/pi-ai";
import type { KnownProvider } from "@mariozechner/pi-ai";
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
 * This is the function you pass to Agent's `getApiKey` option.
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
