// Psychedelicraft (Bedrock) — main entry point.
// Mirrors Psychedelicraft.onInitialize() bootstrap order and the Fabric event
// hooks (player copy-on-death, join capability sync, etc.).

import { world, system, ItemStack } from "@minecraft/server";

import { CONTENT } from "./data/content.js";
import { DrugProperties, DrugInfluence } from "./lib/drugs.js";
import { applyEffects, distortFor, onWakeUp, onWakeUpBathSalts } from "./lib/effects.js";
import {
  barrel,
  distillery,
  flask,
  mash_tub,
  mash_tub_edge,
  drying_table,
  bottle_rack,
  tray,
  bunsen_burner,
  rift_jar,
  placed_drink,
  loadState,
  saveState,
  dropMachineContents,
  depositIngredient,
} from "./lib/machines.js";
import { COMPONENTS as CROP_COMPONENTS } from "./lib/crops.js";
import { ITEM_COMPONENTS } from "./lib/items.js";
import { dropsForBlock } from "./lib/loot.js";
import { updateHallucinations, tickRifts, updateHeatMotion } from "./lib/hallucinations.js";
import { openMachineUi, openDryingUi, openFluidCrafting, heatHeldFluid } from "./lib/ui.js";
import { unpackFluid, makeFluidState, drugInfluencesPerLiter, fluidDisplayName, readItemFluid, writeItemFluid, VOLUMES } from "./lib/fluids.js";
import { translate } from "./data/lang.js";

import { wood, WOOD_KINDS, placeWood, stripLog, mergeSlab, breakDoorPartner } from "./lib/wood.js";
import { riftJar, jarDrop, chargedJar } from "./lib/rift.js";
import { fillFromWorld, readFluid } from "./lib/crafting.js";

globalThis.__ps = { world, addDrug: (player, drug, amount) => propsFor(player).addToDrug(drug, amount) };

// ---------------------------------------------------------------------------
// Per-player drug state (DrugProperties) with dynamic-property persistence
// ---------------------------------------------------------------------------
const playerState = new Map();

function propsFor(player) {
  let props = playerState.get(player.id);
  if (!props) {
    props = new DrugProperties({
      onHeartAttack: () => {
        try {
          player.applyDamage(20);
          props.drugs.forEach((d) => d.reset());
        } catch {
          /* ignore */
        }
      },
      onAlcoholPoisoning: (amount) => {
        try {
          player.applyDamage(amount);
        } catch {
          /* ignore */
        }
      },
      onNauseaPulse: (duration) => {
        try {
          player.addEffect("minecraft:nausea", duration, { showParticles: false });
        } catch {
          /* Bedrock has no nausea effect - camera shake fallback */
          try {
            player.runCommand(`camerashake @s add 0.4 ${Math.floor(duration / 20)} rotational`);
          } catch {
            /* ignore */
          }
        }
      },
      addExhaustion: (amount) => {
        try {
          const hunger = player.getComponent("minecraft:player.hunger");
          if (hunger) hunger.current = Math.max(0, hunger.current - amount * 2);
        } catch {
          /* ignore */
        }
      },
    });
    try {
      const saved = player.getDynamicProperty("ps:drugs");
      if (saved) props.deserialize(JSON.parse(saved));
    } catch {
      /* new player */
    }
    playerState.set(player.id, props);
  }
  return props;
}

function saveProps(player, props) {
  try {
    player.setDynamicProperty("ps:drugs", JSON.stringify(props.serialize()));
  } catch {
    /* persistence unavailable */
  }
}

// ---------------------------------------------------------------------------
// Custom component registration (startup hook; API name varies by engine:
// system.beforeEvents.startup on @minecraft/server >= 1.10,
// world.beforeEvents.worldInitialize on older module versions)
// ---------------------------------------------------------------------------
const MACHINE_COMPONENTS = {
  "psychedelicraft:barrel": barrel,
  "psychedelicraft:distillery": distillery,
  "psychedelicraft:flask": flask,
  "psychedelicraft:mash_tub": mash_tub,
  "psychedelicraft:mash_tub_edge": mash_tub_edge,
  "psychedelicraft:drying_table": drying_table,
  "psychedelicraft:bottle_rack": bottle_rack,
  "psychedelicraft:tray": tray,
  "psychedelicraft:bunsen_burner": bunsen_burner,
  "psychedelicraft:rift_jar": riftJar,
  "psychedelicraft:wood": wood,
  "psychedelicraft:placed_drink": placed_drink,
};

