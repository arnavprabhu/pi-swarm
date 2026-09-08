# Getting started

This tutorial uses the maintained pi 0.85.1 packages and Node.js 24+. The
practical default is `openai-codex/gpt-5.6-luna`; model IDs are resolved by
pi's installed catalog, so `/model` is authoritative. Other current catalog
examples include `openai-codex/gpt-5.6-sol`, `openai-codex/gpt-5.6-terra`,
`openai/gpt-5.6-luna`, `anthropic/claude-opus-4-8`, and
`google/gemini-3.1-pro-preview`. These are examples, not a ranking.

## 1. Install and authenticate

Use Node 24 or later:

```sh
node --version
npm ci
./node_modules/.bin/pi -e ./dist/extension.js
```

Or select the model at startup:

```sh
./node_modules/.bin/pi --provider openai-codex --model gpt-5.6-luna -e ./dist/extension.js
```

Inside pi, run `/login`, choose **ChatGPT Plus/Pro (Codex)**, then use
`/model` to select `gpt-5.6-luna`. The swarm uses pi's selected model and
thinking level for every tier. This is subscription/OAuth authentication; it
does not use `OPENAI_API_KEY`. For OpenAI API billing instead, choose the
`openai` provider and set `OPENAI_API_KEY` (see `.env.example`).

## 2. Try a task with supplied context

```text
/swarm Draft an API design for searching users by name, with pagination. Ask engineering for edge cases and product for usability concerns. Return recommendations and a test plan.
```

The CEO delegates to selected leads. Leads discover their configured workers, request analysis, and return reports. The CEO synthesizes those reports. Progress appears above the editor and in the status line.

This produces text, not repository changes. Supply relevant code or facts in the task/context when asking for analysis. Workers cannot fetch research or inspect your project themselves.

Use `/swarm-cancel` to stop, `/swarm-status` to inspect the last result, and `/swarm-config` to inspect the current model and teams.

## 3. Use a budget

Ask pi to call `swarm_delegate` with:

```json
{
  "task": "Ask engineering to outline a pagination test plan, then summarize.",
  "context": "Inputs: page >= 1, pageSize 1..100; missing page defaults to 1.",
  "budget": 0.10
}
```

The threshold uses pi's reported token usage and model pricing. Active requests may take the total beyond it. Always inspect the returned status: a budget stop is not a completed task.

## 4. Run the SDK

For examples outside pi, authenticate first with pi (`/login`) or copy
`.env.example` to `.env`. Set `PROVIDER` and `MODEL` together. The Codex
subscription setup uses the credentials stored by pi; an API-key setup uses
the provider's key environment variable.

```sh
npm run build
node examples/basic-orchestration.ts
```

`examples/custom-team.ts` demonstrates custom research and design workers. Its prompt asks for analysis of supplied facts, not live web research.

The SDK accepts a full `SwarmConfig` for custom teams and per-agent model/turn
choices. Its low-level `createSwarmAgent` factory is asynchronous because pi's
model runtime initializes asynchronously:

```ts
import { createSwarmAgent } from "pi-swarm";

const agent = await createSwarmAgent({
  agentId: "reviewer",
  systemPrompt: "Review the supplied API design and identify edge cases.",
  model: { provider: "openai-codex", model: "gpt-5.6-luna" },
});
```

Pass `{ signal: controller.signal }` as the third argument to `swarm.run` when
embedding the SDK. In pi's TUI, `/swarm-cancel` cancels the active swarm while
the command is running. See [the README](README.md) for result fields and
limits.

## 5. Verify the setup

```sh
npm test
node scripts/check-package.mjs
```

These checks do not contact a model. A successful offline test proves the delegation machinery and packaging work; it does not verify your provider credentials or model availability.

If a live run fails:

- Authentication/model failure: reselect an available model in pi; for the SDK set both `PROVIDER` and `MODEL`, or neither.
- Partial result: inspect delegation and worker errors; completed results remain attached.
- Turn limit: increase the affected agent's `maxTurns` or narrow the task.
- Budget exceeded: inspect the recorded estimate before increasing the threshold.
- Unknown team/worker: use IDs from the configured roster.
