/**
 * Basic orchestration example.
 *
 * Delegates a simple dev task and shows:
 * - Live progress output as agents work
 * - Team tree with per-agent stats
 * - CEO summary
 *
 * Usage:
 *   npx tsx examples/basic-orchestration.ts
 */

import { Swarm } from "../src/index.js";

const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function main() {
  const swarm = new Swarm({
    name: "Dev Team",
    costBudget: 2.0,
  });

  const config = swarm.getConfig();
  console.log(`${DIM}Provider: ${config.defaults.orchestratorModel.provider}${RESET}`);
  console.log(`${DIM}Model: ${config.defaults.orchestratorModel.model}${RESET}`);

  const result = await swarm.run(
    "Build a REST API endpoint that returns a paginated list of users. " +
      "Include input validation, error handling, and unit tests.",
  );

  // Print CEO summary
  if (result.companyStatus && !result.companyStatus.startsWith("Orchestration")) {
    console.log(`\n${CYAN}${BOLD}--- CEO Summary ---${RESET}\n`);
    console.log(result.companyStatus);
  }
}

main().catch(console.error);
