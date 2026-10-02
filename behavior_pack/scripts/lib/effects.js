// Effects — applies Drug aggregate modifiers to the player (DrugProperties.onTick)
// and the verbatim chat distortion of entity/drug/MessageDistorter.java.
//
// Java-side shader effects (color hallucination, bloom, motion blur, double
// vision, desaturation, ...) have NO Bedrock equivalent: Bedrock cannot load
// custom GLSL shaders. Their gameplay-relevant side effects (movement speed,
// jumps, exhaustion, sounds, camera tremble) are reproduced; the post-processing
// visuals are documented in docs/06-bedrock-limitation-report.md.

import { inverseLerp } from "./util.js";

// ---------------------------------------------------------------------------
// MessageDistorter.java — transcribed (probabilities per char/word exact)
// ---------------------------------------------------------------------------
export const FILLER_WORDS = [", like, ", "... like, ", ", uhm, ", ", uhhhh, "];
export const START_FILLER_WORDS = ["Dude, ", "Dood, ", "Dewd, ", "Dude, like, ", "Dood, like, ", "Dewd, like, ", "Yeah... ", "And, "];
export const HICS = ["*hic*", "*hiuc*", "*burp*", "*h-cup*", "*hup*"];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function distortMessage(message, alcohol, zero, cannabis) {
  let out = "";
  let wasPoint = true;
  const randomCaseChance = inverseLerp(alcohol, 0.3, 1) * 0.06 + inverseLerp(zero, 0, 0.3);
  const randomLetterChance = inverseLerp(alcohol, 0.5, 1) * 0.015;
  const sToShChance = inverseLerp(alcohol, 0.2, 0.6);
  const longShChance = alcohol * 0.8;
  const hicChance = inverseLerp(alcohol, 0.5, 1) * 0.04;
  const rewindChance = inverseLerp(alcohol, 0.4, 0.9) * 0.03;
  const longCharChance = inverseLerp(alcohol, 0.3, 1) * 0.025;
  const oneZeroChance = inverseLerp(zero, 0.6, 0.95);
  const randomCharChance = inverseLerp(zero, 0.2, 0.95);
  const fillerWordChance = inverseLerp(cannabis, 0.2, 0.95) * 0.1;
  const startFillerWordChance = inverseLerp(cannabis, 0.2, 0.95) * 0.7;

  const chars = [...message];
  let i = 0;
  while (i < chars.length) {
    let curChar = chars[i];
    if (Math.random() < oneZeroChance) {
      curChar = Math.random() < 0.5 ? "0" : "1";
    } else if (Math.random() < randomCharChance) {
      curChar = String.fromCharCode(32 + Math.floor(Math.random() * 95));
    } else if (Math.random() < randomLetterChance) {
      const upper = Math.random() < 0.5;
      curChar = String.fromCharCode((upper ? 65 : 97) + Math.floor(Math.random() * 26));
    } else if (Math.random() < randomCaseChance) {
      if (Math.random() < 0.5) {
        curChar = curChar === curChar.toUpperCase() ? curChar.toLowerCase() : curChar.toUpperCase();
      }
    }

    if ((curChar === "s" || curChar === "S") && Math.random() < sToShChance) {
      out += curChar + (Math.random() < longShChance ? "hh" : "h");
    } else if (curChar === " " && Math.random() < fillerWordChance) {
      out += pick(FILLER_WORDS);
    } else if (wasPoint && Math.random() < startFillerWordChance) {
      out += pick(START_FILLER_WORDS) + curChar;
    } else {
      out += curChar;
    }
    wasPoint = false;

    if (Math.random() < longCharChance) {
      let moreChance = 0.6 * 2;
      do {
        moreChance *= 0.5;
        out += curChar;
      } while (Math.random() < moreChance);
    }
    if (Math.random() < hicChance) out += pick(HICS);
    if (Math.random() < rewindChance) {
      out += "... ";
      const wordsRewind = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < wordsRewind; j++) {
        i = message.lastIndexOf(" ", i - 1);
      }
      if (i < 0) i = 0;
    }
    i++;
  }
  return out;
}

// DrugProperties.distortMessage gate: only alcohol+kava / zero / cannabis distort
export function distortFor(properties, message) {
  const alcohol = Math.min(properties.getDrugValue("alcohol") + properties.getDrugValue("kava"), 1);
  const zero = properties.getDrugValue("zero");
  const cannabis = properties.getDrugValue("cannabis");
  if (alcohol > 0 || zero > 0 || cannabis > 0) {
    return distortMessage(message, alcohol, zero, cannabis);
  }
  return message;
}

// ---------------------------------------------------------------------------
// Per-player effect application (DrugProperties.onTick + drug type behavior)
// ---------------------------------------------------------------------------
const SPEED_MODIFIER_NAME = "ps_drug_effects";

