// Crop system — port of block/CannabisPlantBlock.java, TobaccoPlantBlock.java,
// CoffeaPlantBlock.java, CocaPlantBlock.java, HopPlantBlock.java,
// NightshadeBlock.java, SucculentPlantBlock.java (PeyoteBlock/AgavePlantBlock),
// VineStemBlock.java, BurdenedLatticeBlock.java and JuniperTreeSaplingGenerator.java.
//
// Java random-tick pacing: a block receives a random tick about every
// 1365 ticks (randomTickSpeed 3). Growth success checks run on that event.
// Bedrock blocks tick on a fixed interval (TICK_CALL), so per-tick-call
// probability is scaled by TICK_CALL / 1365 to preserve real-time growth
// pacing (Level 7 pacing equivalence; per-stage probabilities transcribed
// from Java).

import { CONTENT } from "../data/content.js";
import { loadState, saveState } from "./machines.js";

export const RANDOM_TICK_INTERVAL = 1365;
const TICK_CALL = 20;

// per-tick-call probability equivalent to `perRandomTick` per Java random tick
function perTickChance(perRandomTick) {
  return (perRandomTick * TICK_CALL) / RANDOM_TICK_INTERVAL;
}

// CannabisPlantBlock.getRandomGrowthChance() = 0.12; TobaccoPlantBlock and
// CocaPlantBlock override with 0.1; HopPlantBlock inherits 0.12 (L1).
const GROWTH_CHANCE = {
  cannabis: 0.12,
  hop: 0.12,
  coca: 0.1,
  tobacco: 0.1,
  coffea: 0.1,
};

// SucculentPlantBlock.randomTick: 1/getGrowthRate(state) per random tick.
// PeyoteBlock.getGrowthRate: age < maxAge ? 20 : 120. AgavePlantBlock: 320.
function succulentRate(def, age) {
  if (def.id === "agave_plant") return 1 / 320;
  return age < def.maxAge ? 1 / 20 : 1 / 120;
}

const NIGHTSHADE_CHANCE = perTickChance(1 / 5); // NightshadeBlock.randomTick: 1/5
const LATTICE_CHANCE = perTickChance(1 / 5); // BurdenedLatticeBlock random growth

function defFor(block) {
  return CONTENT.blocks.find((b) => b.id === block.typeId.replace(/^psychedelicraft:/, ""));
}

function ageOf(block) {
  return block.permutation.getState("psychedelicraft:age") ?? 0;
}

function setAge(block, age) {
  try {
    block.setPermutation(block.permutation.withState("psychedelicraft:age", age));
  } catch {
    /* state not present */
  }
}

function topOf(block) {
  try {
    return block.permutation.getState("psychedelicraft:top") === true;
  } catch {
    return false;
  }
}

// CoffeaPlantBlock.getMaxAge: TOP ? 3 : 7. TobaccoPlantBlock.getMaxAge: 7 (both).
function maxAgeFor(def, isTop) {
  return def.id === "coffea" && isTop ? 3 : def.maxAge;
}

function isTopFamily(def) {
  return !!def.topState; // TobaccoPlantBlock / CoffeaPlantBlock (TOP property)
}

function isSucculent(def) {
  return def.id === "peyote" || def.id === "agave_plant"; // SucculentPlantBlock
}

// Java: world.getBaseLightLevel(pos.up(), 0) >= 9 (max of sky and block light)
function lightAt(block) {
  try {
    const above = block.above(1);
    const sky = above?.lightFromSky;
    const lit = above?.lightFromBlocks;
    if (sky == null && lit == null) return 15;
    return Math.max(sky ?? 0, lit ?? 0);
  } catch {
    return 15;
  }
}

function isAirAbove(block) {
  try {
    const above = block.above(1);
    return !!above && above.isAir;
  } catch {
    return false;
  }
}

