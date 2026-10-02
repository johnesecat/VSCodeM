// Psychedelicraft (Bedrock) — main entry point.
// Mirrors Psychedelicraft.onInitialize() bootstrap order and the Fabric event
// hooks (player copy-on-death, join capability sync, etc.).

import { world, system } from "@minecraft/server";

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
import { updateHallucinations, tickRifts } from "./lib/hallucinations.js";
import { openMachineUi, openDryingUi } from "./lib/ui.js";
import { unpackFluid, makeFluidState, drugInfluencesPerLiter, fluidDisplayName } from "./lib/fluids.js";
import { translate } from "./data/lang.js";

globalThis.__ps = { world };

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
  "psychedelicraft:rift_jar": rift_jar,
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
  for (const key of ["onUse", "onUseOn", "onCompleteUse", "onConsume", "onHitBlock"]) {
    if (handlers[key]) out[key] = (e) => runResult(handlers[key](e), e);
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
        dim.spawnItem({ type: { typeId: drop.id }, amount: drop.amount ?? 1 }, loc);
      } catch {
        /* ignore */
      }
    }
  }
  if (result.sound && (event.block || player)) {
    try {
      const dim = event.block?.dimension ?? player.dimension;
      dim.playSound(result.sound, (event.block ?? player).location, { volume: 1 });
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
      player.sendMessage({ translate: result.message });
    } catch {
      /* ignore */
    }
  }
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
    if (player?.getGameMode?.() === "creative") return;
    const held = player?.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    const enchantments = readEnchantments(held);
    const drops = dropsForBlock(e.brokenBlockPermutation.type.id, {
      blockState: readStates(e.brokenBlockPermutation),
      heldItem: held?.typeId ?? "",
      enchantments,
    });
    for (const drop of drops) {
      e.block.dimension.spawnItem({ type: { typeId: drop.id }, amount: drop.amount }, e.block.location);
    }
  } catch {
    /* ignore */
  }
});

world.afterEvents.blockExplode?.subscribe((e) => {
  try {
    const typeId = e.explodedBlockPermutation.type.id;
    // machine contents spill on explosion too (BlockEntityWithInventory drops
    // its inventory regardless of destruction cause) — dropMachineContents is
    // consume-once, so overlapping drop paths cannot duplicate items (X008)
    const result = dropMachineContents({ block: e.block }, typeId);
    for (const drop of result.drops) {
      e.block.dimension.spawnItem({ type: { typeId: drop.id }, amount: drop.amount ?? 1 }, e.block.location);
    }
    const drops = dropsForBlock(typeId, {
      blockState: readStates(e.explodedBlockPermutation),
      exploded: true,
      enchantments: {},
    });
    for (const drop of drops) {
      e.block.dimension.spawnItem({ type: { typeId: drop.id }, amount: drop.amount }, e.block.location);
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
}, 20);

// ---------------------------------------------------------------------------
// Interactions routed to machines (insert ingredients into mash tub etc.)
// ---------------------------------------------------------------------------
world.afterEvents.playerInteractWithBlock?.subscribe((e) => {
  try {
    const typeId = e.block.typeId;
    if (typeId === "psychedelicraft:mash_tub" && e.itemStack) {
      const state = loadState(e.block);
      const fluid = unpackFluid(e.itemStack.durability ?? 0, 0);
      if (fluid && fluid.level > 0) {
        state.fluid = state.fluid ?? fluid;
        saveState(e.block, state);
        return;
      }
      const result = depositIngredient(state, e.itemStack.typeId);
      saveState(e.block, state);
      if (result.crafted) {
        e.block.dimension.playSound("minecraft:mob.cow.milk", e.block.location);
      }
    }
  } catch {
    /* ignore */
  }
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
    if (!isMachine) return;
    const result = dropMachineContents({ block: e.block }, id);
    for (const drop of result.drops) {
      e.block.dimension.spawnItem({ type: { typeId: drop.id }, amount: drop.amount ?? 1 }, e.block.location);
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