export function applyEffects(player, properties) {
  const speed = properties.getAggregate("speed");
  const digSpeed = properties.getAggregate("digSpeed");
  const drowsyness = properties.getAggregate("drowsyness");
  const jumpChance = properties.getAggregate("randomJumpChance");
  const weightlessness = properties.getAggregate("weightlessness");
  const viewTremble = properties.getAggregate("viewTremble") + properties.getAggregate("viewWobblyness") * 0.2;
  const handTremble = properties.getAggregate("handTremble");
  const heartbeatVolume = properties.getAggregate("heartbeatVolume");
  const breathVolume = properties.getAggregate("breathVolume");

  // changeDrugModifierMultiply: movement speed multiplier (Java also modifies
  // attack_speed - Bedrock has no attack_speed attribute; documented)
  try {
    const movement = player.getAttribute("minecraft:movement");
    for (const mod of movement.getModifiers()) {
      if (mod.name === SPEED_MODIFIER_NAME) movement.removeModifier(mod.id);
    }
    movement.addModifier({
      name: SPEED_MODIFIER_NAME,
      amount: speed - 1.0,
      operation: "multiply_total",
    });
  } catch {
    /* attribute API unavailable */
  }

  // Stable Bedrock movement/digging equivalents; Entity.getAttribute and
  // Java attribute modifiers are not Script API methods.
  if (speed > 1.05) player.addEffect("speed", 25, { amplifier: Math.max(0, Math.min(3, Math.floor((speed - 1) / 0.2))), showParticles: false });
  else if (speed < 0.95) player.addEffect("slowness", 25, { amplifier: Math.max(0, Math.min(3, Math.floor((1 - speed) / 0.15))), showParticles: false });
  if (digSpeed > 1.05) player.addEffect("haste", 25, { amplifier: 0, showParticles: false });
  else if (digSpeed < 0.95) player.addEffect("mining_fatigue", 25, { amplifier: 0, showParticles: false });

  // drowsyness -> exhaustion (Java: addExhaustion(0.05F) with chance)
  if (drowsyness > 0 && Math.random() < drowsyness) {
    tryAddExhaustion(player, 0.05);
  }

  // JUMP_CHANCE: random involuntary jump (Java: LivingEntity.jump mixin)
  if (jumpChance > 0 && Math.random() < jumpChance) {
    try {
      player.applyImpulse({ x: 0, y: 0.42, z: 0 });
    } catch {
      /* not on ground */
    }
  }

  // WEIGHTLESSNESS -> levitation-like float (LsdDrug)
  if (weightlessness > 0.3) {
    try {
      player.addEffect("minecraft:levitation", 40, { showParticles: false });
    } catch {
      /* effects unavailable */
    }
  }

  // camera tremble approximates view/hand tremble (no shader access)
  const tremble = Math.min(1, viewTremble + handTremble * 0.5);
  if (tremble > 0.05) {
    try {
      player.runCommand(`camerashake @s add ${tremble.toFixed(2)} 2 rotational`);
    } catch {
      /* command unavailable */
    }
  }

  // heartbeat / breath loops (DrugMusicManager audible layer)
  if (heartbeatVolume > 0 && properties.age % 60 === 0) {
    playAt(player, "psbed:entity.player.heartbeat", Math.min(1, heartbeatVolume));
  }
  if (breathVolume > 0 && properties.age % 80 === 0) {
    playAt(player, "psbed:entity.player.breath", Math.min(1, breathVolume));
  }
  if (properties.isBreathingSmoke() && properties.age % 20 === 0) {
    playAt(player, "psbed:drug.generic", 0.4);
  }
}

function playAt(player, sound, volume) {
  try {
    player.dimension.playSound(sound.replace(/^psbed:/, "psybed:"), player.location, { volume, pitch: 1 });
  } catch {
    /* sound unavailable */
  }
}

function tryAddExhaustion(player, amount) {
  try {
    const hunger = player.getComponent("minecraft:player.hunger");
    if (hunger?.current !== undefined) {
      hunger.current = Math.max(0, hunger.current - amount * 2);
      return;
    }
  } catch {
    /* fall through */
  }
}

// AlcoholDrug.onWakeUp: hangover (damage + sleep deprivation +0.25)
export function onWakeUp(player, properties) {
  const alcohol = properties.getDrug("alcohol");
  const value = alcohol.getActiveValue();
  if (value > 0 && Math.random() > 1 - value) {
    try {
      player.applyDamage(1);
    } catch {
      /* invulnerable */
    }
    properties.addToDrug("sleep_deprivation", 0.25);
    return { hangover: true };
  }
  return { hangover: false };
}

// BathSaltsDrug.onWakeUp: chance of damage in sleep
export function onWakeUpBathSalts(player, properties) {
  const bathSalts = properties.getDrug("bath_salts");
  if (bathSalts.getActiveValue() > 0 && Math.random() < 0.5) {
    try {
      player.applyDamage(Math.random() < 0.002 ? 12 : 4);
    } catch {
      /* invulnerable */
    }
    return { damaged: true };
  }
  return { damaged: false };
}
