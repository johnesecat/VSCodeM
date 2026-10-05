// DrugFluid + MolotovCocktailEntity: alcohol is volume-scaled BEFORE clamping,
// then combustion multiplies by volume again (preserve the Java formula).
import { system, world } from "@minecraft/server";
import { drugInfluencesPerLiter, readItemFluid, VOLUMES } from "./fluids.js";
export const MOLOTOV = "psychedelicraft:molotov_cocktail";
export function combustion(fluid) {
  const liters = Math.max(0, fluid?.level ?? 0) / VOLUMES.BUCKET;
  const total = fluid ? drugInfluencesPerLiter(fluid).filter((i) => i.drugType === "alcohol").reduce((n, i) => n + i.maxInfluence * liters, 0) : 0;
  const alcohol = Math.max(0, Math.min(1, total));
  const fire = alcohol * liters * 2, explosion = alcohol * liters * 0.6;
  return { fire, explosion, damage: Math.max(4, explosion * 0.6 + fire * 0.3), fireSeconds: Math.floor(Math.max(10, 3 * fire)) / 20, quality: Math.max(0, Math.min(7, Math.floor(fire * 0.6 + explosion * 0.8 + 0.5))) };
}
export function launchMolotov(dimension, location, velocity, fluid, owner) {
  const entity = dimension.spawnEntity(MOLOTOV, location);
  try {
    entity.setDynamicProperty("ps:molotovFluid", JSON.stringify(fluid ?? null));
    entity.setDynamicProperty("ps:molotovBorn", system.currentTick);
    const projectile = entity.getComponent("minecraft:projectile");
    if (!projectile) throw new Error("Molotov projectile component missing");
    if (owner) projectile.owner = owner;
    projectile.shoot(velocity);
    return entity;
  } catch (error) { entity.remove(); throw error; }
}
export const molotovItem = {
  onUse({ player, itemStack }) {
    const direction = player.getViewDirection(), head = player.getHeadLocation();
    const entity = launchMolotov(player.dimension, { x: head.x + direction.x * 0.6, y: head.y + direction.y * 0.6, z: head.z + direction.z * 0.6 }, { x: direction.x * 0.5, y: direction.y * 0.5, z: direction.z * 0.5 }, readItemFluid(itemStack), player);
    return entity ? { consumeItem: true, playSound: "random.bow" } : {};
  },
};
function particles(dimension, location, spread = 1) {
  const triangular = () => (Math.random() - Math.random()) * 0.5 * spread;
  const point = { x: location.x + triangular(), y: location.y + triangular(), z: location.z + triangular() };
  dimension.spawnParticle("minecraft:basic_flame_particle", point);
  dimension.spawnParticle("minecraft:lava_particle", point);
}
export function impactMolotov(event, target) {
  const projectile = event.projectile;
  if (!projectile.isValid || projectile.typeId !== MOLOTOV || projectile.getDynamicProperty("ps:molotovHit")) return;
  projectile.setDynamicProperty("ps:molotovHit", true);
  const fluid = JSON.parse(projectile.getDynamicProperty("ps:molotovFluid") ?? "null");
  const strength = combustion(fluid), dimension = event.dimension, location = event.location;
  try {
    if (target) {
      target.applyDamage(strength.damage, { damagingProjectile: projectile, ...(event.source ? { damagingEntity: event.source } : {}) });
      // Bedrock truncates sub-second setOnFire durations to zero.
      // Round UP to one-second granularity so Java's 10-tick minimum
      // remains observable rather than silently losing ignition.
      if (strength.fire > 0) target.setOnFire(Math.ceil(strength.fireSeconds), true);
    }
    dimension.playSound("random.glass", location);
    for (let i = 0; i < strength.fire * 2; i++) particles(dimension, location, strength.fire);
    if (strength.explosion > 0) {
      // Java protects non-replaceable blocks. Bedrock lacks Java's block
      // replaceability predicate: protect ALL blocks, retaining native blast
      // entity damage/knockback and a bounded air-only fire spread below.
      dimension.createExplosion(location, strength.explosion, { breaksBlocks: false, causesFire: false, ...(event.source ? { source: event.source } : {}) });
      if (world.gameRules.mobGriefing) {
        const radius = Math.ceil(strength.explosion);
        for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) {
          if (x * x + z * z > strength.explosion * strength.explosion) continue;
          const block = dimension.getBlock({ x: Math.floor(location.x) + x, y: Math.floor(location.y), z: Math.floor(location.z) + z });
          if (block?.isAir && block.below()?.isSolid && Math.random() < 1 / 3) block.setType("minecraft:fire");
        }
      }
    } else dimension.playSound("random.fizz", location);
    return strength;
  } finally { if (projectile.isValid) projectile.remove(); }
}
export function registerMolotovEvents() {
  world.afterEvents.projectileHitBlock.subscribe((event) => impactMolotov(event));
  world.afterEvents.projectileHitEntity.subscribe((event) => impactMolotov(event, event.projectile.typeId === MOLOTOV ? event.getEntityHit().entity : undefined));
  system.runInterval(() => {
    for (const id of ["overworld", "nether", "the_end"]) {
      const dimension = world.getDimension(id);
      for (const entity of dimension.getEntities({ type: MOLOTOV })) {
        if (system.currentTick - (entity.getDynamicProperty("ps:molotovBorn") ?? system.currentTick) > 1200) { entity.remove(); continue; }
        const fluid = JSON.parse(entity.getDynamicProperty("ps:molotovFluid") ?? "null");
        if (combustion(fluid).fire > 0) particles(dimension, entity.location);
      }
    }
  }, 1);
}
