/**
 * Default configurations for pi-swarm.
 *
 * Provides sensible defaults for all 5 teams and their workers.
 * All models are configurable — the defaults below are just starting points.
 */

import type { ModelConfig, SwarmConfig, TeamConfig } from "./types.js";
import type { KnownProvider } from "@mariozechner/pi-ai";
import { TEAM_LEAD_ROLES, teamLeadRoleToConfig } from "./team-lead/roles.js";
import { getTeamWorkerRoles, workerRoleToConfig } from "./worker/roles.js";

// ---------------------------------------------------------------------------
// Default model configs (user should override these)
// ---------------------------------------------------------------------------

/** Default model for the orchestrator (highest capability). */
export const DEFAULT_ORCHESTRATOR_MODEL: ModelConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  thinkingLevel: "low",
};

/** Default model for team leads (balanced capability/cost). */
export const DEFAULT_TEAM_LEAD_MODEL: ModelConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  thinkingLevel: "off",
};

/** Default model for workers (fast and cheap). */
export const DEFAULT_WORKER_MODEL: ModelConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  thinkingLevel: "off",
};

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
 * @param name - Name for this swarm (default: "Pi Swarm")
 * @param overrides - Partial overrides for model configs or budget
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
  const oModel = overrides?.orchestratorModel ?? DEFAULT_ORCHESTRATOR_MODEL;
  const tlModel = overrides?.teamLeadModel ?? DEFAULT_TEAM_LEAD_MODEL;
  const wModel = overrides?.workerModel ?? DEFAULT_WORKER_MODEL;

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
