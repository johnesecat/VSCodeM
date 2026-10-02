// Source: FillRecepticalRecipe, ChangeRecepticalRecipe, PouringRecipe,
// FluidAwareShapelessRecipe, SmeltingFluidRecipe and BottleRecipe.
// Bedrock cannot intercept the crafting grid's dynamic-property output, so
// these operations run through a crafting-table form and synchronous commits.
import { ItemStack } from "@minecraft/server";
import { CONTENT } from "../data/content.js";
import { RECIPES } from "../data/recipes.js";
import { ITEM_TAGS } from "../data/tags.js";
import { readItemFluid, writeItemFluid, makeFluidState } from "./fluids.js";

export function capacityOf(stack) {
  if (!stack) return 0;
  const id = stack.typeId;
  const def = CONTENT.items.find((i) => `psychedelicraft:${i.id}` === id);
  if (def?.capacity) return def.capacity;
  if (/^psychedelicraft:.+_barrel$/.test(id)) return 16000;
  if (["psychedelicraft:flask", "psychedelicraft:distillery"].includes(id)) return 8000;
  if (id === "psychedelicraft:mash_tub") return 32000;
  if (id === "psychedelicraft:molotov_cocktail") return 2000;
  return { "minecraft:bucket": 1000, "minecraft:water_bucket": 1000, "minecraft:lava_bucket": 1000, "minecraft:milk_bucket": 1000, "minecraft:glass_bottle": 125, "minecraft:bowl": 50 }[id] ?? 0;
}
export function attributesOf(spec) {
  if (!spec) return {};
  if (typeof spec === "object") return spec;
  try { return JSON.parse(spec); } catch { return {}; }
}
export function fluidMatches(fluid, restriction) {
  if (!fluid) return false;
  const spec = typeof restriction === "string" ? { fluid: restriction } : restriction;
  const id = spec.fluid.replace(/^psychedelicraft:/, "");
  return fluid.id === id && (spec.level <= 0 || spec.level == null || fluid.level >= spec.level)
    && Object.entries(attributesOf(spec.attributes)).every(([key, value]) => fluid[key] === value);
}
export function tagMatches(id, tag, seen = new Set()) {
  if (seen.has(tag)) return false;
  const next = new Set(seen); next.add(tag);
  if ((ITEM_TAGS[tag] ?? []).some((value) => value.startsWith("#") ? tagMatches(id, value.slice(1), next) : value === id)) return true;
  // Vanilla/common tags absent from the Java mod tree.
  if (tag === "c:glass_blocks") return id === "minecraft:glass" || /^minecraft:.+_stained_glass$/.test(id);
  if (tag === "minecraft:wool") return /^minecraft:.+_wool$/.test(id) || id === "minecraft:wool";
  return false;
}
export function ingredientMatches(stack, ingredient) {
  if (!stack) return false;
  if (Array.isArray(ingredient)) return ingredient.some((i) => ingredientMatches(stack, i));
  if (ingredient.item && stack.typeId !== ingredient.item) return false;
  if (ingredient.tag && !tagMatches(stack.typeId, ingredient.tag)) return false;
  return !ingredient.fluid || fluidMatches(readFluid(stack), ingredient.fluid);
}
export function readFluid(stack) {
  const stored = readItemFluid(stack);
  if (stored) return stored;
  const vanilla = { "minecraft:water_bucket": "minecraft:water", "minecraft:lava_bucket": "minecraft:lava", "minecraft:milk_bucket": "milk" };
  return vanilla[stack?.typeId] ? makeFluidState(vanilla[stack.typeId], 1000) : null;
}
export function setFluid(stack, fluid) {
  if (stack.typeId.startsWith("minecraft:") && fluid?.level > 0) {
    const filled = { "minecraft:bucket": "filled_bucket", "minecraft:water_bucket": "filled_bucket", "minecraft:lava_bucket": "filled_bucket", "minecraft:milk_bucket": "filled_bucket", "minecraft:glass_bottle": "filled_glass_bottle", "minecraft:bowl": "filled_bowl" }[stack.typeId];
    if (filled) stack = new ItemStack(`psychedelicraft:${filled}`, 1);
  } else if (!fluid?.level && ["minecraft:water_bucket", "minecraft:lava_bucket", "minecraft:milk_bucket"].includes(stack.typeId)) {
    return new ItemStack("minecraft:bucket", 1);
  }
  return writeItemFluid(stack, fluid);
}
export function suitable(stack, fluid) {
  if (!capacityOf(stack)) return false;
  // SimpleFluid's default suitability is unrestricted; injectable fluids and
  // hot coffee restrictions are applied by source recipe receptacle tags.
  const def = CONTENT.fluids.find((f) => f.id === fluid?.id);
  if (def?.kind === "alcohol") return tagMatches(stack.typeId, "psychedelicraft:suitable_alcoholic_drink_recepticals") || /_barrel$/.test(stack.typeId);
  if (fluid?.id === "coffee") return tagMatches(stack.typeId, "psychedelicraft:suitable_hot_drink_recepticals");
  if (def?.kind === "drug" || def?.kind === "extract") return stack.typeId === "psychedelicraft:syringe" ? !!def.injectable : stack.typeId !== "psychedelicraft:wooden_mug" && !def.injectable;
  return !!fluid;
}
function clone(stack) { return stack?.clone(); }
function takeOne(slots, index) {
  const stack = slots[index];
  const one = clone(stack); one.amount = 1;
  if (stack.amount > 1) { const left = clone(stack); left.amount--; slots[index] = left; }
  else slots[index] = undefined;
  return one;
}
function add(slots, stack) {
  // Conservative: require empty slots instead of merging metadata-bearing items.
  const max = stack.maxAmount ?? 64;
  let amount = stack.amount;
  while (amount > 0) {
    const index = slots.findIndex((s) => !s);
    if (index < 0) return false;
    const next = clone(stack); next.amount = Math.min(amount, max);
    slots[index] = next; amount -= next.amount;
  }
  return true;
}
function matchSlots(slots, ingredients, reserved = new Set()) {
  const remaining = slots.map((s) => s?.amount ?? 0);
  for (const i of reserved) remaining[i] = 0;
  const result = [];
  function search(n) {
    if (n === ingredients.length) return true;
    for (let i = 0; i < slots.length; i++) {
      if (!remaining[i] || !ingredientMatches(slots[i], ingredients[n])) continue;
      remaining[i]--; result.push(i);
      if (search(n + 1)) return true;
      remaining[i]++; result.pop();
    }
    return false;
  }
  return search(0) ? result : null;
}
function remainder(stack) {
  if (["minecraft:water_bucket", "minecraft:lava_bucket", "minecraft:milk_bucket"].includes(stack.typeId)) return new ItemStack("minecraft:bucket", 1);
  if (stack.typeId === "minecraft:honey_bottle") return new ItemStack("minecraft:glass_bottle", 1);
  return null;
}
export function recipesForCrafting() {
  return [...RECIPES.fill_receptical, ...RECIPES.change_receptical, ...RECIPES.shapeless_fluid, ...RECIPES.shaped_fluid.filter((r) => !r.blocked)];
}
// Planner never mutates input stacks. Null means no match/insufficient capacity.
export function planRecipe(input, recipe, heldSlot = 0) {
  const slots = input.map(clone), extras = [];
  let containerIndex = -1;
  if (recipe.type.endsWith("fill_receptical")) {
    containerIndex = ingredientMatches(slots[heldSlot], recipe.receptical) && capacityOf(slots[heldSlot]) ? heldSlot : -1;
    if (containerIndex < 0 || slots[containerIndex].amount !== 1) return null;
  }
  const ingredients = recipe.ingredients ?? recipe.pattern.flatMap((row) => [...row].filter((c) => c !== " ").map((c) => recipe.key[c]));
  const matched = matchSlots(slots, ingredients, containerIndex >= 0 ? new Set([containerIndex]) : new Set());
  if (!matched) return null;
  const consumed = matched.map((i) => takeOne(slots, i));
  for (const stack of consumed) { const rem = remainder(stack); if (rem) extras.push(rem); }
  let output;
  if (recipe.type.endsWith("fill_receptical")) {
    const original = slots[containerIndex], old = readFluid(original);
    const fluid = { ...makeFluidState(recipe.result.fluid.replace(/^psychedelicraft:/, "")), ...attributesOf(recipe.result.attributes) };
    fluid.level = Math.min(capacityOf(original), recipe.result.level > 0 ? recipe.result.level + (old?.level ?? 0) : capacityOf(original));
    slots[containerIndex] = setFluid(original, fluid);
  } else if (recipe.type.endsWith("change_receptical")) {
    const originals = consumed.filter((s) => capacityOf(s));
    if (originals.length !== 1) return null;
    output = new ItemStack(recipe.result.item, recipe.result.count ?? 1);
    const fluid = readFluid(originals[0]);
    if (fluid) output = setFluid(output, { ...fluid, level: Math.min(capacityOf(output), fluid.level) });
    const dye = originals[0].getDynamicProperty("ps:dye");
    if (dye !== undefined) output.setDynamicProperty("ps:dye", dye);
  } else {
    output = new ItemStack(recipe.result.item, recipe.result.count ?? 1);
    consumed.forEach((stack, n) => {
      const restriction = ingredients[n].fluid;
      if (typeof restriction === "object" && restriction.level > 0 && !remainder(stack)) {
        const fluid = readFluid(stack);
        extras.push(setFluid(stack, { ...fluid, level: fluid.level - restriction.level }));
      }
    });
    const colored = consumed.find((s) => /_stained_glass$/.test(s.typeId));
    if (colored && recipe.type.endsWith("crafting_shaped")) output.setDynamicProperty("ps:dye", colored.typeId.replace(/^minecraft:|_stained_glass$/g, ""));
  }
  if (output) extras.push(output);
  if (!extras.every((stack) => add(slots, stack))) return null;
  return slots;
}
export function planPour(input, fromIndex, toIndex) {
  if (fromIndex === toIndex) return null;
  const slots = input.map(clone), from = slots[fromIndex], to = slots[toIndex];
  if (!from || !to || from.amount !== 1 || to.amount !== 1) return null;
  const fluid = readFluid(from), old = readFluid(to);
  if (!fluid || !suitable(to, fluid) || old && ["id", "fermentation", "distillation", "maturation", "vinegar", "temperature"].some((k) => old[k] !== fluid[k])) return null;
  const amount = Math.min(fluid.level, capacityOf(to) - (old?.level ?? 0));
  if (amount <= 0) return null;
  slots[fromIndex] = setFluid(from, { ...fluid, level: fluid.level - amount });
  slots[toIndex] = setFluid(to, { ...fluid, level: (old?.level ?? 0) + amount });
  return slots;
}
export function planHeat(input, slot, recipe) {
  const slots = input.map(clone), stack = slots[slot];
  if (!stack || stack.amount !== 1 || !fluidMatches(readFluid(stack), recipe.input)) return null;
  if (recipe.item && !ingredientMatches(stack, recipe.item)) return null;
  const fluid = { ...readFluid(stack) };
  for (const [key, mod] of Object.entries(recipe.result.attributes ?? {})) {
    const old = fluid[key] ?? 0, value = mod.value;
    fluid[key] = ({ set: () => value, add: () => old + value, subtract: () => old - value, multiply: () => old * value, divide: () => value ? Math.trunc(old / value) : old }[mod.type] ?? (() => old + value))();
  }
  slots[slot] = setFluid(recipe.result.item ? new ItemStack(recipe.result.item, recipe.result.count ?? 1) : stack, fluid);
  return slots;
}
export function snapshot(inv) { return Array.from({ length: inv.size }, (_, i) => inv.getItem(i)); }
export function commitPlan(inv, plan) {
  if (!plan || plan.length !== inv.size) return false;
  const before = snapshot(inv);
  try { plan.forEach((stack, i) => inv.setItem(i, stack)); }
  catch (error) { before.forEach((stack, i) => inv.setItem(i, stack)); throw error; }
  return true;
}
export function fillFromWorld(player, block) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const stack = inv?.getItem(player.selectedSlotIndex);
  const id = /lava/.test(block.typeId) ? "minecraft:lava" : /water/.test(block.typeId) ? "minecraft:water" : null;
  if (!id || !stack || stack.amount !== 1 || !capacityOf(stack)) return false;
  inv.setItem(player.selectedSlotIndex, setFluid(stack, makeFluidState(id, capacityOf(stack))));
  return true;
}
