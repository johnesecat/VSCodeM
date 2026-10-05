// Item behaviors — port of item/*.java (PSItems.java registrations).
//   DrinkableItem / BottleItem / ProxyDrinkableItem -> container component
//   SmokeableItem  -> smokeable component (durability = uses)
//   BongItem       -> bong component (consumes listed materials)
//   InjectableItem -> syringe component
//   AliasedBlockItem seeds -> seeds component (plants crop block)
//   EdibleItem influences -> consumable component (drug influence on eat)
//   PaperBagItem / SuspiciousItem / HarmoniumItem
//   MolotovCocktailItem -> scripted fluid-preserving projectile launch

import { BlockPermutation } from "@minecraft/server";
import { CONTENT } from "../data/content.js";
import { molotovItem } from "./molotov.js";
import { DrugInfluence } from "./drugs.js";
import {
  VOLUMES,
  makeFluidState,
  packFluid,
  unpackFluid,
  readItemFluid,
  fluidDef,
  influenceForLevel,
} from "./fluids.js";

function itemDef(id) {
  return CONTENT.items.find((i) => i.id === id.replace(/^psychedelicraft:/, ""));
}

function influencesOf(def) {
  return (def?.influences ?? []).map((arr) => DrugInfluence.fromArray(arr));
}

function heldStack(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Containers: DrinkableItem (mug/cup/chalice/shot/bottle/filled variants)
// Fluid state is packed into the item's aux value (see fluids.js).
// ---------------------------------------------------------------------------
export const container = {
  onUse(event) {
    const { player, itemStack } = event;
    const def = itemDef(itemStack.typeId);
    const capacity = def?.capacity ?? VOLUMES.MUG;
    const fluid = readItemFluid(itemStack);
    if (fluid && !fluidDef(fluid.id)?.drinkable && fluidDef(fluid.id)?.kind !== "alcohol") return { message: "This fluid is not drinkable." };
    if (!fluid || fluid.level <= 0) return {};

    // DrinkableItem.FLUID_PER_DRINKING = 1/4 of the container per use
    const perDrink = Math.max(1, Math.floor(capacity / 4));
    const consumed = Math.min(perDrink, fluid.level);
    fluid.level -= consumed;

    // consumption: drug influences scaled by consumed level (per liter math)
    const influences = influenceForLevel(fluid, consumed);
    return {
      addInfluences: influences,
      playSound: "minecraft:random.drink",
      setItemFluid: fluid,
      fluidRemaining: fluid.level,
    };
  },

  onUseOn(event) {
    // World water/lava is handled before interaction; tank forms are already
    // opened by the machine block component. Do not open a duplicate form.
    return {};
  },
};

// ---------------------------------------------------------------------------
// SmokeableItem: cigarette/cigar/joint/peyote_joint
// ---------------------------------------------------------------------------
export const smokeable = {
  onUse(event) {
    const { player, itemStack } = event;
    const def = itemDef(itemStack.typeId);
    return {
      addInfluences: influencesOf(def),
      startBreathingSmoke: { time: 20, color: def?.smoke ?? [1, 1, 1] },
      damageItem: 1,
      playSound: "psybed:drug.generic",
    };
  },
};

// ---------------------------------------------------------------------------
// BongItem: consumes one matching material from the inventory then applies it
// ---------------------------------------------------------------------------
export const bong = {
  onUse(event) {
    const { player, itemStack } = event;
    const def = itemDef(itemStack.typeId);
    for (const consumable of def?.consumables ?? []) {
      const found = findInInventory(player, consumable.item);
      if (found) {
        found.setItem(undefined);
        return {
          addInfluences: consumable.influences.map((arr) => DrugInfluence.fromArray(arr)),
          startBreathingSmoke: { time: 30, color: [0.8, 0.8, 0.8] },
          damageItem: 1,
          playSound: "minecraft:mob.cow.milk", // bubble stand-in (Java: bubble column pop)
        };
      }
    }
    return { message: "psybed:psychedelicraft.bong.needs_contents" };
  },
};

function findInInventory(player, typeId) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return null;
    for (let i = 0; i < inv.size; i++) {
      const stack = inv.getItem(i);
      if (stack && stack.typeId === typeId) return { setItem: () => {
        if (stack.amount > 1) { stack.amount--; inv.setItem(i, stack); }
        else inv.setItem(i, undefined);
      } };
    }
    for (let i = 0; i < inv.size; i++) {
      const stack = inv.getItem(i);
      if (stack && stack.typeId === typeId) return { setItem: (v) => (v ? inv.setItem(i, v) : inv.setItem(i, undefined)) };
    }
  } catch {
    /* no inventory */
  }
  return null;
}

