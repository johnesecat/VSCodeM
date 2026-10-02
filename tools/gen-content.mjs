/**
 * Generates Bedrock block/item definitions from tools/content-spec.mjs.
 * Age -> texture mappings are extracted from the Java blockstates + models
 * (Level 3 evidence) so visual states match the original exactly.
 */
import fs from "node:fs";
import path from "node:path";
import { BLOCKS, ITEMS, FLUIDS, DRUGS, DRYING_RECIPES } from "./content-spec.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const JAVA_ASSETS = path.join(ROOT, "reference/psychedelicraft-java/src/main/resources/assets/psychedelicraft");
const RP = path.join(ROOT, "resource_pack");
const BP = path.join(ROOT, "behavior_pack");

const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
};
const readJsonSafe = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);

// ---------------------------------------------------------------------------
// Extract per-state texture from Java blockstates/models (exact, mechanical).
// ---------------------------------------------------------------------------
function javaTextureForState(blockId, stateQuery) {
  const bs = readJsonSafe(path.join(JAVA_ASSETS, `blockstates/${blockId}.json`));
  if (!bs) return null;
  let modelName = null;
  if (bs.variants) {
    // exact match first, then tolerant match: all query parts must match key parts
    modelName = bs.variants[stateQuery]?.model;
    if (!modelName) {
      const want = stateQuery.split(",");
      for (const [key, val] of Object.entries(bs.variants)) {
        const have = key === "" ? [] : key.split(",");
        if (want.every((w) => have.includes(w)) || key === "") {
          modelName = val.model;
          break;
        }
      }
    }
  } else if (bs.multipart) {
    for (const part of bs.multipart) {
      const when = JSON.stringify(part.when ?? {});
      if (when.includes(stateQuery.split("=")[1] ?? "!!") || !part.when) {
        modelName = part.apply?.model ?? modelName;
      }
    }
  }
  if (!modelName) return null;
  const modelFile = modelName.replace(/^psychedelicraft:/, "");
  const model = readJsonSafe(path.join(JAVA_ASSETS, `models/${modelFile}.json`));
  if (!model?.textures) return null;
  let tex = Object.values(model.textures)[0];
  // resolve "#ref" indirection through the model's own texture map
  while (typeof tex === "string" && tex.startsWith("#")) {
    tex = model.textures[tex.slice(1)];
  }
  return typeof tex === "string" ? tex.split("/").pop().replace(/^psychedelicraft:/, "") : null;
}

/** Ensure a texture shortname exists in terrain_texture.json (items fallback). */
function ensureTerrainTexture(name) {
  const terrainPath = path.join(RP, "textures/terrain_texture.json");
  const terrain = readJsonSafe(terrainPath);
  if (!terrain || terrain.texture_data[name]) return;
  const resolved = resolveTexturePath(name);
  if (resolved) terrain.texture_data[name] = { textures: resolved };
  writeJson(terrainPath, terrain);
}

function ageTextures(block, top = false) {
  const out = [];
  for (let age = 0; age <= block.maxAge; age++) {
    const query = block.topState ? `age=${age},top=${top}` : `age=${age}`;
    out.push(javaTextureForState(block.id, query) ?? block.tex);
  }
  // fallback for ages the Java blockstates don't resolve: use the age-0 texture
  const first = out.find((t) => t && t !== block.tex) ?? out[0];
  return out.map((t) => t ?? first);
}

/** Resolve a texture shortname to a real path inside the resource pack. */
function resolveTexturePath(name) {
  const candidates = [
    `textures/blocks/${name}`,
    `textures/blocks/fluid/${name}`,
    `textures/items/${name}`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(RP, `${c}.png`))) return c;
  }
  // family prefix match (e.g. wine_grape_lattice -> wine_grape_lattice_0)
  for (const dir of ["textures/blocks", "textures/items"]) {
    const hit = fs.readdirSync(path.join(RP, dir)).find((f) => f.startsWith(`${name}_`) && f.endsWith(".png"));
    if (hit) return `${dir}/${hit.replace(/\.png$/, "")}`;
  }
  // vanilla textures (e.g. flower pot) referenced by Java block models
  if (name === "flower_pot" || name === "grass") return `textures/blocks/${name}`;
  return null;
}

