/**
 * pi-swarm — Multi-agent orchestration framework built on pi.dev
 *
 * SDK mode: import classes and functions for programmatic use.
 *
 * @example
 * ```typescript
 * import { Swarm } from "pi-swarm";
 *
 * const swarm = new Swarm({ name: "My Company" });
 * const result = await swarm.run("Plan and execute the Q2 product launch");
 * console.log(result.companyStatus);
 * ```
 */

// Core types
export type {
  AgentTier,
  TeamId,
  ModelConfig,
  MessageType,
  Priority,
  AgentMessage,
  AgentConfig,
  TeamConfig,
  SwarmConfig,
  AgentResult,
  CycleResult,
  ToolCallRecord,
  Thread,
  RoutingRule,
  LogLevel,
  LogEntry,
} from "./types.js";

// Orchestrator
export { runOrchestrationCycle } from "./orchestrator/orchestrator.js";

// Team leads
export { runTeamLead } from "./team-lead/team-lead.js";
export { TEAM_LEAD_ROLES, getTeamLeadRole, teamLeadRoleToConfig } from "./team-lead/roles.js";

// Workers
export { runWorker } from "./worker/worker.js";
export {
  ALL_WORKER_ROLES,
  getWorkerRole,
  getTeamWorkerRoles,
  workerRoleToConfig,
  DEV_WORKERS,
  PRODUCT_WORKERS,
  MARKETING_WORKERS,
  OPS_WORKERS,
  GTM_WORKERS,
} from "./worker/roles.js";

// Protocol
export { createMessage, createDirective, createReport, createEscalation, createRequest } from "./protocol/messages.js";
export { ThreadTracker } from "./protocol/thread.js";
export { ROUTING_RULES, findRoutes, resolvePath } from "./protocol/router.js";

// Config
export {
  createDefaultConfig,
  DEFAULT_ORCHESTRATOR_MODEL,
  DEFAULT_TEAM_LEAD_MODEL,
  DEFAULT_WORKER_MODEL,
} from "./config.js";

// Utilities
export { Logger, logger } from "./utils/logger.js";
export { CostTracker } from "./utils/cost-tracker.js";
export type { CostEntry } from "./utils/cost-tracker.js";

// Environment
export { resolveApiKey, envModelConfig, ENV_PROVIDER, ENV_MODEL } from "./env.js";

// Agent factory
export { createSwarmAgent, runOneShot } from "./session.js";
export type { SwarmAgentOptions } from "./session.js";

// UI
export { CycleTracker, ProgressLogger, renderTree, printTree } from "./ui/index.js";
export type { TrackedAgent } from "./ui/index.js";

// Orchestration options
export type { OrchestrationOptions } from "./orchestrator/orchestrator.js";

// ---------------------------------------------------------------------------
// Swarm — High-level convenience class
// ---------------------------------------------------------------------------

import type { CycleResult, SwarmConfig, ModelConfig } from "./types.js";
import { createDefaultConfig } from "./config.js";
import { runOrchestrationCycle } from "./orchestrator/orchestrator.js";
import { envModelConfig } from "./env.js";
import type { OrchestrationOptions } from "./orchestrator/orchestrator.js";

export interface SwarmOptions {
  /** Name for this swarm. Default: "Pi Swarm" */
  name?: string;
  /** Model for the orchestrator agent. */
  orchestratorModel?: ModelConfig;
  /** Model for team lead agents. */
  teamLeadModel?: ModelConfig;
  /** Model for worker agents. */
  workerModel?: ModelConfig;
  /** Maximum cost budget per cycle (in dollars). */
  costBudget?: number;
  /** Maximum concurrent agent executions. */
  maxConcurrentAgents?: number;
  /** Full custom config (overrides all other options). */
  config?: SwarmConfig;
}

/**
 * High-level entry point for pi-swarm.
 *
 * Create a Swarm instance and call `.run()` to execute an orchestration cycle.
 */
export class Swarm {
  private config: SwarmConfig;

  constructor(options?: SwarmOptions) {
    if (options?.config) {
      this.config = options.config;
    } else {
      // Use env defaults if available, otherwise let pi auth resolve at runtime
      const defaultModel = envModelConfig();
      this.config = createDefaultConfig(options?.name, {
        orchestratorModel: options?.orchestratorModel ?? defaultModel ?? undefined,
        teamLeadModel: options?.teamLeadModel ?? defaultModel ?? undefined,
        workerModel: options?.workerModel ?? defaultModel ?? undefined,
        costBudget: options?.costBudget,
        maxConcurrentAgents: options?.maxConcurrentAgents,
      });
    }
  }

  /** Get the current configuration. */
  getConfig(): SwarmConfig {
    return this.config;
  }

  /** Run a full orchestration cycle. */
  async run(directive: string, context?: string, uiOpts?: OrchestrationOptions): Promise<CycleResult> {
    return runOrchestrationCycle(this.config, directive, context, uiOpts);
  }
}
