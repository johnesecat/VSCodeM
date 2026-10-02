// Fluid system — port of fluid/PSFluids.java + fluid/AlcoholicFluid.java.
// State machine (fermentation/distillation/maturation/vinegar), drink-variant
// resolution (StatePredicate.java semantics) and container packing are
// transcribed from the Java sources (Level 1/3 evidence).

import { CONTENT } from "../data/content.js";
import { formatDrinkName } from "../data/lang.js";
import { clamp, progress } from "./util.js";
import { DrugInfluence } from "./drugs.js";

export const FERMENTATION_STEPS = 2;
export const UNCONVERTABLE = -1;

export const ProcessType = {
  IDLE: "idle",
  FERMENT: "ferment",
  DISTILL: "distill",
  MATURE: "mature",
  ACETIFY: "acetify",
};

// FluidVolumes.java
export const VOLUMES = {
  BUCKET: 1000,
  CAULDRON: 1000,
  GLASS_BOTTLE: 125,
  BOWL: 50,
  MUG: 500,
  CUP: 250,
  CHALLICE: 200,
  SHOT: 40,
  BOTTLE: 2000,
  SYRINGE: 10,
  BARREL: 16000,
  VAT: 32000,
};

// ---------------------------------------------------------------------------
// Drink variant tables — transcribed 1:1 from PSFluids.java `variants(...)`.
// entry: [drinkType, variationName|null, appearance|null, predicate]
// predicate keys: f(fermentation), m(maturation), d(distillation), v(vinegar)
//   values are [min,max] ranges; v: true|false|undefined(false)|"any"
// ---------------------------------------------------------------------------
const ANY = { v: "any" };
const BASE = { f: [0, 0], m: [0, 0], d: [0, 0], v: false };
const VINEGAR = { v: true };
const DISTILLED = { d: [1, 16], v: false };
const MATURED = { m: [1, 16], v: false };
const F1 = { f: [1, 1], v: false };
const F2 = { f: [2, 16], v: false };

export const DRINK_VARIANTS = {
  wheat_hop: [
    ["wort", "bitter", null, BASE], ["beer_vinegar", "bitter", null, VINEGAR],
    ["beer", null, "clear", DISTILLED], ["beer", null, null, MATURED],
    ["half_wash", "bitter", null, F1], ["beer", "green", "rum_mature", F2],
  ],
  wheat: [
    ["wort", null, null, BASE], ["beer_vinegar", null, null, VINEGAR],
    ["wheat_whiskey", null, null, { m: [1, 16], d: [1, 16], v: false }],
    ["vodka", null, null, DISTILLED], ["wash", null, null, MATURED],
    ["half_wash", null, null, F1], ["wash", null, null, F2],
  ],
  potato: [
    ["wort", null, null, BASE], ["vinegar", null, null, VINEGAR],
    ["poteen", null, "rum_semi_mature", { m: [1, 16], d: [1, 16], v: false }],
    ["vodka", null, null, DISTILLED], ["beer", null, null, MATURED],
    ["half_wash", null, null, F1], ["beer", null, "rum_mature", F2],
  ],
  tomato: [
    ["ketchup", null, null, { f: [0, 0], m: [1, 4], v: true, extraDrug: ["sugar", 20, 0.003, 0.002, 0.3] }],
    ["whiskey", null, "rum_semi_mature", { f: [1, 16], m: [6, 16], d: [3, 16], v: false }],
    ["mead", null, null, { f: [1, 16], m: [5, 16], d: [0, 0], v: false }],
    ["beer", null, null, { f: [1, 16], d: [1, 1], v: false }],
    ["vinegar", null, null, VINEGAR], ["vodka", null, null, DISTILLED],
    ["juice", null, "tomato_juice", ANY],
  ],
  red_grapes: [
    ["juice", null, "wine", BASE], ["vinegar", null, null, VINEGAR], ["brandy", null, null, DISTILLED],
    ["vinegar", null, null, { m: [16, 16], v: false }],
    ["wine", "well_aged", null, { m: [14, 16], v: false }],
    ["wine", "aged", null, { m: [8, 16], v: false }],
    ["wine", "slightly_aged", null, { m: [4, 16], v: false }],
    ["wine", "young", null, MATURED],
    ["half_wash", "wine", "wine", F1], ["wash", "wine", "wine", F2],
  ],
  rice: [
    ["wort", null, "rice_wine", BASE], ["vinegar", null, null, VINEGAR],
    ["brandy", null, "clear", DISTILLED], ["wine", null, "clear", MATURED],
    ["half_wash", null, "clear", F1], ["wine", "young", "clear", F2],
  ],
  juniper: [
    ["wort", null, "slurry", BASE], ["vinegar", null, null, VINEGAR],
    ["gin", null, null, DISTILLED], ["wash", null, null, MATURED],
    ["half_wash", null, null, F1], ["wash", "young", null, F2],
  ],
  honey: [
    ["wort", null, "mead", BASE], ["vinegar", null, "mead", VINEGAR],
    ["brandy", null, "mead", DISTILLED], ["mead", null, null, MATURED],
    ["half_wash", null, "mead", F1], ["mead", "young", "mead", F2],
  ],
  sugar_cane: [
    ["wort", null, "clear", BASE], ["vinegar", null, null, VINEGAR],
    ["rum", "young", null, { d: [1, 16], m: [0, 0], v: false }],
    ["rum", null, null, DISTILLED], ["basi", null, null, MATURED],
    ["half_wash", null, null, F1], ["basi", "young", null, F2],
  ],
  corn: [
    ["wort", null, "beer", BASE], ["vinegar", null, null, VINEGAR],
    ["vodka", null, null, { d: [1, 16], m: [0, 0], v: false }],
    ["whiskey", null, null, { d: [1, 16], m: [1, 16], v: false }],
    ["beer", null, null, MATURED], ["half_wash", null, null, F1], ["beer", "green", null, F2],
  ],
  apple: [
    ["cider", "sweet", null, BASE], ["vinegar", null, null, VINEGAR],
    ["brandy", null, "cider", DISTILLED], ["cider", null, null, MATURED],
    ["cider", "half_sweet", null, F1], ["cider", "hard", null, F2],
  ],
  pineapple: [
    ["juice", null, "cider", BASE], ["vinegar", null, null, VINEGAR],
    ["brandy", null, "cider", DISTILLED], ["wine", null, "cider", MATURED],
    ["half_wash", null, "cider", F1], ["wine", "young", "cider", F2],
  ],
  banana: [
    ["juice", null, "mead", BASE], ["vinegar", null, null, VINEGAR],
    ["brandy", null, "mead", DISTILLED], ["beer", null, "mead", MATURED],
    ["half_wash", null, "mead", F1], ["beer", null, "mead", F2],
  ],
  milk: [
    ["wort", null, "rice_wine", BASE], ["vinegar", null, "rice_wine", VINEGAR],
    ["arkhi", null, "rice_wine", DISTILLED], ["blaand", null, "rice_wine", MATURED],
    ["half_wash", null, "rice_wine", F1], ["blaand", null, "rice_wine", F2],
  ],
  agave: [
    ["mezcal", null, null, { f: [1, 16], m: [0, 0], d: [1, 1], v: false }],
    ["tequila", "blanco", null, { f: [1, 16], m: [0, 0], d: [2, 16], v: false }],
    ["tequila", "reposado", null, { f: [1, 16], m: [1, 16], d: [2, 16], v: false }],
    ["juice", null, null, ANY],
  ],
};

