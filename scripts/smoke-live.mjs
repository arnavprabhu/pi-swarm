import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ModelRuntime, ModelRegistry, getAgentDir, discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";
import { envModelConfig } from "../dist/env.js";

// Opt-in live check: uses existing pi credentials/settings, never prints credentials.
const modelRegistry = new ModelRegistry(await ModelRuntime.create());
let settings = {};
try { settings = JSON.parse(readFileSync(join(getAgentDir(), "settings.json"), "utf8")); } catch {}
const selected = envModelConfig() ?? (settings.defaultProvider && settings.defaultModel
  ? { provider: settings.defaultProvider, model: settings.defaultModel } : undefined);
const model = selected ? modelRegistry.find(selected.provider, selected.model) : modelRegistry.getAvailable()[0];
assert.ok(model, "No configured model available; select one with pi /model.");
const isolated = mkdtempSync(join(tmpdir(), "pi-swarm-smoke-"));
const loaded = await discoverAndLoadExtensions([resolve("dist/extension.js")], isolated, isolated);
assert.deepEqual(loaded.errors, []);
assert.equal(loaded.extensions.length, 1);
const tool = loaded.extensions[0].tools.get("swarm_delegate").definition;
console.log("Live model:", model.provider + "/" + model.id);
const reply = await tool.execute("smoke", {
  task: "Smoke test only. Delegate exactly once to dev. Tell the dev lead to spawn exactly one backend-eng worker whose task is to return SWARM_OK. The lead must report that token; then finish_cycle with SWARM_OK. Do no other work.",
  budget: 0.10,
}, AbortSignal.timeout(90_000), update => console.log(update.content[0].text), {
  model, modelRegistry, thinkingLevel: "off", mode: "text", hasUI: false,
});
const result = reply.details;
assert.equal(result.status, "completed");
assert.ok(result.delegations.some(d => d.workers?.some(w => w.success && w.output.includes("SWARM_OK"))));
assert.match(result.companyStatus, /SWARM_OK/);
console.log(JSON.stringify({ status: result.status, delegations: result.delegations.length,
  workers: result.delegations.reduce((n, d) => n + d.workers.length, 0), estimatedCost: result.totalCost, durationMs: result.duration }));
