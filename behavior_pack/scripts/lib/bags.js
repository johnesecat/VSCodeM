// PaperBagItem equivalent: single item type, 64,000 capacity (bottles: 1).
// Bedrock cannot intercept inventory right-clicks; use an explicit form.
import { ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { tagMatches, snapshot, commitPlan } from "./crafting.js";

const KEY = "ps:bag";
export function readBag(bag) {
  const raw = bag.getDynamicProperty(KEY);
  return raw ? JSON.parse(raw) : null;
}
function encode(stack) {
  return {
    id: stack.typeId, name: stack.nameTag ?? "", lore: stack.getLore?.() ?? [],
    properties: Object.fromEntries((stack.getDynamicPropertyIds?.() ?? []).map((key) => [key, stack.getDynamicProperty(key)])),
    damage: stack.getComponent?.("minecraft:durability")?.damage ?? 0,
    enchantments: (stack.getComponent?.("minecraft:enchantable")?.getEnchantments() ?? []).map((e) => ({ id: e.type.id, level: e.level })),
  };
}
function decode(data, count) {
  const stack = new ItemStack(data.id, count);
  if (data.name) stack.nameTag = data.name;
  stack.setLore(data.lore);
  for (const [key, value] of Object.entries(data.properties)) stack.setDynamicProperty(key, value);
  const durability = stack.getComponent?.("minecraft:durability");
  if (durability) durability.damage = data.damage;
  const enchantable = stack.getComponent?.("minecraft:enchantable");
  for (const e of data.enchantments) enchantable?.addEnchantment({ type: EnchantmentTypes.get(e.id), level: e.level });
  return stack;
}
function writeBag(bag, contents) {
  bag.setDynamicProperty(KEY, contents?.count > 0 ? JSON.stringify(contents) : undefined);
  bag.setLore(contents?.count > 0 ? [`${contents.count} × ${contents.item.id.replace(/^.*:/, "").replaceAll("_", " ")}`] : []);
}
export function bagAccepts(stack) {
  return !!stack && tagMatches(stack.typeId, "psychedelicraft:can_go_into_paper_bag");
}
export function insertBag(bag, incoming) {
  if (bag.amount !== 1 || !bagAccepts(incoming)) return 0;
  const contents = readBag(bag), item = encode(incoming);
  if (contents && JSON.stringify(contents.item) !== JSON.stringify(item)) return 0;
  const capacity = incoming.typeId === "psychedelicraft:bottle" ? 1 : 64000;
  const count = Math.min(incoming.amount, capacity - (contents?.count ?? 0));
  if (count <= 0) return 0;
  writeBag(bag, { item, count: (contents?.count ?? 0) + count });
  return count;
}
export function withdrawBag(bag, count = 64) {
  const contents = readBag(bag);
  if (!contents) return null;
  const prototype = decode(contents.item, 1);
  const amount = Math.min(contents.count, count, prototype.maxAmount ?? 64);
  const stack = decode(contents.item, amount);
  writeBag(bag, { ...contents, count: contents.count - amount });
  return stack;
}
export async function openPaperBag(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex, bag = inv?.getItem(slot);
  if (!bag || bag.typeId !== "psychedelicraft:paper_bag") return;
  if (bag.amount !== 1) { player.sendMessage("Separate one paper bag before filling it."); return; }
  const fingerprint = JSON.stringify(readBag(bag));
  const candidates = Array.from({ length: inv.size }, (_, i) => i).filter((i) => i !== slot && bagAccepts(inv.getItem(i)));
  const form = new ActionFormData().title("Paper bag").body(bag.getLore?.().join("\n") || "Empty. Stores one matching item type.")
    .button("Drop one item").button("Drop one stack");
  for (const i of candidates) form.button(`Store slot ${i + 1}: ${inv.getItem(i).typeId}`);
  const result = await form.show(player);
  if (result.canceled) return;
  const current = inv.getItem(slot);
  if (player.selectedSlotIndex !== slot || current?.typeId !== bag.typeId || current.amount !== 1 || JSON.stringify(readBag(current)) !== fingerprint) return;
  if (result.selection < 2) {
    // Spawn before committing the bag mutation, so failed spawning loses nothing.
    const dropped = withdrawBag(current, result.selection === 0 ? 1 : 64);
    if (!dropped) return;
    const entity = player.dimension.spawnItem(dropped, player.location);
    try {
      inv.setItem(slot, current);
    } catch (error) {
      // The inventory still holds the original bag. Undo the spawned drop
      // rather than leaving both it and the unchanged contents available.
      entity.remove();
      throw error;
    }
    return;
  } else {
    const target = candidates[result.selection - 2];
    if (target == null) return;
    const incoming = inv.getItem(target);
    const inserted = insertBag(current, incoming);
    if (!inserted) return;
    const plan = snapshot(inv);
    if (incoming.amount > inserted) { incoming.amount -= inserted; plan[target] = incoming; }
    else plan[target] = undefined;
    plan[slot] = current;
    commitPlan(inv, plan);
  }
}
