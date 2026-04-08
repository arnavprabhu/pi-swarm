# Tutorial: Getting Started with pi-swarm

This guide walks you through running your first multi-agent orchestration, understanding the output, and building your own custom swarm.

---

## Part 1: Setup

### Install Node.js

If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org) (version 18 or higher). Verify it's installed:

```bash
node --version   # Should print v18.x.x or higher
npm --version    # Should print 9.x.x or higher
```

### Install pi CLI

pi-swarm is built on [pi.dev](https://github.com/badlogic/pi-mono). Install the pi CLI globally:

```bash
npm install -g @mariozechner/pi
```

### Clone pi-swarm

```bash
git clone https://github.com/arnavprabhu/pi-swarm.git
cd pi-swarm
npm install
npm run build
```

### Authenticate

You have two options. Pick one.

**Option A — pi login (recommended):**

```bash
pi /login
```

Follow the prompts to sign in. pi-swarm will automatically use whatever provider and model you set up.

**Option B — API key in .env:**

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in your provider, model, and API key:

```env
PROVIDER=google
MODEL=gemini-3-flash-preview
GEMINI_API_KEY=your-key-here
```

You can get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

---

## Part 2: Your First Swarm

Run the basic example:

```bash
npx tsx examples/basic-orchestration.ts
```

### What's happening

1. A **Swarm** is created with a $2.00 budget
2. The **Orchestrator (CEO)** receives the task: _"Build a REST API endpoint that returns a paginated list of users"_
3. The CEO decides this is a dev task and delegates to the **CTO**
4. The CTO spawns two workers: a **Backend Engineer** and a **QA Engineer**
5. Both workers do their thing and report back
6. The CTO synthesizes their work and reports to the CEO
7. The CEO produces a final summary

### Reading the output

You'll see three things in your terminal:

**1. Live progress** — colored lines showing what each agent is doing in real time:

```
[Orchestrator] Build a REST API endpoint...
[Orchestrator] → Delegating to CTO (dev)...
  [CTO] Spawning Backend Engineer...
    [Backend Engineer] ✓ Complete (7.2s) (4141 chars)
```

**2. Team tree** — an ASCII tree showing every agent, how long it took, what model it used, and how much it cost:

```
Dev Team | 429d8097 | 65.2s | total: $0.0023
◆ Orchestrator 💰 $0.0023 gemini-3-flash-preview 65.2s
└── ◆ CTO 💰 $0.0012 gemini-3-flash-preview 32.3s
    ├── ◆ Backend Engineer 💰 $0.0006 gemini-3-flash-preview 7.2s
    └── ◆ QA Engineer 💰 $0.0005 gemini-3-flash-preview 14.0s
```

**3. CEO Summary** — the orchestrator's final synthesis of everything the team produced.

### Verify it worked

Check for these signs of a successful run:
- Green `◆` icons next to each agent (not red `✗`)
- A cost that's greater than $0.0000
- A CEO Summary with actual content (not empty or an error message)

---

## Part 3: Run a Full Company

The full-company example engages all 5 teams on quarterly planning:

```bash
npx tsx examples/full-company.ts
```

This sends a multi-part directive to the CEO:

- **Product (CPO):** Define top 3 Q2 priorities
- **Engineering (CTO):** Estimate capacity and identify tech debt
- **Marketing (CMO):** Plan the Q2 campaign calendar
- **Operations (COO):** Review budget and headcount
- **GTM (CRO):** Set revenue targets and pipeline opportunities

The CEO delegates to all 5 team leads, each of whom spawns their own workers. You'll see a much larger tree at the end with 5+ branches.

> **Tip:** This example uses more tokens. If you're on a free API tier with rate limits, you may see some 503 errors — just wait a minute and try again.

---

## Part 4: Build Your Own Swarm

Now let's write something from scratch. Create a new file:

```bash
touch my-swarm.ts
```

### Step 1: Basic orchestration

Open `my-swarm.ts` and add:

```typescript
import { Swarm } from "./src/index.js";

async function main() {
  const swarm = new Swarm({
    name: "My First Swarm",
    costBudget: 1.0,
  });

  const result = await swarm.run(
    "Write a technical blog post about WebSocket vs Server-Sent Events. " +
    "Include code examples and a comparison table."
  );

  console.log("\n--- Result ---");
  console.log(result.companyStatus);
  console.log(`Cost: $${result.totalCost.toFixed(4)}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
}

