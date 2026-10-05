// Hallucinations — port of entity/drug/hallucination/* + RealityRiftEntity.java.
//
// Java drives these through its shader pipeline (post-processing, drifting
// camera, entity-spawning hallucinations). Bedrock cannot load custom shaders,
// so each observable is reproduced through the closest engine surface:
//   COLOR hallucination        -> /camera fade color pulses (screen tint)
//   SUPER_SAT / DESATURATION   -> tint saturation proxies (white/gray pulses)
//   INVERSION                  -> black/white strobe fade
//   MOVEMENT hallucination     -> /camera set minecraft:free drifting sway
//   CONTEXTUAL hallucination   -> visual-only hallucination entities that
//                                 despawn when approached or damaged
//   DOUBLE_VISION / MOTION_BLUR-> rapid double tint pulses (documented proxy)
//   REALITY RIFT               -> drifting visual entity + rift particles,
//                                 capturable by the rift jar (RiftJarBlockEntity)
// Strengths come from Drug.AggregateModifier values (drug formulas in
// data/content.js), so intensity curves match the Java source.

import { system, world } from "@minecraft/server";
import { HEAT_NOISE } from "../data/heat_noise.js";

const RIFT_SPAWN_INTERVAL = 180 * 60 * 20; // PSConfig.randomTicksUntilRiftSpawn

const state = {
  lastFade: new Map(),
  hallucinations: new Map(), // entity id -> { born, owner }
  rifts: new Map(), // entity id -> { born, phase }
};

function cam(player, cmd) {
  try {
    player.runCommand(`camera @s ${cmd}`);
  } catch {
    /* camera commands unavailable */
  }
}

function tintFade(player, r, g, b, seconds = 0.35) {
  cam(player, `fade time 0.15 ${seconds} 0.25 color ${r} ${g} ${b}`);
}

// ---------------------------------------------------------------------------
// Per-player hallucination update (called from the main 1s loop)
// ---------------------------------------------------------------------------
export function updateHallucinations(player, properties) {
  const color = properties.getAggregate("color");
  const movement = properties.getAggregate("movement");
  const contextual = properties.getAggregate("contextual");
  const superSat = properties.getAggregate("superSaturation");
  const desat = properties.getAggregate("desaturation");
  const inversion = properties.getAggregate("inversion");
  const bloom = properties.getAggregate("bloom");
  const doubleVision = properties.getAggregate("doubleVision");
  const motionBlur = properties.getAggregate("motionBlur");

  // --- COLOR hallucination: hue pulses (Drug colorization/bloom curves) ---
  if (color > 0.02 && Math.random() < Math.min(0.9, color * 1.5)) {
    const hue = Math.random();
    const r = Math.round(128 + 127 * Math.sin(hue * 6.28));
    const g = Math.round(128 + 127 * Math.sin(hue * 6.28 + 2.09));
    const b = Math.round(128 + 127 * Math.sin(hue * 6.28 + 4.19));
    tintFade(player, r, g, b, 0.25 + color * 0.6);
  }
  // --- SUPER_SATURATION / BLOOM: bright pulses ---
  if (superSat + bloom > 0.05 && Math.random() < (superSat + bloom) * 0.5) {
    tintFade(player, 255, 255, 255, 0.2 + bloom * 0.4);
  }
  // --- DESATURATION: gray pulses ---
  if (desat > 0.05 && Math.random() < desat * 0.5) {
    tintFade(player, 128, 128, 128, 0.3 + desat * 0.5);
  }
  // --- INVERSION: black/white strobe ---
  if (inversion > 0.05 && Math.random() < inversion * 0.4) {
    tintFade(player, 0, 0, 0, 0.15);
    system.runTimeout(() => tintFade(player, 255, 255, 255, 0.15), 6);
  }
  // --- DOUBLE_VISION / MOTION_BLUR: double-pulse proxy ---
  if (doubleVision + motionBlur > 0.1 && Math.random() < (doubleVision + motionBlur) * 0.3) {
    tintFade(player, 20, 20, 40, 0.12);
    system.runTimeout(() => tintFade(player, 40, 20, 20, 0.12), 5);
  }

  // --- MOVEMENT hallucination: drifting camera (DriftingCamera.java analogue)
  if (movement > 0.05 && Math.random() < Math.min(0.8, movement)) {
    const t = Date.now() / 1000;
    const sway = movement * 2.2;
    const loc = player.location;
    cam(
      player,
      `set minecraft:free ease 0.6 linear pos ${loc.x.toFixed(2)} ${(loc.y + 1.62).toFixed(2)} ${loc.z.toFixed(2)} rot ${(player.getRotation().x + Math.sin(t) * sway * 6).toFixed(2)} ${(player.getRotation().y + Math.cos(t * 0.7) * sway * 6).toFixed(2)}`,
    );
    system.runTimeout(() => cam(player, "clear"), 25 + Math.floor(movement * 20));
  }

  // --- CONTEXTUAL hallucination: fake entities (EntityHallucinationList.java)
  if (contextual > 0.05 && Math.random() < Math.min(0.6, contextual * 0.8)) {
    spawnHallucination(player, contextual);
  }

  // --- REALITY RIFT spawning (RealityRiftEntity.spawn via config interval) ---
  if (Math.random() < 1 / RIFT_SPAWN_INTERVAL || (properties.isTripping() && Math.random() < 0.002)) {
    spawnRealityRift(player);
  }

  // drift + lifetime management
  tickHallucinationEntities(player);
}

