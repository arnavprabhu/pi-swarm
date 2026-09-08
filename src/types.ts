/**
 * pi-swarm type definitions
 *
 * Core types for the multi-agent orchestration system.
 * Follows the AOrchestra 4-tuple pattern: (Instruction, Context, Tools, Model)
 */

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

// ---------------------------------------------------------------------------
// Agent Tiers & Team Identifiers
// ---------------------------------------------------------------------------

/** The three tiers in the orchestration hierarchy. */
export type AgentTier = "orchestrator" | "team-lead" | "worker";

/** Built-in team identifiers. Extend with custom strings for user-defined teams. */
export type TeamId = "dev" | "product" | "marketing" | "ops" | "gtm" | (string & {});

// ---------------------------------------------------------------------------
// Model Configuration (AI-Model Agnostic)
// ---------------------------------------------------------------------------

/**
 * Model configuration — always read from .env or pi auth.
 * Supports built-in and custom provider/model pairs in pi's model registry.
 */
export interface ModelConfig {
  provider: string;
  model: string;
  thinkingLevel?: ThinkingLevel;
}

// ---------------------------------------------------------------------------
// Inter-Agent Message Protocol
// ---------------------------------------------------------------------------

/** Message types flowing between agents. */
export type MessageType = "directive" | "request" | "report" | "escalation" | "approval";

/** Priority levels for messages. */
export type Priority = "p0" | "p1" | "p2" | "p3";

/** A structured message passed between agents. */
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  priority: Priority;
  payload: {
    summary: string;
    body: string;
    dependencies: string[];
    deadline?: string;
    response_required: boolean;
  };
  threadId: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Agent Configuration
// ---------------------------------------------------------------------------

/** Configuration for a single agent (any tier). */
export interface AgentConfig {
  id: string;
  name: string;
  tier: AgentTier;
  team?: TeamId;
  role: string;
  systemPrompt: string;
  model: ModelConfig;
  tools?: string[];
  maxTurns?: number;
}

/** Configuration for an entire team (lead + workers). */
export interface TeamConfig {
  lead: AgentConfig;
  workers: AgentConfig[];
}

// ---------------------------------------------------------------------------
// Swarm Configuration
// ---------------------------------------------------------------------------

/** Top-level configuration for a swarm deployment. */
export interface SwarmConfig {
  name: string;
  orchestrator: AgentConfig;
  teams: Record<string, TeamConfig>;
  defaults: {
    orchestratorModel: ModelConfig;
    teamLeadModel: ModelConfig;
    workerModel: ModelConfig;
  };
  maxConcurrentAgents?: number;
  costBudget?: number;
}

// ---------------------------------------------------------------------------
// Execution Results
// ---------------------------------------------------------------------------

/** Represents the result of a single agent's execution. */
export interface AgentResult {
  executionId?: string;
  status?: RunStatus;
  error?: string;
  workers?: AgentResult[];
  /** Agent's own cost. Team totals include descendants separately. */
  teamCost?: number;
  agentId: string;
  success: boolean;
  output: string;
  cost: { input: number; output: number; total: number };
  tokensUsed: { input: number; output: number };
  duration: number;
  toolCalls: { name: string; args: unknown; result: string }[];
}

/** Represents the result of an entire orchestration cycle. */
export interface CycleResult {
  status: RunStatus;
  error?: string;
  cycleId: string;
  timestamp: string;
  delegations: AgentResult[];
  companyStatus: string;
  totalCost: number;
  duration: number;
}

export type RunStatus = "completed" | "partial" | "failed" | "cancelled" | "budget_exceeded" | "turn_limit";

// ---------------------------------------------------------------------------
// Tool Call Descriptor
// ---------------------------------------------------------------------------

/** A recorded tool invocation for audit/logging. */
export interface ToolCallRecord {
  name: string;
  args: unknown;
  result: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Thread & Routing
// ---------------------------------------------------------------------------

/** A conversation thread linking related messages across agents. */
export interface Thread {
  id: string;
  originAgent: string;
  messages: AgentMessage[];
  status: "open" | "resolved" | "escalated";
  createdAt: string;
  updatedAt: string;
}

/** A routing rule that describes how a message type travels through the system. */
export interface RoutingRule {
  name: string;
  trigger: string;
  path: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  agentId: string;
  event: string;
  data?: unknown;
}