// ---------------------------------------------------------------------------
// InjectableItem (syringe): inject the stored fluid (DrugFluid.injectable)
// ---------------------------------------------------------------------------
export const syringe = {
  onUse(event) {
    const { itemStack } = event;
    const fluid = readItemFluid(itemStack);
    if (fluid && !fluidDef(fluid.id)?.injectable) return { message: "This fluid is not injectable." };
    if (!fluid || fluid.level <= 0) return {};
    return {
      addInfluences: influenceForLevel(fluid, fluid.level),
      setItemFluid: null,
      playSound: "psybed:drug.generic",
    };
  },
  onUseOn() {
    return {};
  },
};

// ---------------------------------------------------------------------------
// Seeds (AliasedBlockItem): plant the crop block on soil
// ---------------------------------------------------------------------------
const PLANTABLE_SOIL = ["minecraft:dirt", "minecraft:grass_block", "minecraft:farmland", "minecraft:podzol", "minecraft:coarse_dirt", "minecraft:mycelium", "minecraft:rooted_dirt", "minecraft:sand"];

export const seeds = {
  onUseOn(event) {
    const { player, itemStack, block } = event;
    const def = itemDef(itemStack.typeId);
    if (!def?.plant) return {};
    try {
      const target = block.above(1);
      const soil = block;
      const isNightshade = ["jimsonweed", "belladonna", "tomatoes"].includes(def.plant);
      const soilOk = isNightshade
        ? PLANTABLE_SOIL.includes(soil.typeId)
        : soil.typeId === "minecraft:farmland" || PLANTABLE_SOIL.includes(soil.typeId);
      if (!soilOk || !target.isAir) return {};
      target.setPermutation(BlockPermutation.resolve(`psychedelicraft:${def.plant}`, { "psychedelicraft:age": 0 }));
      return { consumeItem: true };
    } catch {
      return {};
    }
  },
};

// ---------------------------------------------------------------------------
// Consumable (EdibleItem drug influences) - fires when eating completes
// ---------------------------------------------------------------------------
export const consumable = {
  onConsume(event) {
    const def = itemDef(event.itemStack?.typeId ?? "");
    return { addInfluences: influencesOf(def), playSound: "psybed:drug.generic" };
  },
};

// ---------------------------------------------------------------------------
// MolotovCocktailItem / PaperBagItem
// ---------------------------------------------------------------------------
export const paper_bag = {
  onUse() {
    return { openUi: "paper_bag" };
  },
};

export const suspicious = consumable;

export const boat = {
  onUseOn({ block, itemStack, player }) {
    if (!block || !player) return {};
    const target = block.above(1);
    if (!target || !target.isAir && !/water/.test(target.typeId)) return {};
    const chest = itemStack.typeId.endsWith("chest_boat");
    block.dimension.spawnEntity(chest ? "minecraft:chest_boat" : "minecraft:boat", { x: target.location.x + 0.5, y: target.location.y, z: target.location.z + 0.5 });
    return { consumeItem: true };
  },
};

// keys must match the custom component names emitted by tools/gen-content.mjs
export const ITEM_COMPONENTS = {
  "psychedelicraft:molotov": molotovItem,
  "psychedelicraft:boat": boat,
  "psychedelicraft:container": container,
  "psychedelicraft:smokeable": smokeable,
  "psychedelicraft:bong": bong,
  "psychedelicraft:syringe": syringe,
  "psychedelicraft:seeds": seeds,
  "psychedelicraft:consumable": consumable,
  "psychedelicraft:paper_bag": paper_bag,
  "psychedelicraft:suspicious": suspicious,
};

// Fuel durations registered via FuelRegistry in PSItems.bootstrap are applied
// through the minecraft:fuel component (see tools/gen-content.mjs).
export function fuelDuration(typeId) {
  return itemDef(typeId)?.fuel ?? 0;
}
