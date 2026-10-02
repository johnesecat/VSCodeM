// Drug system — 1:1 port of entity/drug/* (Level 1 evidence).
//   DrugInfluence.update  -> influence update math (DrugInfluence.java)
//   SimpleDrug.update     -> decay + active-value smoothing (SimpleDrug.java)
//   AggregateModifier     -> modifier aggregation (Drug.java)
// Modifier formulas live in data/content.js (transcribed from entity/drug/type/*.java).

import { CONTENT } from "../data/content.js";
import { clamp, clamp01, nearValue } from "./util.js";

// ---------------------------------------------------------------------------
// Mini expression evaluator for the transcribed modifier formulas.
// Grammar: numbers, identifiers (v, t, str), + - * /, unary -, parens,
//          functions il(x,min,max), max(a,b), min(a,b).
// ---------------------------------------------------------------------------
export function evalFormula(src, ctx) {
  src = src.replace(/\s+/g, "");
  let i = 0;
  const peek = () => src[i];
  const eat = (c) => {
    if (src[i] === c) { i++; return true; }
    return false;
  };
  function parseExpr() {
    let v = parseTerm();
    for (;;) {
      if (eat("+")) v += parseTerm();
      else if (eat("-")) v -= parseTerm();
      else return v;
    }
  }
  function parseTerm() {
    let v = parseUnary();
    for (;;) {
      if (eat("*")) v *= parseUnary();
      else if (eat("/")) v /= parseUnary();
      else return v;
    }
  }
  function parseUnary() {
    if (eat("-")) return -parseUnary();
    return parsePrimary();
  }
  function parsePrimary() {
    if (eat("(")) { const v = parseConditional(); eat(")"); return v; }
    if (/[0-9.]/.test(peek() ?? "")) {
      let s = "";
      while (i < src.length && /[0-9.]/.test(src[i])) s += src[i++];
      return parseFloat(s);
    }
    if (/[a-zA-Z_]/.test(peek() ?? "")) {
      let s = "";
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i])) s += src[i++];
      if (eat("(")) {
        const args = [parseConditional()];
        while (eat(",")) args.push(parseConditional());
        eat(")");
        switch (s) {
          case "il": return clamp01((args[0] - args[1]) / (args[2] - args[1]));
          case "max": return Math.max(...args);
          case "min": return Math.min(...args);
          default: throw new Error(`unknown fn ${s}`);
        }
      }
      switch (s) {
        case "v": return ctx.v;
        case "t": return ctx.t;
        // str: strength ramp used by Kava/Lsd sound formulas
        // Java: (MathHelper.clamp(getTicksActive(), 50, 250) - 50) / 200F
        case "str": return (clamp(ctx.t, 50, 250) - 50) / 200;
        default: throw new Error(`unknown ident ${s}`);
      }
    }
    throw new Error(`parse error at ${i} in ${src}`);
  }
  function parseConditional() {
    let value = parseExpr();
    if (eat(">")) value = value > parseExpr() ? 1 : 0;
    else if (eat("<")) value = value < parseExpr() ? 1 : 0;
    if (eat("?")) {
      const yes = parseConditional();
      if (!eat(":")) throw new Error(`missing ':' in ${src}`);
      const no = parseConditional();
      value = value ? yes : no;
    }
    return value;
  }
  const result = parseConditional();
  if (i !== src.length || !Number.isFinite(result)) throw new Error(`invalid formula: ${src}`);
  return result;
}

