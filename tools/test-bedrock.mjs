// Run with BDS_DIR pointing to an installed Bedrock Dedicated Server.
// Uses the packaged addon in an isolated copy; never modifies existing worlds.
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(process.env.BDS_DIR ?? path.join(root, ".runtime/server"));
if (!fs.existsSync(path.join(source, "bedrock_server"))) throw new Error("Set BDS_DIR to an installed Linux Bedrock Dedicated Server.");
fs.mkdirSync(path.join(root, ".runtime"), { recursive: true });
const scratch = fs.mkdtempSync(path.join(root, ".runtime/smoke-"));
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (["worlds", "behavior_packs", "resource_packs", "development_behavior_packs", "development_resource_packs"].includes(entry.name)) continue;
  if (entry.name.endsWith(".txt") || entry.name === "server.properties" || entry.name === "permissions.json" || entry.name === "allowlist.json") continue;
  fs.cpSync(path.join(source, entry.name), path.join(scratch, entry.name), { recursive: true });
}
for (const kind of ["behavior", "resource"]) {
  const dest = path.join(scratch, `${kind}_packs`); fs.mkdirSync(dest);
  for (const name of fs.readdirSync(path.join(source, `${kind}_packs`)).filter((n) => n !== "psychedelicraft")) {
    fs.cpSync(path.join(source, `${kind}_packs`, name), path.join(dest, name), { recursive: true });
  }
}
const archive = path.join(root, "Psychedelicraft-Bedrock.mcaddon");
execFileSync("unzip", ["-q", archive, "-d", scratch]);
for (const kind of ["behavior", "resource"]) fs.renameSync(path.join(scratch, `${kind}_pack`), path.join(scratch, `${kind}_packs/psychedelicraft`));
const testMolotov = process.argv.includes("--molotov");
if (testMolotov) {
  const scripts = path.join(scratch, "behavior_packs/psychedelicraft/scripts");
  fs.copyFileSync(path.join(root, "tools/test-molotov-bedrock.js"), path.join(scripts, "test-molotov.js"));
  fs.appendFileSync(path.join(scripts, "main.js"), '\nimport "./test-molotov.js";\n');
}
// Copy only the local test fixture, never open or alter the source world.
const world = path.join(scratch, "worlds/SmokeWorld");
fs.cpSync(path.join(source, "worlds/TestWorld"), world, { recursive: true });
for (const kind of ["behavior", "resource"]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(scratch, `${kind}_packs/psychedelicraft/manifest.json`)));
  fs.writeFileSync(path.join(world, `world_${kind}_packs.json`), JSON.stringify([{ pack_id: manifest.header.uuid, version: manifest.header.version }]));
}
fs.writeFileSync(path.join(scratch, "allowlist.json"), "[]");
fs.writeFileSync(path.join(scratch, "permissions.json"), "[]");
fs.writeFileSync(path.join(scratch, "server.properties"), "online-mode=false\ntransport=nethernet\nserver-port=0\nserver-portv6=0\nlevel-name=SmokeWorld\ngamemode=creative\nallow-cheats=true\nview-distance=4\ntick-distance=4\ncontent-log-file-enabled=true\n");
const server = spawn("./bedrock_server", [], { cwd: scratch, env: { ...process.env, LD_LIBRARY_PATH: scratch }, stdio: ["pipe", "pipe", "pipe"] });
let output = "", ready = false;
function capture(chunk) {
  const text = chunk.toString(); output += text; process.stdout.write(text);
  if (!ready && output.includes("Server started.")) {
    ready = true;
    server.stdin.write("tickingarea add circle 0 80 0 2 smoke true\n");
    setTimeout(() => server.stdin.write("setblock 0 80 0 psychedelicraft:rift_jar\nsetblock 2 80 0 psychedelicraft:oak_barrel\nsetblock 4 80 0 psychedelicraft:bunsen_burner\n"), 3000);
    if (testMolotov) setTimeout(() => server.stdin.write("scriptevent psychedelicraft:test_molotov\n"), 4000);
    setTimeout(() => server.stdin.write("stop\n"), testMolotov ? 15000 : 7000);
  }
}
server.stdout.on("data", capture); server.stderr.on("data", capture);
const deadline = setTimeout(() => server.kill("SIGTERM"), 25000);
const code = await new Promise((resolve, reject) => { server.once("error", reject); server.once("close", resolve); });
clearTimeout(deadline);
const contentLogs = fs.readdirSync(scratch).filter((name) => /^ContentLog.*\.txt$/.test(name));
const content = contentLogs.map((name) => fs.readFileSync(path.join(scratch, name), "utf8")).join("\n");
fs.writeFileSync(path.join(scratch, "smoke-output.log"), output);
const failures = (output + "\n" + content).split("\n").filter((line) => /\bERROR\]|\[error\]|self-test failed|unknown command|Syntax error/i.test(line));
console.log(`Evidence: ${scratch}`);
const placed = (output.match(/\bBlock placed\b/g) ?? []).length;
if (code !== 0 || !ready || !output.includes("self-test ok") || placed !== 3 || (testMolotov && !output.includes('[Molotov live] ALL PASS (6 real projectile collisions)')) || failures.length) {
  console.error(failures.join("\n"));
  throw new Error(`Bedrock smoke test failed (exit ${code}, ready=${ready}, errors=${failures.length}, placed=${placed}).`);
}
console.log("PASS: packaged addon loads, initializes script math, and runs placed block ticks. No client rendering or player interaction certified.");