// ---------------------------------------------------------------------------
// Geometry library (Bedrock geometry, exact texture names, Java proportions)
// ---------------------------------------------------------------------------
function geo(name, cubes, textureWidth = 16, textureHeight = 16) {
  return {
    "geometry.format_version": "1.12.0",
    "minecraft:geometry": [
      {
        description: {
          identifier: `psychedelicraft:geometry.${name}`,
          texture_width: textureWidth,
          texture_height: textureHeight,
          visible_bounds_width: 3,
          visible_bounds_height: 3,
          visible_bounds_offset: [0, 1, 0],
        },
        cubes,
      },
    ],
  };
}

const cube = (origin, size, uv = [0, 0, 16, 16], pivot = [0, 0, 0], rotation = undefined) => ({
  origin,
  size,
  uv,
  ...(pivot.some((p) => p !== 0) ? { pivot } : {}),
  ...(rotation ? { rotation } : {}),
});

function generateGeometry() {
  const dir = path.join(RP, "models/blocks");
  const crossCubes = [
    cube([-8, 0, -8], [16, 16, 0], [0, 0, 16, 16], [0, 0, 0], [0, 45, 0]),
    cube([-8, 0, -8], [16, 16, 0], [0, 0, 16, 16], [0, 0, 0], [0, -45, 0]),
  ];
  writeJson(path.join(dir, "cross.geo.json"), geo("cross", crossCubes));
  writeJson(path.join(dir, "cross_top.geo.json"), geo("cross_top", [
    ...crossCubes.map((c) => ({ ...c, origin: [-8, -16, -8] })), // lower layer rendered at y=16
    cube([-8, 8, -8], [16, 16, 0], [0, 0, 16, 16], [0, 0, 0], [0, 45, 0]),
    cube([-8, 8, -8], [16, 16, 0], [0, 0, 16, 16], [0, 0, 0], [0, -45, 0]),
  ]));
  // machines
  writeJson(path.join(dir, "mash_tub.geo.json"), geo("mash_tub", [
    cube([-8, 0, -8], [16, 2, 16], [0, 14, 16, 16]), // base
    cube([-8, 2, -8], [2, 10, 16], [0, 0, 2, 16]),
    cube([6, 2, -8], [2, 10, 16], [0, 0, 2, 16]),
    cube([-8, 2, -8], [16, 10, 2], [0, 4, 16, 14]),
    cube([-8, 2, 6], [16, 10, 2], [0, 4, 16, 14]),
    cube([-8, 12, -8], [16, 1, 16], [0, 0, 16, 2]), // rim
  ]));
  writeJson(path.join(dir, "distillery.geo.json"), geo("distillery", [
    cube([-8, 0, -8], [16, 8, 16], [0, 8, 16, 16]),
    cube([-5, 8, -5], [10, 6, 10], [0, 0, 16, 6]),
    cube([-2, 14, -2], [4, 2, 4], [0, 0, 8, 4]),
  ]));
  writeJson(path.join(dir, "flask.geo.json"), geo("flask", [
    cube([-6, 0, -6], [12, 10, 12], [0, 6, 16, 16]),
    cube([-4, 10, -4], [8, 4, 8], [0, 0, 16, 4]),
    cube([-2, 14, -2], [4, 2, 4], [0, 0, 8, 2]),
  ]));
  writeJson(path.join(dir, "barrel.geo.json"), geo("barrel", [
    cube([-8, 0, -8], [16, 14, 16], [0, 0, 16, 16]),
    cube([-8, 0, -8], [16, 1, 16], [0, 0, 16, 1]),
    cube([-8, 13, -8], [16, 1, 16], [0, 0, 16, 1]),
  ]));
  writeJson(path.join(dir, "table.geo.json"), geo("table", [
    cube([-8, 0, -8], [16, 2, 16], [0, 0, 16, 2]), // legs
    cube([-8, 2, -8], [16, 1, 16], [0, 0, 16, 2]),
    cube([-8, 3, -8], [16, 12, 16], [0, 4, 16, 16]), // frame
    cube([-6, 3, -6], [12, 12, 12], [0, 4, 16, 16]),
  ]));
  writeJson(path.join(dir, "tray.geo.json"), geo("tray", [
    cube([-8, 0, -8], [16, 2, 16], [0, 14, 16, 16]),
    cube([-8, 2, -8], [16, 1, 16], [0, 0, 16, 1]),
  ]));
  writeJson(path.join(dir, "burner.geo.json"), geo("burner", [
    cube([-5, 0, -5], [10, 2, 10], [0, 14, 16, 16]),
    cube([-3, 2, -3], [6, 8, 6], [0, 0, 12, 8]),
  ]));
  writeJson(path.join(dir, "jar.geo.json"), geo("jar", [
    cube([-5, 0, -5], [10, 12, 10], [0, 4, 16, 16]),
    cube([-3, 12, -3], [6, 3, 6], [0, 0, 12, 3]),
  ]));
  writeJson(path.join(dir, "bottle_rack.geo.json"), geo("bottle_rack", [
    cube([-8, 0, -8], [16, 16, 2], [0, 0, 16, 16]),
  ]));
  writeJson(path.join(dir, "small.geo.json"), geo("small", [
    cube([-4, 0, -4], [8, 6, 8], [0, 10, 16, 16]),
  ]));
  writeJson(path.join(dir, "lattice.geo.json"), geo("lattice", [
    cube([-8, 0, -7], [16, 16, 2], [0, 0, 16, 16]),
    cube([-7, 0, -8], [2, 16, 16], [0, 0, 2, 16]),
  ]));
  writeJson(path.join(dir, "slab.geo.json"), geo("slab", [cube([-8, 0, -8], [16, 8, 16], [0, 0, 16, 16])]));
  writeJson(path.join(dir, "stairs.geo.json"), geo("stairs", [
    cube([-8, 0, -8], [16, 8, 16], [0, 8, 16, 16]),
    cube([-8, 8, 0], [16, 8, 8], [0, 0, 16, 8]),
  ]));
  writeJson(path.join(dir, "fence_post.geo.json"), geo("fence_post", [cube([-4, 0, -4], [8, 16, 8], [0, 0, 16, 16])]));
  writeJson(path.join(dir, "door.geo.json"), geo("door", [
    cube([-8, 0, -2], [16, 16, 4], [0, 0, 16, 16]),
  ]));
  writeJson(path.join(dir, "trapdoor.geo.json"), geo("trapdoor", [cube([-8, 0, -2], [16, 16, 4], [0, 0, 16, 16])]));
  writeJson(path.join(dir, "button.geo.json"), geo("button", [cube([-2, 0, -2], [4, 2, 4], [0, 0, 4, 2])]));
  writeJson(path.join(dir, "pressure_plate.geo.json"), geo("pressure_plate", [cube([-7, 0, -7], [14, 1, 14], [0, 0, 14, 1])]));
  writeJson(path.join(dir, "sign.geo.json"), geo("sign", [cube([-8, 0, -1], [16, 12, 2], [0, 0, 16, 12])]));
  writeJson(path.join(dir, "pot.geo.json"), geo("pot", [
    cube([-4, 0, -4], [8, 5, 8], [0, 11, 16, 16]),
    cube([-3, 5, -3], [6, 2, 6], [0, 0, 12, 2]),
  ]));
}