const startupSignal = system.beforeEvents?.startup ?? world.beforeEvents?.worldInitialize;
startupSignal?.subscribe((initEvent) => {
  for (const [name, handlers] of Object.entries(MACHINE_COMPONENTS)) {
    initEvent.blockComponentRegistry.registerCustomComponent(name, wrapBlockHandlers(handlers));
  }
  for (const [name, handlers] of Object.entries(CROP_COMPONENTS)) {
    initEvent.blockComponentRegistry.registerCustomComponent(name, wrapBlockHandlers(handlers));
  }
  for (const [name, handlers] of Object.entries(ITEM_COMPONENTS)) {
    initEvent.itemComponentRegistry.registerCustomComponent(name, wrapItemHandlers(handlers));
  }
});

// custom components fire with (event) signatures; normalize to handler results
function wrapBlockHandlers(handlers) {
  const out = {};
  for (const key of ["onTick", "onPlayerInteract", "onPlayerDestroy"]) {
    if (handlers[key]) out[key] = (e) => runResult(handlers[key](e), e);
  }
  return out;
}

function wrapItemHandlers(handlers) {
  const out = {};
  for (const key of ["onUse", "onUseOn", "onCompleteUse", "onConsume"]) {
    if (handlers[key]) out[key] = (e) => {
      const event = { ...e, player: e.source, itemStack: e.itemStack, block: e.block };
      runResult(handlers[key](event), event);
    };
  }
  return out;
}

// Apply declarative handler results (drops, sounds, influences, UI)
function runResult(result, event) {
  if (!result || typeof result !== "object") return;
  const player = event.player;
  if (result.drops?.length) {
    const dim = event.block?.dimension ?? player?.dimension;
    const loc = event.block?.location ?? player?.location;
    for (const drop of result.drops) {
      try {
        spawnDrop(dim, loc, drop);
      } catch {
        /* ignore */
      }
    }
  }
  if (Object.hasOwn(result, "setItemFluid") && player) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    const stack = inv?.getItem(player.selectedSlotIndex);
    if (stack) inv.setItem(player.selectedSlotIndex, writeItemFluid(stack, result.setItemFluid));
  }
  if ((result.sound || result.playSound) && (event.block || player)) {
    try {
      const dim = event.block?.dimension ?? player.dimension;
      dim.playSound((result.sound ?? result.playSound).replace(/^minecraft:/, "").replace(/^psbed:/, "psybed:"), (event.block ?? player).location, { volume: 1 });
    } catch {
      /* ignore */
    }
  }
  if (result.addInfluences?.length && player) {
    const props = propsFor(player);
    for (const inf of result.addInfluences) {
      props.addInfluence(Array.isArray(inf) ? DrugInfluence.fromArray(inf) : inf);
    }
  }
  if (result.startBreathingSmoke && player) {
    propsFor(player).startBreathingSmoke(result.startBreathingSmoke.time, result.startBreathingSmoke.color);
  }
  if (result.damageItem && player) {
    damageHeldItem(player, result.damageItem);
  }
  if (result.consumeItem && player) {
    consumeHeldItem(player);
  }
  if (result.openUi && player && event.block) {
    const kind = result.openUi;
    if (kind === "drying_table") openDryingUi(player, event.block);
    else openMachineUi(player, kind, event.block).catch(() => {});
  }
  if (result.message && player) {
    try {
      player.sendMessage(translate(result.message));
    } catch {
      /* ignore */
    }
  }
}

function spawnDrop(dimension, location, drop) {
  if ((drop.amount ?? 1) <= 0) return;
  const stack = new ItemStack(drop.id, drop.amount ?? 1);
  if (drop.fluid) writeItemFluid(stack, { ...drop.fluid, level: VOLUMES.BUCKET });
  dimension.spawnItem(stack, location);
}

