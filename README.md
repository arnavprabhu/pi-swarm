# pi-swarm

Multi-agent orchestration framework built on [pi.dev](https://shittycodingagent.ai).

pi-swarm organizes AI agents into a hierarchical company structure — an orchestrator (CEO) delegates to team leads (C-level), who spawn specialist workers. It uses pi's auth system and works with any provider pi supports: Anthropic, OpenAI, Google, Groq, Mistral, OpenRouter, and more.

```
[Orchestrator] Build a REST API for user management...

[Orchestrator] → Delegating to CTO (dev)...
  [CTO] Spawning Backend Engineer...
  [CTO] Spawning QA Engineer...
    [Backend Engineer] ✓ Complete (7.2s) (4141 chars)
    [QA Engineer] ✓ Complete (14.0s) (10052 chars)
  [CTO] ✓ Complete (32.3s)

[Orchestrator] ✓ Cycle complete (65.2s, 1 team)

Dev Team | 429d8097-929 | 65.2s | total: $0.0023
◆ Orchestrator 💰 $0.0023 gemini-3-flash-preview 65.2s
└── ◆ CTO 💰 $0.0000 gemini-3-flash-preview 32.3s
    ├── ◆ Backend Engineer 💰 $0.0000 gemini-3-flash-preview 7.2s
    └── ◆ QA Engineer 💰 $0.0000 gemini-3-flash-preview 14.0s
```

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

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pi CLI](https://shittycodingagent.ai) installed and authenticated (`pi /login`)

### Install

```bash
git clone https://github.com/arnavprabhu/pi-swarm.git
cd pi-swarm
npm install
npm run build
```

### Authentication

pi-swarm uses pi's own auth system. If you've already run `pi /login`, you're set — pi-swarm reads from the same `~/.pi/agent/auth.json` file.

**Fallback: environment variables.** If you haven't set up pi auth, copy the env template:

```bash
cp .env.example .env
```

Edit `.env` with your provider and API key:

```env
PROVIDER=google
MODEL=gemini-3-flash-preview
GEMINI_API_KEY=your-key-here
```

Supported providers:

| Provider | Env Var | Get a Key |
|----------|---------|-----------|
| Google Gemini | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| Groq | `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| OpenRouter | `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Mistral | `MISTRAL_API_KEY` | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| xAI | `XAI_API_KEY` | [console.x.ai](https://console.x.ai) |

### Run an example

```bash
npx tsx examples/basic-orchestration.ts
```

---

## Using pi-swarm in Your Project

### Option A: Add to an existing codebase

From your project root:

```bash
# Install pi-swarm and its peer dependencies
npm install @mariozechner/pi-ai @mariozechner/pi-agent-core @mariozechner/pi-coding-agent dotenv

# Copy pi-swarm's source into your project (or reference it as a local dep)
cp -r /path/to/pi-swarm/src ./lib/pi-swarm
```

Or add it as a git dependency in your `package.json`:

```json
{
  "dependencies": {
    "pi-swarm": "github:arnavprabhu/pi-swarm"
  }
}
```

Then use it:

```typescript
import { Swarm } from "pi-swarm";

const swarm = new Swarm({ name: "My Project" });
const result = await swarm.run("Review the authentication module and suggest improvements");
console.log(result.companyStatus);
```

### Option B: Start a new project with pi-swarm

```bash
mkdir my-agent-team && cd my-agent-team
npm init -y
npm install @mariozechner/pi-ai @mariozechner/pi-agent-core @mariozechner/pi-coding-agent dotenv

# Clone pi-swarm as a subdirectory
git clone https://github.com/arnavprabhu/pi-swarm.git
```

Create your orchestration script:

```typescript
// orchestrate.ts
import { Swarm } from "./pi-swarm/src/index.js";

const swarm = new Swarm({
  name: "My Startup",
  costBudget: 5.0,
});

const result = await swarm.run(
  "Plan and build a landing page with email signup, A/B testing, and analytics integration"
);
```

Run it:

```bash
npx tsx orchestrate.ts
```

### Option C: Use as a Pi Extension

Load pi-swarm directly in pi's CLI:

```bash
cd your-project
pi -e /path/to/pi-swarm/dist/extension.js
```

Then in pi:

```
/swarm Plan the Q2 product launch
/swarm-config
```

---

## Examples

### Basic Orchestration

Single dev task — CEO delegates to CTO, who spawns backend + QA workers:

```bash
npx tsx examples/basic-orchestration.ts
```

### Full Company

All 5 teams engaged on quarterly planning (dev, product, marketing, ops, GTM):

```bash
npx tsx examples/full-company.ts
```

### Custom Teams

Define your own teams (research + design studio) with custom roles:

```bash
npx tsx examples/custom-team.ts
```

---

## SDK Reference

### `Swarm`

```typescript
import { Swarm } from "pi-swarm";

// Reads PROVIDER and MODEL from .env / pi auth automatically
const swarm = new Swarm({ name: "My Company", costBudget: 2.0 });

// Run with live progress UI and team tree
const result = await swarm.run("Build a REST API for user management");

// Disable UI (for programmatic use)
const result = await swarm.run("Analyze this", undefined, { showProgress: false, showTree: false });
```

### Model Configuration

Override models per tier — use a powerful model for the orchestrator, balanced for leads, cheap for workers:

```typescript
const swarm = new Swarm({
  orchestratorModel: { provider: "anthropic", model: "claude-sonnet-4-20250514", thinkingLevel: "medium" },
  teamLeadModel:     { provider: "openai",    model: "gpt-4o" },
  workerModel:       { provider: "groq",      model: "llama-3.3-70b-versatile" },
});
```

### Custom Teams

Not limited to the built-in company structure — define your own:

```typescript
import { Swarm } from "pi-swarm";
import type { SwarmConfig, TeamConfig } from "pi-swarm";

const securityTeam: TeamConfig = {
  lead: {
    id: "security-lead", name: "Security Lead", tier: "team-lead",
    team: "security", role: "security_lead",
    systemPrompt: "You lead the security team. Delegate vulnerability analysis and pen testing to your workers.",
    model: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  },
  workers: [
    {
      id: "pen-tester", name: "Pen Tester", tier: "worker",
      team: "security", role: "pen_tester",
      systemPrompt: "You are a penetration tester. Find vulnerabilities and suggest fixes.",
      model: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
    },
  ],
};
```

### UI Controls

```typescript
// Full UI (default)
await swarm.run("task");

// No progress output, just the tree
await swarm.run("task", undefined, { showProgress: false });

// Silent mode — no UI at all
await swarm.run("task", undefined, { showProgress: false, showTree: false });

// Keep JSONL logger alongside progress UI
await swarm.run("task", undefined, { suppressLogger: false });
```

### Lower-Level APIs

```typescript
import { createSwarmAgent, runOneShot, CycleTracker, ProgressLogger, printTree } from "pi-swarm";

// Create a single pi-authenticated agent
const agent = createSwarmAgent({
  agentId: "my-agent",
  systemPrompt: "You are a code reviewer.",
  model: { provider: "google", model: "gemini-3-flash-preview" },
});

// One-shot prompt
const { text, success } = await runOneShot(
  { agentId: "reviewer", systemPrompt: "Review code for bugs.", model: myModel },
  "Review this function: ..."
);
```

---

## How It Works

### Agent Lifecycle

1. **You send a directive** to the `Swarm`
2. **Orchestrator (CEO)** analyzes the task, decides which teams to involve
3. **Orchestrator calls `delegate_task`** or `broadcast` — team leads are spawned
4. **Team leads** receive the directive, decompose it, and call `spawn_worker` for each subtask
5. **Workers** execute their task and return text output to the team lead
6. **Team leads** synthesize worker outputs and report back to the orchestrator
7. **Orchestrator** calls `finish_cycle` with a summary
8. **Tree renders** showing every agent, its status, cost, model, and duration

### Auth Chain

pi-swarm resolves API keys in this order:

1. **Pi's AuthStorage** — `~/.pi/agent/auth.json` (from `pi /login`)
2. **ModelRegistry** — custom provider configs
3. **Environment variables** — `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc. (from `.env`)

If you've authenticated via pi, everything just works. The `.env` fallback is there for environments without pi installed.

### Tools

Each agent tier has different tools:

| Tier | Tools |
|------|-------|
| Orchestrator | `delegate_task`, `broadcast`, `collect_reports`, `finish_cycle` |
| Team Leads | `spawn_worker`, `list_workers`, `report_to_orchestrator`, `get_worker_results` |
| Workers | None (text-only reasoning agents) |

---

## Design Principles

1. **Model agnostic** — Any provider pi-ai supports. Config-driven model selection per agent tier.
2. **Pi-native auth** — Uses pi's own auth system. No separate key management.
3. **Observable** — Live progress UI with colored output + team tree visualization.
4. **Ephemeral workers** — Workers are stateless and disposable. No session persistence overhead.
5. **Composable** — Define custom teams, roles, and system prompts. Not locked to the built-in structure.
6. **Cost-aware** — Per-cycle budget limits. Cost tracking across all agents.

## Project Structure

```
pi-swarm/
├── src/
│   ├── index.ts                 # SDK exports + Swarm class
│   ├── session.ts               # Agent factory (pi-authenticated)
│   ├── env.ts                   # .env loader + API key resolution
│   ├── extension.ts             # Pi extension entry point
│   ├── types.ts                 # All type definitions
│   ├── config.ts                # Default team configurations
│   ├── orchestrator/
│   │   ├── orchestrator.ts      # CEO agent + cycle runner
│   │   └── tools.ts             # delegate, broadcast, finish_cycle
│   ├── team-lead/
│   │   ├── team-lead.ts         # Team lead agent factory
│   │   ├── tools.ts             # spawn_worker, report, list_workers
│   │   └── roles.ts             # CTO, CPO, CMO, COO, CRO definitions
│   ├── worker/
│   │   ├── worker.ts            # Ephemeral worker runner
│   │   └── roles.ts             # 21 specialist role definitions
│   ├── protocol/
│   │   ├── messages.ts          # Inter-agent message creation
│   │   ├── router.ts            # 8 built-in routing rules
│   │   └── thread.ts            # Thread tracking
│   ├── ui/
│   │   ├── tracker.ts           # CycleTracker (agent lifecycle events)
│   │   ├── tree.ts              # ASCII tree renderer with ANSI colors
│   │   ├── progress.ts          # Live indented progress output
│   │   └── index.ts             # Re-exports
│   └── utils/
│       ├── logger.ts            # Structured JSONL logger
│       └── cost-tracker.ts      # Token & cost aggregation
├── examples/
│   ├── basic-orchestration.ts   # Single dev task
│   ├── full-company.ts          # All 5 teams, quarterly planning
│   └── custom-team.ts           # Custom research + design studio
└── skills/
    └── orchestrate/
        └── SKILL.md             # Pi skill for /swarm commands
```

## License

MIT
