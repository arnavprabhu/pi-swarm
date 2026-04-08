/**
 * Default configurations for pi-swarm.
 *
 * All model defaults come from .env (PROVIDER + MODEL).
 * No hardcoded providers — ever.
 */

import type { ModelConfig, SwarmConfig, TeamConfig } from "./types.js";
import { TEAM_LEAD_ROLES, teamLeadRoleToConfig } from "./team-lead/roles.js";
import { getTeamWorkerRoles, workerRoleToConfig } from "./worker/roles.js";
import { envModelConfig } from "./env.js";

// ---------------------------------------------------------------------------
// Default model configs — read from .env / pi auth, never hardcoded
// ---------------------------------------------------------------------------

/** Default model for the orchestrator. Read from PROVIDER + MODEL env vars. */
export function getDefaultOrchestratorModel(): ModelConfig {
  return envModelConfig();
}

/** Default model for team leads. Read from PROVIDER + MODEL env vars. */
export function getDefaultTeamLeadModel(): ModelConfig {
  return envModelConfig();
}

/** Default model for workers. Read from PROVIDER + MODEL env vars. */
export function getDefaultWorkerModel(): ModelConfig {
  return envModelConfig();
}

// Keep these for backward compat but they now read from env
export const DEFAULT_ORCHESTRATOR_MODEL: ModelConfig = envModelConfig();
export const DEFAULT_TEAM_LEAD_MODEL: ModelConfig = envModelConfig();
export const DEFAULT_WORKER_MODEL: ModelConfig = envModelConfig();

// ---------------------------------------------------------------------------
// Team builders
// ---------------------------------------------------------------------------

/** Build a TeamConfig from built-in roles. */
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
 * Create a default SwarmConfig with all 5 teams using built-in roles.
 *
 * Model defaults come from .env (PROVIDER + MODEL). Override per tier
 * by passing orchestratorModel, teamLeadModel, or workerModel.
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
  const oModel = overrides?.orchestratorModel ?? envModelConfig();
  const tlModel = overrides?.teamLeadModel ?? envModelConfig();
  const wModel = overrides?.workerModel ?? envModelConfig();

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
      systemPrompt: "", // Built dynamically in orchestrator.ts
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