// ---------------------------------------------------------------------------
// Aggregate modifier names (Drug.java) and their combiners.
// MUL: value * m   |   SUM: value + m   |   INVERSE_MUL: 1 - (1-value)*(1-m)
//   (INVERSE_MUL combination is strong inference, Level 6: Combiner source not
//    in the audited window; chosen because it yields Java's observable ranges.)
// ---------------------------------------------------------------------------
export const AGGREGATES = {
  speed: { init: 1, combiner: "MUL" },
  digSpeed: { init: 1, combiner: "MUL" },
  sound: { init: 1, combiner: "MUL" },
  breathVolume: { init: 0, combiner: "SUM" },
  breathSpeed: { init: 1, combiner: "SUM" },
  heartbeatVolume: { init: 0, combiner: "SUM" },
  heartbeatSpeed: { init: 1, combiner: "SUM" },
  randomJumpChance: { init: 0, combiner: "SUM" },
  randomPunchChance: { init: 0, combiner: "SUM" },
  weightlessness: { init: 0, combiner: "SUM" },
  hungerSuppression: { init: 0, combiner: "SUM" },
  headMotionInertness: { init: 0, combiner: "SUM" },
  viewTremble: { init: 0, combiner: "INVERSE_MUL" },
  viewWobblyness: { init: 0, combiner: "SUM" },
  drowsyness: { init: 0, combiner: "SUM" },
  handTremble: { init: 0, combiner: "INVERSE_MUL" },
  doubleVision: { init: 0, combiner: "INVERSE_MUL" },
  color: { init: 0, combiner: "SUM" },
  movement: { init: 0, combiner: "SUM" },
  contextual: { init: 0, combiner: "SUM" },
  superSaturation: { init: 0, combiner: "INVERSE_MUL" },
  desaturation: { init: 0, combiner: "INVERSE_MUL" },
  inversion: { init: 0, combiner: "SUM" },
  bloom: { init: 0, combiner: "SUM" },
  motionBlur: { init: 0, combiner: "INVERSE_MUL" },
};

// ---------------------------------------------------------------------------
// DrugInfluence (DrugInfluence.java)
// ---------------------------------------------------------------------------
export class DrugInfluence {
  constructor(drugType, delay, influenceSpeed, influenceSpeedPlus, maxInfluence) {
    this.drugType = drugType;
    this.delay = delay;
    this.influenceSpeed = influenceSpeed;
    this.influenceSpeedPlus = influenceSpeedPlus;
    this.maxInfluence = maxInfluence;
  }

  static fromArray([drugType, delay, influenceSpeed, influenceSpeedPlus, maxInfluence]) {
    return new DrugInfluence(drugType, delay, influenceSpeed, influenceSpeedPlus, maxInfluence);
  }

  // Java: if (delay > 0) delay--; if (delay == 0 && maxInfluence > 0) {
  //   addition = min(maxInfluence, influenceSpeedPlus + maxInfluence * influenceSpeed);
  //   addToDrug(...); maxInfluence -= addition; } return isDone();
  update(props) {
    if (this.delay > 0) this.delay--;
    if (this.delay === 0 && this.maxInfluence > 0) {
      const addition = Math.min(this.maxInfluence, this.influenceSpeedPlus + this.maxInfluence * this.influenceSpeed);
      props.addToDrug(this.drugType, addition);
      this.maxInfluence -= addition;
    }
    return this.isDone();
  }

  isDone() {
    return this.maxInfluence <= 0.0;
  }

  clone() {
    return new DrugInfluence(this.drugType, this.delay, this.influenceSpeed, this.influenceSpeedPlus, this.maxInfluence);
  }

  serialize() {
    return [this.drugType, this.delay, this.influenceSpeed, this.influenceSpeedPlus, this.maxInfluence];
  }
}

// ---------------------------------------------------------------------------
// Drug (SimpleDrug.java + type subclasses via formula table)
// ---------------------------------------------------------------------------
export class Drug {
  constructor(def) {
    this.def = def;
    this.effect = 0;          // desired value
    this.effectActive = 0;    // active value (smoothed)
    this.locked = false;
    this.ticksActive = 0;
    this.storedEnergy = 0;    // SleepDeprivationDrug
    this.currentColor = [1, 1, 1]; // HarmoniumDrug
  }

  get type() { return this.def.id; }

