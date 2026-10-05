/**
 * Validation suite (§33 BUILD/VALIDATE loop, §36 fuzz-safe checks):
 *  - every JSON file parses
 *  - manifests: UUID format, module entry present, dependency consistency
 *  - blocks: unique identifiers, textures/geometry resolve, custom components
 *    are registered in scripts/main.js, age states cover permutations
 *  - items: icon textures resolve, components registered
 *  - recipes: unique identifiers, all referenced items resolve (mod or vanilla)
 *  - lang coverage for every block/item
 *  - script syntax (node --check as ES modules)
 *  - drug/fluid cross references in script data modules
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const BP = path.join(ROOT, "behavior_pack");
const RP = path.join(ROOT, "resource_pack");

const errors = [];
const warnings = [];
const ok = [];

function walk(dir, ext = null, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out);
    else if (!ext || entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

// 1. JSON well-formedness
let jsonCount = 0;
for (const file of [...walk(BP, ".json"), ...walk(RP, ".json")]) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
    jsonCount++;
  } catch (e) {
    errors.push(`JSON parse: ${path.relative(ROOT, file)}: ${e.message}`);
  }
}
ok.push(`json: ${jsonCount} files parse`);

// 2. Manifests
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bpManifest = JSON.parse(fs.readFileSync(path.join(BP, "manifest.json"), "utf8"));
const rpManifest = JSON.parse(fs.readFileSync(path.join(RP, "manifest.json"), "utf8"));
for (const [name, m] of [["behavior", bpManifest], ["resource", rpManifest]]) {
  if (!uuidRe.test(m.header.uuid)) errors.push(`manifest ${name}: header uuid invalid`);
  for (const mod of m.modules) {
    if (!uuidRe.test(mod.uuid)) errors.push(`manifest ${name}: module uuid invalid (${mod.uuid})`);
    if (mod.type === "script" && !fs.existsSync(path.join(BP, mod.entry))) {
      errors.push(`manifest ${name}: script entry missing (${mod.entry})`);
    }
  }
}
if (bpManifest.dependencies.some((d) => d.uuid === rpManifest.header.uuid)) {
  ok.push("manifests: BP depends on RP header uuid");
} else {
  errors.push("manifests: BP does not reference RP pack uuid");
}
const uuids = [bpManifest.header.uuid, rpManifest.header.uuid, ...bpManifest.modules.map((m) => m.uuid), ...rpManifest.modules.map((m) => m.uuid)];
if (new Set(uuids).size !== uuids.length) errors.push("manifests: duplicate uuids");

// 3. Blocks
const terrain = JSON.parse(fs.readFileSync(path.join(RP, "textures/terrain_texture.json"), "utf8")).texture_data;
const itemTex = JSON.parse(fs.readFileSync(path.join(RP, "textures/item_texture.json"), "utf8")).texture_data;
const allScripts = walk(path.join(BP, "scripts"), ".js")
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

const blockIds = new Set();
for (const file of walk(path.join(BP, "blocks"), ".json")) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const block = data["minecraft:block"];
  const id = block?.description?.identifier;
  if (!id) {
    errors.push(`block: missing identifier (${path.basename(file)})`);
    continue;
  }
  if (blockIds.has(id)) errors.push(`block: duplicate identifier ${id}`);
  blockIds.add(id);

  const mat = block.components?.["minecraft:material_instances"]?.["*"]?.texture;
  if (mat && !terrain[mat]) errors.push(`block ${id}: texture '${mat}' not in terrain_texture.json`);
  const geoComponent = block.components?.["minecraft:geometry"];
  const geo = typeof geoComponent === "string" ? geoComponent : geoComponent?.identifier;
  if (geo && geo.startsWith("psychedelicraft:")) {
    const geoName = geo.replace("psychedelicraft:geometry.", "");
    if (!fs.existsSync(path.join(RP, `models/blocks/${geoName}.geo.json`))) {
      errors.push(`block ${id}: geometry '${geo}' missing`);
    }
  }
  for (const comp of [...(block.components?.["minecraft:custom_components"] ?? []), ...Object.keys(block.components ?? {}).filter((key) => key.startsWith("psychedelicraft:"))]) {
    if (!allScripts.includes(`"${comp}"`)) errors.push(`block ${id}: component ${comp} not registered in scripts`);
  }
  for (const perm of block.permutations ?? []) {
    const tex = perm.components?.["minecraft:material_instances"]?.["*"]?.texture;
    if (tex && !terrain[tex]) errors.push(`block ${id}: permutation texture '${tex}' not in terrain_texture.json`);
    for (const m of perm.condition.matchAll(/psychedelicraft:age'\) == (\d+)/g)) {
      const states = block.description.states?.["psychedelicraft:age"] ?? [];
      if (!states.includes(Number(m[1]))) errors.push(`block ${id}: permutation age ${m[1]} outside states`);
    }
  }
}
ok.push(`blocks: ${blockIds.size} identifiers validated`);

// 4. Items
const itemIds = new Set();
for (const file of walk(path.join(BP, "items"), ".json")) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const item = data["minecraft:item"];
  const id = item?.description?.identifier;
  if (!id) {
    errors.push(`item: missing identifier (${path.basename(file)})`);
    continue;
  }
  if (itemIds.has(id)) errors.push(`item: duplicate identifier ${id}`);
  itemIds.add(id);
  const iconComp = item.components?.["minecraft:icon"];
  const icon = typeof iconComp === "string" ? iconComp : iconComp?.textures?.default ?? iconComp?.texture;
  if (icon && !itemTex[icon]) errors.push(`item ${id}: icon texture '${icon}' not in item_texture.json`);
  for (const comp of [...(item.components?.["minecraft:custom_components"] ?? []), ...Object.keys(item.components ?? {}).filter((key) => key.startsWith("psychedelicraft:"))]) {
    if (!allScripts.includes(`"${comp}"`)) errors.push(`item ${id}: component ${comp} not registered in scripts`);
  }
}
ok.push(`items: ${itemIds.size} identifiers validated`);

// Geometry/schema regressions that syntax-only validation missed originally.
for (const file of walk(path.join(RP, "models"), ".json")) {
  const model = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!model.format_version) errors.push(`geometry ${path.relative(RP, file)}: missing format_version`);
  for (const geometry of model["minecraft:geometry"] ?? []) {
    if (!geometry.bones?.length) errors.push(`geometry ${geometry.description?.identifier}: no bones`);
    for (const bone of geometry.bones ?? []) for (const cube of bone.cubes ?? []) {
      if (Array.isArray(cube.uv) && cube.uv.length !== 2) errors.push(`geometry ${geometry.description.identifier}: box UV must have 2 coordinates`);
      if (!Array.isArray(cube.uv)) for (const face of Object.values(cube.uv ?? {})) {
        if (face.uv?.length !== 2 || face.uv_size?.length !== 2) errors.push(`geometry ${geometry.description.identifier}: invalid face UV`);
      }
    }
  }
}
const vanillaTextures = new Set(["textures/blocks/flower_pot", "textures/blocks/glass", "textures/blocks/planks_oak", "textures/blocks/planks_spruce", "textures/blocks/planks_birch", "textures/blocks/planks_jungle", "textures/blocks/planks_acacia", "textures/blocks/planks_big_oak"]);
for (const [kind, atlas] of [["terrain", terrain], ["items", itemTex]]) {
  for (const [key, entry] of Object.entries(atlas)) {
    const refs = Array.isArray(entry.textures) ? entry.textures : [entry.textures];
    for (const ref of refs) if (typeof ref === "string" && !fs.existsSync(path.join(RP, `${ref}.png`)) && !vanillaTextures.has(ref)) errors.push(`${kind} texture ${key}: missing PNG ${ref}`);
  }
}
for (const entry of JSON.parse(fs.readFileSync(path.join(RP, "textures/flipbook_textures.json"), "utf8"))) {
  if (!fs.existsSync(path.join(RP, `${entry.flipbook_texture}.png`))) errors.push(`flipbook ${entry.atlas_tile}: missing PNG`);
}
ok.push("geometry schemas, UV dimensions, texture files, and flipbook paths checked");

// 5. Recipes
const knownIds = new Set([...blockIds, ...itemIds]);
const recipeIds = new Set();
for (const file of walk(path.join(BP, "recipes"), ".json")) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [type, recipe] of Object.entries(data)) {
    if (!type.startsWith("minecraft:")) continue; // skip format_version etc.
    const rid = recipe.description?.identifier;
    if (!rid) errors.push(`recipe ${path.basename(file)}: missing identifier`);
    else if (recipeIds.has(rid)) errors.push(`recipe: duplicate identifier ${rid}`);
    else recipeIds.add(rid);

    const refs = [];
    if (type === "minecraft:recipe_shaped") {
      for (const v of Object.values(recipe.key ?? {})) if (v.item) refs.push(v.item);
      if (recipe.result?.item) refs.push(recipe.result.item);
    } else if (type === "minecraft:recipe_shapeless") {
      for (const v of recipe.ingredients ?? []) if (v.item) refs.push(v.item);
      if (recipe.result?.item) refs.push(recipe.result.item);
    } else if (type === "minecraft:recipe_furnace") {
      if (recipe.input?.item) refs.push(recipe.input.item);
      if (recipe.output) refs.push(recipe.output);
    }
    for (const ref of refs) {
      if (ref.startsWith("psychedelicraft:") && !knownIds.has(ref)) {
        errors.push(`recipe ${rid}: unknown item '${ref}'`);
      }
    }
  }
}
ok.push(`recipes: ${recipeIds.size} identifiers validated`);

// 6. Lang coverage
const lang = fs.readFileSync(path.join(RP, "texts/en_US.lang"), "utf8");
for (const id of blockIds) {
  if (!lang.includes(`tile.${id}.name=`)) warnings.push(`lang: missing block name ${id}`);
}
for (const id of itemIds) {
  if (!lang.includes(`item.${id}.name=`)) warnings.push(`lang: missing item name ${id}`);
}
ok.push("lang: coverage checked");

// Sound paths must resolve locally; event aliases reference native Bedrock events.
const sounds = JSON.parse(fs.readFileSync(path.join(RP, "sounds/sound_definitions.json"), "utf8")).sound_definitions;
for (const [id, definition] of Object.entries(sounds)) {
  for (const sound of definition.sounds) {
    const name = typeof sound === "string" ? sound : sound.name;
    if (sound.type !== "event" && !fs.existsSync(path.join(RP, `${name}.ogg`))) errors.push(`sound ${id}: missing asset ${name}.ogg`);
  }
}
for (const match of allScripts.matchAll(/["']((?:psybed|psbed):[^"']+)["']/g)) {
  if (match[1].startsWith("psbed:") && !match[1].includes("rift_jar")) errors.push(`sound: legacy namespace ${match[1]}`);
  const id = match[1].replace(/^psbed:/, "psybed:");
  // Script translation keys also use psybed; only sound-shaped IDs matter.
  if (/:(?:drug\.|block\.rift_jar\.|entity\.player\.)/.test(id) && !sounds[id]) errors.push(`sound: undefined event ${id}`);
}
ok.push("sounds: asset paths and custom event references resolve");

// 7. Script syntax
const tmpDir = path.join(ROOT, ".validate-tmp");
fs.mkdirSync(tmpDir, { recursive: true });
let scriptCount = 0;
for (const file of walk(path.join(BP, "scripts"), ".js")) {
  const tmp = path.join(tmpDir, path.basename(file) + ".mjs");
  fs.copyFileSync(file, tmp);
  try {
    execFileSync("node", ["--check", tmp], { stdio: "pipe" });
    scriptCount++;
  } catch (e) {
    errors.push(`script syntax: ${path.relative(ROOT, file)}: ${e.stderr?.toString().split("\n")[0] ?? e.message}`);
  }
}
fs.rmSync(tmpDir, { recursive: true, force: true });
ok.push(`scripts: ${scriptCount} modules syntax-check clean`);

// 8. Data module cross references
const contentJs = fs.readFileSync(path.join(BP, "scripts/data/content.js"), "utf8");
const content = JSON.parse(contentJs.slice(contentJs.indexOf("{"), contentJs.lastIndexOf("}") + 1));
const drugIds = new Set(content.drugs.map((d) => d.id));
for (const item of content.items) {
  for (const inf of item.influences ?? []) {
    if (!drugIds.has(inf[0])) errors.push(`item ${item.id}: unknown drug '${inf[0]}'`);
  }
}
for (const fluid of content.fluids) {
  if (fluid.drug && !drugIds.has(fluid.drug[0])) errors.push(`fluid ${fluid.id}: unknown drug '${fluid.drug[0]}'`);
}
for (const drug of content.drugs) {
  for (const key of Object.keys(drug.modifiers ?? {})) {
    const known = [
      "speed", "digSpeed", "sound", "breathVolume", "breathSpeed", "heartbeatVolume", "heartbeatSpeed",
      "randomJumpChance", "randomPunchChance", "weightlessness", "hungerSuppression", "headMotionInertness",
      "viewTremble", "viewWobblyness", "drowsyness", "handTremble", "doubleVision", "color", "movement",
      "contextual", "superSaturation", "desaturation", "inversion", "bloom", "motionBlur",
    ];
    if (!known.includes(key)) errors.push(`drug ${drug.id}: unknown modifier '${key}'`);
  }
}
ok.push(`data: ${content.drugs.length} drugs / ${content.fluids.length} fluids cross-checked`);

// 9. Worldgen features referenced by rules
for (const file of walk(path.join(BP, "feature_rules"), ".json")) {
  const rule = JSON.parse(fs.readFileSync(file, "utf8"))["minecraft:feature_rules"];
  const featureId = rule.description.places_feature;
  const found = walk(path.join(BP, "features"), ".json").some((f) => {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    return Object.entries(data).some(
      ([key, val]) => key.startsWith("minecraft:") && val?.description?.identifier === featureId,
    );
  });
  if (!found) errors.push(`feature_rule ${rule.description.identifier}: places unknown feature ${featureId}`);
}
ok.push("worldgen: feature rules resolve");

console.log(ok.map((l) => `  ok  ${l}`).join("\n"));
if (warnings.length) console.log(warnings.map((l) => ` WARN ${l}`).join("\n"));
if (errors.length) {
  console.log(errors.map((l) => ` FAIL ${l}`).join("\n"));
  console.log(`\nRESULT: FAIL (${errors.length} errors, ${warnings.length} warnings)`);
  process.exit(1);
}
console.log(`\nRESULT: PASS (0 errors, ${warnings.length} warnings)`);
