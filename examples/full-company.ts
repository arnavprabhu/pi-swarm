/**
 * Full company simulation.
 *
 * Engages all 5 teams on quarterly planning.
 * Shows the full team tree with 5 leads + workers.
 *
 * Usage:
 *   npx tsx examples/full-company.ts
 */

import { Swarm } from "../src/index.js";

const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function main() {
  const swarm = new Swarm({
    name: "Acme Corp",
    costBudget: 5.0,
  });

  const config = swarm.getConfig();
  const teamCount = Object.keys(config.teams).length;
  const workerCount = Object.values(config.teams).reduce((sum, t) => sum + t.workers.length, 0);
  console.log(`${DIM}${teamCount} teams, ${workerCount} workers${RESET}`);
  console.log(`${DIM}Model: ${config.defaults.orchestratorModel.model}${RESET}`);

  const result = await swarm.run(
    `Kick off Q2 planning across all teams:

1. Product (CPO): Define the top 3 product priorities for Q2
2. Engineering (CTO): Estimate capacity and identify tech debt
3. Marketing (CMO): Plan the Q2 campaign calendar
4. Operations (COO): Review budget allocation and headcount
5. GTM (CRO): Set revenue targets and top pipeline opportunities

Each team should produce deliverables with timelines.`,
    "Series B startup, 50 employees, $10M ARR, B2B SaaS.",
  );

  if (result.companyStatus && !result.companyStatus.startsWith("Orchestration")) {
    console.log(`\n${CYAN}${BOLD}--- CEO Summary ---${RESET}\n`);
    console.log(result.companyStatus);
  }
}

main().catch(console.error);
