import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { AssistantMessageEventStream } from "@earendil-works/pi-ai";
import { Swarm, createDefaultConfig, createSwarmAgent, envModelConfig, runOneShot } from "../dist/index.js";
import extension from "../dist/extension.js";
import { RunContext } from "../dist/runtime.js";

const usage = { input: 10, output: 5, cacheRead: 2, cacheWrite: 3, totalTokens: 20,
  cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 } };
const call = (name, args) => ({ type: "toolCall", id: crypto.randomUUID(), name, arguments: args });
const finish = (summary = "Final synthesis") => [call("finish_cycle", { summary })];
const modelConfig = id => ({ provider: "test-provider", model: id });
const quiet = { showProgress: false, showTree: false };
async function until(condition) {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "Timed out waiting for background command");
    await delay(1);
  }
}

function harness(handler, wait = 1) {
  const requests = [];
  let active = 0, peak = 0;
  const models = new Map(["root", "lead", "worker", "alternate"].map(id => [id, {
    id, provider: "test-provider", api: "openai-responses", name: id, baseUrl: "https://unused.invalid",
    reasoning: false, input: ["text"], contextWindow: 10000, maxTokens: 1000,
    cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.2 },
  }]));
  const streamFn = (model, context, options) => {
    const stream = new AssistantMessageEventStream();
    const request = { model, context, options };
    requests.push(request);
    active++; peak = Math.max(peak, active);
    void (async () => {
      let result;
      try {
        await delay(wait, undefined, { signal: options.signal });
        result = await handler(request);
      } catch (error) {
        result = { content: [], stopReason: options.signal.aborted ? "aborted" : "error", errorMessage: String(error) };
      }
      active--;
      const content = Array.isArray(result) ? result : result.content ?? [];
      const message = {
        role: "assistant", api: model.api, provider: model.provider, model: model.id,
        content, usage: structuredClone(usage),
        stopReason: content.some(b => b.type === "toolCall") ? "toolUse" : "stop",
        timestamp: Date.now(), ...(Array.isArray(result) ? {} : result),
      };
      stream.push(message.stopReason === "error" || message.stopReason === "aborted"
        ? { type: "error", reason: message.stopReason, error: message }
        : { type: "done", reason: message.stopReason, message });
      stream.end(message);
    })();
    return stream;
  };
  const modelRegistry = {
    find: (provider, id) => provider === "test-provider" ? models.get(id) : undefined,
    getAvailable: () => [...models.values()],
    getProvider: () => ({ streamSimple: streamFn }),
    getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "offline-test" }),
  };
  return { requests, modelRegistry, streamFn, peak: () => peak, active: () => active };
}

function config() {
  const cfg = createDefaultConfig("Test swarm", {
    orchestratorModel: modelConfig("root"), teamLeadModel: modelConfig("lead"), workerModel: modelConfig("worker"),
  });
  cfg.teams = Object.fromEntries(["alpha", "beta"].map(team => [team, {
    lead: { id: team, name: team, tier: "team-lead", team, role: "lead",
      systemPrompt: "CUSTOM LEAD " + team, model: modelConfig("lead"), maxTurns: 5 },
    workers: [{ id: "specialist", name: "Specialist", tier: "worker", team, role: "custom",
      systemPrompt: "CUSTOM WORKER " + team, model: modelConfig("worker"), maxTurns: 3 }],
  }]));
  return cfg;
}
function standard({ model, context }) {
  const turn = context.messages.filter(m => m.role === "assistant").length;
  if (model.id === "worker") return [{ type: "text", text: "Worker evidence" }];
  if (model.id === "lead") {
    if (!turn) return [call("list_workers", {})];
    if (turn === 1) return [call("spawn_worker", { workerId: "specialist", task: "Analyze", context: "Evidence context" })];
    return [call("report_to_orchestrator", { summary: "Team summary", body: "Worker evidence" })];
  }
  if (!turn) return [call("broadcast", { teams: ["alpha", "beta"], task: "Analyze" })];
  if (turn === 1) return [call("delegate_task", { team: "alpha", task: "Recheck" })];
  if (turn === 2) return [call("collect_reports", {})];
  return finish();
}

