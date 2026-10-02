#!/usr/bin/env node
/**
 * Psychedelicraft Java -> Bedrock mechanical converter.
 *
 * Every output file produced here is derived 1:1 from audited source files in
 * reference/psychedelicraft-java (commit 319a4ea). Nothing is invented: files
 * that cannot be converted mechanically are emitted as *tables* consumed by the
 * hand-written Script API modules, and are listed in docs/05-parity-matrix.md.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "reference/psychedelicraft-java", "src/main/resources");
const ASSETS = path.join(SRC, "assets/psychedelicraft");
const DATA = path.join(SRC, "data");
const RP = path.join(ROOT, "resource_pack");
const BP = path.join(ROOT, "behavior_pack");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
};
const copyFile = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
const listFiles = (dir, ext = null) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (!ext || entry.name.endsWith(ext)) out.push(full);
  }
  return out;
};

const report = { textures: 0, animated: [], lang: 0, sounds: 0, recipes: 0, loot: 0, tables: 0, skipped: [] };

// ---------------------------------------------------------------------------
// 1. TEXTURES
// ---------------------------------------------------------------------------
function convertTextures() {
  const map = { blocks: [], items: [], fluids: [], other: [] };
  for (const file of listFiles(path.join(ASSETS, "textures"), ".png")) {
    const rel = path.relative(path.join(ASSETS, "textures"), file).replace(/\\/g, "/");
    let dest;
    if (rel.startsWith("block/fluid/")) dest = path.join(RP, "textures/blocks/fluid", path.basename(rel));
    else if (rel.startsWith("block/")) dest = path.join(RP, "textures/blocks", path.basename(rel));
    else if (rel.startsWith("item/")) dest = path.join(RP, "textures/items", path.basename(rel));
    else if (rel.startsWith("fluid/")) dest = path.join(RP, "textures/fluids", path.basename(rel));
    else if (rel.startsWith("particle/") || rel.startsWith("drug/")) dest = path.join(RP, "textures/particles", path.basename(rel));
    else if (rel.startsWith("environment/")) dest = path.join(RP, "textures/environment", rel.slice("environment/".length));
    else if (rel.startsWith("gui/")) dest = path.join(RP, "textures/ui", path.basename(rel));
    else dest = path.join(RP, "textures/misc", rel);
    copyFile(file, dest);
    report.textures++;

    const name = path.basename(rel, ".png");
    if (rel.startsWith("block/")) map.blocks.push(name);
    else if (rel.startsWith("item/")) map.items.push(name);
    else if (rel.startsWith("fluid/")) map.fluids.push(name);

    // Animated texture: Java uses png + mcmeta (vertical frame strip) - identical to Bedrock flipbook.
    const mcmeta = file + ".mcmeta";
    if (fs.existsSync(mcmeta)) {
      let frames = 0;
      try {
        const meta = readJson(mcmeta);
        frames = meta?.animation?.frames ?? 0;
      } catch { /* fall through */ }
      report.animated.push({ name, frames: Number.isInteger(frames) && frames > 0 ? frames : undefined });
    }
  }

  // terrain_texture.json / item_texture.json (Bedrock atlas shortnames)
  const terrain = { texture_name: "atlas.terrain", texture_data: {} };
  for (const name of [...new Set(map.blocks)].sort()) {
    const inFluid = fs.existsSync(path.join(RP, "textures/blocks/fluid", name + ".png"));
    terrain.texture_data[name] = { textures: `textures/blocks/${inFluid ? "fluid/" : ""}${name}` };
  }
  writeJson(path.join(RP, "textures/terrain_texture.json"), terrain);

  const itemTex = { texture_name: "atlas.items", texture_data: {} };
  for (const name of [...new Set(map.items)].sort()) {
    itemTex.texture_data[name] = { textures: `textures/items/${name}` };
  }
  // Filled containers reference block textures for their fluid appearance.
  writeJson(path.join(RP, "textures/item_texture.json"), itemTex);

  // flipbook_textures.json for animated textures
  const flipbook = report.animated.map((a) => ({
    atlas_tile: a.name,
    flipbook_texture: `textures/blocks/${a.name}`,
    ticks_per_frame: 2,
    ...(a.frames ? { frames: a.frames } : {}),
    blend_frames: false,
  }));
  if (flipbook.length) writeJson(path.join(RP, "textures/flipbook_textures.json"), flipbook);
}

