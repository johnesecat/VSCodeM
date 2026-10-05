/**
 * Packaging: produces Psychedelicraft-Bedrock.mcaddon — a zip containing
 * resource_pack/ and behavior_pack/ (Bedrock import format).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "Psychedelicraft-Bedrock.mcaddon");

if (fs.existsSync(OUT)) fs.rmSync(OUT);
execFileSync(
  "zip",
  ["-r", "-q", OUT, "resource_pack", "behavior_pack", "-x", "*.DS_Store", "*/source_assets/*", "behavior_pack/data/*"],
  { cwd: ROOT, stdio: "pipe" },
);
const size = fs.statSync(OUT).size;
console.log(`packaged: ${path.basename(OUT)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
