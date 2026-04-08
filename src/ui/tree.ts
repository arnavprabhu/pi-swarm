/**
 * ASCII tree renderer with ANSI colors.
 *
 * Renders the agent hierarchy as a visual tree:
 * ```
 * pi-swarm | cycle-abc | 1m 05s
 * └── ◆ Orchestrator 💰 $0.74 🧠 1043K claude-opus-4-6
 *     ├── ◆ CTO 💰 $0.53 🧠 1039K claude-opus-4-6
 *     │   ├── ◆ Backend Eng 💰 $0.19 🧠 1015K claude-sonnet-4-6
 *     │   └── ◆ QA Eng 💰 $0.00 🧠 1M claude-sonnet-4-6
 *     └── ◆ CPO 💰 $0.07 🧠 1042K claude-opus-4-6
 * ```
 */

import type { CycleTracker, TrackedAgent } from "./tracker.js";

// ANSI color codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const WHITE = "\x1b[37m";
const GRAY = "\x1b[90m";

/** Format token count: 1000000 → "1M", 500000 → "500K", 1234 → "1.2K" */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Format duration in seconds or minutes. */
function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

/** Format cost. */
function formatCost(cost: number): string {
  return `$${cost.toFixed(cost >= 0.01 ? 2 : 4)}`;
}

/** Get status icon with color. */
function statusIcon(agent: TrackedAgent): string {
  switch (agent.status) {
    case "complete": return `${GREEN}◆${RESET}`;
    case "error": return `${RED}✗${RESET}`;
    case "working": return `${YELLOW}◆${RESET}`;
    default: return `${GRAY}◇${RESET}`;
  }
}

/** Color the agent name by tier. */
function colorName(agent: TrackedAgent): string {
  switch (agent.tier) {
    case "orchestrator": return `${CYAN}${BOLD}${agent.name}${RESET}`;
    case "team-lead": return `${YELLOW}${agent.name}${RESET}`;
    case "worker": return `${GREEN}${agent.name}${RESET}`;
    default: return agent.name;
  }
}

/** Render a single agent line. */
function renderAgent(agent: TrackedAgent): string {
  const icon = statusIcon(agent);
  const name = colorName(agent);
  const cost = `${DIM}💰 ${formatCost(agent.cost)}${RESET}`;
  const tokens = agent.tokens > 0 ? ` ${DIM}🧠 ${formatTokens(agent.tokens)}${RESET}` : "";
  const model = `${GRAY}${agent.model}${RESET}`;
  const dur = agent.duration > 0 ? ` ${DIM}${formatDuration(agent.duration)}${RESET}` : "";

  return `${icon} ${name} ${cost}${tokens} ${model}${dur}`;
}

/** Recursively render the tree. */
function renderNode(
  tracker: CycleTracker,
  agent: TrackedAgent,
  prefix: string,
  isLast: boolean,
  lines: string[],
): void {
  const connector = isLast ? "└── " : "├── ";
  const childPrefix = isLast ? "    " : "│   ";

  lines.push(`${DIM}${prefix}${connector}${RESET}${renderAgent(agent)}`);

  const children = tracker.getChildren(agent.id);
  children.forEach((child, i) => {
    renderNode(tracker, child, prefix + childPrefix, i === children.length - 1, lines);
  });
}

/**
 * Render the full team tree.
 * Returns an array of strings (one per line) with ANSI color codes.
 */
export function renderTree(tracker: CycleTracker): string[] {
  const root = tracker.getRoot();
  if (!root) return ["(no agents tracked)"];

  const lines: string[] = [];

  // Header
  const cycleShort = tracker.cycleId.slice(0, 12) || "pending";
  const elapsed = formatDuration(tracker.elapsed);
  const totalCost = formatCost(tracker.totalCost);
  lines.push(
    `${DIM}${tracker.name} | ${cycleShort} | ${elapsed} | total: ${totalCost}${RESET}`,
  );

  // Root
  lines.push(`${renderAgent(root)}`);

  // Children of root
  const children = tracker.getChildren(root.id);
  children.forEach((child, i) => {
    renderNode(tracker, child, "", i === children.length - 1, lines);
  });

  return lines;
}

/** Print the tree to stdout. */
export function printTree(tracker: CycleTracker): void {
  const lines = renderTree(tracker);
  console.log("");
  console.log(lines.join("\n"));
  console.log("");
}