// ---------------------------------------------------------------------------
// 2. LANGUAGE
// ---------------------------------------------------------------------------
function convertLang() {
  const java = readJson(path.join(ASSETS, "lang/en_us.json"));
  const lines = [];
  for (const [key, value] of Object.entries(java)) {
    let out = null;
    // Java: block.psychedelicraft.<name>  ->  Bedrock: tile.psychedelicraft:<name>.name
    let m = key.match(/^block\.psychedelicraft\.(.+)$/);
    if (m) {
      out = [`tile.psychedelicraft:${m[1]}.name`, value];
      // block items share the block's display name in Bedrock
      lines.push(`item.psychedelicraft:${m[1]}.name=${String(value).replace(/=/g, "\\u003d")}`);
    }
    // Java: item.psychedelicraft.<name>   ->  Bedrock: item.psychedelicraft:<name>.name
    m = key.match(/^item\.psychedelicraft\.(.+)$/);
    if (m) out = [`item.psychedelicraft:${m[1]}.name`, value];
    // Java: fluid.psychedelicraft.<name>  ->  Bedrock: fluid.psychedelicraft:<name>.name (scripted UI labels)
    m = key.match(/^fluid\.psychedelicraft\.(.+)$/);
    if (m) out = [`fluid.psychedelicraft:${m[1]}.name`, value];
    // entity types
    m = key.match(/^entity\.psychedelicraft\.(.+)$/);
    if (m) out = [`entity.psychedelicraft:${m[1]}.name`, value];
    // everything else (gui, commands, subtitles, alcohol status) passes through
    if (!out) out = [`psybed:${key}`, value];
    lines.push(`${out[0]}=${String(out[1]).replace(/=/g, "\\u003d")}`);
  }
  fs.mkdirSync(path.join(RP, "texts"), { recursive: true });
  fs.writeFileSync(path.join(RP, "texts/en_US.lang"), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(RP, "texts/languages.json"), JSON.stringify(["en_US"], null, 2) + "\n");
  report.lang = lines.length;

  const pl = path.join(ASSETS, "lang/pl_pl.json");
  if (fs.existsSync(pl)) {
    const javaPl = readJson(pl);
    const plLines = [];
    for (const [key, value] of Object.entries(javaPl)) {
      let out = null;
      let m = key.match(/^block\.psychedelicraft\.(.+)$/);
      if (m) out = [`tile.psychedelicraft:${m[1]}.name`, value];
      m = key.match(/^item\.psychedelicraft\.(.+)$/);
      if (m) out = [`item.psychedelicraft:${m[1]}.name`, value];
      if (!out) out = [`psybed:${key}`, value];
      plLines.push(`${out[0]}=${String(out[1]).replace(/=/g, "\\u003d")}`);
    }
    fs.writeFileSync(path.join(RP, "texts/pl_PL.lang"), plLines.join("\n") + "\n");
  }
}

// ---------------------------------------------------------------------------
// 3. SOUNDS
// ---------------------------------------------------------------------------
function convertSounds() {
  const defs = {};
  for (const file of listFiles(path.join(ASSETS, "sounds"), ".ogg")) {
    const rel = path.relative(path.join(ASSETS, "sounds"), file).replace(/\\/g, "/");
    copyFile(file, path.join(RP, "sounds", rel));
    report.sounds++;
    defs[`psybed:${rel.replace(/\.ogg$/, "").replace(/\//g, ".")}`] = {
      category: "player",
      sounds: [`sounds/${rel}`],
    };
  }
  // Map PSSounds registry ids (PSSounds.java) onto the copied oggs.
  const javaSounds = readJson(path.join(ASSETS, "sounds.json"));
  for (const [id, def] of Object.entries(javaSounds)) {
    const sounds = (def.sounds || []).map((s) => {
      const name = typeof s === "string" ? s : s.name;
      const ogg = name.replace(/^psychedelicraft:/, "");
      return { name: `sounds/${ogg}`, ...(typeof s === "object" && s.stream ? { stream: true } : {}) };
    });
    defs[`psybed:${id}`] = { category: def.category || "player", sounds };
  }
  writeJson(path.join(RP, "sounds/sound_definitions.json"), defs);
}

