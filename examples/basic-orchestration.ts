/**
 * Basic orchestration example.
 *
 * Uses the provider and model from your .env file.
 * No hardcoded API keys or model names.
 *
 * Usage:
 *   npx tsx examples/basic-orchestration.ts
 */

import { Swarm } from "../src/index.js";

async function main() {
  // Create a swarm — reads PROVIDER and MODEL from .env automatically
  const swarm = new Swarm({
    name: "Small Dev Team",
    costBudget: 1.0, // $1 max
  });

  const config = swarm.getConfig();
  console.log(`Provider: ${config.defaults.orchestratorModel.provider}`);
  console.log(`Model: ${config.defaults.orchestratorModel.model}`);
  console.log("Starting basic orchestration...\n");

  const result = await swarm.run(
    "Build a REST API endpoint that returns a paginated list of users. " +
      "Include input validation, error handling, and unit tests.",
  );

  console.log("\n=== Orchestration Complete ===");
  console.log(`Cycle ID: ${result.cycleId}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`Total Cost: $${result.totalCost.toFixed(4)}`);
  console.log(`Teams Involved: ${result.delegations.length}`);
  console.log(`\n--- CEO Summary ---\n${result.companyStatus}`);

  for (const delegation of result.delegations) {
    console.log(`\n--- ${delegation.agentId} ---`);
    console.log(`Status: ${delegation.success ? "OK" : "FAIL"}`);
    console.log(`Cost: $${delegation.cost.total.toFixed(4)}`);
    console.log(`Output:\n${delegation.output.slice(0, 500)}`);
  }
}

main().catch(console.error);
