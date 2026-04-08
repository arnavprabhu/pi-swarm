/**
 * Custom team definition example.
 *
 * Shows how to create a swarm with entirely custom teams,
 * roles, and model assignments — not limited to the built-in
 * company structure.
 *
 * Usage:
 *   npx tsx examples/custom-team.ts
 */

import { Swarm } from "../src/index.js";
import type { SwarmConfig, TeamConfig, AgentConfig, ModelConfig } from "../src/types.js";

// Define your own models per tier
const orchestratorModel: ModelConfig = {
  provider: "google",
  model: "gemini-2.5-pro",
  thinkingLevel: "medium",
};

const leadModel: ModelConfig = {
  provider: "openai",
  model: "gpt-4o",
};

const workerModel: ModelConfig = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
};

// Define custom teams
const researchTeam: TeamConfig = {
  lead: {
    id: "research-director",
    name: "Research Director",
    tier: "team-lead",
    team: "research",
    role: "research_director",
    systemPrompt:
      "You are the Research Director. You lead a team of research specialists. " +
      "You decompose research questions, delegate to analysts, and synthesize findings " +
      "into actionable insights.",
    model: leadModel,
    maxTurns: 8,
  },
  workers: [
    {
      id: "market-researcher",
      name: "Market Researcher",
      tier: "worker",
      team: "research",
      role: "market_researcher",
      systemPrompt:
        "You are a market researcher. You analyze market trends, competitor landscapes, " +
        "TAM/SAM/SOM, and produce data-driven market analyses.",
      model: workerModel,
      maxTurns: 3,
    },
    {
      id: "academic-researcher",
      name: "Academic Researcher",
      tier: "worker",
      team: "research",
      role: "academic_researcher",
      systemPrompt:
        "You are an academic researcher. You review literature, summarize papers, " +
        "identify key findings, and evaluate research methodologies.",
      model: workerModel,
      maxTurns: 3,
    },
  ],
};

const designTeam: TeamConfig = {
  lead: {
    id: "design-director",
    name: "Design Director",
    tier: "team-lead",
    team: "design",
    role: "design_director",
    systemPrompt:
      "You are the Design Director. You lead a team of designers. " +
      "You create design strategies, delegate specific design tasks, and ensure " +
      "visual consistency and quality across all deliverables.",
    model: leadModel,
    maxTurns: 8,
  },
  workers: [
    {
      id: "ui-designer",
      name: "UI Designer",
      tier: "worker",
      team: "design",
      role: "ui_designer",
      systemPrompt:
        "You are a UI designer. You create interface mockups, component designs, " +
        "and interaction specifications with attention to usability and aesthetics.",
      model: workerModel,
      maxTurns: 3,
    },
  ],
};

// Build the full config
const customConfig: SwarmConfig = {
  name: "Research & Design Studio",
  orchestrator: {
    id: "studio-lead",
    name: "Studio Lead",
    tier: "orchestrator",
    role: "studio_lead",
    systemPrompt: "", // Built dynamically by the orchestrator
    model: orchestratorModel,
    maxTurns: 15,
  },
  teams: {
    research: researchTeam,
    design: designTeam,
  },
  defaults: {
    orchestratorModel,
    teamLeadModel: leadModel,
    workerModel,
  },
  costBudget: 2.0,
};

async function main() {
  const swarm = new Swarm({ config: customConfig });

  console.log("=== Custom Team: Research & Design Studio ===\n");

  const result = await swarm.run(
    "Research the current state of AI-powered design tools and create a competitive analysis " +
      "with recommendations for which tools our team should adopt.",
  );

  console.log("\n=== Complete ===");
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`Cost: $${result.totalCost.toFixed(4)}`);
  console.log(`\n${result.companyStatus}`);
}

main().catch(console.error);
