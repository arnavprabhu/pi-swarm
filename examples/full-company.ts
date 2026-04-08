/**
 * Full company simulation example.
 *
 * Spins up the complete 5-team hierarchy with all 21 worker roles.
 * The CEO delegates quarterly OKRs, and all teams execute in parallel.
 *
 * Uses the provider and model from your .env file.
 *
 * Usage:
 *   npx tsx examples/full-company.ts
 */

import { Swarm } from "../src/index.js";

async function main() {
  // Full company with all default teams — reads from .env
  const swarm = new Swarm({
    name: "Acme Corp",
    costBudget: 5.0,
  });

  const config = swarm.getConfig();
  console.log(`Provider: ${config.defaults.orchestratorModel.provider}`);
  console.log(`Model: ${config.defaults.orchestratorModel.model}`);
  console.log("=== Acme Corp — Q2 Planning Cycle ===\n");

  const result = await swarm.run(
    `It's the beginning of Q2. As CEO, kick off quarterly planning:

1. Ask the product team (CPO) to define the top 3 product priorities for Q2
2. Ask the dev team (CTO) to estimate capacity and identify technical debt to address
3. Ask marketing (CMO) to plan the Q2 campaign calendar
4. Ask ops (COO) to review budget allocation and headcount plan
5. Ask GTM (CRO) to set revenue targets and identify top pipeline opportunities

Each team should produce a detailed plan with specific deliverables and timelines.`,
    "Company context: Series B startup, 50 employees, $10M ARR, B2B SaaS product.",
  );

  console.log("\n" + "=".repeat(60));
  console.log("ORCHESTRATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`Total Cost: $${result.totalCost.toFixed(4)}`);
  console.log(`Teams Involved: ${result.delegations.length}`);

  console.log("\n--- CEO Summary ---");
  console.log(result.companyStatus);

  for (const d of result.delegations) {
    console.log(`\n${"—".repeat(40)}`);
    console.log(`Team: ${d.agentId} | ${d.success ? "OK" : "FAIL"} | $${d.cost.total.toFixed(4)}`);
    console.log(d.output);
  }
}

main().catch(console.error);
