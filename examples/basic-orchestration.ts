/**
 * Basic orchestration example.
 *
 * Creates a minimal swarm with CEO + CTO + 2 dev workers,
 * delegates a simple coding task, and displays the result.
 *
 * Usage:
 *   npx tsx examples/basic-orchestration.ts
 */

import { Swarm } from "../src/index.js";

async function main() {
  // Create a minimal swarm — only the dev team
  const swarm = new Swarm({
    name: "Small Dev Team",
    // Use any provider/model you have API keys for:
    orchestratorModel: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      thinkingLevel: "low",
    },
    teamLeadModel: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    },
    workerModel: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    },
    costBudget: 1.0, // $1 max
  });

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
