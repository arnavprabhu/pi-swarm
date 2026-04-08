# pi-swarm

Multi-agent orchestration framework built on [pi.dev](https://shittycodingagent.ai).

pi-swarm organizes AI agents into a hierarchical company structure — an orchestrator (CEO) delegates to team leads (C-level), who spawn specialist workers. It's **AI model agnostic**: use Anthropic, OpenAI, Google, Groq, Mistral, or any provider that pi-ai supports.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (CEO)                        │
│         Strategic planner · Delegates to team leads          │
└────────┬──────────┬──────────┬──────────┬──────────┬────────┘
         │          │          │          │          │
    ┌────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌───▼───┐ ┌───▼───┐
    │  CTO   │ │  CPO   │ │ CMO  │ │  COO  │ │  CRO  │
    │  dev   │ │product │ │mktg  │ │  ops  │ │  gtm  │
    └──┬─┬─┬─┘ └─┬─┬─┬──┘ └┬─┬─┬┘ └┬─┬─┬─┘ └┬─┬─┬─┘
       │ │ │     │ │ │      │ │ │    │ │ │     │ │ │
       W W W     W W W      W W W    W W W     W W W
      5 eng    4 spec     4 mktrs  4 ops     4 gtm
```

**21 built-in worker roles** across 5 teams:
- **Dev**: Frontend, Backend, Infra, QA, Security
- **Product**: PM, UX Designer, Data Analyst, Technical Writer
- **Marketing**: Content Writer, SEO, Growth, Brand Designer
- **Ops**: Finance, HR, Legal, Operations
- **GTM**: Sales, Customer Success, Solutions Eng, Partnerships

## Quick Start

### 1. Setup

```bash
git clone https://github.com/arnavprabhu/pi-swarm.git
cd pi-swarm
npm install
```

### 2. Configure your API key

```bash
cp .env.example .env
```

Edit `.env` and set your provider, model, and API key. Example for Gemini:

```env
PROVIDER=google
MODEL=gemini-2.5-flash
GEMINI_API_KEY=your-key-here
```

Supported env vars per provider:

| Provider | Env Var | Key Source |
|----------|---------|------------|
| Google Gemini | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| Groq | `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| OpenRouter | `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Mistral | `MISTRAL_API_KEY` | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| xAI | `XAI_API_KEY` | [console.x.ai](https://console.x.ai) |

### 3. Build & Run

```bash
npm run build
npx tsx examples/basic-orchestration.ts
```

### As a Pi Extension

```bash
pi -e ./dist/extension.js

# Then use in pi:
/swarm Plan the Q2 product launch
/swarm-config
```

### As an SDK

```typescript
import { Swarm } from "pi-swarm";

// Reads PROVIDER and MODEL from .env automatically
const swarm = new Swarm({ name: "My Company", costBudget: 2.0 });

const result = await swarm.run("Build a REST API for user management");
console.log(result.companyStatus);
console.log(`Cost: $${result.totalCost.toFixed(4)}`);
```

Or override models per tier:

```typescript
const swarm = new Swarm({
  name: "My Company",
  orchestratorModel: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  teamLeadModel:     { provider: "openai",    model: "gpt-4o" },
  workerModel:       { provider: "groq",      model: "llama-3.3-70b-versatile" },
  costBudget: 2.0,
});
```

## Model Agnostic

Every agent's model is configurable — orchestrator, team leads, and workers can each use a different provider and model. Mix and match based on capability needs and cost:

```typescript
const swarm = new Swarm({
  // Powerful model for strategic thinking
  orchestratorModel: { provider: "anthropic", model: "claude-sonnet-4-20250514", thinkingLevel: "medium" },
  // Balanced model for team coordination
  teamLeadModel: { provider: "openai", model: "gpt-4o" },
  // Fast/cheap model for atomic tasks
  workerModel: { provider: "groq", model: "llama-3.3-70b-versatile" },
});
```

## Configuration

### Default Config

```typescript
import { createDefaultConfig } from "pi-swarm";

// Creates a full 5-team config with all 22 workers
const config = createDefaultConfig("Acme Corp", {
  orchestratorModel: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  teamLeadModel: { provider: "openai", model: "gpt-4o" },
  workerModel: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  costBudget: 5.0,
});
```

### Custom Teams

Define your own teams with custom roles (see `examples/custom-team.ts`):

```typescript
import { Swarm } from "pi-swarm";
import type { SwarmConfig, TeamConfig } from "pi-swarm";

const researchTeam: TeamConfig = {
  lead: {
    id: "research-director",
    name: "Research Director",
    tier: "team-lead",
    team: "research",
    role: "research_director",
    systemPrompt: "You are the Research Director...",
    model: { provider: "openai", model: "gpt-4o" },
  },
  workers: [
    {
      id: "analyst",
      name: "Research Analyst",
      tier: "worker",
      team: "research",
      role: "analyst",
      systemPrompt: "You are a research analyst...",
      model: { provider: "groq", model: "llama-3.3-70b-versatile" },
    },
  ],
};

const swarm = new Swarm({
  config: {
    name: "Research Lab",
    orchestrator: { /* ... */ },
    teams: { research: researchTeam },
    defaults: { /* ... */ },
  },
});
```

## API Reference

### `Swarm`

The main entry point for SDK usage.

| Method | Description |
|--------|-------------|
| `new Swarm(options?)` | Create a swarm with optional config overrides |
| `swarm.run(directive, context?)` | Run a full orchestration cycle |
| `swarm.getConfig()` | Get the current configuration |

### `runOrchestrationCycle(config, directive, context?)`

Low-level function to run an orchestration cycle with a full `SwarmConfig`.

### `runTeamLead(config, directive, context?, workerModel?, costTracker?)`

Run a single team lead agent with its workers.

### `runWorker(config, task, context?, costTracker?)`

Run an ephemeral worker agent.

### Message Protocol

```typescript
import { createDirective, createReport, createEscalation, createRequest } from "pi-swarm";
import { ThreadTracker } from "pi-swarm";

const tracker = new ThreadTracker();
const directive = createDirective("ceo", "cto", "Build the API", "Full details...");
tracker.track(directive);
```

### Routing

```typescript
import { findRoutes, resolvePath, ROUTING_RULES } from "pi-swarm";

const path = resolvePath("new feature");
// → ["orchestrator", "product", "dev"]
```

### Cost Tracking

```typescript
import { CostTracker } from "pi-swarm";

const tracker = new CostTracker(5.0); // $5 budget
tracker.record("cto", 1000, 500, 0.02);
console.log(tracker.summary());
console.log(tracker.isOverBudget); // false
```

## Design Principles

1. **Model agnostic** — Any LLM provider that pi-ai supports. Config-driven model selection per tier.
2. **Curated context** — Following the [AOrchestra](https://arxiv.org/abs/2501.09475) 4-tuple pattern `(Instruction, Context, Tools, Model)`, each sub-agent receives only the context it needs.
3. **Observable** — Every agent action is logged. JSONL-compatible output for replay and debugging.
4. **Ephemeral workers** — Workers are stateless and disposable. Only the orchestrator maintains persistent state across cycles.
5. **Composable** — Define custom teams, custom roles, and custom tools. Not limited to the built-in company structure.
6. **Cost-aware** — Track and optionally limit spending per orchestration cycle.

## Project Structure

```
pi-swarm/
├── src/
│   ├── index.ts                 # SDK exports + Swarm class
│   ├── extension.ts             # Pi extension entry point
│   ├── types.ts                 # All type definitions
│   ├── config.ts                # Default configurations
│   ├── orchestrator/
│   │   ├── orchestrator.ts      # CEO orchestrator agent
│   │   └── tools.ts             # Orchestrator tools (delegate, broadcast, etc.)
│   ├── team-lead/
│   │   ├── team-lead.ts         # Team lead agent factory
│   │   ├── tools.ts             # Team lead tools (spawn_worker, report, etc.)
│   │   └── roles.ts             # C-level role definitions
│   ├── worker/
│   │   ├── worker.ts            # Ephemeral worker factory
│   │   └── roles.ts             # 22 worker role definitions
│   ├── protocol/
│   │   ├── messages.ts          # Message creation utilities
│   │   ├── router.ts            # Routing rules
│   │   └── thread.ts            # Thread tracking
│   └── utils/
│       ├── logger.ts            # Structured JSONL logger
│       └── cost-tracker.ts      # Token & cost tracking
├── examples/
│   ├── basic-orchestration.ts   # Minimal CEO + CTO example
│   ├── full-company.ts          # Full 50-agent simulation
│   └── custom-team.ts           # Custom team definitions
└── skills/
    └── orchestrate/
        └── SKILL.md             # Pi skill for natural language use
```

## License

MIT