// ---------------------------------------------------------------------------
// BLOCKS
// ---------------------------------------------------------------------------
const SOUND_MAP = {
  wood: ["wood", "wood", 1, 1],
  metal: ["metal", "metal", 1, 1],
  copper: ["copper", "copper", 1, 1],
  glass: ["glass", "glass", 1, 1],
  grass: ["grass", "grass", 1, 1],
};

const GEO_FOR_KIND = {
  mash_tub: "mash_tub", mash_tub_edge: "mash_tub", barrel: "barrel", flask: "flask",
  distillery: "distillery", bottle_rack: "bottle_rack", drying_table: "table",
  tray: "tray", bunsen_burner: "burner", rift_jar: "jar", placed_drink: "small",
  lattice: "lattice", lattice_crop: "lattice", slab: "slab", stairs: "stairs",
  fence: "fence_post", fence_gate: "fence_post", door: "door", trapdoor: "trapdoor",
  button: "button", pressure_plate: "pressure_plate", sign: "sign", pot: "pot",
  sapling: "cross", vine: "cross", crop: "cross", nightshade: "cross",
};

function blockGeometry(block) {
  if (block.geometry) return block.geometry;
  return GEO_FOR_KIND[block.kind] ?? "cross";
}

function generateBlocks() {
  for (const block of BLOCKS) {
    const usedTextures = block.maxAge != null ? ageTextures(block) : [block.tex];
    usedTextures.forEach(ensureTerrainTexture);
    const description = {
      identifier: `psychedelicraft:${block.id}`,
      menu_category: { category: block.kind === "machine" ? "construction" : "nature" },
    };

    const components = {
      "minecraft:geometry": `psychedelicraft:geometry.${blockGeometry(block)}`,
      "minecraft:material_instances": {
        "*": {
          texture: usedTextures[0],
          render_method: block.kind === "leaves" || block.kind === "crop" || block.kind === "vine" || block.kind === "lattice_crop" || block.kind === "sapling" || block.kind === "nightshade" ? "alpha_test" : "opaque",
        },
      },
      "minecraft:destructible_by_mining": { seconds_to_destroy: Math.max(0.05, (block.hardness ?? 1) / 1.5) },
      "minecraft:destructible_by_explosion": { explosion_resistance: (block.hardness ?? 1) * 5 },
    };
    if (block.light) components["minecraft:light_emission"] = block.light;
    if (SOUND_MAP[block.sound]) {
      components["minecraft:material_instances"]["*"].sound = SOUND_MAP[block.sound][0];
    }

    // collision / selection
    if (block.kind === "air_like") {
      components["minecraft:collision_box"] = { origin: [0, 0, 0], size: [0, 0, 0] };
      components["minecraft:selection_box"] = { origin: [0, 0, 0], size: [0, 0, 0] };
      components["minecraft:geometry"] = "psychedelicraft:geometry.small";
    } else if (block.kind === "crop" || block.kind === "nightshade" || block.kind === "vine" || block.kind === "sapling") {
      components["minecraft:collision_box"] = { origin: [0, 0, 0], size: [0, 0, 0] };
      components["minecraft:selection_box"] = { origin: [-4, 0, -4], size: [8, 12, 8] };
      components["minecraft:tick"] = { interval_range: [20, 20], looping: true };
    } else if (block.kind === "lattice_crop") {
      components["minecraft:tick"] = { interval_range: [20, 20], looping: true };
    } else if (block.kind === "machine") {
      // machine processing advances 20 ticks per onTick (see scripts/lib/machines.js)
      components["minecraft:tick"] = { interval_range: [20, 20], looping: true };
    }

    // states for growth stages (permutations added below)
    if (block.maxAge != null) {
      description.states = { "psychedelicraft:age": Array.from({ length: block.maxAge + 1 }, (_, i) => i) };
      if (block.topState) {
        // TobaccoPlantBlock.TOP / CoffeaPlantBlock top layer
        description.states["psychedelicraft:top"] = [false, true];
      }
    }

    // facing for machines with directional processing (distillery)
    if (block.id === "distillery") {
      description.traits = {
        "minecraft:placement_direction": {
          enabled_states: ["minecraft:cardinal_direction"],
          y_rotation_offset: 180,
        },
      };
    }

    // custom components bind behaviour implemented in behavior_pack/scripts
    const custom = [];
    if (block.kind === "machine") custom.push(`psychedelicraft:${block.machine ?? "machine"}`);
    if (block.kind === "crop") custom.push("psychedelicraft:crop");
    if (block.kind === "nightshade") custom.push("psychedelicraft:nightshade");
    if (block.kind === "vine") custom.push("psychedelicraft:vine");
    if (block.kind === "lattice_crop") custom.push("psychedelicraft:lattice_crop");
    if (block.kind === "sapling") custom.push("psychedelicraft:sapling");
    if (custom.length) components["minecraft:custom_components"] = custom;

    // permutations
    const permutations = [];
    if (block.maxAge != null) {
      const variants = block.topState
        ? [...ageTextures(block, false).map((tex, age) => ({ tex, age, top: false })), ...ageTextures(block, true).map((tex, age) => ({ tex, age, top: true }))]
        : ageTextures(block).map((tex, age) => ({ tex, age, top: null }));
      const seen = new Map();
      for (const v of variants) {
        const key = `${v.tex}|${v.top}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(v);
      }
      for (const group of [...seen.values()].sort((a, b) => a[0].age - b[0].age || Number(a[0].top) - Number(b[0].top))) {
        const conds = group.map((v) => {
          const ageCond = `q.block_state('psychedelicraft:age') == ${v.age}`;
          return v.top == null ? ageCond : `${ageCond} && q.block_state('psychedelicraft:top') == ${v.top}`;
        });
        permutations.push({
          condition: conds.join(" || "),
          components: {
            "minecraft:material_instances": {
              "*": { texture: group[0].tex, render_method: "alpha_test" },
            },
          },
        });
      }
    }
    if (block.kind === "leaves") {
      components["minecraft:material_instances"]["*"].render_method = "alpha_test";
      components["minecraft:light_dampening"] = 1;
    }

    writeJson(path.join(BP, "blocks", `${block.id}.json`), {
      format_version: "1.21.10",
      "minecraft:block": {
        description,
        components,
        ...(permutations.length ? { permutations } : {}),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------
function generateItems() {
  for (const item of ITEMS) {
    // resolve icon shortnames (block textures may be used as item icons)
    const itemTexPath = path.join(RP, "textures/item_texture.json");
    const itemTex = readJsonSafe(itemTexPath);
    if (itemTex && !itemTex.texture_data[item.tex]) {
      const resolved = resolveTexturePath(item.tex);
      if (resolved) itemTex.texture_data[item.tex] = { textures: resolved };
      writeJson(itemTexPath, itemTex);
    }
    const description = {
      identifier: `psychedelicraft:${item.id}`,
      menu_category: { category: item.kind === "food" || item.kind === "seeds" ? "nature" : "items" },
    };
    const components = {
      // 1.21.90+ schema: icon is a textures map with a "default" key
      "minecraft:icon": { textures: { default: item.tex } },
      "minecraft:display_name": { value: `item.psychedelicraft:${item.id}.name` },
      "minecraft:max_stack_size": item.maxStack ?? (item.kind === "smokeable" || item.kind === "bong" ? 1 : 64),
    };
    if (item.fuel) components["minecraft:fuel"] = { duration: item.fuel / 20 };
    if (item.kind === "food" || item.kind === "suspicious") {
      components["minecraft:food"] = {
        nutrition: item.nutrition ?? 1,
        saturation_modifier: item.saturation ?? 0.1,
        ...(item.canAlwaysEat ? { can_always_eat: true } : {}),
      };
      // engine requirement: food needs a non-zero use_duration
      components["minecraft:use_modifiers"] = { use_duration: 32, movement_modifier: 0.35 };
    }
    if (item.kind === "smokeable" || item.kind === "bong") {
      components["minecraft:durability"] = { max_durability: item.damage ?? 1 };
      components["minecraft:use_modifiers"] = { use_duration: 2.5, movement_modifier: 0.7 };
      components["minecraft:hand_equipped"] = true;
    }
    if (item.kind === "container" || item.kind === "syringe") {
      components["minecraft:use_modifiers"] = { use_duration: item.useDuration ?? 32, movement_modifier: 0.35 };
    }
    if (item.kind === "molotov") {
      components["minecraft:throwable"] = {
        launch_power_scale: 2,
        max_draw_duration: 1.5,
        min_draw_duration: 0.3,
        scale_power_by_draw_duration: true,
      };
      components["minecraft:projectile"] = { minimum_critical_power: 1.1, projectile_entity: "psychedelicraft:molotov_cocktail" };
    }

    const custom = [];
    if (item.kind === "container") custom.push("psychedelicraft:container");
    if (item.kind === "syringe") custom.push("psychedelicraft:syringe");
    if (item.kind === "smokeable") custom.push("psychedelicraft:smokeable");
    if (item.kind === "bong") custom.push("psychedelicraft:bong");
    if (item.kind === "seeds") custom.push("psychedelicraft:seeds");
    if (item.influences) custom.push("psychedelicraft:consumable");
    if (item.kind === "molotov") custom.push("psychedelicraft:molotov");
    if (item.kind === "paper_bag") custom.push("psychedelicraft:paper_bag");
    if (item.kind === "suspicious") custom.push("psychedelicraft:suspicious");
    if (custom.length) components["minecraft:custom_components"] = custom;

    writeJson(path.join(BP, "items", `${item.id}.json`), {
      format_version: "1.21.10",
      "minecraft:item": { description, components },
    });
  }
}

// ---------------------------------------------------------------------------
// DATA FOR SCRIPTS (single source of truth consumed by behavior_pack/scripts)
// ---------------------------------------------------------------------------
function generateData() {
  writeJson(path.join(BP, "data/psychedelicraft/content.json"), {
    blocks: BLOCKS,
    items: ITEMS,
    fluids: FLUIDS,
    drugs: DRUGS,
    dryingRecipes: DRYING_RECIPES,
  });
  // scripts cannot read pack JSON at runtime; emit the same data as an ES module
  const js = `// GENERATED from tools/content-spec.mjs - do not edit by hand.\nexport const CONTENT = ${JSON.stringify(
    { blocks: BLOCKS, items: ITEMS, fluids: FLUIDS, drugs: DRUGS, dryingRecipes: DRYING_RECIPES },
    null,
    2,
  )};\n`;
  fs.mkdirSync(path.join(BP, "scripts/data"), { recursive: true });
  fs.writeFileSync(path.join(BP, "scripts/data/content.js"), js);

  // custom recipe tables (converted by tools/convert-data.mjs) also need to be
  // script-readable: mashing / drying / fill_receptical / change_receptical /
  // smelting_receptical / pour_drink / shapeless_fluid / shaped_fluid
  // localization table for scripts (correct in-game naming from en_us.json)
  const lang = readJsonSafe(path.join(JAVA_ASSETS, "lang/en_us.json")) ?? {};
  const langJs = `// GENERATED from assets/psychedelicraft/lang/en_us.json - do not edit by hand.\nexport const LANG = ${JSON.stringify(lang, null, 2)};\n\nexport function translate(key) {\n  const k = key.replace(/^psybed:/, "");\n  return LANG[k] ?? LANG[\`psybed:\${k}\`] ?? key;\n}\n\nexport function formatDrinkName(drink, variation) {\n  if (!variation) return translate(\`psychedelicraft.alcohol.\${drink}\`);\n  const composed = translate(\`psychedelicraft.alcohol.\${variation}_\${drink}\`);\n  if (!composed.startsWith(\`psychedelicraft.alcohol.\`)) return composed;\n  const v = translate(\`psychedelicraft.alcohol.variation.\${variation}\`);\n  return \`\${v} \${translate(\`psychedelicraft.alcohol.\${drink}\`)}\`;\n}\n`;
  fs.writeFileSync(path.join(BP, "scripts/data/lang.js"), langJs);

  const tables = readJsonSafe(path.join(BP, "data/psychedelicraft/recipes.json")) ?? {};
  const recipesJs = `// GENERATED from data/psychedelicraft/recipes.json - do not edit by hand.\nexport const RECIPES = ${JSON.stringify(tables, null, 2)};\n`;
  fs.writeFileSync(path.join(BP, "scripts/data/recipes.js"), recipesJs);

  // verbatim Java loot tables for scripts/loot.js
  const loot = readJsonSafe(path.join(BP, "data/psychedelicraft/loot_java.json")) ?? {};
  const lootJs = `// GENERATED from data/psychedelicraft/loot_java.json (verbatim Java loot) - do not edit by hand.\nexport const LOOT_TABLES = ${JSON.stringify(loot, null, 2)};\nexport const CHEST_LOOT = ${JSON.stringify(readJsonSafe(path.join(BP, "data/psychedelicraft/chest_loot.json")) ?? {}, null, 2)};\n`;
  fs.writeFileSync(path.join(BP, "scripts/data/loot.js"), lootJs);
}

function generateLangFallbacks() {
  // display-name fallbacks for ids without a Java lang key (e.g. wall signs,
  // containers): humanized identifiers so no raw translation keys show in-game
  const langPath = path.join(RP, "texts/en_US.lang");
  const lang = fs.readFileSync(langPath, "utf8");
  const extra = [];
  const humanize = (id) => id.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  for (const block of BLOCKS) {
    if (!lang.includes(`tile.psychedelicraft:${block.id}.name=`)) extra.push(`tile.psychedelicraft:${block.id}.name=${humanize(block.id)}`);
    if (!lang.includes(`item.psychedelicraft:${block.id}.name=`)) extra.push(`item.psychedelicraft:${block.id}.name=${humanize(block.id)}`);
  }
  for (const item of ITEMS) {
    if (!lang.includes(`item.psychedelicraft:${item.id}.name=`)) extra.push(`item.psychedelicraft:${item.id}.name=${humanize(item.id)}`);
  }
  if (extra.length) fs.writeFileSync(langPath, lang + extra.join("\n") + "\n");
}

generateGeometry();
generateBlocks();
generateItems();
generateData();
generateLangFallbacks();

console.log(
  JSON.stringify(
    {
      blocks: BLOCKS.length,
      items: ITEMS.length,
      fluids: FLUIDS.length,
      drugs: DRUGS.length,
      dryingRecipes: DRYING_RECIPES.length,
    },
    null,
    2,
  ),
);
