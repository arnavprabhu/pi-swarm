---
description: Delegate analysis and text generation to pi-swarm specialists
---

# Orchestrate

Use `swarm_delegate` for tasks that benefit from several specialist perspectives.

Workers analyze the supplied task and context and return text. They cannot browse, read or write project files, or execute code. Supply relevant facts or code in `context`; do not claim that the swarm performed external actions.

The CEO selects configured teams. Leads discover their configured workers, delegate analysis, and report back. The CEO returns a synthesis.

Inside pi, all tiers inherit the active provider, model, and thinking level. Use `/model` to select an available model and `/swarm-config` to verify it. The tested OpenAI Codex setup is `openai-codex/gpt-5.6-luna`, authenticated through pi's `/login`. Model availability depends on the configured provider and account; see the README for current alternatives and SDK per-tier examples.

Tool parameters:
- `task`: required task description.
- `context`: optional supporting information.
- `budget`: optional dollar threshold using pi's reported usage and pricing. In-flight requests may exceed it.

Commands:
- `/swarm <task>`: start a task using pi's active model.
- `/swarm-config`: inspect configuration.
- `/swarm-status`: inspect the active run or last result.
- `/swarm-cancel`: cancel the run and descendants.

Check the cycle status and worker failures before treating a result as complete. There is no `swarm_status` tool.

Example: `/swarm Draft a product-launch plan and identify engineering, marketing, and support dependencies.`