// CannabisPlantBlock.getPlantSize: count of this block type stacked downward
function plantSize(block) {
  let size = 1;
  try {
    let below = block.below(1);
    while (below && below.typeId === block.typeId) {
      size++;
      below = below.below(1);
    }
  } catch {
    /* unloaded */
  }
  return size;
}

// TobaccoPlantBlock: getDefaultState().with(TOP, true); CannabisPlantBlock: getDefaultState()
function placeAbove(block, top) {
  try {
    const pos = block.above(1).location;
    block.dimension.setBlockType(pos, block.typeId);
    const placed = block.dimension.getBlock(pos);
    if (top) {
      placed.setPermutation(placed.permutation.withState("psychedelicraft:top", true));
    }
    return placed;
  } catch {
    return null;
  }
}

// Fertilizable gates:
//  TobaccoPlantBlock.isFertilizable: (isAir(up) && plantSize < maxHeight) || age < maxAge   [L1 verbatim]
//  CannabisPlantBlock: !isMature == age < maxAge || (isAir(up) && plantSize < maxHeight)     [L1 isMature +
//    getStateForNeighborUpdate GROWING derivation — enables canGrowUpwards, else unreachable]
//  SucculentPlantBlock.isFertilizable: age < maxAge                                          [L1 verbatim]
function isFertilizable(block, def) {
  const age = ageOf(block);
  if (isSucculent(def)) return age < def.maxAge;
  const maxHeight = isTopFamily(def) ? 2 : 3;
  return age < maxAgeFor(def, topOf(block)) || (isAirAbove(block) && plantSize(block) < maxHeight);
}

function applyGrowth(block, def, bonemeal) {
  if (isSucculent(def)) return succulentGrowth(block, def);
  const topFamily = isTopFamily(def);
  const maxHeight = topFamily ? 2 : 3;
  // TobaccoPlantBlock.applyGrowth: number = bonemeal ? rand(2)+1 : 1
  // CannabisPlantBlock.applyGrowth: number = bonemeal ? rand(4)+1 : 1
  const number = bonemeal ? 1 + Math.floor(Math.random() * (topFamily ? 2 : 4)) : 1;
  let cur = block;
  for (let i = 0; i < number; i++) {
    const maxAge = maxAgeFor(def, topOf(cur));
    const age = ageOf(cur);
    const freeOver = isAirAbove(cur) && plantSize(cur) < maxHeight;
    if (topFamily) {
      // TobaccoPlantBlock.applyGrowth (verbatim control flow):
      //   if (age < max) cycle age; if (freeOver && age >= max) plant TOP above
      if (age < maxAge) setAge(cur, age + 1);
      const cycled = Math.min(age + 1, maxAge);
      if (freeOver && cycled >= maxAge) {
        const placed = placeAbove(cur, true);
        if (placed) cur = placed;
      }
    } else {
      // CannabisPlantBlock.applyGrowth:
      //   if (age < max) cycle age;
      //   else if (canGrowUpwards) plant default above
      //   canGrowUpwards = isAir(up) && plantSize < maxHeight && age > MAX_AGE_WHILE_COVERED (11)
      if (age < maxAge) {
        setAge(cur, age + 1);
      } else if (freeOver && age > 11) {
        const placed = placeAbove(cur, false);
        if (placed) cur = placed;
      }
    }
  }
}

// SucculentPlantBlock.applyGrowth: cycle age, or (mature) plant a new succulent
// at a random adjacent position (4 attempts). The spread branch is unreachable
// in-game (isFertilizable requires age < maxAge) — transcribed verbatim (L1);
// upstream passes `pos` (not plantingPos) to canPlaceAt — quirk preserved.
function succulentGrowth(block, def) {
  const age = ageOf(block);
  if (age < def.maxAge) {
    setAge(block, age + 1);
    return;
  }
  for (let i = 0; i < 4; i++) {
    const dx = Math.floor(Math.random() * 3) - 1;
    const dy = Math.floor(Math.random() * 2) - Math.floor(Math.random() * 2);
    const dz = Math.floor(Math.random() * 3) - 1;
    try {
      const pos = { x: block.location.x + dx, y: block.location.y + dy, z: block.location.z + dz };
      const target = block.dimension.getBlock(pos);
      if (target && target.isAir) {
        block.dimension.setBlockType(pos, block.typeId);
        return;
      }
    } catch {
      /* unloaded */
    }
  }
}

