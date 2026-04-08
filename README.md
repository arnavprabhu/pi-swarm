<p align="center">
  <img src="assets/logo.jpg" alt="pi-swarm logo" width="200">
</p>

<h1 align="center">pi-swarm</h1>
<p align="center">Multi-agent orchestration built on <a href="https://github.com/badlogic/pi-mono">pi.dev</a></p>

<p align="center">
  <a href="https://github.com/arnavprabhu/pi-swarm/blob/main/LICENSE"><img src="https://img.shields.io/github/license/arnavprabhu/pi-swarm?style=flat-square&color=blue" alt="License"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://github.com/badlogic/pi-mono"><img src="https://img.shields.io/badge/Built_on-pi.dev-black?style=flat-square" alt="Built on pi.dev"></a>
  <a href="https://github.com/arnavprabhu/pi-swarm"><img src="https://img.shields.io/github/stars/arnavprabhu/pi-swarm?style=flat-square&color=yellow" alt="Stars"></a>
</p>

<br>

pi-swarm runs a team of AI agents organized like a company. You give it a task, and a CEO agent breaks it down, delegates to team leads, who spawn specialist workers — all using whatever AI provider you want (Gemini, Claude, GPT, Groq, etc.).

```
[Orchestrator] Build a REST API for user management...

[Orchestrator] → Delegating to CTO (dev)...
  [CTO] Spawning Backend Engineer...
  [CTO] Spawning QA Engineer...
    [Backend Engineer] ✓ Complete (7.2s) (4141 chars)
    [QA Engineer] ✓ Complete (14.0s) (10052 chars)
  [CTO] ✓ Complete (32.3s)

[Orchestrator] ✓ Cycle complete (65.2s, 1 team)

Dev Team | 429d8097 | 65.2s | total: $0.0023
◆ Orchestrator 💰 $0.0023 gemini-3-flash-preview 65.2s
└── ◆ CTO 💰 $0.0012 gemini-3-flash-preview 32.3s
    ├── ◆ Backend Engineer 💰 $0.0006 gemini-3-flash-preview 7.2s
    └── ◆ QA Engineer 💰 $0.0005 gemini-3-flash-preview 14.0s
```

---

## How It Works

```
                        ┌──────────────────┐
                        │   ORCHESTRATOR   │
                        │      (CEO)       │
                        └──┬──┬──┬──┬──┬───┘
                           │  │  │  │  │
              ┌────────────┘  │  │  │  └────────────┐
              │       ┌───────┘  │  └───────┐       │
         ┌────▼──┐ ┌──▼───┐ ┌───▼──┐ ┌─────▼┐ ┌───▼──┐
         │  CTO  │ │ CPO  │ │ CMO  │ │ COO  │ │ CRO  │
         │  dev  │ │ prod │ │ mktg │ │ ops  │ │ gtm  │
         └──┬──┬─┘ └─┬──┬─┘ └─┬──┬─┘ └─┬──┬─┘ └─┬──┬─┘
            │  │     │  │     │  │     │  │     │  │
            W  W     W  W     W  W     W  W     W  W
```

1. You give the **Orchestrator** a task
2. It decides which **Team Leads** to involve (CTO, CPO, CMO, COO, CRO)
3. Each lead spawns **Workers** — ephemeral specialists that do the actual work
4. Workers report back to their lead, leads report to the orchestrator
5. You get a summary + a live tree showing every agent's status, cost, and timing

**21 built-in workers** across 5 teams:

| Team | Lead | Workers |
|------|------|---------|
| Dev | CTO | Frontend, Backend, Infra, QA, Security |
| Product | CPO | PM, UX Designer, Data Analyst, Technical Writer |
| Marketing | CMO | Content Writer, SEO, Growth, Brand Designer |
| Ops | COO | Finance, HR, Legal, Operations |
| GTM | CRO | Sales, Customer Success, Solutions Eng, Partnerships |

You can also [define your own teams](#custom-teams) with any roles you want.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pi CLI](https://github.com/badlogic/pi-mono) installed

### Install

```bash
git clone https://github.com/arnavprabhu/pi-swarm.git
cd pi-swarm
npm install
npm run build
```

### Authenticate

**Option 1 — pi login (recommended):**

```bash
pi /login
```

pi-swarm reads from `~/.pi/agent/auth.json` automatically. Nothing else to configure.

**Option 2 — environment variables:**

```bash
cp .env.example .env
```

Edit `.env`:

```env
PROVIDER=google
MODEL=gemini-3-flash-preview
GEMINI_API_KEY=your-key-here
```

<details>
<summary>All supported providers</summary>

| Provider | Env Var | Get a Key |
|----------|---------|-----------|
| Google Gemini | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) |
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| Groq | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) |
| OpenRouter | `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai/keys) |
| Mistral | `MISTRAL_API_KEY` | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| xAI | `XAI_API_KEY` | [console.x.ai](https://console.x.ai) |

</details>

### Run

```bash
npx tsx examples/basic-orchestration.ts
```

You should see colored progress output and a tree at the end. See the full [Tutorial](./TUTORIAL.md) for a walkthrough.

---

## Usage

### As an SDK

```typescript
import { Swarm } from "pi-swarm";

const swarm = new Swarm({ name: "My Project" });
const result = await swarm.run("Build a REST API with auth and tests");