test("custom delegation, repeated runs, terminal reports, usage, and concurrency", async () => {
  for (const limit of [1, 2]) {
    const h = harness(standard);
    const cfg = config(); cfg.maxConcurrentAgents = limit;
    const result = await new Swarm({ config: cfg }).run("Analyze", undefined, { ...quiet, modelRegistry: h.modelRegistry });
    assert.equal(result.status, "completed");
    assert.equal(result.companyStatus, "Final synthesis");
    assert.equal(result.delegations.length, 3);
    assert.equal(new Set(result.delegations.map(d => d.executionId)).size, 3);
    assert.equal(h.peak(), limit);
    assert.equal(h.active(), 0);
    assert.equal(h.requests.length, 16);
    assert.ok(Math.abs(result.totalCost - usage.cost.total * 16) < 1e-10);
    for (const lead of result.delegations) {
      assert.equal(lead.workers.length, 1);
      assert.equal(lead.workers[0].output, "Worker evidence");
      assert.equal(lead.workers[0].tokensUsed.input, 15);
      assert.ok(Math.abs(lead.cost.total - usage.cost.total * 3) < 1e-10);
      assert.ok(Math.abs(lead.teamCost - usage.cost.total * 4) < 1e-10);
    }
    assert.ok(h.requests.some(r => r.context.systemPrompt.includes("CUSTOM WORKER alpha")));
  }
});

test("worker errors retain partial results and billed usage", async () => {
  const h = harness(r => r.model.id === "worker"
    ? { stopReason: "error", errorMessage: "Provider unavailable", content: [] } : standard(r));
  const result = await new Swarm({ config: config() }).run("Analyze", undefined, { ...quiet, modelRegistry: h.modelRegistry });
  assert.equal(result.status, "partial");
  assert.equal(result.delegations.length, 3);
  assert.equal(result.delegations[0].workers[0].status, "failed");
  assert.equal(result.delegations[0].workers[0].cost.total, usage.cost.total);
  assert.ok(result.totalCost > 0);
});

test("explicit finish stops mixed tool batches and prevents further delegation", async () => {
  const h = harness(() => [
    call("collect_reports", {}), ...finish(),
    call("delegate_task", { team: "alpha", task: "Must not execute" }),
  ]);
  const result = await new Swarm({ config: config() }).run("Analyze", undefined, { ...quiet, modelRegistry: h.modelRegistry });
  assert.equal(result.status, "completed");
  assert.equal(result.companyStatus, "Final synthesis");
  assert.equal(result.delegations.length, 0);
  assert.equal(h.requests.length, 1);
});

test("zero budget dispatches nothing; reaching a budget cancels the cycle", async () => {
  for (const budget of [0, 0.005]) {
    const h = harness(standard, 3);
    const cfg = config(); cfg.costBudget = budget;
    const result = await new Swarm({ config: cfg }).run("Analyze", undefined, { ...quiet, modelRegistry: h.modelRegistry });
    assert.equal(result.status, "budget_exceeded");
    assert.equal(h.active(), 0);
    assert.ok(h.requests.length <= (budget === 0 ? 0 : 3));
    assert.ok(Math.abs(result.totalCost - h.requests.length * usage.cost.total) < 1e-10);
  }
});

test("cancellation settles streaming and queued requests", async () => {
  const controller = new AbortController();
  const h = harness(standard, 10);
  const cfg = config(); cfg.maxConcurrentAgents = 1;
  const work = new Swarm({ config: cfg }).run("Analyze", undefined, { ...quiet, modelRegistry: h.modelRegistry, signal: controller.signal,
    onProgress: message => { if (message === "beta: working") controller.abort(); },
  });
  const result = await work;
  assert.equal(result.status, "cancelled");
  assert.equal(h.active(), 0);
  const count = h.requests.length;
  await delay(15);
  assert.equal(h.requests.length, count);
});

test("turn limit prevents another request and retains completed workers", async () => {
  const h = harness(standard);
  const cfg = config(); cfg.teams.alpha.lead.maxTurns = 2;
  const result = await new Swarm({ config: cfg }).run("Analyze", undefined, { ...quiet, modelRegistry: h.modelRegistry });
  assert.equal(result.status, "turn_limit");
  const lead = result.delegations.find(d => d.agentId === "alpha");
  assert.equal(lead.workers[0].success, true);
  assert.equal(lead.status, "turn_limit");
});

test("unknown teams are rejected; invalid tool arguments cannot dispatch children", async () => {
  for (const args of [{ team: "dev", task: "Do it" }, { team: "alpha" }]) {
    const h = harness(({ context }) => context.messages.some(m => m.role === "assistant")
      ? finish() : [call("delegate_task", args)]);
    const result = await new Swarm({ config: config() }).run("Analyze", undefined, { ...quiet, modelRegistry: h.modelRegistry });
    assert.equal(result.delegations.length, 0);
    assert.equal(h.requests.length, 2);
    assert.ok(h.requests[1].context.messages.some(m => m.role === "toolResult" && m.isError));
  }
});