// ---------------------------------------------------------------------------
// Cannabis family (cannabis, hop, tobacco, coca, coffea) + succulents
// (peyote, agave_plant) — CropBlock / TobaccoPlantBlock / SucculentPlantBlock
// ---------------------------------------------------------------------------

export const crop = {
  onTick(event) {
    const { block } = event;
    const def = defFor(block);
    if (!def) return;

    if (isSucculent(def)) {
      // SucculentPlantBlock.randomTick
      if (!isFertilizable(block, def)) return;
      if (Math.random() >= perTickChance(succulentRate(def, ageOf(block)))) return;
      applyGrowth(block, def, false);
      return;
    }

    // CannabisPlantBlock.randomTick:
    //   if (light(pos.up()) >= 9 && random < getRandomGrowthChance())
    //     if (isFertilizable) applyGrowth(false)
    if (Math.random() >= perTickChance(GROWTH_CHANCE[def.id] ?? 0.12)) return;
    if (lightAt(block) < 9) return;
    if (!isFertilizable(block, def)) return;
    applyGrowth(block, def, false);
  },

  // Fertilizable.grow (bone meal): applyGrowth(bonemeal = true) when fertilizable
  onPlayerInteract(event) {
    const { block, itemStack } = event;
    if (itemStack?.typeId !== "minecraft:bone_meal") return {};
    const def = defFor(block);
    if (!def || !isFertilizable(block, def)) return {};
    applyGrowth(block, def, true);
    return { consumeItem: true };
  },

  // Break drops are driven centrally from main.js (playerBreakBlock) with full
  // block states (incl. psychemod top) and held-item enchantments.
  onPlayerDestroy() {
    return {};
  },
};

// ---------------------------------------------------------------------------
// Nightshade (jimsonweed, belladonna, tomatoes) — NightshadeBlock.java
// ---------------------------------------------------------------------------
export const nightshade = {
  onTick(event) {
    const { block } = event;
    const def = defFor(block);
    const maxAge = def?.maxAge ?? 7;
    const age = ageOf(block);
    if (age >= maxAge) return;
    if (Math.random() >= NIGHTSHADE_CHANCE) return;
    if (lightAt(block) < 9) return;
    setAge(block, age + 1);
  },

  // onUse: shears (age>=1) or bone meal (age==MAX) harvest fruit/leaf 1-2 and
  // set age to age-1 (NightshadeBlock.onUse, transcribed)
  onPlayerInteract(event) {
    const { block, itemStack } = event;
    const def = defFor(block);
    const maxAge = def?.maxAge ?? 7;
    const age = ageOf(block);
    const isShears = itemStack?.typeId === "minecraft:shears";
    const isBoneMeal = itemStack?.typeId === "minecraft:bone_meal";

    if ((isShears && age >= 1) || (isBoneMeal && age === maxAge)) {
      const dropId = age === maxAge ? `psychedelicraft:${def.fruit}` : `psychedelicraft:${def.leaf}`;
      const amount = 1 + Math.floor(Math.random() * 2);
      setAge(block, Math.max(0, age - 1));
      return {
        // Java damages shears without consuming them; mature bone meal
        // harvest returns PASS and is not consumed by this handler.
        damageItem: isShears ? 1 : 0,
        drops: [{ id: dropId, amount }],
        sound: isShears ? "minecraft:mob.sheep.shear" : null,
      };
    }
    // bone meal below max: fertilize (+1)
    if (isBoneMeal && age < maxAge) {
      setAge(block, Math.min(maxAge, age + 1));
      return { consumeItem: true };
    }
    return {};
  },

  onPlayerDestroy() {
    return {};
  },
};