  update(props) {
    if (this.getActiveValue() > 0) {
      this.ticksActive++;
      // SimpleDrug: heartbeatSpeed() > 3 -> heart attack + reset
      if (this.heartbeatSpeed() > 3) {
        props.onHeartAttack();
        this.reset();
      }
    } else {
      this.ticksActive = 0;
    }

    if (!this.locked) {
      this.effect *= this.def.dec[0];
      this.effect -= this.def.dec[1];
    }
    this.effect = clamp01(this.effect);
    this.effectActive = nearValue(this.effectActive, this.effect, 0.05, 0.005);

    // SleepDeprivationDrug.update: storedEnergy approaches min(1, (caffeine+cocaine)*10)
    if (this.def.behavior?.storedEnergyFromCaffeine) {
      const stim = props.getDrugValue("caffeine") + props.getDrugValue("coccaine");
      this.storedEnergy = nearValue(this.storedEnergy, Math.min(1, stim * 10), 0.02, 0);
    }
    // CannabisDrug.update: exhaustion per tick scaled by active value
    if (this.def.behavior?.exhaustionPerTick && this.getActiveValue() > 0) {
      props.addExhaustion(this.def.behavior.exhaustionPerTick * this.getActiveValue());
    }
    // LsdDrug.update (harmful variant): caffeine interaction
    if (this.def.harmful && this.getActiveValue() >= 0.99) {
      const caffeine = props.getDrug("caffeine");
      if (caffeine.getActiveValue() > 0) {
        caffeine.addToDesiredValue(-0.5);
        this.effect /= 2;
      }
    }
    // AlcoholDrug.update: alcohol poisoning damage above 0.9
    if (this.def.behavior?.alcoholPoisoningDamage && this.getActiveValue() > 0 && props.age % 20 === 0) {
      const active = this.getActiveValue();
      const damageChance = (active - 0.9) * 2;
      if (Math.random() < damageChance) {
        props.onAlcoholPoisoning(Math.floor((active - 0.9) * 50 + 4));
      }
    }
    // BathSaltsDrug.update: periodic nausea (status effect in Java)
    if (this.def.behavior?.nausea && this.getActiveValue() > 0 && props.age % 200 === 0) {
      props.onNauseaPulse(this.def.behavior.nausea);
    }
    return this.getActiveValue();
  }

  getActiveValue() {
    // SleepDeprivationDrug.getActiveValue: eff + storedEnergy * 0.2
    if (this.def.behavior?.storedEnergyFromCaffeine) {
      return clamp01(this.effectActive + this.storedEnergy * 0.2);
    }
    return this.effectActive;
  }

  getDesiredValue() { return this.effect; }
  setDesiredValue(v) { if (!this.locked) this.effect = clamp01(v); }
  addToDesiredValue(v) { if (!this.locked) this.effect = clamp01(this.effect + v); }
  setLocked(l) { this.locked = l; }

  reset() { if (!this.locked) this.effect = 0; }

  modifierValue(name) {
    const formula = this.def.modifiers?.[name];
    if (!formula) return null;
    return evalFormula(formula, { v: this.getActiveValue(), t: this.ticksActive });
  }

  heartbeatSpeed() { return this.modifierValue("heartbeatSpeed") ?? 0; }

  serialize() {
    return {
      effect: this.effect,
      effectActive: this.effectActive,
      locked: this.locked,
      ticksActive: this.ticksActive,
      storedEnergy: this.storedEnergy,
      currentColor: this.currentColor,
    };
  }

  static deserialize(def, data) {
    const drug = new Drug(def);
    drug.effect = data.effect ?? 0;
    drug.effectActive = data.effectActive ?? 0;
    drug.locked = data.locked ?? false;
    drug.ticksActive = data.ticksActive ?? 0;
    drug.storedEnergy = data.storedEnergy ?? 0;
    if (data.currentColor) drug.currentColor = data.currentColor;
    return drug;
  }
}

// ---------------------------------------------------------------------------
// DrugProperties (DrugProperties.java) — per-player state
// ---------------------------------------------------------------------------
export class DrugProperties {
  constructor(callbacks = {}) {
    this.drugs = new Map();
    this.influences = [];
    this.age = 0;
    this.timeBreathingSmoke = 0;
    this.breathSmokeColor = [1, 1, 1];
    this.cb = callbacks; // { onHeartAttack, onAlcoholPoisoning, onNauseaPulse, addExhaustion, onDirty }
  }