// Maturity.java: STAGES[(maturation / 3) % 5]
export function maturityName(maturation) {
  const STAGES = ["young", "aged", "mature", "very_mature"];
  return STAGES[Math.floor(maturation / 3) % 5];
}

function rangeTest(range, value) {
  if (!range) return true;
  return value >= range[0] && value <= range[1];
}

function stateMatches(predicate, fluid) {
  if (!rangeTest(predicate.f, fluid.fermentation)) return false;
  if (!rangeTest(predicate.m, fluid.maturation)) return false;
  if (!rangeTest(predicate.d, fluid.distillation)) return false;
  const v = predicate.v;
  if (v === true && !fluid.vinegar) return false;
  if (v === false && fluid.vinegar) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Fluid state
// ---------------------------------------------------------------------------
export function fluidDef(id) {
  return CONTENT.fluids.find((f) => f.id === id);
}

export function makeFluidState(id, level = 0) {
  return {
    id,
    level,
    fermentation: 0,
    distillation: 0,
    maturation: 0,
    vinegar: false,
    temperature: 0,
  };
}

export function resolveVariant(fluid) {
  const variants = DRINK_VARIANTS[fluid.id];
  const def = fluidDef(fluid.id);
  if (!variants) {
    return { drink: fluid.id, variation: null, appearance: null, extraDrug: def?.drug ?? null };
  }
  for (const [drink, variation, appearance, predicate] of variants) {
    if (stateMatches(predicate, fluid)) {
      return { drink, variation, appearance, extraDrug: predicate.extraDrug ?? null };
    }
  }
  return { drink: fluid.id, variation: null, appearance: null, extraDrug: null };
}

export function fluidDisplayName(fluid) {
  const variant = resolveVariant(fluid);
  return formatDrinkName(variant.drink, variant.variation);
}

// AlcoholicFluid.getDrugInfluencesPerLiter
export function drugInfluencesPerLiter(fluid) {
  const def = fluidDef(fluid.id);
  const out = [];
  if (def && def.kind === "alcohol") {
    const alcohol =
      def.alcohol[0] * (fluid.fermentation / FERMENTATION_STEPS) +
      def.alcohol[1] * progress(fluid.distillation) +
      def.alcohol[2] * progress(fluid.maturation * 0.2);
    out.push(new DrugInfluence("alcohol", 20, 0.003, 0.002, alcohol));
    const variant = resolveVariant(fluid);
    if (variant.extraDrug) out.push(DrugInfluence.fromArray(variant.extraDrug));
  } else if (def && def.drug) {
    out.push(DrugInfluence.fromArray(def.drug));
  }
  return out;
}

// Alcohol strength for a fluid level (used when drinking)
export function influenceForLevel(fluid, level) {
  return drugInfluencesPerLiter({ ...fluid, level }).map((inf) => {
    // DrugInfluence maxInfluence scales with consumed level (per liter basis)
    const liters = level / VOLUMES.BUCKET;
    return [inf.drugType, inf.delay, inf.influenceSpeed, inf.influenceSpeedPlus, inf.maxInfluence * liters];
  });
}

// ---------------------------------------------------------------------------
// Processing state machine — AlcoholicFluid.getProcessingTime / process /
// modifyProcess, transcribed verbatim (including the acetification quirk:
// ACETIFY reports a duration only when VINEGAR is already set, matching the
// Java source line-for-line).
// ---------------------------------------------------------------------------
export function modifyProcess(fluid, type) {
  if (type === ProcessType.FERMENT && fluid.fermentation >= FERMENTATION_STEPS) {
    return ProcessType.ACETIFY;
  }
  return type;
}

export function getProcessingTime(fluid, type) {
  const def = fluidDef(fluid.id);
  if (!def || def.kind !== "alcohol") return UNCONVERTABLE;
  const t = def.tick;
  switch (type) {
    case ProcessType.DISTILL:
      return fluid.fermentation === 0 || fluid.maturation !== 0 ? UNCONVERTABLE : t[1];
    case ProcessType.MATURE:
      return fluid.fermentation === 0 ? UNCONVERTABLE : t[2];
    case ProcessType.FERMENT:
      return t[0];
    case ProcessType.ACETIFY:
      return fluid.vinegar ? t[3] : UNCONVERTABLE;
    default:
      return UNCONVERTABLE;
  }
}

// cycle(): attribute increment with wraparound (FluidStateManager semantics)
function cycleInt(fluid, key, max) {
  const next = fluid[key] + 1;
  fluid[key] = next > max ? 0 : next;
}

export function process(fluid, type) {
  const def = fluidDef(fluid.id);
  switch (type) {
    case ProcessType.DISTILL: {
      // amountDrained = floor(level * progress(distillation, 0.5))  [AlcoholicFluid.java]
      const amountDrained = Math.floor(fluid.level * progress(fluid.distillation, 0.5));
      const byproduct = amountDrained > 0 ? { id: "slurry", level: 1 } : null;
      cycleInt(fluid, "distillation", 16);
      return byproduct;
    }
    case ProcessType.MATURE:
      cycleInt(fluid, "maturation", 16);
      return null;
    case ProcessType.FERMENT:
      cycleInt(fluid, "fermentation", FERMENTATION_STEPS);
      return null;
    case ProcessType.ACETIFY:
      fluid.vinegar = !fluid.vinegar;
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Container packing — fluid state encoded in the 16-bit item `aux` value:
//   bits 0-4   fluidId (32 slots; 27 used, see CONTENT.fluids)
//   bits 5-6   fermentation (0-2)
//   bits 7-10  distillation (0-16)
//   bits 11-14 maturation (0-16)
//   bit  15    vinegar
// (temperature is a transient property kept on the item via dynamic property)
// ---------------------------------------------------------------------------
export function fluidIndex(id) {
  return CONTENT.fluids.findIndex((f) => f.id === id);
}

export function fluidIdAt(index) {
  return CONTENT.fluids[index]?.id ?? null;
}

export function packFluid(fluid) {
  const idx = fluidIndex(fluid.id);
  if (idx < 0) return 0;
  return (
    (idx & 0x1f) |
    ((fluid.fermentation & 0x3) << 5) |
    ((fluid.distillation & 0xf) << 7) |
    ((fluid.maturation & 0xf) << 11) |
    ((fluid.vinegar ? 1 : 0) << 15)
  ) >>> 0;
}

export function unpackFluid(aux, level) {
  const idx = aux & 0x1f;
  const id = fluidIdAt(idx);
  if (id == null) return null;
  return {
    id,
    level,
    fermentation: (aux >> 5) & 0x3,
    distillation: (aux >> 7) & 0xf,
    maturation: (aux >> 11) & 0xf,
    vinegar: ((aux >> 15) & 1) === 1,
    temperature: 0,
  };
}

export function clampLevel(fluid) {
  fluid.level = clamp(fluid.level, 0, VOLUMES.BUCKET * 32);
  return fluid;
}