function damageHeldItem(player, amount) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    const stack = inv?.getItem(player.selectedSlotIndex);
    if (stack) {
      const max = stack.getComponent("minecraft:durability")?.maxDurability ?? 0;
      if (max > 0) {
        const dura = stack.getComponent("minecraft:durability");
        dura.damage = (dura.damage ?? 0) + amount;
        if (dura.damage >= max) inv.setItem(player.selectedSlotIndex, undefined);
        else inv.setItem(player.selectedSlotIndex, stack);
      }
    }
  } catch {
    /* ignore */
  }
}

function consumeHeldItem(player) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    const stack = inv?.getItem(player.selectedSlotIndex);
    if (stack) {
      if ((stack.amount ?? 1) > 1) {
        stack.amount -= 1;
        inv.setItem(player.selectedSlotIndex, stack);
      } else {
        inv.setItem(player.selectedSlotIndex, undefined);
      }
    }
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Break/explodes drops (script-driven Java loot tables; engine loot disabled)
// ---------------------------------------------------------------------------
world.afterEvents.playerBreakBlock?.subscribe((e) => {
  try {
    const player = e.player;
    const id = e.brokenBlockPermutation.type.id;
    if (String(player?.getGameMode?.()).toLowerCase() === "creative") {
      breakDoorPartner(e.block, e.brokenBlockPermutation);
      if (id === "psychedelicraft:rift_jar") jarDrop(e.block);
      return;
    }
    if (id === "psychedelicraft:rift_jar") {
      for (const stack of jarDrop(e.block)) e.block.dimension.spawnItem(stack, e.block.location);
      return;
    }
    if (id === "psychedelicraft:juniper_door") {
      breakDoorPartner(e.block, e.brokenBlockPermutation);
      e.block.dimension.spawnItem(new ItemStack(id), e.block.location);
      return;
    }
    const held = player?.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    const enchantments = readEnchantments(held);
    const drops = dropsForBlock(e.brokenBlockPermutation.type.id, {
      blockState: readStates(e.brokenBlockPermutation),
      heldItem: held?.typeId ?? "",
      enchantments,
    });
    for (const drop of drops) {
      spawnDrop(e.block.dimension, e.block.location, drop);
    }
  } catch {
    /* ignore */
  }
});

world.afterEvents.blockExplode?.subscribe((e) => {
  try {
    const typeId = e.explodedBlockPermutation.type.id;
    if (typeId === "psychedelicraft:rift_jar") {
      for (const stack of jarDrop(e.block)) e.block.dimension.spawnItem(stack, e.block.location);
      return;
    }
    if (typeId === "psychedelicraft:juniper_door") {
      breakDoorPartner(e.block, e.explodedBlockPermutation);
      e.block.dimension.spawnItem(new ItemStack(typeId), e.block.location); return;
    }
    // machine contents spill on explosion too (BlockEntityWithInventory drops
    // its inventory regardless of destruction cause) — dropMachineContents is
    // consume-once, so overlapping drop paths cannot duplicate items (X008)
    const result = dropMachineContents({ block: e.block }, typeId);
    for (const drop of result.drops) {
      spawnDrop(e.block.dimension, e.block.location, drop);
    }
    const drops = dropsForBlock(typeId, {
      blockState: readStates(e.explodedBlockPermutation),
      exploded: true,
      enchantments: {},
    });
    for (const drop of drops) {
      spawnDrop(e.block.dimension, e.block.location, drop);
    }
  } catch {
    /* ignore */
  }
});