// ---------------------------------------------------------------------------
// Hallucination entities (RastaHeadHallucination / EntityHallucination)
// ---------------------------------------------------------------------------
function spawnHallucination(player, strength) {
  try {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 10 * (1 - strength);
    const loc = {
      x: player.location.x + Math.cos(angle) * dist,
      y: player.location.y + (Math.random() * 3 - 1),
      z: player.location.z + Math.sin(angle) * dist,
    };
    const entity = player.dimension.spawnEntity("psychedelicraft:hallucination", loc);
    entity.addTag("ps_hallucination");
    state.hallucinations.set(entity.id, { born: Date.now(), owner: player.id, maxLife: 4000 + Math.random() * 6000 });
  } catch {
    /* entity unavailable */
  }
}

function tickHallucinationEntities(player) {
  for (const [id, info] of state.hallucinations) {
    try {
      const entity = world.getEntity(id);
      if (!entity) {
        state.hallucinations.delete(id);
        continue;
      }
      const age = Date.now() - info.born;
      const near = distance(entity.location, player.location) < 3.5;
      if (age > info.maxLife || near) {
        // approaching a hallucination makes it vanish (Java behavior)
        entity.triggerEvent("psychedelicraft:vanish");
        entity.remove();
        state.hallucinations.delete(id);
      }
    } catch {
      state.hallucinations.delete(id);
    }
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// ---------------------------------------------------------------------------
// Reality Rift (RealityRiftEntity.java + RiftJarBlock.java)
// ---------------------------------------------------------------------------
function spawnRealityRift(player) {
  try {
    const angle = Math.random() * Math.PI * 2;
    const loc = {
      x: player.location.x + Math.cos(angle) * 8,
      y: player.location.y + 1 + Math.random() * 2,
      z: player.location.z + Math.sin(angle) * 8,
    };
    const rift = player.dimension.spawnEntity("psychedelicraft:reality_rift", loc);
    rift.addTag("ps_rift");
    state.rifts.set(rift.id, { born: Date.now(), phase: Math.random() * Math.PI * 2 });
    player.dimension.playSound("psybed:block.rift_jar.toggle", loc, { volume: 0.6 });
  } catch {
    /* entity unavailable */
  }
}

// Rifts drift in slow orbits and emit their particle halo; a placed rift jar
// within range captures one (RiftJarBlockEntity absorb behavior).
export function tickRifts(player) {
  for (const [id, info] of state.rifts) {
    try {
      const rift = world.getEntity(id);
      if (!rift) {
        state.rifts.delete(id);
        continue;
      }
      info.phase += 0.05;
      const t = info.phase;
      const base = player.location;
      const target = {
        x: base.x + Math.cos(t) * 7,
        y: base.y + 1.5 + Math.sin(t * 0.6) * 1.2,
        z: base.z + Math.sin(t) * 7,
      };
      const cur = rift.location;
      rift.teleport({
        x: cur.x + (target.x - cur.x) * 0.02,
        y: cur.y + (target.y - cur.y) * 0.05,
        z: cur.z + (target.z - cur.z) * 0.02,
      });

      // particle halo (zero_screen frames approximated by flickering particles)
      if (Math.random() < 0.6) {
        player.dimension.spawnParticle("psychedelicraft:rift_frames", rift.location);
      }

      // Placed jar blocks own capture/charge via riftJar.onTick. Never search
      // for a nonexistent rift_jar entity or instantly destroy whole rifts.
    } catch {
      state.rifts.delete(id);
    }
  }
}

// Heat-noise camera proxy: uses the original shader's two noise-sample
// velocities. This is global camera sway, NOT per-pixel framebuffer refraction.
export function updateHeatMotion(player, properties) {
  let hot = player.dimension.id === "minecraft:nether";
  try {
    const loc = player.location;
    for (const offset of [{ x: 0, y: -1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }]) {
      const block = player.dimension.getBlock({ x: Math.floor(loc.x) + offset.x, y: Math.floor(loc.y) + offset.y, z: Math.floor(loc.z) + offset.z });
      if (/lava|fire|campfire|bunsen_burner/.test(block?.typeId ?? "")) hot = true;
    }
    const eye = player.dimension.getBlock(player.getHeadLocation());
    if (/water/.test(eye?.typeId ?? "")) hot = false;
  } catch { /* unloaded block */ }
  const strength = hot ? 0.01 : 0;
  if (strength > 0) {
    const [x, y] = HEAT_NOISE[Math.floor(system.currentTick / 4) % HEAT_NOISE.length];
    const rotation = player.getRotation();
    player.setRotation({ x: Math.max(-90, Math.min(90, rotation.x + y * strength * 2)), y: rotation.y + x * strength * 2 });
  }
  if (properties.getDrugValue("power") > 0.05 && system.currentTick % 20 === 0) {
    const loc = player.getHeadLocation(), view = player.getViewDirection();
    player.dimension.spawnParticle("psychedelicraft:power_frames", { x: loc.x + view.x * 2, y: loc.y + view.y * 2, z: loc.z + view.z * 2 });
  }
}

export function isRift(entityId) {
  return state.rifts.has(entityId);
}
