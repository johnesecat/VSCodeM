// UI layer — functional equivalents of screen/FluidContraptionScreenHandler,
// DryingTableScreenHandler and the drink/machine interactions. Bedrock script
// UI is form-based (no custom container GUIs), so machines expose their state
// and insert/extract operations through forms (documented UI equivalence).

import { ActionFormData } from "@minecraft/server-ui";
import {
  loadState,
  saveState,
  tankDeposit,
  tankWithdraw,
  variantLabel,
} from "./machines.js";
import { fluidDisplayName, unpackFluid, packFluid, VOLUMES } from "./fluids.js";

function heldStack(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex) ?? null;
  } catch {
    return null;
  }
}

function setHeld(player, stack) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (inv) inv.setItem(player.selectedSlotIndex, stack);
  } catch {
    /* no inventory */
  }
}

function tankLines(state) {
  const lines = [];
  if (state.fluid && state.fluid.level > 0) {
    const display = variantLabel(state.fluid);
    lines.push(`Fluid: ${fluidDisplayName(state.fluid)}`);
    lines.push(`Level: ${state.fluid.level} / ${state.capacity ?? VOLUMES.VAT}`);
    lines.push(`F:${state.fluid.fermentation} D:${state.fluid.distillation} M:${state.fluid.maturation}${state.fluid.vinegar ? " (vinegar)" : ""}`);
  } else {
    lines.push("Tank: empty");
  }
  if (state.timeNeeded && state.timeNeeded > 0) {
    lines.push(`Process: ${state.activeProcess ?? "?"} ${state.timeProcessed ?? 0}/${state.timeNeeded}`);
  }
  return lines;
}

export async function openMachineUi(player, kind, block) {
  const state = loadState(block);
  state.capacity = kind === "mash_tub" ? VOLUMES.VAT : kind === "barrel" ? VOLUMES.BARREL : VOLUMES.BOTTLE;
  const form = new ActionFormData();
  form.title(`psybed:psychedelicraft.ui.${kind}`);
  form.body(tankLines(state).join("\n"));
  form.button("psybed:psychedelicraft.ui.insert");
  form.button("psybed:psychedelicraft.ui.extract");
  form.button("psybed:psychedelicraft.ui.close");

  const res = await form.show(player);
  if (res.canceled) return;

  const held = heldStack(player);
  if (res.selection === 0) {
    // insert held container fluid
    const aux = held?.durability ?? 0;
    const fluid = unpackFluid(aux, VOLUMES.BOTTLE);
    if (fluid && fluid.level > 0) {
      const result = tankDeposit(state, fluid);
      if (result.remaining <= 0) setHeld(player, held);
      save(state, block, player, `inserted ${result.transferred}`);
    }
  } else if (res.selection === 1) {
    // withdraw into held empty container
    const taken = tankWithdraw(state, Math.min(state.capacity, VOLUMES.BOTTLE));
    if (taken && held) {
      const aux = packFluid(taken);
      setHeld(player, held);
      player.runCommand?.(`give @s psychedelicraft:bottle 1 ${aux}`);
      save(state, block, player, `withdrew ${taken.level}`);
    }
  }
}

function save(state, block, player, msg) {
  try {
    saveState(block, state);
    player.onScreenDisplay?.setActionBar?.(msg ?? "");
  } catch {
    /* ignore */
  }
}

export async function openDryingUi(player, block) {
  const state = loadState(block);
  const form = new ActionFormData();
  form.title("psybed:psychedelicraft.ui.drying_table");
  form.body(
    [
      `Heat: ${Math.round((state.heatRatio ?? 0) * 100)}%`,
      `Progress: ${Math.round((state.dryingProgress ?? 0) * 100)}%`,
      `Inputs: ${Object.values(state.items ?? {}).filter(Boolean).length - (state.items?.[0] ? 1 : 0)}/9`,
      state.items?.[0] ? `Output: ${state.items[0].id} x${state.items[0].amount}` : "Output: empty",
    ].join("\n"),
  );
  form.button("psybed:psychedelicraft.ui.close");
  await form.show(player);
}