console.log(result.companyStatus);   // CEO's summary
console.log(result.totalCost);       // Total spend in dollars
console.log(result.duration);        // Time in ms
```

### As a pi extension

```bash
pi -e /path/to/pi-swarm/dist/extension.js
```

Then inside pi:

```
/swarm Plan the Q2 product launch
/swarm-config
```

### In an existing project

Add as a git dependency:

```json
{
  "dependencies": {
    "pi-swarm": "github:arnavprabhu/pi-swarm"
  }
}
```

```bash
npm install
```

---

## Configuration

### Per-tier models

Use a powerful model for the CEO, a balanced one for leads, and a fast/cheap one for workers:

```typescript
const swarm = new Swarm({
  orchestratorModel: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  teamLeadModel:     { provider: "openai",    model: "gpt-4o" },
  workerModel:       { provider: "groq",      model: "llama-3.3-70b-versatile" },
});
```

### Budget limits

```typescript
const swarm = new Swarm({
  costBudget: 2.0,           // Stop if spend exceeds $2
  maxConcurrentAgents: 5,    // Max parallel agents
});
```

### Custom teams

Not limited to the built-in 5 teams — define your own:

```typescript
import { Swarm } from "pi-swarm";
import type { SwarmConfig, TeamConfig } from "pi-swarm";

const securityTeam: TeamConfig = {
  lead: {
    id: "security-lead", name: "Security Lead", tier: "team-lead",
    team: "security", role: "security_lead",
    systemPrompt: "You lead the security team. Delegate pen testing and audits.",
    model: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  },
  workers: [
    {
      id: "pen-tester", name: "Pen Tester", tier: "worker",
      team: "security", role: "pen_tester",
      systemPrompt: "Find vulnerabilities and suggest fixes.",
      model: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
    },
  ],
};
```

See [`examples/custom-team.ts`](./examples/custom-team.ts) for a full working example.

### UI controls

```typescript
// Full UI (default) — progress output + tree
await swarm.run("task");

// Tree only, no progress output
await swarm.run("task", undefined, { showProgress: false });

// Silent — no UI at all
await swarm.run("task", undefined, { showProgress: false, showTree: false });

// Keep JSONL logger on alongside UI
await swarm.run("task", undefined, { suppressLogger: false });
```

---

## Examples

| Example | What it does | Command |
|---------|-------------|---------|
| [basic-orchestration.ts](./examples/basic-orchestration.ts) | Single dev task — CEO → CTO → Backend + QA | `npx tsx examples/basic-orchestration.ts` |
| [full-company.ts](./examples/full-company.ts) | All 5 teams on Q2 planning | `npx tsx examples/full-company.ts` |
| [custom-team.ts](./examples/custom-team.ts) | Custom research + design teams | `npx tsx examples/custom-team.ts` |

---

## API Reference

### Swarm

```typescript
new Swarm(options?: SwarmOptions)
```

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Swarm name (default: `"Pi Swarm"`) |
| `orchestratorModel` | `ModelConfig` | Model for the CEO agent |
| `teamLeadModel` | `ModelConfig` | Model for team leads |
| `workerModel` | `ModelConfig` | Model for workers |
| `costBudget` | `number` | Max spend per cycle in dollars |
| `maxConcurrentAgents` | `number` | Parallel agent limit (default: `10`) |
| `config` | `SwarmConfig` | Full custom config (overrides everything) |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `run(directive, context?, uiOpts?)` | `Promise<CycleResult>` | Run an orchestration cycle |
| `getConfig()` | `SwarmConfig` | Get the current config |

### Lower-level APIs

```typescript
import { createSwarmAgent, runOneShot } from "pi-swarm";

// Create a single agent
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

### Agent tools by tier

| Tier | Tools |
|------|-------|
| Orchestrator | `delegate_task`, `broadcast`, `collect_reports`, `finish_cycle` |
| Team Lead | `spawn_worker`, `list_workers`, `report_to_orchestrator`, `get_worker_results` |
| Worker | None (text-only reasoning) |

---

## Auth Chain

pi-swarm resolves API keys in this order:

1. **pi's AuthStorage** — `~/.pi/agent/auth.json` (from `pi /login`)
2. **ModelRegistry** — custom provider configs
3. **Environment variables** — from `.env` file

If you've logged in via pi, everything just works.

---

## Project Structure

```
pi-swarm/
├── src/
│   ├── index.ts               # Exports + Swarm class
│   ├── session.ts             # Agent factory (pi-authenticated)
│   ├── env.ts                 # .env loader + key resolution
│   ├── config.ts              # Default team configs
│   ├── extension.ts           # Pi extension entry point
│   ├── types.ts               # Type definitions
│   ├── orchestrator/          # CEO agent + delegation tools
│   ├── team-lead/             # Team lead agent + worker management
│   ├── worker/                # Ephemeral worker runner + 21 roles
│   ├── protocol/              # Inter-agent message protocol
│   ├── ui/                    # Progress output + ASCII tree
│   └── utils/                 # Logger + cost tracker
├── examples/                  # 3 runnable examples
├── skills/orchestrate/        # Pi skill for /swarm commands
├── TUTORIAL.md                # Step-by-step guide
└── LICENSE                    # MIT
```

---

## License

[MIT](./LICENSE) — use it however you want.