main().catch(console.error);
```

Run it:

```bash
npx tsx my-swarm.ts
```

The CEO will figure out which teams to involve (probably Product for the writing, Dev for code examples) and delegate automatically.

### Step 2: Mix models across tiers

You don't have to use the same model for every agent. Use a smart model for the CEO, a balanced one for leads, and a fast one for workers:

```typescript
const swarm = new Swarm({
  name: "Mixed Models",
  orchestratorModel: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  teamLeadModel:     { provider: "openai",    model: "gpt-4o" },
  workerModel:       { provider: "groq",      model: "llama-3.3-70b-versatile" },
  costBudget: 3.0,
});
```

> **Note:** Each provider needs its own API key set up via `pi /login` or in your `.env` file.

### Step 3: Add context

The second argument to `run()` is context — background information that every agent in the hierarchy receives:

```typescript
const result = await swarm.run(
  "Plan and build an onboarding flow for new users",
  "B2B SaaS, 500 customers, React frontend, Node.js backend, PostgreSQL database."
);
```

### Step 4: Silent mode

If you're using pi-swarm programmatically and don't want terminal output:

```typescript
const result = await swarm.run(
  "Analyze our API performance",
  undefined,
  { showProgress: false, showTree: false }
);

// Just use the result object
console.log(JSON.stringify(result, null, 2));
```

---

## Part 5: Define Custom Teams

The built-in 5-team structure is just the default. You can define any team structure you want.

Create `my-custom-team.ts`:

```typescript
import { Swarm, envModelConfig } from "./src/index.js";
import type { SwarmConfig, TeamConfig } from "./src/types.js";

// Resolve model from .env or pi auth
const PLACEHOLDER = { provider: "anthropic" as any, model: "placeholder" };
const model = envModelConfig() ?? PLACEHOLDER;

// Define a Data Science team
const dataTeam: TeamConfig = {
  lead: {
    id: "data-lead",
    name: "Data Science Lead",
    tier: "team-lead",
    team: "data",
    role: "data_lead",
    model,
    maxTurns: 8,
    systemPrompt:
      "You lead the data science team. Break down analytical problems, " +
      "delegate to your analysts, and synthesize findings.",
  },
  workers: [
    {
      id: "ml-engineer",
      name: "ML Engineer",
      tier: "worker",
      team: "data",
      role: "ml_engineer",
      model,
      maxTurns: 3,
      systemPrompt:
        "You are an ML engineer. Design model architectures, " +
        "write training pipelines, and evaluate model performance.",
    },
    {
      id: "data-analyst",
      name: "Data Analyst",
      tier: "worker",
      team: "data",
      role: "data_analyst",
      model,
      maxTurns: 3,
      systemPrompt:
        "You are a data analyst. Run exploratory analysis, " +
        "build visualizations, and find actionable insights.",
    },
  ],
};

// Build the full config
const config: SwarmConfig = {
  name: "Data Lab",
  orchestrator: {
    id: "lab-director",
    name: "Lab Director",
    tier: "orchestrator",
    role: "lab_director",
    systemPrompt: "",  // The framework fills in the orchestrator's prompt
    model,
    maxTurns: 15,
  },
  teams: { data: dataTeam },
  defaults: {
    orchestratorModel: model,
    teamLeadModel: model,
    workerModel: model,
  },
  costBudget: 2.0,
};

async function main() {
  const swarm = new Swarm({ config });

  const result = await swarm.run(
    "Analyze customer churn patterns and recommend retention strategies. " +
    "Build a predictive model spec and an executive dashboard design."
  );

  console.log("\n--- Lab Director Summary ---");
  console.log(result.companyStatus);
}

main().catch(console.error);
```

Run it:

```bash
npx tsx my-custom-team.ts
```

You'll see your custom Lab Director → Data Science Lead → ML Engineer + Data Analyst hierarchy in the tree.

---

## Part 6: Use as a pi Extension

If you use pi's interactive CLI, you can load pi-swarm as an extension:

```bash
pi -e ./dist/extension.js
```

Then use slash commands:

```
/swarm Plan a landing page with email signup and A/B testing
/swarm-config
/swarm-status
```

The extension reads your model from pi's active session — no extra config needed.

---

## Troubleshooting

### 503 errors

This usually means your API provider is rate-limiting you. Common with Gemini's free tier. Wait a minute and try again, or switch to a provider with higher limits.

### "No API key found"

Make sure you've either:
- Run `pi /login` and completed authentication, or
- Set `PROVIDER`, `MODEL`, and the matching API key in your `.env` file

### "Cannot find module" errors

Run `npm run build` — the TypeScript needs to be compiled before it can be used.

### Extension crashes when typing "/"

Make sure you're on the latest version:

```bash
git pull
npm install
npm run build
```

### Agents complete but output is empty

Check that your model has enough quota. Some free tiers return empty responses when rate-limited instead of throwing an error.

---

## Next Steps

- Read the [API Reference](./README.md#api-reference) for the full SDK surface
- Look at the [examples/](./examples/) directory for working code
- Define your own teams tailored to your use case
- Try mixing different models across tiers to optimize for cost vs. quality