// ---------------------------------------------------------------------------
// 4. RECIPES (vanilla types -> Bedrock JSON; custom types -> script tables)
// ---------------------------------------------------------------------------
function ingredient(java) {
  if (!java) return null;
  if (java.item) return { item: java.item.replace(/^minecraft:(air)$/, "minecraft:air") };
  if (java.tag) {
    // engine requires namespaced tags — bare "planks" is rejected as missing
    // (verified against BDS content log), so keep/derive the minecraft: prefix
    const tag = java.tag.includes(":") ? java.tag : `minecraft:${java.tag}`;
    return { tag };
  }
  return null;
}

function convertRecipes() {
  const outDir = path.join(BP, "recipes");
  const tables = { mashing: [], drying: [], fill_receptical: [], change_receptical: [], smelting_receptical: [], pour_drink: [], shapeless_fluid: [], shaped_fluid: [] };

  for (const file of listFiles(path.join(DATA, "psychedelicraft/recipes"), ".json")) {
    const rel = path.relative(path.join(DATA, "psychedelicraft/recipes"), file).replace(/\\/g, "/");
    const recipe = readJson(file);
    const id = rel.replace(/\.json$/, "");

    if (id === "juniper_boat" || id === "juniper_chest_boat") {
      // TerraformBoat items need custom vehicle entities (see docs/06) - the
      // recipes are preserved as data but not emitted as working recipes.
      if (!tables.shaped_fluid) tables.shaped_fluid = [];
      tables.shaped_fluid.push({ id: `psychedelicraft:${id}`, blocked: "boat_entity", ...recipe });
      report.tables++;
      continue;
    }

    if (recipe.type === "minecraft:crafting_shaped" || recipe.type === "psychedelicraft:crafting_shaped") {
      if (recipe.type === "psychedelicraft:crafting_shaped") {
        // BottleRecipe: fluid-aware shaped crafting handled by scripts.
        tables.shaped_fluid.push({ id: `psychedelicraft:${id}`, ...recipe });
        report.tables++;
        continue;
      }
      const key = {};
      for (const [k, v] of Object.entries(recipe.key || {})) key[k] = ingredient(v);
      writeJson(path.join(outDir, `${id}.recipe.json`), {
        format_version: "1.21.10",
        "minecraft:recipe_shaped": {
          description: { identifier: `psychedelicraft:${id}` },
          tags: ["crafting_table"],
          unlock: { context: "AlwaysUnlocked" },
          pattern: recipe.pattern,
          key,
          result: Array.isArray(recipe.result)
            ? recipe.result.map((r) => ({ item: r.item, count: r.count ?? 1 }))
            : { item: recipe.result.item, count: recipe.result.count ?? 1 },
        },
      });
      report.recipes++;
    } else if (recipe.type === "minecraft:crafting_shapeless") {
      writeJson(path.join(outDir, `${id}.recipe.json`), {
        format_version: "1.21.10",
        "minecraft:recipe_shapeless": {
          description: { identifier: `psychedelicraft:${id}` },
          tags: ["crafting_table"],
          unlock: { context: "AlwaysUnlocked" },
          ingredients: (recipe.ingredients || []).map(ingredient),
          result: { item: recipe.result.item, count: recipe.result.count ?? 1 },
        },
      });
      report.recipes++;
    } else if (recipe.type === "minecraft:smelting") {
      writeJson(path.join(outDir, `${id}.recipe.json`), {
        format_version: "1.21.10",
        "minecraft:recipe_furnace": {
          description: { identifier: `psychedelicraft:${id}` },
          tags: ["furnace", "smoker", "blast_furnace"],
          unlock: { context: "AlwaysUnlocked" },
          input: ingredient(recipe.ingredient),
          output: recipe.result,
        },
      });
      report.recipes++;
    } else {
      // Custom recipe types: preserved verbatim as data for the Script API layer.
      tables[
        {
          "psychedelicraft:mashing": "mashing",
          "psychedelicraft:drying": "drying",
          "psychedelicraft:fill_receptical": "fill_receptical",
          "psychedelicraft:change_receptical": "change_receptical",
          "psychedelicraft:smelting_receptical": "smelting_receptical",
          "psychedelicraft:pour_drink": "pour_drink",
          "psychedelicraft:shapeless_fluid": "shapeless_fluid",
        }[recipe.type]
      ]?.push({ id: `psychedelicraft:${id}`, path: rel, ...recipe });
      report.tables++;
    }
  }
  writeJson(path.join(BP, "data/psychedelicraft/recipes.json"), tables);
}

