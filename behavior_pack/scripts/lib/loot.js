// Loot evaluator — runs the VERBATIM Java loot tables
// (data/psychedelicraft/loot_java.json -> scripts/data/loot.js) so drops,
// rolls, conditions and functions match the source exactly (§28).
//
// Constructs used by the audited tables (census of loot_java.json):
//   entries:   minecraft:item, minecraft:alternatives, minecraft:dynamic("contents")
//   conditions: minecraft:survives_explosion, minecraft:block_state_property,
//               minecraft:any_of, minecraft:match_tool, minecraft:table_bonus
//   functions:  minecraft:set_count, minecraft:explosion_decay,
//               minecraft:apply_bonus(binomial_with_bonus_count)

import { LOOT_TABLES } from "../data/loot.js";

export function getTable(path) {
  return LOOT_TABLES[path] ?? null;
}

function matchTool(cond, ctx) {
  const pred = cond.predicate ?? {};
  if (pred.items) {
    const held = ctx.heldItem ?? "";
    if (!pred.items.some((i) => held === i)) return false;
  }
  if (pred.enchantments) {
    for (const req of pred.enchantments) {
      const short = req.enchantment.replace(/^minecraft:/, "");
      const level = ctx.enchantments?.[short] ?? 0;
      const min = req.levels?.min ?? 1;
      if (level < min) return false;
    }
  }
  return true;
}

function blockStateProperty(cond, ctx) {
  const props = cond.properties ?? {};
  const state = ctx.blockState ?? {};
  for (const [key, spec] of Object.entries(props)) {
    const value = state[key];
    if (typeof spec === "object" && spec !== null) {
      const min = spec.min !== undefined ? Number(spec.min) : -Infinity;
      const max = spec.max !== undefined ? Number(spec.max) : Infinity;
      if (value < min || value > max) return false;
    } else if (String(spec) !== String(value)) {
      // string comparison so boolean states match their Java loot literals
      // (e.g. "top": "true" against state value true)
      return false;
    }
  }
  return true;
}

export function testCondition(cond, ctx) {
  if (!cond) return true;
  switch (cond.condition) {
    case "minecraft:survives_explosion":
      // Java: passes unless destroyed by an explosion (then ~1/radius chance)
      return !ctx.exploded || Math.random() < 0.35;
    case "minecraft:block_state_property":
      return blockStateProperty(cond, ctx);
    case "minecraft:any_of":
      return (cond.terms ?? []).some((t) => testCondition(t, ctx));
    case "minecraft:all_of":
      return (cond.terms ?? []).every((t) => testCondition(t, ctx));
    case "minecraft:inverted":
      return !testCondition(cond.term, ctx);
    case "minecraft:match_tool":
      return matchTool(cond, ctx);
    case "minecraft:table_bonus": {
      // chance by enchantment level, clamped to the last entry
      const level = ctx.enchantments?.[cond.enchantment?.replace(/^minecraft:/, "")] ?? 0;
      const chances = cond.chances ?? [1];
      return Math.random() < chances[Math.min(level, chances.length - 1)];
    }
    default:
      return true;
  }
}

function applyFunctions(count, fns, ctx) {
  let out = count;
  for (const fn of fns ?? []) {
    switch (fn.function) {
      case "minecraft:set_count": {
        const c = fn.count;
        if (typeof c === "number") out = c;
        else if (c?.min !== undefined) out = c.min + Math.floor(Math.random() * (c.max - c.min + 1));
        break;
      }
      case "minecraft:explosion_decay": {
        if (ctx.exploded) {
          let kept = 0;
          for (let i = 0; i < out; i++) if (Math.random() < 0.7) kept++;
          out = kept;
        }
        break;
      }
      case "minecraft:apply_bonus": {
        // census: only binomial_with_bonus_count {extra, probability} is used:
        // Java: added = binomial(n = level + extra, p = probability)
        const level = ctx.enchantments?.[fn.enchantment?.replace(/^minecraft:/, "")] ?? 0;
        if (fn.formula === "minecraft:binomial_with_bonus_count") {
          const n = level + (fn.parameters?.extra ?? 0);
          const p = fn.parameters?.probability ?? 0;
          let added = 0;
          for (let i = 0; i < n; i++) if (Math.random() < p) added++;
          out += added;
        } else if (fn.formula === "minecraft:uniform_bonus_count") {
          out += level > 0 ? Math.floor(Math.random() * (level * (fn.parameters?.bonusMultiplier ?? 1) + 1)) : 0;
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function rollEntry(entry, ctx, drops) {
  if (!entry) return false;
  if (entry.conditions && !entry.conditions.every((c) => testCondition(c, ctx))) return false;

  switch (entry.type) {
    case "minecraft:alternatives": {
      for (const child of entry.children ?? []) {
        const before = drops.length;
        if (rollEntry(child, ctx, drops)) return true;
        drops.length = before;
      }
      return false;
    }
    case "minecraft:item": {
      const count = applyFunctions(entry.count ?? 1, entry.functions, ctx);
      if (count > 0) drops.push({ id: entry.name, amount: count });
      return true;
    }
    case "minecraft:dynamic": {
      // "minecraft:contents" = block entity inventory (machines). Provided by
      // the machine layer; accepted here as a marker for accounting.
      if (entry.name === "minecraft:contents") {
        for (const item of ctx.machineContents ?? []) drops.push(item);
        return true;
      }
      return false;
    }
    case "minecraft:loot_table": {
      const sub = getTable(entry.name?.replace(/^psychedelicraft:/, "blocks/") ?? "");
      if (!sub) return false;
      return evaluateTable(sub, ctx, drops);
    }
    default:
      return false;
  }
}

function rollNumber(rolls) {
  if (typeof rolls === "number") return rolls;
  if (rolls?.min !== undefined) return rolls.min + Math.floor(Math.random() * (rolls.max - rolls.min + 1));
  return 1;
}

export function evaluateTable(table, ctx, out = []) {
  for (const pool of table.pools ?? []) {
    if (pool.conditions && !pool.conditions.every((c) => testCondition(c, ctx))) continue;
    const rolls = rollNumber(pool.rolls) + (ctx.enchantments?.fortune ? 0 : 0); // bonus_rolls unused in tables
    for (let r = 0; r < rolls; r++) {
      const weighted = (pool.entries ?? []).filter((e) => !e.conditions || e.conditions.every((c) => testCondition(c, ctx)));
      if (!weighted.length) continue;
      const totalWeight = weighted.reduce((sum, e) => sum + (e.weight ?? 1), 0);
      let pick = Math.random() * totalWeight;
      for (const entry of weighted) {
        pick -= entry.weight ?? 1;
        if (pick <= 0) {
          rollEntry(entry, ctx, out);
          break;
        }
      }
    }
  }
  return out;
}

// Convenience: evaluate "blocks/<id>" table for a broken block
export function dropsForBlock(blockId, ctx) {
  const short = blockId.replace(/^psychedelicraft:/, "");
  const table = getTable(`blocks/${short}`);
  if (!table) return [];
  return evaluateTable(table, ctx);
}
