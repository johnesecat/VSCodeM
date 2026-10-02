// Bedrock form-based machine interfaces. Fluid volume travels with ItemStack
// dynamic properties; no /give aux values or duplicating container transfers.
import { ActionFormData } from "@minecraft/server-ui";
import { ItemStack } from "@minecraft/server";
import { CONTENT } from "../data/content.js";
import { loadState, saveState, tankDeposit, tankWithdraw, tankCapacity } from "./machines.js";
import { fluidDisplayName, readItemFluid, writeItemFluid } from "./fluids.js";
import { RECIPES } from "../data/recipes.js";
import { recipesForCrafting, planRecipe, planPour, planHeat, snapshot, commitPlan, capacityOf, readFluid, setFluid, suitable } from "./crafting.js";
import { system } from "@minecraft/server";

export async function openFluidCrafting(player, block) {
  const blockId = block.typeId;
  const recipes = recipesForCrafting();
  const form = new ActionFormData().title("Fluid-aware crafting").body("Recipes use your inventory. Hold the receptacle for filling. All ingredients and output space are checked again when you choose.");
  for (const recipe of recipes) form.button(recipe.id.replace("psychedelicraft:", "").replaceAll("_", " "));
  form.button("Pour held fluid into another container");
  const result = await form.show(player);
  if (result.canceled || block.typeId !== blockId) return;
  const inv = inventory(player);
  if (!inv) return;
  if (result.selection < recipes.length) {
    if (!commitPlan(inv, planRecipe(snapshot(inv), recipes[result.selection], player.selectedSlotIndex))) player.sendMessage("Ingredients, receptacle or output space do not match.");
  } else {
    const from = player.selectedSlotIndex;
    const targets = snapshot(inv).map((stack, slot) => ({ stack, slot })).filter(({ stack, slot }) => slot !== from && capacityOf(stack));
    if (!targets.length) return;
    const choose = new ActionFormData().title("Pour into which container?");
    for (const target of targets) choose.button(`Slot ${target.slot + 1}: ${target.stack.typeId}`);
    const chosen = await choose.show(player);
    if (chosen.canceled || block.typeId !== blockId || !targets[chosen.selection]) return;
    if (!commitPlan(inv, planPour(snapshot(inv), from, targets[chosen.selection].slot))) player.sendMessage("Fluids differ, container is full, or an item changed.");
  }
}

const heating = new Set();
export function heatHeldFluid(player, block) {
  if (heating.has(player.id)) return;
  const inv = inventory(player), slot = player.selectedSlotIndex;
  const recipe = RECIPES.smelting_receptical.find((r) => planHeat(snapshot(inv), slot, r));
  if (!recipe) return;
  const fingerprint = JSON.stringify(readItemFluid(inv.getItem(slot)));
  const blockId = block.typeId, dimension = block.dimension, location = { ...block.location };
  heating.add(player.id);
  player.sendMessage(`Heating fluid (${recipe.cookingtime ?? 200} ticks). Keep the same container in the selected slot.`);
  system.runTimeout(() => {
    heating.delete(player.id);
    const currentBlock = dimension.getBlock(location);
    if (currentBlock?.typeId !== blockId || !/lit_|campfire|bunsen_burner/.test(blockId)) return;
    const current = inventory(player);
    if (!current || player.selectedSlotIndex !== slot || JSON.stringify(readItemFluid(current.getItem(slot))) !== fingerprint) return;
    const plan = planHeat(snapshot(current), slot, recipe);
    if (commitPlan(current, plan)) { player.addExperience?.(1); player.sendMessage("Fluid heated."); }
  }, recipe.cookingtime ?? 200);
}

function inventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}
function containerDef(stack) {
  return CONTENT.items.find((i) => `psychedelicraft:${i.id}` === stack?.typeId && ["container", "syringe"].includes(i.kind));
}
function sameFluid(a, b) {
  return ["id", "fermentation", "distillation", "maturation", "vinegar"].every((key) => a[key] === b[key]);
}

export async function openMachineUi(player, kind, block) {
  const preview = loadState(block);
  const body = preview.fluid?.level > 0
    ? `${fluidDisplayName(preview.fluid)}\n${preview.fluid.level} / ${tankCapacity(kind)} mB\nF:${preview.fluid.fermentation} D:${preview.fluid.distillation} M:${preview.fluid.maturation}`
    : "Tank: empty. Hold a container to insert or extract fluid.";
  const result = await new ActionFormData().title(`Psychedelicraft — ${kind.replaceAll("_", " ")}`).body(body)
    .button("Insert held fluid").button("Fill held container").button("Close").show(player);
  if (result.canceled || result.selection === 2 || !block.typeId.startsWith("psychedelicraft:")) return;
  // Reload after awaiting the form: processing or another player may change it.
  const state = loadState(block);
  state.capacity = tankCapacity(kind);
  const inv = inventory(player);
  const slot = player.selectedSlotIndex;
  let held = inv?.getItem(slot);
  const def = containerDef(held) ?? (capacityOf(held) ? { capacity: capacityOf(held) } : null);
  if (!held || !def || held.amount !== 1) {
    player.sendMessage("Hold one drink container or syringe first.");
    return;
  }
  const fluid = readFluid(held);
  if (result.selection === 0) {
    if (!fluid) return;
    const transfer = tankDeposit(state, fluid);
    held = setFluid(held, { ...fluid, level: transfer.remaining });
  } else {
    if (!state.fluid || !suitable(held, state.fluid)) return;
    if (fluid && state.fluid && !sameFluid(fluid, state.fluid)) return;
    const space = (def.capacity ?? 2000) - (fluid?.level ?? 0);
    if (space <= 0) return;
    const taken = tankWithdraw(state, space);
    if (!taken) return;
    held = setFluid(held, { ...taken, level: taken.level + (fluid?.level ?? 0) });
  }
  inv.setItem(slot, held);
  saveState(block, state);
}

export async function openDryingUi(player, block) {
  const preview = loadState(block);
  const result = await new ActionFormData().title("Psychedelicraft — drying table")
    .body(`Heat: ${Math.round((preview.heatRatio ?? 0) * 100)}%\nProgress: ${Math.round((preview.dryingProgress ?? 0) * 100)}%\nOutput: ${preview.items?.[0]?.id ?? "empty"}`)
    .button("Insert one held ingredient").button("Take output").button("Return inputs").button("Close").show(player);
  if (result.canceled || result.selection === 3 || !block.typeId.endsWith("drying_table")) return;
  const state = loadState(block);
  state.items ??= {};
  const inv = inventory(player);
  if (!inv) return;
  if (result.selection === 0) {
    const held = inv.getItem(player.selectedSlotIndex);
    if (!held || !CONTENT.dryingRecipes.some((r) => r.input === held.typeId)) return;
    const slot = Array.from({ length: 9 }, (_, i) => i + 1).find((i) => !state.items[i]);
    if (!slot) return;
    state.items[slot] = { id: held.typeId, amount: 1 };
    if (held.amount > 1) { held.amount--; inv.setItem(player.selectedSlotIndex, held); }
    else inv.setItem(player.selectedSlotIndex, undefined);
  } else {
    const slots = result.selection === 1 ? [0] : Array.from({ length: 9 }, (_, i) => i + 1);
    for (const slot of slots) {
      const item = state.items[slot];
      if (!item) continue;
      const remaining = inv.addItem(new ItemStack(item.id, item.amount));
      if (remaining) state.items[slot] = { id: item.id, amount: remaining.amount };
      else delete state.items[slot];
    }
  }
  saveState(block, state);
}
