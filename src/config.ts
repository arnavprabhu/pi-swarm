/**
 * Default configurations for pi-swarm.
 *
 * Model defaults come from .env if set, otherwise left undefined
 * so pi's auth system resolves the model at runtime.
 */

import type { ModelConfig, SwarmConfig, TeamConfig } from "./types.js";
import { TEAM_LEAD_ROLES, teamLeadRoleToConfig } from "./team-lead/roles.js";
import { getTeamWorkerRoles, workerRoleToConfig } from "./worker/roles.js";
import { envModelConfig } from "./env.js";

// ---------------------------------------------------------------------------
// Lazy model config — reads from .env at call time, not import time
// ---------------------------------------------------------------------------

/** Get the default model config from .env, or undefined if not set. */
export function getDefaultModelConfig(): ModelConfig | undefined {
  return envModelConfig();
}

// Backward compat (lazy — evaluated when accessed, not at import)
export const DEFAULT_ORCHESTRATOR_MODEL: ModelConfig | undefined = undefined;
export const DEFAULT_TEAM_LEAD_MODEL: ModelConfig | undefined = undefined;
export const DEFAULT_WORKER_MODEL: ModelConfig | undefined = undefined;

// ---------------------------------------------------------------------------
// Team builders
// ---------------------------------------------------------------------------

function buildTeamConfig(
  teamId: string,
  leadModel: ModelConfig,
  workerModel: ModelConfig,
): TeamConfig | undefined {
  const leadRole = TEAM_LEAD_ROLES.find((r) => r.team === teamId);
  if (!leadRole) return undefined;

  const workerRoles = getTeamWorkerRoles(teamId);

  return {
    lead: teamLeadRoleToConfig(leadRole, leadModel),
    workers: workerRoles.map((r) => workerRoleToConfig(r, workerModel)),
  };
}

// ---------------------------------------------------------------------------
// Default swarm config
// ---------------------------------------------------------------------------

/**
 * Placeholder model used when no .env is configured and no override given.
 * The actual model resolution happens at runtime via pi's ModelRegistry.
 * This just needs valid-looking values so the config object can be constructed.
 */
const PLACEHOLDER_MODEL: ModelConfig = {
  provider: "anthropic" as any,
  model: "placeholder",
};

/**
 * Create a default SwarmConfig with all 5 teams.
 *
 * If PROVIDER/MODEL are in .env, those are used. Otherwise a placeholder
 * is set and the actual model is resolved at runtime by pi's auth system.
 */
export function createDefaultConfig(
  name?: string,
  overrides?: {
    orchestratorModel?: ModelConfig;
    teamLeadModel?: ModelConfig;
    workerModel?: ModelConfig;
    costBudget?: number;
    maxConcurrentAgents?: number;
  },
): SwarmConfig {
  const envModel = envModelConfig();
  const fallback = envModel ?? PLACEHOLDER_MODEL;

  const oModel = overrides?.orchestratorModel ?? fallback;
  const tlModel = overrides?.teamLeadModel ?? fallback;
  const wModel = overrides?.workerModel ?? fallback;

  const teams: Record<string, TeamConfig> = {};
  for (const teamId of ["dev", "product", "marketing", "ops", "gtm"]) {
    const tc = buildTeamConfig(teamId, tlModel, wModel);
    if (tc) teams[teamId] = tc;
  }

  return {
    name: name ?? "Pi Swarm",
    orchestrator: {
      id: "ceo",
      name: "CEO",
      tier: "orchestrator",
      role: "chief_executive_officer",
      systemPrompt: "",
      model: oModel,
      maxTurns: 20,
    },
    teams,
    defaults: {
      orchestratorModel: oModel,
      teamLeadModel: tlModel,
      workerModel: wModel,
    },
    maxConcurrentAgents: overrides?.maxConcurrentAgents ?? 10,
    costBudget: overrides?.costBudget,
  };
}