function readStates(permutation) {
  const out = {};
  try {
    for (const [key, value] of Object.entries(permutation.getAllStates())) {
      out[key.replace(/^psychedelicraft:/, "")] = value;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function readEnchantments(stack) {
  const out = {};
  try {
    const ench = stack?.getComponent("minecraft:enchantments")?.enchantments;
    for (const e of ench) out[e.type.id.replace(/^minecraft:/, "")] = e.level;
  } catch {
    /* ignore */
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chat distortion (MessageDistorter.distortOutgoingMessage)
// ---------------------------------------------------------------------------
world.beforeEvents.chatSend?.subscribe((e) => {
  try {
    const props = playerState.get(e.sender.id);
    if (!props) return;
    const distorted = distortFor(props, e.message);
    if (distorted !== e.message) {
      e.cancel = true;
      world.sendMessage(`<${e.sender.name}> ${distorted}`);
    }
  } catch {
    /* chat events unavailable */
  }
});

// ---------------------------------------------------------------------------
// Main loop: drug updates + effects + persistence + sleep + rifts
// ---------------------------------------------------------------------------
const wasSleeping = new Map();

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const props = propsFor(player);
    props.update();
    if (props.age % 4 === 0) updateHeatMotion(player, props);
    if (props.age % 20 !== 0) continue;
    applyEffects(player, props);

    // sleep/wake transitions (DrugProperties.onAwoken + drug onWakeUp behavior)
    const sleeping = player.isSleeping ?? false;
    const prev = wasSleeping.get(player.id) ?? false;
    if (prev && !sleeping) {
      onWakeUp(player, props);
      onWakeUpBathSalts(player, props);
      for (const drug of props.drugs.values()) drug.reset();
    }
    wasSleeping.set(player.id, sleeping);

    // hallucinations (color/movement/contextual) + Reality Rift spawning and
    // drift/capture management (entity/drug/hallucination/* + RealityRiftEntity)
    updateHallucinations(player, props);
    tickRifts(player);

    saveProps(player, props);
  }
}, 1);

// ---------------------------------------------------------------------------
// Interactions routed to machines (insert ingredients into mash tub etc.)
// ---------------------------------------------------------------------------
world.afterEvents.playerInteractWithBlock?.subscribe((e) => {
  try {
    const typeId = e.block.typeId;
    if (typeId === "minecraft:crafting_table" && e.player.isSneaking) return; // before-event owns the form
    if (/lit_furnace|lit_smoker|lit_blast_furnace|campfire|bunsen_burner/.test(typeId)) { heatHeldFluid(e.player, e.block); return; }
    if (typeId === "psychedelicraft:mash_tub" && e.itemStack) {
      const state = loadState(e.block);
      const fluid = readFluid(e.itemStack);
      if (fluid && fluid.level > 0) {
        return; // Container component/UI owns volume transfer; never copy fluid here.
      }
      const result = depositIngredient(state, e.itemStack.typeId);
      if (!result.accepted) return;
      consumeHeldItem(e.player);
      saveState(e.block, state);
      if (result.crafted) {
        e.block.dimension.playSound("minecraft:mob.cow.milk", e.block.location);
      }
    }
  } catch {
    /* ignore */
  }
});

// Cancel native placement only for the custom wood/charge paths; defer writes
// out of before-event read-only execution. Revalidate the held item afterward.
world.beforeEvents.playerInteractWithBlock?.subscribe((e) => {
  if (e.block.typeId === "minecraft:crafting_table" && e.player.isSneaking) {
    e.cancel = true;
    const player = e.player, block = e.block;
    system.run(() => openFluidCrafting(player, block).catch(console.warn)); return;
  }
  if (!e.itemStack) return;
  const def = CONTENT.items.find((i) => `psychedelicraft:${i.id}` === e.itemStack.typeId);
  const blockDef = CONTENT.blocks.find((b) => b.id === def?.block);
  const customWood = WOOD_KINDS.has(blockDef?.kind);
  const filledMachine = blockDef?.kind === "machine" && !!readItemFluid(e.itemStack);
  const stripping = /juniper_(log|wood)$/.test(e.block.typeId) && /_axe$/.test(e.itemStack.typeId);
  const worldFill = /^(minecraft:)(water|flowing_water|lava|flowing_lava)$/.test(e.block.typeId) && ["container", "syringe"].includes(def?.kind);
  const jar = def?.id === "rift_jar";
  if (!customWood && !stripping && !worldFill && !jar && !filledMachine) return;
  e.cancel = true;
  const player = e.player, block = e.block, typeId = e.itemStack.typeId;
  const face = e.blockFace, faceLocation = e.faceLocation;
  const charge = jar ? e.itemStack.getDynamicProperty("ps:riftFraction") ?? 0 : 0;
  system.run(() => {
    const inv = player.getComponent("minecraft:inventory")?.container, held = inv?.getItem(player.selectedSlotIndex);
    if (!held || held.typeId !== typeId) return;
    if (stripping) stripLog(block, held, player);
    else if (worldFill) fillFromWorld(player, block);
    else if (customWood) placeWood({ player, block, itemStack: held, blockFace: face, faceLocation });
    else if (jar || filledMachine) {
      const offsets = { Up: [0,1,0], Down: [0,-1,0], North: [0,0,-1], South: [0,0,1], East: [1,0,0], West: [-1,0,0] };
      const delta = offsets[face]; if (!delta) return;
      const target = block.dimension.getBlock({ x: block.location.x + delta[0], y: block.location.y + delta[1], z: block.location.z + delta[2] });
      if (!target?.isAir || (held.getDynamicProperty("ps:riftFraction") ?? 0) !== charge) return;
      target.setType(jar ? "psychedelicraft:rift_jar" : typeId);
      saveState(target, jar ? { currentRiftFraction: charge, suckingRifts: true } : { fluid: readItemFluid(held) });
      consumeHeldItem(player);
    }
  });
});

// Player join/leave lifecycle (Fabric: ServerPlayConnectionEvents.JOIN /
// ServerPlayerEvents.COPY_FROM -> capability sync on respawn)
world.afterEvents.playerSpawn?.subscribe((e) => {
  if (e.initialSpawn === false) {
    // respawn: DrugProperties.copyFrom(old, alive=true) keeps state
    const props = propsFor(e.player);
    props.cb && (props.cb.onDirty = () => {});
  }
});

world.afterEvents.playerLeave?.subscribe((e) => {
  const props = playerState.get(e.playerId);
  if (props) {
    try {
      world.setDynamicProperty(`ps:drugs:${e.playerId}`, JSON.stringify(props.serialize()));
    } catch {
      /* ignore */
    }
    playerState.delete(e.playerId);
  }
});

// Machine contents on break are also dropped for machine blocks whose custom
// component onPlayerDestroy is unavailable (fallback path).
world.afterEvents.playerBreakBlock?.subscribe((e) => {
  try {
    const id = e.brokenBlockPermutation.type.id;
    const isMachine = Object.values(CONTENT.blocks).some((b) => b.kind === "machine" && `psychedelicraft:${b.id}` === id);
    if (!isMachine || id === "psychedelicraft:rift_jar") return;
    const result = dropMachineContents({ block: e.block }, id);
    for (const drop of result.drops) {
      spawnDrop(e.block.dimension, e.block.location, drop);
    }
  } catch {
    /* ignore */
  }
});

// ---------------------------------------------------------------------------
// Engine self-test: exercises the transcribed substance math (DrugInfluence
// accumulation/decay, alcohol content formula, naming, chat distortion) in the
// live script runtime so headless engine logs prove the mechanics execute.
// ---------------------------------------------------------------------------
function selfTest() {
  try {
    const props = new DrugProperties({});
    // cannabis: delay 0, speed 0.05, plus 0.05, max 1 (DrugType.CANNABIS shape)
    props.addInfluence(new DrugInfluence("cannabis", 0, 0.05, 0.05, 1));
    for (let i = 0; i < 40; i++) props.update();
    const cannabis = props.getDrugValue("cannabis").toFixed(3);

    // red_grapes wine at full fermentation, 4/16 maturation -> alcohol per liter
    // expected: 0.55*(2/2) + 1.7*progress(0) + 0.2*progress(4*0.2) = 0.639
    const wine = makeFluidState("red_grapes", 1);
    wine.fermentation = 2;
    wine.maturation = 4;
    const inf = drugInfluencesPerLiter(wine);
    const alcohol = (inf[0]?.maxInfluence ?? 0).toFixed(3);

    const name = translate("item.psychedelicraft.joint");
    const drink = fluidDisplayName(wine);
    const distorted = distortFor(props, "Hello world, this is a test");
    console.warn(
      `[Psychedelicraft] self-test ok: cannabis=${cannabis} wine_alcohol=${alcohol} name=${name} drink=${drink} distort="${distorted}"`,
    );
  } catch (err) {
    console.warn(`[Psychedelicraft] self-test failed: ${err && err.stack ? err.stack : err}`);
  }
}
selfTest();

console.warn("[Psychedelicraft] behavior systems initialized");
