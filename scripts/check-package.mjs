import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "pi-swarm-package-"));
const npm = (args, cwd = process.cwd()) => execFileSync("npm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
npm(["run", "build"]);
const [packed] = JSON.parse(npm(["pack", "--ignore-scripts", "--json", "--pack-destination", temp]));
assert.ok(packed.files.some(file => file.path === "dist/extension.js"));
assert.ok(packed.files.some(file => file.path === "dist/index.d.ts"));
assert.ok(packed.files.some(file => file.path === "skills/orchestrate/SKILL.md"));
npm(["init", "-y"], temp);
npm(["install", "--no-audit", "--no-fund", join(temp, packed.filename)], temp);
execFileSync(process.execPath, ["--input-type=module", "-e", `
  import assert from "node:assert/strict";
  import { Swarm } from "pi-swarm";
  import extension from "pi-swarm/dist/extension.js";
  assert.equal(typeof Swarm, "function");
  assert.equal(typeof extension, "function");
`], { cwd: temp, stdio: "inherit" });
console.log("Packed SDK and extension install passed:", temp);

// Build a disposable Git fixture from current sources, without committing in the user's repository.
const source = join(temp, "source");
mkdirSync(source);
for (const path of ["src", "skills", "assets", "package.json", "package-lock.json", "tsconfig.json", ".gitignore", "README.md", "TUTORIAL.md", "LICENSE"]) {
  cpSync(path, join(source, path), { recursive: true });
}
const git = args => execFileSync("git", args, { cwd: source, stdio: "pipe" });
git(["init", "--quiet"]);
git(["add", "."]);
git(["-c", "user.name=Package Test", "-c", "user.email=package-test@example.invalid", "commit", "--quiet", "--no-gpg-sign", "-m", "Package fixture"]);
const consumer = join(temp, "git-consumer");
mkdirSync(consumer);
npm(["init", "-y"], consumer);
npm(["install", "--no-audit", "--no-fund", "git+file://" + source], consumer);
execFileSync(process.execPath, ["--input-type=module", "-e", 'import { Swarm } from "pi-swarm"; if (typeof Swarm !== "function") process.exit(1);'], { cwd: consumer, stdio: "inherit" });
console.log("Git dependency preparation and import passed.");