// ---------------------------------------------------------------------------
// Vine (morning_glory) — VineStemBlock.java (AGE 0-4)
// ---------------------------------------------------------------------------
export const vine = {
  onTick(event) {
    const { block } = event;
    const def = CONTENT.blocks.find((b) => b.id === "morning_glory");
    const maxAge = def?.maxAge ?? 4;
    const age = ageOf(block);
    if (age >= maxAge) return;
    if (Math.random() >= perTickChance(1 / 26)) return;
    setAge(block, age + 1);
  },
  onPlayerInteract() {
    return {};
  },
  onPlayerDestroy() {
    return {};
  },
};

// ---------------------------------------------------------------------------
// Burdened lattice (wine_grape_lattice, morning_glory_lattice) — AGE 0-3
// ---------------------------------------------------------------------------
export const lattice_crop = {
  onTick(event) {
    const { block } = event;
    const age = ageOf(block);
    if (age >= 3) return;
    if (Math.random() >= LATTICE_CHANCE) return;
    setAge(block, age + 1);
  },
  onPlayerInteract() {
    return {};
  },
  onPlayerDestroy() {
    return {};
  },
};

// ---------------------------------------------------------------------------
// Juniper sapling — JuniperTreeSaplingGenerator (ForkingTrunkPlacer 5/2/2,
// BlobFoliagePlacer radius 2 height 3). Bedrock has no data-driven tree
// feature, so the tree is constructed directly (Level 7 equivalent shape).
// ---------------------------------------------------------------------------
export const sapling = {
  onTick(event) {
    const { block } = event;
    const state = loadState(block);
    state.growTimer = (state.growTimer ?? 0) + TICK_CALL;
    saveState(block, state);
    if (state.growTimer < RANDOM_TICK_INTERVAL * 4) return;
    if (Math.random() >= 0.3) return;
    growJuniperTree(block);
  },
  onPlayerInteract(event) {
    if (event.itemStack?.typeId === "minecraft:bone_meal") {
      growJuniperTree(event.block);
      return { consumeItem: true };
    }
    return {};
  },
  onPlayerDestroy() {
    return {};
  },
};

function growJuniperTree(block) {
  try {
    const dim = block.dimension;
    const base = block.location;
    dim.setBlockType(base, "psychedelicraft:juniper_log");
    // ForkingTrunkPlacer(5, 2, 2): 5 tall, up to 2 forks of length 2
    for (let y = 1; y <= 5; y++) {
      dim.setBlockType({ x: base.x, y: base.y + y, z: base.z }, "psychedelicraft:juniper_log");
    }
    for (const dir of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      dim.setBlockType({ x: base.x + dir[0], y: base.y + 5, z: base.z + dir[1] }, "psychedelicraft:juniper_leaves");
    }
    // BlobFoliagePlacer(radius 2, height 3)
    for (let dy = 4; dy <= 7; dy++) {
      const r = dy <= 6 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 7) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && Math.random() < 0.5) continue;
          const pos = { x: base.x + dx, y: base.y + dy, z: base.z + dz };
          try {
            const target = dim.getBlock(pos);
            if (target && (target.isAir || target.typeId === "psychedelicraft:juniper_leaves")) {
              dim.setBlockType(pos, Math.random() < 0.12 ? "psychedelicraft:fruiting_juniper_leaves" : "psychedelicraft:juniper_leaves");
            }
          } catch {
            /* unloaded */
          }
        }
      }
    }
  } catch {
    /* dimension unloaded */
  }
}

// keys must match the custom component names emitted by tools/gen-content.mjs
export const COMPONENTS = {
  "psychedelicraft:crop": crop,
  "psychedelicraft:nightshade": nightshade,
  "psychedelicraft:vine": vine,
  "psychedelicraft:lattice_crop": lattice_crop,
  "psychedelicraft:sapling": sapling,
};
