import { BlockPermutation, ItemStack } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { loadState, saveState } from "./machines.js";

export const WOOD_KINDS = new Set(["log", "slab", "stairs", "fence", "fence_gate", "door", "trapdoor", "button", "pressure_plate", "sign"]);
const directions = { north: { x: 0, y: 0, z: -1 }, east: { x: 1, y: 0, z: 0 }, south: { x: 0, y: 0, z: 1 }, west: { x: -1, y: 0, z: 0 } };
const names = Object.keys(directions);
const opposite = (direction) => names[(names.indexOf(direction) + 2) % 4];
export function getState(block, key) { return block.permutation.getState(`psychedelicraft:${key}`); }
function setState(block, key, value) { if (getState(block, key) !== value) block.setPermutation(block.permutation.withState(`psychedelicraft:${key}`, value)); }
function offset(block, delta) { return block.dimension.getBlock({ x: block.location.x + delta.x, y: block.location.y + delta.y, z: block.location.z + delta.z }); }
export function facingFor(yaw) { return names[((Math.floor((yaw + 45) / 90) + 2) % 4 + 4) % 4]; }
function consume(player) {
  if (String(player.getGameMode?.()).toLowerCase() === "creative") return;
  const inv = player.getComponent("minecraft:inventory")?.container, stack = inv?.getItem(player.selectedSlotIndex);
  if (!stack) return;
  if (stack.amount > 1) { stack.amount--; inv.setItem(player.selectedSlotIndex, stack); }
  else inv.setItem(player.selectedSlotIndex, undefined);
}
const axes = new Set(["minecraft:wooden_axe", "minecraft:stone_axe", "minecraft:iron_axe", "minecraft:golden_axe", "minecraft:diamond_axe", "minecraft:netherite_axe"]);
export function stripLog(block, stack, player) {
  if (!axes.has(stack?.typeId) || !["psychedelicraft:juniper_log", "psychedelicraft:juniper_wood"].includes(block.typeId)) return false;
  const axis = getState(block, "axis") ?? "y";
  block.setPermutation(BlockPermutation.resolve(block.typeId.replace("juniper_", "stripped_juniper_"), { "psychedelicraft:axis": axis }));
  if (player && String(player.getGameMode?.()).toLowerCase() !== "creative") {
    const durability = stack.getComponent("minecraft:durability");
    if (durability) {
      const inv = player.getComponent("minecraft:inventory")?.container;
      if (durability.damage + 1 >= durability.maxDurability) inv.setItem(player.selectedSlotIndex, undefined);
      else { durability.damage++; inv.setItem(player.selectedSlotIndex, stack); }
    }
  }
  return true;
}
export function mergeSlab(block, stack, player) {
  if (block.typeId !== "psychedelicraft:juniper_slab" || stack?.typeId !== block.typeId || getState(block, "type") === "double") return false;
  setState(block, "type", "double"); consume(player); return true;
}
export function placeWood({ player, block, itemStack, blockFace, faceLocation }) {
  const id = itemStack.typeId;
  if (mergeSlab(block, itemStack, player)) return true;
  const face = String(blockFace).toLowerCase();
  const delta = face === "up" ? { x: 0, y: 1, z: 0 } : face === "down" ? { x: 0, y: -1, z: 0 } : directions[face];
  if (!delta) return false;
  const target = offset(block, delta);
  if (!target?.isAir) return false;
  const states = {}, facing = facingFor(player.getRotation().y);
  let placedId = id;
  if (/sign$/.test(id)) {
    if (id === "psychedelicraft:juniper_sign" && delta.y === 0) placedId = "psychedelicraft:juniper_wall_sign";
    if (id === "psychedelicraft:juniper_hanging_sign" && delta.y === 0) placedId = "psychedelicraft:juniper_wall_hanging_sign";
  }
  const above = target.above(1);
  if (id.endsWith("_door") && (!above?.isAir || target.below(1)?.isAir)) return false;
  if (/juniper_(log|wood)$/.test(id)) states["psychedelicraft:axis"] = delta.x ? "x" : delta.z ? "z" : "y";
  if (/stairs|trapdoor|fence_gate|door|button|sign/.test(id)) states["psychedelicraft:facing"] = delta.y === 0 && /sign|button/.test(id) ? face : facing;
  const half = face === "down" || face !== "up" && (faceLocation?.y ?? 0) > 0.5 ? "top" : "bottom";
  if (id.endsWith("_slab")) states["psychedelicraft:type"] = half;
  if (/stairs|trapdoor/.test(id)) states["psychedelicraft:half"] = half;
  if (id.endsWith("_door")) {
    states["psychedelicraft:half"] = "lower";
    const left = directions[names[(names.indexOf(facing) + 3) % 4]];
    const right = directions[names[(names.indexOf(facing) + 1) % 4]];
    states["psychedelicraft:hinge"] = offset(target, right)?.typeId === id || !offset(target, left)?.isAir && offset(target, right)?.isAir ? "right" : "left";
  }
  if (id.endsWith("_button")) states["psychedelicraft:face"] = face === "up" ? "floor" : face === "down" ? "ceiling" : "wall";
  // Sign variants use only facing (standing rotation is approximated to cardinal).
  if (/sign$/.test(id)) {
    const base = BlockPermutation.resolve(placedId);
    const supported = base.getAllStates();
    if ("psychedelicraft:rotation" in supported) {
      delete states["psychedelicraft:facing"];
      states["psychedelicraft:rotation"] = ((Math.round((player.getRotation().y + 180) / 22.5) % 16) + 16) % 16;
    }
  }
  target.setPermutation(BlockPermutation.resolve(placedId, states));
  if (id.endsWith("_door")) above.setPermutation(BlockPermutation.resolve(id, { ...states, "psychedelicraft:half": "upper" }));
  consume(player); return true;
}
export function toggleWood(block) {
  if (/door|fence_gate/.test(block.typeId)) {
    const open = !getState(block, "open"); setState(block, "open", open);
    if (block.typeId.endsWith("juniper_door")) {
      const partner = getState(block, "half") === "upper" ? block.below(1) : block.above(1);
      if (partner?.typeId === block.typeId) setState(partner, "open", open);
    }
    return true;
  }
  if (block.typeId.endsWith("_button")) {
    setState(block, "powered", true);
    const state = loadState(block); state.buttonTicks = 30; saveState(block, state);
    return true;
  }
  return false;
}
export function breakDoorPartner(block, permutation) {
  if (permutation.type.id !== "psychedelicraft:juniper_door") return;
  const half = permutation.getState("psychedelicraft:half");
  const partner = half === "upper" ? block.below(1) : block.above(1);
  if (partner?.typeId === "psychedelicraft:juniper_door") partner.setType("minecraft:air");
}
export function stairShape(block) {
  const facing = getState(block, "facing"), half = getState(block, "half");
  const side = (other) => names[(names.indexOf(facing) + 3) % 4] === other ? "left" : "right";
  const same = (other) => other?.typeId === block.typeId && getState(other, "half") === half;
  const differentAt = (direction) => {
    const neighbor = offset(block, directions[direction]);
    return !same(neighbor) || getState(neighbor, "facing") !== facing;
  };
  const front = offset(block, directions[facing]);
  if (same(front) && getState(front, "facing") !== facing && getState(front, "facing") !== opposite(facing) && differentAt(opposite(getState(front, "facing")))) return `outer_${side(getState(front, "facing"))}`;
  const back = offset(block, directions[opposite(facing)]);
  if (same(back) && getState(back, "facing") !== facing && getState(back, "facing") !== opposite(facing) && differentAt(getState(back, "facing"))) return `inner_${side(getState(back, "facing"))}`;
  return "straight";
}
export async function editSign(player, block) {
  const id = block.typeId, location = { ...block.location }, state = loadState(block);
  const back = !!player.isSneaking, key = back ? "backText" : "frontText";
  if (state.waxed) { player.sendMessage(state[key] ?? ""); return; }
  const result = await new ModalFormData().title(`Juniper sign — ${back ? "back" : "front"}`).textField("Text (four lines maximum)", "Your sign text", state[key] ?? "").show(player);
  if (result.canceled || block.typeId !== id || Object.keys(location).some((k) => location[k] !== block.location[k])) return;
  const fresh = loadState(block);
  if (fresh.waxed) return;
  fresh[key] = String(result.formValues[0] ?? "").slice(0, 384).split("\n").slice(0, 4).join("\n");
  saveState(block, fresh); player.sendMessage(fresh[key]);
}
export const wood = {
  onPlayerInteract({ block, player }) {
    if (/sign$/.test(block.typeId)) {
      const inv = player?.getComponent("minecraft:inventory")?.container, held = inv?.getItem(player.selectedSlotIndex);
      const state = loadState(block), key = player.isSneaking ? "back" : "front";
      if (held?.typeId === "minecraft:honeycomb") { state.waxed = true; saveState(block, state); consume(player); }
      else if (axes.has(held?.typeId)) { state.waxed = false; state[`${key}Glow`] = false; saveState(block, state); }
      else if (!state.waxed && (held?.typeId === "minecraft:glow_ink_sac" || held?.typeId?.endsWith("_dye"))) { state[`${key}Glow`] = held.typeId === "minecraft:glow_ink_sac"; state[`${key}Dye`] = held.typeId; saveState(block, state); consume(player); }
      else editSign(player, block).catch((error) => console.warn(`[Psychedelicraft] sign form: ${error}`));
    } else toggleWood(block);
    return {};
  },
  onTick({ block }) {
    const id = block.typeId;
    if (id.endsWith("_button")) {
      const state = loadState(block);
      const arrows = block.dimension.getEntities({ type: "minecraft:arrow", location: { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 }, maxDistance: 0.75 });
      if (arrows.length) state.buttonTicks = 30;
      state.buttonTicks = Math.max(0, (state.buttonTicks ?? 0) - 1);
      setState(block, "powered", state.buttonTicks > 0); saveState(block, state);
    } else if (id.endsWith("_pressure_plate")) {
      const p = block.location;
      const pressed = block.dimension.getEntities({ location: { x: p.x + 0.5, y: p.y + 0.1, z: p.z + 0.5 }, maxDistance: 1 }).some((e) => Math.abs(e.location.x - p.x - 0.5) < 0.5 && Math.abs(e.location.z - p.z - 0.5) < 0.5 && e.location.y >= p.y && e.location.y < p.y + 0.5);
      setState(block, "powered", pressed);
    } else if (id.endsWith("_fence")) {
      for (const [face, delta] of Object.entries(directions)) {
        const neighbor = offset(block, delta);
        setState(block, face, !!neighbor && !neighbor.isAir && (!neighbor.typeId.includes("minecraft:water")) && (neighbor.isSolid || /fence|planks|log|wood/.test(neighbor.typeId)));
      }
    } else if (id.endsWith("_stairs")) setState(block, "shape", stairShape(block));
    else if (/door|fence_gate/.test(id)) {
      const state = loadState(block);
      const nearbyPower = [...Object.values(directions), { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }].some((delta) => (offset(block, delta)?.getRedstonePower?.() ?? 0) > 0);
      const powered = (block.getRedstonePower?.() ?? 0) > 0 || nearbyPower;
      if ((state.powered ?? false) !== powered) {
        state.powered = powered; saveState(block, state);
        if (getState(block, "open") !== powered) toggleWood(block);
      }
      if (id.endsWith("juniper_door")) {
        const partner = getState(block, "half") === "upper" ? block.below(1) : block.above(1);
        if (partner?.typeId !== id) { const lower = getState(block, "half") === "lower"; block.setType("minecraft:air"); if (lower) block.dimension.spawnItem(new ItemStack(id), block.location); }
      }
    }
  },
};