// ---------------------------------------------------------------------------
// 5. LOOT TABLES
// ---------------------------------------------------------------------------
function convertLoot() {
  // Java loot tables are preserved VERBATIM as data (Level 3 evidence) and are
  // evaluated exactly by scripts/loot.js (rolls, weights, conditions, functions,
  // fortune apply_bonus, silk-touch match_tool, table_bonus, alternatives).
  const javaTables = {};
  for (const file of listFiles(path.join(DATA, "psychedelicraft/loot_tables"), ".json")) {
    const rel = path.relative(path.join(DATA, "psychedelicraft/loot_tables"), file).replace(/\\/g, "/");
    javaTables[rel.replace(/\.json$/, "")] = readJson(file);
    // Engine-side table is emptied; drops are script-verified to avoid duplicates.
    writeJson(path.join(BP, "loot_tables", rel), { pools: [] });
    report.loot++;
  }
  writeJson(path.join(BP, "data/psychedelicraft/loot_java.json"), javaTables);

  // Chest injection tables (psychedelicraftmc:loot_tables/chests) -> preserved verbatim
  const chests = {};
  for (const file of listFiles(path.join(DATA, "psychedelicraftmc/loot_tables"), ".json")) {
    const rel = path.relative(path.join(DATA, "psychedelicraftmc/loot_tables"), file).replace(/\\/g, "/");
    chests[rel.replace(/\.json$/, "")] = readJson(file);
    report.tables++;
  }
  writeJson(path.join(BP, "data/psychedelicraft/chest_loot.json"), chests);
}

// ---------------------------------------------------------------------------
// 6. MISC DATA PRESERVED FOR THE SCRIPT LAYER
// ---------------------------------------------------------------------------
function collectMisc() {
  const misc = {};
  misc.placeable_drinks = {};
  for (const file of listFiles(path.join(DATA, "psychedelicraft/placeable_drinks"), ".json")) {
    misc.placeable_drinks[path.basename(file, ".json")] = readJson(file);
  }
  misc.tags = {};
  for (const ns of ["psychedelicraft", "minecraft", "c"]) {
    for (const file of listFiles(path.join(DATA, ns, "tags"), ".json")) {
      const rel = path.relative(path.join(DATA, ns, "tags"), file).replace(/\\/g, "/");
      misc.tags[`${ns}:${rel.replace(/\.json$/, "")}`] = readJson(file);
    }
  }
  misc.advancements = {};
  for (const file of listFiles(path.join(DATA, "psychedelicraft/advancements"), ".json")) {
    misc.advancements[path.basename(file, ".json")] = readJson(file);
  }
  misc.template_pools = {};
  const poolsDir = path.join(DATA, "psychedelicraftmc/worldgen/template_pool");
  for (const file of listFiles(poolsDir, ".json")) {
    misc.template_pools[path.basename(file, ".json")] = readJson(file);
  }
  writeJson(path.join(BP, "data/psychedelicraft/ported_data.json"), misc);
  report.tables++;
}

convertTextures();
convertLang();
convertSounds();
convertRecipes();
convertLoot();
collectMisc();

console.log(JSON.stringify(report, null, 2));
