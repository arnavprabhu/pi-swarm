/**
 * Live progress logger with colored, indented output.
 *
 * Replaces the raw JSONL logger during orchestration cycles.
 *
 * ```
 * [Orchestrator] Analyzing task...
 * [Orchestrator] → Delegating to dev team...
 *   [CTO] Spawning Backend Engineer...
 *     [Backend Eng] ✓ Complete (7.2s, 4141 chars)
 *     [QA Eng] ✗ Failed: 503 error
 *   [CTO] ✓ Complete (32.3s)
 * [Orchestrator] ✓ Cycle complete (65.2s)
 * ```
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";

type AgentTierHint = "orchestrator" | "team-lead" | "worker";

function tierColor(tier: AgentTierHint): string {
  switch (tier) {
    case "orchestrator": return CYAN;
    case "team-lead": return YELLOW;
    case "worker": return GREEN;
  }
}

function tierIndent(tier: AgentTierHint): string {
  switch (tier) {
    case "orchestrator": return "";
    case "team-lead": return "  ";
    case "worker": return "    ";
  }
}

export class ProgressLogger {
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /** Log an agent action. */
  log(name: string, tier: AgentTierHint, message: string): void {
    if (!this.enabled) return;
    const indent = tierIndent(tier);
    const color = tierColor(tier);
    console.log(`${indent}${color}[${name}]${RESET} ${message}`);
  }

  /** Log delegation. */
  delegating(from: string, to: string, team: string): void {
    if (!this.enabled) return;
    console.log(`${CYAN}[${from}]${RESET} → Delegating to ${YELLOW}${to}${RESET} (${team})...`);
  }

  /** Log worker spawn. */
  spawning(leadName: string, workerName: string): void {
    if (!this.enabled) return;
    console.log(`  ${YELLOW}[${leadName}]${RESET} Spawning ${GREEN}${workerName}${RESET}...`);
  }

  /** Log completion. */
  complete(name: string, tier: AgentTierHint, durationMs: number, extra?: string): void {
    if (!this.enabled) return;
    const indent = tierIndent(tier);
    const color = tierColor(tier);
    const dur = (durationMs / 1000).toFixed(1);
    const suffix = extra ? ` ${DIM}(${extra})${RESET}` : "";
    console.log(`${indent}${color}[${name}]${RESET} ${GREEN}✓${RESET} Complete ${DIM}(${dur}s)${RESET}${suffix}`);
  }

  /** Log failure. */
  failed(name: string, tier: AgentTierHint, error: string): void {
    if (!this.enabled) return;
    const indent = tierIndent(tier);
    const color = tierColor(tier);
    // Truncate long error messages
    const shortError = error.length > 80 ? error.slice(0, 77) + "..." : error;
    console.log(`${indent}${color}[${name}]${RESET} ${RED}✗${RESET} ${RED}Failed: ${shortError}${RESET}`);
  }

  /** Log cycle start. */
  cycleStart(directive: string): void {
    if (!this.enabled) return;
    const short = directive.length > 100 ? directive.slice(0, 97) + "..." : directive;
    console.log(`\n${CYAN}${BOLD}[Orchestrator]${RESET} ${short}\n`);
  }

  /** Log cycle end. */
  cycleEnd(durationMs: number, teamsInvolved: number): void {
    if (!this.enabled) return;
    const dur = (durationMs / 1000).toFixed(1);
    console.log(`\n${CYAN}${BOLD}[Orchestrator]${RESET} ${GREEN}✓${RESET} Cycle complete ${DIM}(${dur}s, ${teamsInvolved} team${teamsInvolved !== 1 ? "s" : ""})${RESET}`);
  }
}