  static drugDefs() {
    return CONTENT.drugs;
  }

  getDrug(id) {
    if (!this.drugs.has(id)) {
      const def = DrugProperties.drugDefs().find((d) => d.id === id);
      if (!def) return new Drug({ id, dec: [1, 0], modifiers: {} });
      this.drugs.set(id, new Drug(def));
    }
    return this.drugs.get(id);
  }

  getDrugValue(id) {
    return this.drugs.has(id) ? this.drugs.get(id).getActiveValue() : 0;
  }

  isDrugActive(id) {
    return this.getDrugValue(id) > 1e-6;
  }

  addToDrug(id, effect) {
    this.getDrug(id).addToDesiredValue(effect);
    this.cb.onDirty?.();
  }

  setDrugValue(id, effect) {
    this.getDrug(id).setDesiredValue(effect);
    this.cb.onDirty?.();
  }

  addInfluence(influence) {
    this.influences.push(influence.clone());
    this.cb.onDirty?.();
  }

  addAllInfluences(list) {
    for (const inf of list) this.addInfluence(typeof inf.serialize === "function" ? inf : DrugInfluence.fromArray(inf));
    this.cb.onDirty?.();
  }

  startBreathingSmoke(time, color) {
    this.breathSmokeColor = color;
    this.timeBreathingSmoke = time + 10; // 10 ticks breathing in (DrugProperties.java)
  }

  isBreathingSmoke() {
    return this.timeBreathingSmoke > 0;
  }

  // Java: influences update 4x/second (entity.age % 5 == 0)
  update() {
    this.age++;
    if (this.age % 5 === 0) {
      this.influences = this.influences.filter((inf) => !inf.update(this));
    }
    for (const drug of this.drugs.values()) drug.update(this);

    if (this.isBreathingSmoke()) this.timeBreathingSmoke--;

    return this.getAggregate("speed");
  }

  getAggregate(name) {
    const spec = AGGREGATES[name];
    if (!spec) return 0;
    let value = spec.init;
    for (const drug of this.drugs.values()) {
      const m = drug.modifierValue(name);
      if (m == null) continue;
      if (spec.combiner === "MUL") value *= m;
      else if (spec.combiner === "SUM") value += m;
      else value = 1 - (1 - value) * (1 - m); // INVERSE_MUL
    }
    return value;
  }

  isTripping() {
    return (
      this.getAggregate("movement") + this.getAggregate("contextual") + this.getAggregate("color")
    ) > 0.7;
  }

  onHeartAttack() { this.cb.onHeartAttack?.(); }
  onAlcoholPoisoning(amount) { this.cb.onAlcoholPoisoning?.(amount); }
  onNauseaPulse(duration) { this.cb.onNauseaPulse?.(duration); }
  addExhaustion(amount) { this.cb.addExhaustion?.(amount); }

  // NBT parity: DrugProperties.toNbt / fromNbt
  serialize() {
    const drugs = {};
    for (const [id, drug] of this.drugs) drugs[id] = drug.serialize();
    return {
      drugs,
      drugInfluences: this.influences.map((i) => i.serialize()),
      timeBreathingSmoke: this.timeBreathingSmoke,
      breathSmokeColor: this.breathSmokeColor,
    };
  }

  deserialize(data) {
    this.drugs.clear();
    for (const [id, d] of Object.entries(data.drugs ?? {})) {
      const def = DrugProperties.drugDefs().find((x) => x.id === id);
      if (def) this.drugs.set(id, Drug.deserialize(def, d));
    }
    this.influences = (data.drugInfluences ?? []).map((arr) => DrugInfluence.fromArray(arr));
    this.timeBreathingSmoke = data.timeBreathingSmoke ?? 0;
    this.breathSmokeColor = data.breathSmokeColor ?? [1, 1, 1];
  }

  // DrugProperties.copyFrom(old, alive): keep state on death only when alive
  copyFrom(old, alive) {
    if (alive) {
      this.deserialize(old.serialize());
    }
  }
}
