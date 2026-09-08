/**
 * Environment configuration loader.
 *
 * Reads .env file (via dotenv) and provides the configured provider,
 * model, and API key resolution for pi-swarm agents.
 */

import { config } from "dotenv";
import { getEnvApiKey } from "@earendil-works/pi-ai/compat";
import type { KnownProvider } from "@earendil-works/pi-ai";
import type { ModelConfig } from "./types.js";

// Load .env file into process.env
config({ quiet: true });

/** The provider from .env. Must be set — no hardcoded default. */
export const ENV_PROVIDER: string = process.env.PROVIDER ?? "";

/** The model from .env. Must be set — no hardcoded default. */
export const ENV_MODEL: string = process.env.MODEL ?? "";

/**
 * Resolve an API key for a given provider.
 * Uses pi-ai's built-in env var mapping (GEMINI_API_KEY, OPENAI_API_KEY, etc.)
 */
export function resolveApiKey(provider: string): string | undefined {
  return getEnvApiKey(provider as KnownProvider);
}

/**
 * Build a ModelConfig from environment variables.
 * Returns undefined if PROVIDER/MODEL are not set (pi auth handles it).
 */
export function envModelConfig(
  providerOverride?: string,
  modelOverride?: string,
): ModelConfig | undefined {
  const provider = providerOverride ?? process.env.PROVIDER;
  const model = modelOverride ?? process.env.MODEL;

  if (!!provider !== !!model) throw new Error("Set both PROVIDER and MODEL, or neither.");
  if (!provider || !model) {
    return undefined;
  }

  return {
    provider: provider as KnownProvider,
    model,
  };
}
