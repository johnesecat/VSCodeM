// Item behaviors — port of item/*.java (PSItems.java registrations).
//   DrinkableItem / BottleItem / ProxyDrinkableItem -> container component
//   SmokeableItem  -> smokeable component (durability = uses)
//   BongItem       -> bong component (consumes listed materials)
//   InjectableItem -> syringe component
//   AliasedBlockItem seeds -> seeds component (plants crop block)
//   EdibleItem influences -> consumable component (drug influence on eat)
//   MolotovCocktailItem / PaperBagItem / SuspiciousItem / HarmoniumItem

import { CONTENT } from "../data/content.js";
import { DrugInfluence } from "./drugs.js";
import {
  VOLUMES,
  makeFluidState,
  packFluid,
  unpackFluid,
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
    const aux = itemStack.durability ?? 0;
    const fluid = unpackFluid(aux, capacity);
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
      setItemAux: packFluid(fluid),
      fluidRemaining: fluid.level,
    };
  },

  onUseOn(event) {
    // fill from targeted tank (machine) or fluid block
    return { openUi: "container_fill" };
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
      playSound: "psbed:drug.generic",
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
      if (stack && stack.typeId === typeId) return inv;
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
    const aux = itemStack.durability ?? 0;
    const fluid = unpackFluid(aux, VOLUMES.SYRINGE);
    if (!fluid || fluid.level <= 0) return {};
    return {
      addInfluences: influenceForLevel(fluid, fluid.level),
      setItemAux: 0,
      playSound: "psbed:drug.generic",
    };
  },
  onUseOn() {
    return { openUi: "container_fill" };
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
      target.setPermutation(
        target.permutation.withState("psychedelicraft:age", 0),
      );
      target.setType(`psychedelicraft:${def.plant}`);
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
  onCompleteUse(event) {
    const def = itemDef(event.itemStack?.typeId ?? "");
    return {
      addInfluences: influencesOf(def),
      playSound: "psbed:drug.generic",
    };
  },
  onConsume(event) {
    const def = itemDef(event.itemStack?.typeId ?? "");
    if (def?.kind === "suspicious") {
      // SuspiciousItem: eating bag_o_vomit may transform into a random form
      return { transformInto: pick(["minecraft:cookie", "minecraft:mushroom_stew", "minecraft:golden_apple", "minecraft:cooked_beef", "minecraft:cooked_chicken"]) };
    }
    return {};
  },
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ---------------------------------------------------------------------------
// MolotovCocktailItem / PaperBagItem
// ---------------------------------------------------------------------------
export const molotov = {
  onHitBlock() {
    return { ignite: true };
  },
};

export const paper_bag = {
  onUse() {
    return { openUi: "paper_bag" };
  },
};

export const suspicious = consumable;

// keys must match the custom component names emitted by tools/gen-content.mjs
export const ITEM_COMPONENTS = {
  "psychedelicraft:container": container,
  "psychedelicraft:smokeable": smokeable,
  "psychedelicraft:bong": bong,
  "psychedelicraft:syringe": syringe,
  "psychedelicraft:seeds": seeds,
  "psychedelicraft:consumable": consumable,
  "psychedelicraft:molotov": molotov,
  "psychedelicraft:paper_bag": paper_bag,
  "psychedelicraft:suspicious": suspicious,
};

// Fuel durations registered via FuelRegistry in PSItems.bootstrap are applied
// through the minecraft:fuel component (see tools/gen-content.mjs).
export function fuelDuration(typeId) {
  return itemDef(typeId)?.fuel ?? 0;
}
