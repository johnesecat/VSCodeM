/**
 * World generation — mirrors world/gen/PSWorldGen.java:
 *   registerTilledPatch   -> RarityFilter(160), SQUARE, MOTION_BLOCKING_HEIGHTMAP, BIOME
 *   registerUnTilledPatch -> RarityFilter(20),  SQUARE, MOTION_BLOCKING_HEIGHTMAP, BIOME
 *   juniper tree          -> CountExtra(1, 0.05, 2) on dry+hill/forest biomes
 * Bedrock has no data-driven tree feature, so juniper places saplings which the
 * script grows (scripts/lib/crops.js sapling handler).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BP = path.join(ROOT, "behavior_pack");

const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
};

// Biome predicates from PSWorldGen.java (Java biome tags -> Bedrock biome tags)
const OVERWORLD = { any_of: [{ test: "has_biome_tag", subject: "self", operator: "==", value: "overworld" }] };
const PATCHES = [
  // registerTilledPatch(id, crop, requireWater, config) — cold|is_hill|is_forest|plains
  { id: "cannabis", block: "psychedelicraft:cannabis", rarity: 160, biomes: ["cold", "hills", "forest", "plains"], tilled: true },
  { id: "hop", block: "psychedelicraft:hop", rarity: 160, biomes: ["cold", "hills", "forest", "plains"], tilled: true },
  { id: "tobacco", block: "psychedelicraft:tobacco", rarity: 160, biomes: ["cold", "hills", "forest", "plains"], tilled: true },
  { id: "coffea", block: "psychedelicraft:coffea", rarity: 160, biomes: ["cold", "hills", "forest", "plains"], tilled: true },
  { id: "coca", block: "psychedelicraft:coca", rarity: 160, biomes: ["cold", "hills", "forest", "plains"], tilled: true },
  // registerUnTilledPatch — explicit biome keys / tags
  { id: "morning_glory", block: "psychedelicraft:morning_glory", rarity: 20, biomes: ["flower_forest", "plains", "meadow", "lush_caves"] },
  { id: "belladonna", block: "psychedelicraft:belladonna", rarity: 20, biomes: ["roofed_forest"] },
  { id: "jimsonweed", block: "psychedelicraft:jimsonweed", rarity: 20, biomes: ["jungle", "sparse_jungle"] },
  { id: "tomato", block: "psychedelicraft:tomatoes", rarity: 20, biomes: ["forest"] },
  { id: "peyote", block: "psychedelicraft:peyote", rarity: 20, biomes: ["savanna", "mesa", "desert"] },
  { id: "agave", block: "psychedelicraft:agave_plant", rarity: 20, biomes: ["mesa", "desert"] },
  // juniper tree: CountExtra(1, 0.05, 2) over dry + (hills|forest)
  { id: "juniper", block: "psychedelicraft:juniper_sapling", rarity: 4, biomes: ["desert", "mesa", "savanna", "hills", "forest"], tree: true },
];

for (const patch of PATCHES) {
  writeJson(path.join(BP, "features", `${patch.id}_patch.json`), {
    format_version: "1.13.0",
    "minecraft:single_block_feature": {
      description: { identifier: `psychedelicraft:${patch.id}_patch` },
      places_block: {
        name: patch.block,
      },
      enforce_placement_rules: true,
      enforce_survivability_rules: true,
      may_replace: ["minecraft:air"],
    },
  });

  writeJson(path.join(BP, "feature_rules", `${patch.id}_patch_rule.json`), {
    format_version: "1.21.10",
    "minecraft:feature_rules": {
      description: {
        identifier: `psychedelicraft:${patch.id}_patch_rule`,
        places_feature: `psychedelicraft:${patch.id}_patch`,
      },
      conditions: {
        placement_pass: "after_surface_pass",
        "minecraft:biome_filter": [
          OVERWORLD,
          ...patch.biomes.map((b) => ({
            any_of: [
              { test: "has_biome_tag", subject: "self", operator: "==", value: b },
            ],
          })),
        ],
      },
      distribution: {
        iterations: 1,
        coordinate_eval_order: "zyx",
        x: { distribution: "uniform", extent: [0, 16] },
        y: "q.heightmap(v.worldx, v.worldz)",
        z: { distribution: "uniform", extent: [0, 16] },
        // Java RarityFilter(1/N) -> Bedrock scatter_chance percentage (0-100)
        scatter_chance: Math.round((100 / patch.rarity) * 1000) / 1000,
      },
    },
  });
}

console.log(`worldgen: ${PATCHES.length} features + rules written`);
