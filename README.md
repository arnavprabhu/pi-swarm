# pi-swarm

A pi extension and TypeScript SDK for CEO → team lead → specialist worker orchestration.

Workers analyze supplied context and generate text. They do not browse, edit files, or execute commands. The five built-in teams cover engineering, product, marketing, operations, and go-to-market; custom teams work through the same pipeline.

## Install inside pi

Requires Node.js 24+ and pi 0.85.1 from the maintained `@earendil-works/pi-coding-agent` package.

```sh
npm install -g @earendil-works/pi-coding-agent@0.85.1
pi install git:github.com/arnavprabhu/pi-swarm
```

For a local checkout:

```sh
npm ci
npm test
./node_modules/.bin/pi -e ./dist/extension.js
```

Inside pi, use `/login`, select a model with `/model`, then:

```text
/swarm Draft an API design and test plan for paginated user search
/swarm-status
/swarm-config
/swarm-cancel
```

The extension inherits pi's current provider, model, thinking level, and model registry at each invocation. Progress appears in pi's UI. Results are displayed without starting another model turn. Only one swarm runs per extension instance; cancellation and session changes stop its descendants.

The `swarm_delegate` tool takes `task`, optional `context`, and optional `budget` in dollars. `/swarm` has no budget by default; use the tool or SDK to set one.

## SDK

```typescript
import { Swarm } from "pi-swarm";

const controller = new AbortController();
const swarm = new Swarm({ name: "API Review", costBudget: 0.10, maxConcurrentAgents: 2 });
const result = await swarm.run(
  "Draft an API design and identify edge cases.",
  "The endpoint searches a supplied list of users.",
  { signal: controller.signal, showProgress: false, showTree: false,
    onProgress: message => console.log(message) },
);
console.log(result.status, result.companyStatus, result.totalCost);
```

Without pi's extension context, the SDK initializes pi's model runtime lazily and uses its stored credentials and model configuration. Set both `PROVIDER` and `MODEL` in the environment or a local `.env` to choose a model; set the provider's API key or authenticate with pi. With neither set, the first authenticated model in pi's registry is used. No model-name heuristic or fabricated pricing is applied.

Per-tier overrides remain available through `orchestratorModel`, `teamLeadModel`, and `workerModel`, each accepting `{ provider, model, thinkingLevel? }`. A full `config: SwarmConfig` overrides convenience options. Execution options also accept `modelRegistry` for custom providers.

## Advanced model choices (verified September 7, 2026)

The pinned pi `0.85.1` catalog includes the following current choices. “Frontier” here means a current advanced option documented by its provider, not a benchmark ranking; availability, limits, and pricing depend on your account and route.

| Tier | pi provider/model ID | Intended use |
| --- | --- | --- |
| Frontier | `openai-codex/gpt-6-astra` | Hardest reasoning and coding; OpenAI says Astra access is still rolling out. |
| Frontier | `openai-codex/gpt-5.6-sol` | Strong option for complex professional work. |
| Frontier | `anthropic/claude-opus-4-8` | Highest-capability Claude work. |
| Frontier (preview) | `google/gemini-3.1-pro-preview` | Complex multimodal and agentic work; preview model. |
| Balanced | `openai-codex/gpt-5.6-terra` | Strong quality/cost balance. |
| Balanced | `anthropic/claude-sonnet-4-6` | General-purpose Claude work. |
| Balanced | `google/gemini-3.8-flash` | Latest stable Flash option for long-horizon coding and agents. |
| High volume | `openai-codex/gpt-5.6-luna` | Cost-sensitive, high-volume work; live-tested with pi-swarm. |
| High volume | `anthropic/claude-haiku-4-5` | Lower-latency Claude work. |
| High volume | `google/gemini-3.5-flash-lite` | Cost-efficient, high-throughput work. |

