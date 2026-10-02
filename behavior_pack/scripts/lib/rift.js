import { ItemStack } from "@minecraft/server";
import { loadState, saveState, takeState } from "./machines.js";

export function jarDefaults(state) {
  state.currentRiftFraction ??= 0;
  state.isOpening ??= false;
  state.fractionOpen ??= 0;
  state.suckingRifts ??= true;
  state.fractionHandleUp ??= 0;
  return state;
}
export function jarTick(state, rifts, players, center, addDrug) {
  jarDefaults(state);
  state.fractionOpen = Math.max(0, Math.min(1, state.fractionOpen + (state.isOpening ? 0.02 : -0.02)));
  state.fractionHandleUp = Math.max(0, Math.min(1, state.fractionHandleUp + (state.suckingRifts ? -0.04 : 0.04)));
  if (state.fractionOpen > 0 && state.suckingRifts && rifts.length) {
    const amount = 0.001 * state.fractionOpen / rifts.length;
    for (const rift of rifts) {
      const critical = !rift.closing && (rift.instability > 0 || rift.size > 3);
      const drained = critical ? 0.2 : Math.min(amount, rift.size);
      if (!critical) rift.size -= drained;
      state.currentRiftFraction += drained;
    }
  } else if (!state.suckingRifts && state.fractionOpen > 0) {
    const minus = Math.min(0.0004 * state.fractionOpen * state.currentRiftFraction + 0.0004, state.currentRiftFraction);
    for (const player of players) {
      if (["creative", "spectator"].includes(String(player.getGameMode?.()).toLowerCase())) continue;
      const distance = Math.hypot(player.location.x - center.x, player.location.y - center.y, player.location.z - center.z);
      const effect = (5 - distance) * 0.2 * minus;
      // Java box includes points outside radius 5; preserve signed additions.
      addDrug(player, "zero", effect * 5);
      addDrug(player, "power", effect * 35);
    }
    state.currentRiftFraction -= minus;
  }
  state.jarBroken = state.currentRiftFraction > 1;
  return state.jarBroken;
}
export function affectedRifts(block) {
  const p = block.location;
  return block.dimension.getEntities({ type: "psychedelicraft:reality_rift" }).filter((rift) => {
    const l = rift.location;
    return l.x >= p.x - 2 && l.x <= p.x + 3 && l.y >= p.y && l.y <= p.y + 10 && l.z >= p.z - 2 && l.z <= p.z + 3;
  });
}
export function riftState(entity) {
  return { entity, size: entity.getDynamicProperty("ps:riftSize") ?? 1, instability: entity.getDynamicProperty("ps:instability") ?? 0, closing: entity.getDynamicProperty("ps:closing") ?? false };
}
export function releaseRift(block, state) {
  if (state.currentRiftFraction <= 0) return;
  const nearby = affectedRifts(block);
  const entity = nearby[0] ?? block.dimension.spawnEntity("psychedelicraft:reality_rift", { x: block.location.x + 5.5, y: block.location.y + 3.5, z: block.location.z + 1 });
  entity.setDynamicProperty("ps:riftSize", (nearby.length ? riftState(entity).size : 0) + state.currentRiftFraction);
  state.currentRiftFraction = 0;
}
export function chargedJar(amount) {
  const stack = new ItemStack("psychedelicraft:rift_jar", 1);
  stack.setDynamicProperty("ps:riftFraction", amount);
  const label = amount <= 0 ? "empty" : amount < 0.4 ? "slightly filled" : amount < 0.6 ? "half filled" : amount < 0.8 ? "filled" : "over filled";
  stack.setLore([`${label} (${Math.round(amount * 100)}%)`]);
  return stack;
}
export function jarDrop(block) {
  const state = takeState(block);
  return state.jarBroken ? [] : [chargedJar(state.currentRiftFraction ?? 0)];
}
export const riftJar = {
  onTick({ block }) {
    const state = jarDefaults(loadState(block));
    const rifts = affectedRifts(block).map(riftState);
    const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
    const p = block.location;
    const players = block.dimension.getPlayers().filter((player) => {
      const l = player.location;
      return l.x >= p.x - 5 && l.x <= p.x + 6 && l.y >= p.y - 5 && l.y <= p.y + 6 && l.z >= p.z - 2 && l.z <= p.z + 6;
    });
    const broken = jarTick(state, rifts, players, center, (player, drug, amount) => globalThis.__ps?.addDrug?.(player, drug, amount));
    for (const rift of rifts) {
      rift.entity.setDynamicProperty("ps:riftSize", rift.size);
      if (rift.size <= 0) rift.entity.remove();
      else if (state.fractionOpen > 0 && state.suckingRifts) block.dimension.spawnParticle("psychedelicraft:rift_frames", center);
    }
    if (broken) {
      releaseRift(block, state);
      saveState(block, state);
      block.setType("minecraft:air");
      takeState(block);
      block.dimension.createExplosion(center, 1, { breaksBlocks: true, causesFire: false });
    } else saveState(block, state);
  },
  onPlayerInteract({ block, player }) {
    const state = jarDefaults(loadState(block));
    if (player?.isSneaking) state.suckingRifts = !state.suckingRifts;
    else state.isOpening = !state.isOpening;
    saveState(block, state);
    return { sound: player?.isSneaking ? "psybed:block.rift_jar.toggle" : state.isOpening ? "psybed:block.rift_jar.open" : "psybed:block.rift_jar.close" };
  },
};
export const jarItem = {
  onUseOn({ player, itemStack, block, blockFace }) {
    // Block placer may have consumed the item before this callback. The
    // before-interaction hook in main.js snapshots charge for placement.
    return {};
  },
};
