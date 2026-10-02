// Machine system — port of block/entity/*.java (Level 1 evidence).
//   FluidProcessingBlockEntity.tick -> process loop with timeNeeded/timeProcessed
//   BarrelBlockEntity               -> MATURE process + tap animation state
//   DistilleryBlockEntity           -> DISTILL process, heat-based tick rate,
//                                      slurry byproduct, output to adjacent flask
//   MashTubBlockEntity              -> FERMENT process + ingredient tally (mashing)
//   DryingTableBlockEntity          -> heat ratio + drying progress + recipe batch
//
// State is persisted on the block (dynamic property "ps:state") so it survives
// chunk unload, world reload and server restart (persistence parity, §31).

import { world, ItemStack } from "@minecraft/server";
import {
  ProcessType,
  UNCONVERTABLE,
  VOLUMES,
  makeFluidState,
  modifyProcess,
  getProcessingTime,
  process as processFluid,
  drugInfluencesPerLiter,
  resolveVariant,
} from "./fluids.js";
import { CONTENT } from "../data/content.js";
import { RECIPES } from "../data/recipes.js";
import { formatDrinkName, translate } from "../data/lang.js";
import { clamp } from "./util.js";
import { ingredientMatches, fluidMatches, attributesOf } from "./crafting.js";

export const TICK_STEPS = 20; // blocks tick every 20 ticks (minecraft:tick interval)

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
// Block dynamic properties disappear with the block, but break/explosion
// after-events run after removal. A session-level mirror keyed by position
// keeps machine state readable at drop time (and is consumed on drop so
// contents never drop twice).
const stateMirror = new Map();

function mirrorKey(block) {
  try {
    const { x, y, z } = block.location;
    return `${block.dimension.id}:${x},${y},${z}`;
  } catch {
    return null;
  }
}

export function loadState(block) {
  try {
    const raw = world.getDynamicProperty(`ps:machine:${mirrorKey(block)}`);
    if (raw) return JSON.parse(raw);
  } catch {
    /* block removed - fall back to the mirror */
  }
  const key = mirrorKey(block);
  return (key && stateMirror.get(key)) || {};
}

export function saveState(block, state) {
  const key = mirrorKey(block);
  if (key) stateMirror.set(key, state);
  try {
    world.setDynamicProperty(`ps:machine:${key}`, JSON.stringify(state));
  } catch {
    /* dynamic property unavailable - state stays session-local (documented) */
  }
}

// load + forget: used by drop paths so contents drop exactly once
export function takeState(block) {
  const state = loadState(block);
  const key = mirrorKey(block);
  if (key) stateMirror.delete(key);
  try {
    world.setDynamicProperty(`ps:machine:${key}`, undefined);
  } catch {
    /* block removed */
  }
  return state;
}

// Tank capacities (L1): FlaskBlockEntity.FLASK_CAPACITY = BUCKET * 8 (also
// DISTILLERY_CAPACITY), mash tub = VAT, barrel = FluidVolumes.BARREL.
export function tankCapacity(kindOrId) {
  const kind = String(kindOrId).replace(/^psychedelicraft:/, "");
  if (kind === "mash_tub" || kind === "mash_tub_edge") return VOLUMES.VAT;
  if (kind === "barrel" || kind.endsWith("_barrel")) return VOLUMES.BARREL;
  if (kind === "flask" || kind === "distillery") return VOLUMES.BUCKET * 8;
  return VOLUMES.BOTTLE;
}

function dropItemAt(block, id, amount) {
  try {
    if (amount > 0) block.dimension.spawnItem(new ItemStack(id, amount), block.location);
  } catch {
    /* dimension unavailable */
  }
}

// ---------------------------------------------------------------------------
// Tank processing (FluidProcessingBlockEntity.tick)
// ---------------------------------------------------------------------------
export function tickProcessing(state, { tickRate = 1 } = {}) {
  const fluid = state.fluid;
  if (!fluid) {
    state.timeNeeded = UNCONVERTABLE;
    return { completed: false };
  }
  const type = modifyProcess(fluid, state.processType);
  const timeNeeded = getProcessingTime(fluid, type);
  state.timeNeeded = timeNeeded;
  state.activeProcess = type;

  if (timeNeeded >= 0) {
    state.timeProcessed = (state.timeProcessed ?? 0) + TICK_STEPS * tickRate;
    if (state.timeProcessed >= timeNeeded) {
      const byproduct = processFluid(fluid, type);
      state.timeProcessed = 0;
      state.timeNeeded = UNCONVERTABLE;
      return { completed: true, byproduct, type };
    }
  } else {
    state.timeProcessed = 0;
  }
  return { completed: false, type };
}