The model IDs above are present in the installed `@earendil-works/pi-ai@0.85.1` catalog. Provider references: [OpenAI model guide](https://developers.openai.com/api/docs/models/gpt), [Anthropic models overview](https://platform.claude.com/docs/en/models/overview), and [Google Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash). Google’s `gemini-3.1-pro-preview` is explicitly a preview ID; `gemini-3.8-flash` is documented as stable/GA.

`openai-codex` is pi’s login-backed provider: run `/login` and authenticate the Codex account, then choose the model in `/model`. It is not the same credential path as `openai`, which uses an OpenAI API key (for example `OPENAI_API_KEY`) and the corresponding `openai/gpt-6-astra`, `openai/gpt-5.6-sol`, `openai/gpt-5.6-terra`, or `openai/gpt-5.6-luna` IDs. Do not assume either route is enabled for every account.

Example per-tier SDK configuration:

```typescript
import { Swarm } from "pi-swarm";

const result = await new Swarm({
  orchestratorModel: { provider: "openai-codex", model: "gpt-6-astra", thinkingLevel: "xhigh" },
  teamLeadModel: { provider: "anthropic", model: "claude-sonnet-4-6", thinkingLevel: "high" },
  workerModel: { provider: "openai-codex", model: "gpt-5.6-luna", thinkingLevel: "high" },
}).run("Draft an API design and identify edge cases.");
```

## Results and limits

- `CycleResult.status`: `completed`, `partial`, `failed`, `cancelled`, `budget_exceeded`, or `turn_limit`. Check this field rather than guessing from summary text.
- `delegations` preserves every assignment, including repeated assignments to the same team. Each result has a unique `executionId` alongside its configured `agentId`, and team results include `workers`.
- Agent `cost` and `tokensUsed` cover that agent only. `teamCost` includes its workers. Cycle `totalCost` sums all reported usage once, including intermediate turns, cache reads/writes, and available usage from failed requests.
- Costs are pi's model-price estimates, not billing receipts. A budget stops new requests and cancels active work when recorded cost reaches the threshold. In-flight requests may exceed it; zero/missing provider prices cannot provide a reliable dollar cap.
- `maxConcurrentAgents` limits active model requests across all tiers, not waiting parent agents. Default: 10. It must be a positive integer.
- `maxTurns` limits model requests per agent. Defaults: 20 for the CEO, 10 for leads, 3 for workers. Explicit reports finish the agent without another request.
- Completed work remains available after failures. Invalid configuration is rejected before execution.

## Custom teams and examples

Set `config.teams` to a record of `{ lead: AgentConfig, workers: AgentConfig[] }`. Workers retain their configured IDs, prompts, models, and turn limits. Team IDs outside this roster are rejected. Each lead can discover its workers with `list_workers`.

Build first, then run examples with Node's native TypeScript support:

```sh
npm run build
node examples/basic-orchestration.ts
node examples/custom-team.ts
node examples/full-company.ts
```

These examples make model requests and have dollar thresholds configured. See [the tutorial](TUTORIAL.md).

## Migrating from 0.1

- Use Node 24+ and the `@earendil-works` pi packages. The old `@mariozechner` packages are no longer the supported extension host.
- The low-level factory is now asynchronous because pi's model runtime initializes asynchronously: `const agent = await createSwarmAgent(options)`. `Swarm.run` and `runOneShot` retain their call shapes.
- Team `cost.total` now means the lead's own cost; use `teamCost` for its subtree. Repeated delegations are no longer overwritten.
- `AgentConfig.tools` names were never implemented; nonempty lists now fail explicitly. Workers remain text-only.
- `suppressLogger` is retained as a deprecated option. Cycles no longer mutate the shared logger; `showProgress`, `showTree`, and `onProgress` control output.

## Development

```sh
npm ci
npm test
npm audit
node scripts/check-package.mjs
```

Tests use scripted streams and require no credentials. CI runs on Node 24. Public lower-level agent, role, protocol, logging, and UI exports remain available.

For an opt-in live check, run `node scripts/smoke-live.mjs`. It loads the extension with pi's loader and uses your configured model and credentials, a $0.10 reported-cost threshold, and a 90-second timeout.

[MIT](LICENSE)
