// Test-only module copied into the isolated BDS fixture, never shipped.
import { world, system, ItemStack } from "@minecraft/server";
import { launchMolotov, MOLOTOV, combustion } from "./lib/molotov.js";
import { makeFluidState, writeItemFluid, readItemFluid } from "./lib/fluids.js";
const cases = [
  { name: "empty", fluid: null, fire: 0, explosion: 0 },
  { name: "water", fluid: makeFluidState("minecraft:water", 2000), fire: 0, explosion: 0 },
  { name: "half-liter wine", fluid: { ...makeFluidState("red_grapes", 500), fermentation: 2 }, fire: 0.275, explosion: 0.0825 },
  { name: "full wine", fluid: { ...makeFluidState("red_grapes", 2000), fermentation: 2 }, fire: 4, explosion: 1.2 },
  { name: "water entity hit", fluid: makeFluidState("minecraft:water", 2000), fire: 0, explosion: 0, entityHit: true },
  { name: "wine entity hit", fluid: { ...makeFluidState("red_grapes", 500), fermentation: 2 }, fire: 0.275, explosion: 0.0825, entityHit: true },
];
let next = 0, active, collisions = 0;
function check(ok, message) { if (!ok) throw new Error(`Molotov live test: ${message}`); }
function collision(event, entityHit) {
  if (!active || event.projectile.id !== active.entityId) return;
  collisions++;
  system.run(() => {
    try {
      const fireTicks = active.target.getComponent("minecraft:onfire")?.onFireTicksRemaining ?? 0;
      check(!!active, "unexpected collision");
      const health = active.target.getComponent("minecraft:health").currentValue;
      if (active.name === "full wine") check(health < active.health, "native blast did not damage nearby entity");
      check(entityHit === !!active.entityHit, `${active.name}: unexpected collision type`);
      if (active.entityHit) {
        check(health <= active.health - 4, `${active.name}: direct hit did not deal Java minimum damage`);
        check(active.fire > 0 ? fireTicks > 0 : fireTicks === 0, `${active.name}: incorrect ignition (${fireTicks} ticks)`);
      } else if (active.explosion === 0) check(health === active.health, `${active.name}: nonflammable block hit damaged nearby entity`);
      active.target.remove();
      const dim = world.getDimension("overworld");
      check(dim.getBlock({ x: 8, y: 80, z: 0 }).typeId === "minecraft:stone", "impact destroyed solid wall");
      check(!dim.getEntities({ type: MOLOTOV }).some((e) => e.id === active.entityId), "projectile not removed");
      console.warn(`[Molotov live] PASS ${active.name}: fire=${active.fire} explosion=${active.explosion} nearbyHealth=${health}/${active.health} fireTicks=${fireTicks}; wall intact; projectile removed`);
      active = undefined;
      system.runTimeout(runCase, 5);
    } catch (error) { console.error(String(error)); }
  });
}
world.afterEvents.projectileHitBlock.subscribe((event) => collision(event, false));
world.afterEvents.projectileHitEntity.subscribe((event) => collision(event, true));
function runCase() {
  try {
    if (next === cases.length) { console.warn(`[Molotov live] ALL PASS (${collisions} real projectile collisions)`); return; }
    const test = cases[next++], dimension = world.getDimension("overworld");
    const item = new ItemStack(MOLOTOV);
    if (test.fluid) writeItemFluid(item, test.fluid);
    const fluid = readItemFluid(item), strength = combustion(fluid);
    check(Math.abs(strength.fire - test.fire) < 1e-8 && Math.abs(strength.explosion - test.explosion) < 1e-8, "fluid strength mismatch");
    for (let x = 3; x <= 8; x++) for (let y = 78; y <= 83; y++) for (let z = -2; z <= 2; z++) dimension.getBlock({ x, y, z }).setType(x === 8 || y === 78 ? "minecraft:stone" : "minecraft:air");
    const target = dimension.spawnEntity("minecraft:pig", test.entityHit ? { x: 7, y: 80, z: 0.5 } : { x: 6.7, y: 79, z: 1.5 });
    const health = target.getComponent("minecraft:health").currentValue;
    const entity = launchMolotov(dimension, { x: 4.5, y: 80.5, z: 0.5 }, { x: 0.5, y: 0, z: 0 }, fluid);
    active = { ...test, entityId: entity.id, target, health };
  } catch (error) { console.error(String(error)); }
}
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "psychedelicraft:test_molotov") { world.gameRules.mobGriefing = false; runCase(); }
});
