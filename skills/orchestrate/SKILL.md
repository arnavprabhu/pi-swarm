---
description: Multi-agent orchestration via pi-swarm
---

# Orchestrate

Use the pi-swarm extension to delegate complex tasks to a multi-agent team.

## Overview

pi-swarm provides a hierarchical multi-agent orchestration system:

- **Orchestrator (CEO)** — receives your high-level directive and decomposes it
- **Team Leads (C-level)** — domain experts who manage specialist workers
- **Workers** — stateless specialists that execute atomic tasks

## Tools

### `swarm_delegate`

Delegate a task to the full multi-agent pipeline.

```
Use the swarm_delegate tool to send a complex task through the orchestration pipeline.
The CEO agent will analyze the task, delegate to relevant team leads, who will spawn
specialist workers as needed.
```

**Parameters:**
- `task` (required) — The high-level task description
- `context` (optional) — Additional background or constraints
- `budget` (optional) — Maximum cost in dollars

### `swarm_status`

Get the results of the last orchestration cycle.

## Commands

- `/swarm <task>` — Quick-run a task through the pipeline
- `/swarm-config` — Show or update swarm configuration
- `/swarm-status` — Show last cycle results

## When to Use

Use pi-swarm when a task:
- Requires multiple specialized perspectives (engineering + product + marketing)
- Benefits from decomposition into sub-tasks
- Needs cross-functional coordination
- Would take one agent too long to handle alone

## Examples

```
/swarm Plan and execute a product launch for our new analytics feature

/swarm Review our codebase architecture and propose improvements across security, performance, and developer experience

/swarm Create a comprehensive go-to-market strategy for entering the European market
```
