/**
 * Custom team example.
 *
 * Defines a research + design studio with custom roles.
 * Demonstrates that pi-swarm isn't limited to the built-in teams.
 *
 * Usage:
 *   npx tsx examples/custom-team.ts
 */

import { Swarm, envModelConfig } from "../src/index.js";
import type { SwarmConfig, TeamConfig } from "../src/types.js";

const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// Resolve model from .env or use a placeholder for pi auth runtime resolution
const PLACEHOLDER_MODEL = { provider: "anthropic" as any, model: "placeholder" };
const model = envModelConfig() ?? PLACEHOLDER_MODEL;

const researchTeam: TeamConfig = {
  lead: {
    id: "research-director", name: "Research Director", tier: "team-lead",
    team: "research", role: "research_director", model, maxTurns: 8,
    systemPrompt: "You are the Research Director. Decompose research questions, delegate to analysts, and synthesize findings into actionable insights.",
  },
  workers: [
    {
      id: "market-researcher", name: "Market Researcher", tier: "worker",
      team: "research", role: "market_researcher", model, maxTurns: 3,
      systemPrompt: "You are a market researcher. Analyze trends, competitor landscapes, and produce data-driven analyses.",
    },
    {
      id: "academic-researcher", name: "Academic Researcher", tier: "worker",
      team: "research", role: "academic_researcher", model, maxTurns: 3,
      systemPrompt: "You are an academic researcher. Review literature, summarize papers, and evaluate methodologies.",
    },
  ],
};

const designTeam: TeamConfig = {
  lead: {
    id: "design-director", name: "Design Director", tier: "team-lead",
    team: "design", role: "design_director", model, maxTurns: 8,
    systemPrompt: "You are the Design Director. Create design strategies, delegate tasks, and ensure visual quality.",
  },
  workers: [
    {
      id: "ui-designer", name: "UI Designer", tier: "worker",
      team: "design", role: "ui_designer", model, maxTurns: 3,
      systemPrompt: "You are a UI designer. Create interface mockups and interaction specifications.",
    },
  ],
};

const customConfig: SwarmConfig = {
  name: "Research & Design Studio",
  orchestrator: {
    id: "studio-lead", name: "Studio Lead", tier: "orchestrator",
    role: "studio_lead", systemPrompt: "", model, maxTurns: 15,
  },
  teams: { research: researchTeam, design: designTeam },
  defaults: { orchestratorModel: model, teamLeadModel: model, workerModel: model },
  costBudget: 2.0,
};

async function main() {
  const swarm = new Swarm({ config: customConfig });

  console.log(`${DIM}Custom teams: research (2 workers), design (1 worker)${RESET}`);
  console.log(`${DIM}Model: ${model.model}${RESET}`);

  const result = await swarm.run(
    "Research the current state of AI-powered design tools and create a competitive " +
      "analysis with recommendations for which tools our team should adopt.",
  );

  if (result.companyStatus && !result.companyStatus.startsWith("Orchestration")) {
    console.log(`\n${CYAN}${BOLD}--- Studio Lead Summary ---${RESET}\n`);
    console.log(result.companyStatus);
  }
}

main().catch(console.error);