// DistilleryBlockEntity.getTickRate: lava below = 7x, fire/campfire below = 3x
function heatTickRate(block) {
  try {
    const below = block.below(1);
    const id = below?.typeId ?? "";
    if (id === "minecraft:lava" || id === "minecraft:flowing_lava") return 7;
    if (id === "minecraft:fire" || id === "minecraft:soul_fire" || id === "minecraft:campfire" || id === "minecraft:soul_campfire" || id === "psychedelicraft:bunsen_burner") return 3;
  } catch {
    /* fall through */
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Barrel (ProcessType.MATURE + tap animation)
// ---------------------------------------------------------------------------
export const barrel = {
  onTick(event) {
    const { block } = event;
    const state = loadState(block);
    state.processType = ProcessType.MATURE;
    tickProcessing(state);
    if (state.tapOpen > 0) state.tapOpen -= TICK_STEPS;
    if (block.permutation.getAllStates()["psychedelicraft:tap_open"] !== undefined) block.setPermutation(block.permutation.withState("psychedelicraft:tap_open", (state.tapOpen ?? 0) > 0));
    saveState(block, state);
  },
  onPlayerInteract(event) {
    const state = loadState(event.block); state.tapOpen = 40; saveState(event.block, state);
    return { openUi: "barrel", sound: "random.click" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "barrel");
  },
};

// ---------------------------------------------------------------------------
// Distillery (ProcessType.DISTILL; requires facing-connected flask output)
// ---------------------------------------------------------------------------
// DistilleryBlockEntity.canProcess (L1): only processes while the block at
//   getOutputPos() == pos.offset(FACING) connects and holds a tank machine
//   (FlaskBlockEntity subclass: flask, barrel, mash tub, distillery);
//   otherwise timeProcessed resets to 0 every tick.
// DistilleryBlockEntity.accept (L1): byproducts deposit into the output tank
//   on the opposite side; overflow drops at the output position.
const CARDINAL_OFFSETS = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
};

// DistilleryBlock.canConnectTo (L1): barrels tag, mash tub edge, flask, or a
// distillery not facing back.
function canConnectTo(typeId) {
  return (
    typeId === "psychedelicraft:flask" ||
    typeId === "psychedelicraft:mash_tub" ||
    typeId === "psychedelicraft:mash_tub_edge" ||
    typeId === "psychedelicraft:distillery" ||
    /^psychedelicraft:[a-z_]+_barrel$/.test(typeId)
  );
}

function distilleryOutput(block) {
  let facing = null;
  try {
    facing = block.permutation.getState("minecraft:cardinal_direction");
  } catch {
    /* no facing state */
  }
  const offset = CARDINAL_OFFSETS[facing];
  if (!offset) return null;
  try {
    const target = block.dimension.getBlock({
      x: block.location.x + offset.x,
      y: block.location.y + offset.y,
      z: block.location.z + offset.z,
    });
    return target && canConnectTo(target.typeId) ? target : null;
  } catch {
    return null;
  }
}

export const distillery = {
  onTick(event) {
    const { block } = event;
    const state = loadState(block);
    state.processType = ProcessType.DISTILL;

    // canProcess gate: no connectable output tank -> progress resets (L1)
    const output = distilleryOutput(block);
    if (!output) {
      state.timeProcessed = 0;
      saveState(block, state);
      return;
    }

    const result = tickProcessing(state, { tickRate: heatTickRate(block) });
    if (result.completed && result.byproduct) {
      // accept(MutableFluidContainer): byproduct (slurry) deposits into the
      // output tank; overflow drops at the output position (L1)
      const outState = loadState(output);
      outState.capacity = tankCapacity(output.typeId);
      const fluid = makeFluidState(result.byproduct.id, result.byproduct.level);
      const { remaining } = tankDeposit(outState, fluid);
      saveState(output, outState);
      if (remaining > 0) {
        dropItemAt(output, "psychedelicraft:filled_bucket", Math.ceil(remaining / VOLUMES.BUCKET));
      }
    }
    saveState(block, state);
  },
  onPlayerInteract() {
    return { openUi: "distillery" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "distillery");
  },
};

// ---------------------------------------------------------------------------
// Flask / generic tank (ProcessType.IDLE - storage only)
// ---------------------------------------------------------------------------
export const flask = {
  onTick(event) {
    const state = loadState(event.block);
    state.processType = ProcessType.IDLE;
    saveState(event.block, state);
  },
  onPlayerInteract() {
    return { openUi: "flask" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "flask");
  },
};

// ---------------------------------------------------------------------------
// Mash tub (ProcessType.FERMENT + mashing recipes from data/recipes.json)
// ---------------------------------------------------------------------------
export const mash_tub = {
  onTick(event) {
    const { block } = event;
    const state = loadState(block);
    state.processType = ProcessType.FERMENT;
    tickProcessing(state);
    saveState(block, state);
  },
  onPlayerInteract() {
    return { openUi: "mash_tub" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "mash_tub");
  },
};

export const mash_tub_edge = {
  onTick() {},
  onPlayerInteract() {
    return { openUi: "mash_tub" };
  },
  onPlayerDestroy() {
    return { drops: [] };
  },
};

// MashTubBlockEntity.depositIngredient / checkIngredients:
// ingredients are tallied per item; a mashing recipe whose base fluid matches
// the tub's pool completes when the multiset matches exactly (MatchResult.BOTH).
export function depositIngredient(state, itemId) {
  const recipes = (RECIPES.mashing ?? []).filter((r) => fluidMatches(state.fluid, r.base_fluid));
  const candidate = { typeId: itemId };
  if (!recipes.some((r) => r.ingredients.some((i) => ingredientMatches(candidate, i)))) return { accepted: false, crafted: false };
  const tally = (state.ingredientTally ??= {});
  tally[itemId] = (tally[itemId] ?? 0) + 1;

  const poolFluid = state.fluid.id;
  for (const recipe of recipes) {
    const base = recipe.base_fluid?.fluid ?? "minecraft:water";
    if (base !== poolFluid && base !== "minecraft:water") continue;
    const remaining = { ...tally };
    const complete = recipe.ingredients.every((ingredient) => {
      const id = Object.keys(remaining).find((id) => remaining[id] > 0 && ingredientMatches({ typeId: id }, ingredient));
      if (!id) return false;
      remaining[id]--; return true;
    });
    const exact = Object.values(remaining).every((count) => count === 0);
    if (complete && exact) {
      // result fluid fills the tub (level defaults to full capacity - inferred,
      // MashingRecipe result JSON carries no level; see docs/03-feature-ledger)
      state.fluid = { ...makeFluidState(recipe.result.fluid.replace(/^psychedelicraft:/, ""), state.fluid.level), ...attributesOf(recipe.result.attributes) };
      state.ingredientTally = {};
      return { accepted: true, crafted: true, fluid: state.fluid };
    }
  }
  return { accepted: true, crafted: false };
}

// ---------------------------------------------------------------------------
// Drying table (DryingTableBlockEntity.tick) — 10 slots (0 = output, 1-9 input)
// ---------------------------------------------------------------------------
function dryingRecipeFor(state) {
  for (let slot = 1; slot <= 9; slot++) {
    const item = state.items?.[slot];
    if (!item) continue;
    for (const recipe of CONTENT.dryingRecipes) {
      if (recipe.input === item.id) return { recipe, slot };
    }
  }
  return null;
}

export const drying_table = {
  onTick(event) {
    const { block } = event;
    const state = loadState(block);
    const iron = block.typeId === "psychedelicraft:iron_drying_table";
    const duration = iron ? 12 * 1200 : 16 * 1200; // PSConfig.dryingTableTickDuration

    state.ticksAlive = (state.ticksAlive ?? 0) + TICK_STEPS;
    if (state.ticksAlive % 30 < TICK_STEPS) {
      // heatRatio = ((l*l*h)^2), l = light/15, h = biomeTemp*0.75+0.25
      const l = block.lightFromSky ?? 1;
      const h = biomeHeat(block);
      const lh = l * l * h;
      state.heatRatio = clamp(lh * lh, 0, 1);
      if (isRaining() && exposedToSky(block)) {
        state.dryingProgress = 0;
      }
    }

    const match = state.items ? dryingRecipeFor(state) : null;
    state.isCooking = !!match && !state.items?.[0];
    if (state.isCooking) {
      state.dryingProgress = (state.dryingProgress ?? 0) + (state.heatRatio / duration) * TICK_STEPS;
      if (state.dryingProgress >= 1) {
        const { recipe, slot } = match;
        for (let i = 1; i <= 9; i++) delete state.items[i]; // clear() wipes inputs
        state.items[0] = { id: recipe.output, amount: recipe.count };
        state.dryingProgress = 0;
        state.isCooking = false;
      }
    } else {
      state.dryingProgress = 0;
    }
    saveState(block, state);
  },
  onPlayerInteract() {
    return { openUi: "drying_table" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "drying_table");
  },
};

// biome temperature heuristic (Bedrock exposes no biome temperature via script;
// approximated from biome id - documented Level 7 equivalent)
function biomeHeat(block) {
  try {
    const biomeId = block.dimension.getBiome?.(block.location)?.id ?? "";
    if (/desert|savanna|badlands|nether/.test(biomeId)) return 1;
    if (/snow|frozen|ice|taiga/.test(biomeId)) return 0.3;
  } catch {
    /* default below */
  }
  return 0.6;
}

function isRaining() {
  try {
    const { world } = globalThis.__ps ?? {};
    return world && world.getWeather?.() !== "Clear";
  } catch {
    return false;
  }
}

function exposedToSky(block) {
  try {
    for (let dy = 1; dy <= 32; dy++) {
      const above = block.above(dy);
      if (!above || !above.isAir) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Bottle rack / tray / burner / rift jar / placed drink
// ---------------------------------------------------------------------------
export const bottle_rack = {
  onTick() {},
  onPlayerInteract() {
    return { openUi: "bottle_rack" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "bottle_rack");
  },
};

export const tray = {
  onTick() {},
  onPlayerInteract() {
    return { openUi: "tray" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "tray");
  },
};

// BurnerBlock: heat source consumed by machines above (tickRate 3x - Level 6
// inference: DistilleryBlockEntity treats fire/campfire below as 3x heat).
export const bunsen_burner = {
  onTick() {},
  onPlayerInteract() {
    return { toggleBurner: true };
  },
  onPlayerDestroy() {
    return { drops: [{ id: "psychedelicraft:bunsen_burner", amount: 1 }] };
  },
};

// RiftJarBlockEntity: toggles open/closed with dedicated sounds, captures
// reality rifts (RiftJarBlock.java interactions).
export const rift_jar = {
  onTick(event) {
    const state = loadState(event.block);
    if (state.open) {
      state.captureTimer = (state.captureTimer ?? 0) + TICK_STEPS;
    }
    saveState(event.block, state);
  },
  onPlayerInteract(event) {
    const state = loadState(event.block);
    state.open = !state.open;
    saveState(event.block, state);
    return { sound: state.open ? "psbed:block.rift_jar.open" : "psbed:block.rift_jar.close" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "rift_jar");
  },
};

export const placed_drink = {
  onTick() {},
  onPlayerInteract() {
    return { openUi: "placed_drink" };
  },
  onPlayerDestroy(event) {
    return dropMachineContents(event, "placed_drink");
  },
};

// ---------------------------------------------------------------------------
// Machine contents drop on break (BlockEntityWithInventory drops its inventory)
// ---------------------------------------------------------------------------
export function dropMachineContents(event, kind) {
  const state = takeState(event.block);
  const drops = [];
  for (const item of Object.values(state.items ?? {})) {
    if (item) drops.push({ id: item.id, amount: item.amount ?? 1, aux: item.aux ?? 0 });
  }
  if (state.fluid && state.fluid.level > 0) {
    // fluid contents spill as their filled container equivalent (documented)
    drops.push({ id: "psychedelicraft:filled_bucket", amount: Math.floor(state.fluid.level / VOLUMES.BUCKET), fluid: state.fluid });
  }
  return { drops, kind };
}

// ---------------------------------------------------------------------------
// Shared tank operations used by the UI layer (ui.js)
// ---------------------------------------------------------------------------
export function tankDeposit(state, fluid) {
  const capacity = state.capacity ?? VOLUMES.VAT;
  if (!state.fluid) {
    const transferred = Math.min(fluid.level, capacity);
    state.fluid = { ...fluid, level: transferred };
    return { transferred, remaining: fluid.level - transferred };
  }
  if (state.fluid.level <= 0) {
    const transferred = Math.min(fluid.level, capacity); state.fluid = { ...fluid, level: transferred };
    return { transferred, remaining: fluid.level - transferred };
  }
  if (["id", "fermentation", "distillation", "maturation", "vinegar", "temperature"].some((key) => state.fluid[key] !== fluid[key])) return { transferred: 0, remaining: fluid.level };
  const space = capacity - state.fluid.level;
  const transferred = Math.min(space, fluid.level);
  state.fluid.level += transferred;
  // mixing fluids mixes processing attributes (levels are averaged when equal)
  return { transferred, remaining: fluid.level - transferred };
}

export function tankWithdraw(state, amount) {
  if (!state.fluid || state.fluid.level <= 0) return null;
  const taken = Math.min(amount, state.fluid.level);
  const out = { ...state.fluid, level: taken };
  state.fluid.level -= taken;
  if (state.fluid.level <= 0 && (state.timeProcessed ?? 0) > 0) {
    state.timeProcessed = 0; // FluidProcessingBlockEntity.onDrain reset
  }
  return out;
}

export function variantLabel(fluid) {
  return resolveVariant(fluid);
}