test("empty and truncated responses fail; invalid models and config fail clearly", async () => {
  for (const response of [[], { content: [{ type: "text", text: "cut off" }], stopReason: "length" }]) {
    const h = harness(() => response);
    const result = await runOneShot({ agentId: "one", systemPrompt: "", model: modelConfig("worker"), modelRegistry: h.modelRegistry }, "Test");
    assert.equal(result.success, false);
  }
  const h = harness(standard);
  await assert.rejects(createSwarmAgent({ agentId: "one", systemPrompt: "", model: modelConfig("missing"), modelRegistry: h.modelRegistry }), /Unknown model/);
  for (const value of [0, -1, 1.5, Infinity, NaN]) assert.throws(() => new RunContext({}, value), /positive integer/);
  for (const value of [-1, Infinity, NaN]) assert.throws(() => new RunContext({}, 1, value), /nonnegative/);
  const cfg = config(); cfg.orchestrator.maxTurns = 0;
  await assert.rejects(new Swarm({ config: cfg }).run("test", undefined, quiet), /maxTurns/);
});

test("environment model defaults are read at invocation time", () => {
  const saved = { PROVIDER: process.env.PROVIDER, MODEL: process.env.MODEL };
  try {
    process.env.PROVIDER = "custom"; process.env.MODEL = "first";
    assert.equal(envModelConfig().model, "first");
    process.env.MODEL = "second";
    assert.equal(envModelConfig().model, "second");
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

function extensionHarness(h) {
  const commands = new Map(), events = new Map(), tools = new Map(), messages = [], updates = [], notifications = [];
  extension({
    registerCommand: (name, definition) => commands.set(name, definition),
    registerTool: definition => tools.set(definition.name, definition),
    on: (name, handler) => events.set(name, handler),
    getThinkingLevel: () => "low",
    sendMessage: async (message, options) => messages.push({ message, options }),
    sendUserMessage: () => assert.fail("Must not trigger another model turn"),
  });
  const ctx = { model: h.modelRegistry.find("test-provider", "root"), modelRegistry: h.modelRegistry, mode: "tui",
    ui: { notify: message => notifications.push(message), setStatus: (...args) => updates.push(args), setWidget: (...args) => updates.push(args) } };
  return { commands, events, tools, messages, updates, notifications, ctx };
}

test("extension inherits model/auth, delivers without another turn, and clears UI", async () => {
  const h = harness(() => finish("From active model"));
  const e = extensionHarness(h);
  await e.commands.get("swarm").handler("Analyze", e.ctx);
  await until(() => e.messages.length === 1);
  e.ctx.model = h.modelRegistry.find("test-provider", "alternate");
  await e.commands.get("swarm").handler("Again", e.ctx);
  await until(() => e.messages.length === 2);
  assert.deepEqual(h.requests.map(r => r.model.id), ["root", "alternate"]);
  assert.ok(h.requests.every(r => r.options.reasoning === "low" || r.options.thinkingLevel === "low"));
  assert.ok(e.messages.every(m => m.options.triggerTurn === false));
  assert.equal(e.messages.length, 2);
  assert.deepEqual(e.updates.at(-1), ["swarm", undefined]);
  await e.events.get("session_before_switch")();
  await e.commands.get("swarm-status").handler("", e.ctx);
  assert.match(e.notifications.at(-1), /No swarm/);
});

test("extension cancellation, busy guard, tool updates, and session reset", async () => {
  const h = harness(() => finish(), 30);
  const e = extensionHarness(h);
  const running = e.commands.get("swarm").handler("Analyze", e.ctx);
  await e.commands.get("swarm").handler("Second", e.ctx);
  await until(() => e.notifications.length > 0);
  assert.match(e.notifications.at(-1), /already running/);
  await e.commands.get("swarm-cancel").handler("", e.ctx);
  await running;
  await until(() => e.messages.length === 1);
  assert.equal(h.active(), 0);
  assert.equal(e.messages[0].message.details.status, "cancelled");
  const controller = new AbortController();
  const partial = [];
  const toolRun = e.tools.get("swarm_delegate").execute("id", { task: "Analyze" }, controller.signal, r => partial.push(r), e.ctx);
  await delay(5); controller.abort();
  await assert.rejects(toolRun, /cancelled/);
  assert.ok(partial.length > 0);
  const count = e.messages.length;
  const next = e.commands.get("swarm").handler("Again", e.ctx);
  await e.events.get("session_shutdown")();
  await next;
  assert.equal(e.messages.length, count);
});

test("TUI command returns while work is active so queued cancel can execute", async () => {
  const h = harness(() => finish(), 100);
  const e = extensionHarness(h);
  await e.commands.get("swarm").handler("Analyze", e.ctx);
  assert.equal(e.messages.length, 0);
  await e.commands.get("swarm-status").handler("", e.ctx);
  assert.match(e.notifications.at(-1), /Swarm running/);
  await e.commands.get("swarm-cancel").handler("", e.ctx);
  await until(() => e.messages.length === 1);
  assert.equal(e.messages[0].message.details.status, "cancelled");
  assert.equal(h.active(), 0);
});
