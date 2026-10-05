import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coreTests } from './test-core.mjs';
const root = path.resolve(import.meta.dirname, '..');
const properties = new Map();
const formResults = [];
class MockForm {
  title() { return this; } textField() { return this; } body() { return this; } button() { return this; }
  async show() { return formResults.shift() ?? { canceled: true }; }
}
class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.props = new Map(); }
  getDynamicProperty(key) { return this.props.get(key); }
  getDynamicPropertyIds() { return [...this.props.keys()]; }
  getLore() { return this.lore ?? []; }
  get maxAmount() { return ['psychedelicraft:bottle', 'psychedelicraft:molotov_cocktail'].includes(this.typeId) ? 1 : 64; }
  setDynamicProperty(key, value) { if (value === undefined) this.props.delete(key); else this.props.set(key, value); }
  setLore(value) { this.lore = value; }
  clone() { const copy = new ItemStack(this.typeId, this.amount); copy.props = new Map(this.props); copy.lore = this.lore; return copy; }
}
const callbacks = new Map();
const signal = (name) => ({ subscribe: (fn) => { const list = callbacks.get(name) ?? []; list.push(fn); callbacks.set(name, list); } });
const events = ['playerBreakBlock','blockExplode','playerInteractWithBlock','playerSpawn','playerLeave','projectileHitBlock','projectileHitEntity'];
const mockWorld = {
  getDynamicProperty: (key) => properties.get(key),
  setDynamicProperty: (key, value) => { if (value === undefined) properties.delete(key); else properties.set(key, value); },
  afterEvents: Object.fromEntries(events.map((name) => [name, signal(name)])),
  beforeEvents: { worldInitialize: signal('initialize'), playerInteractWithBlock: signal('beforeInteract'), chatSend: signal('chat') },
  getAllPlayers: () => [],
};
const deferred = [];
const mockSystem = { beforeEvents: {}, run: (fn) => deferred.push(fn), runTimeout: (fn) => deferred.push(fn), runInterval: () => {}, currentTick: 0 };
const context = vm.createContext({ console, Math, Date, Map, Set, JSON, Object });
const cache = new Map();
async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file });
  cache.set(file, module);
  await module.link(async (specifier, parent) => {
    if (specifier === '@minecraft/server') {
      const api = { ItemStack, EntityDamageCause: { magic: 'magic' }, EnchantmentTypes: { get: (id) => ({ id }) }, BlockPermutation: { resolve: (id, states = {}) => ({ id, states, getAllStates: () => states }) }, world: mockWorld, system: mockSystem };
      const mock = new vm.SyntheticModule(Object.keys(api), function () { for (const [key, value] of Object.entries(api)) this.setExport(key, value); }, { context });
      return mock;
    }
    if (specifier === '@minecraft/server-ui') {
      const mock = new vm.SyntheticModule(['ModalFormData', 'ActionFormData'], function () { this.setExport('ModalFormData', MockForm); this.setExport('ActionFormData', MockForm); }, { context });
      return mock;
    }
    return load(path.resolve(path.dirname(parent.identifier), specifier));
  });
  return module;
}
async function exportsOf(relative) {
  const module = await load(path.join(root, relative));
  if (module.status === 'linked') await module.evaluate();
  return module.namespace;
}
// Pre-link shared modules in dependency order to support cycles deterministically.
await exportsOf('behavior_pack/scripts/lib/crafting.js');
const fluids = await exportsOf('behavior_pack/scripts/lib/fluids.js');
const items = await exportsOf('behavior_pack/scripts/lib/items.js');
const machines = await exportsOf('behavior_pack/scripts/lib/machines.js');
const drugs = await exportsOf('behavior_pack/scripts/lib/drugs.js');
const bags = await exportsOf('behavior_pack/scripts/lib/bags.js');
const molotov = await exportsOf('behavior_pack/scripts/lib/molotov.js');
mockWorld.gameRules = { mobGriefing: false };
const { CONTENT } = await exportsOf('behavior_pack/scripts/data/content.js');
await exportsOf('behavior_pack/scripts/main.js');
const registeredItems = new Map(), registeredBlocks = new Map();
callbacks.get('initialize')[0]({ itemComponentRegistry: { registerCustomComponent: (name, handler) => registeredItems.set(name, handler) }, blockComponentRegistry: { registerCustomComponent: (name, handler) => registeredBlocks.set(name, handler) } });
test('main initializes every new component and routes source-based item events', () => {
  assert.ok(registeredBlocks.has('psychedelicraft:wood'));
  assert.ok(registeredBlocks.has('psychedelicraft:rift_jar'));
  assert.ok(registeredItems.has('psychedelicraft:boat'));
  const held = new ItemStack('psychedelicraft:bottle');
  fluids.writeItemFluid(held, { ...fluids.makeFluidState('red_grapes', 735), fermentation: 2 });
  const player = fakePlayer(held); player.id = 'runtime-dispatch';
  player.getDynamicProperty = () => undefined;
  registeredItems.get('psychedelicraft:container').onUse({ source: player, itemStack: held });
  assert.equal(fluids.readItemFluid(player.getComponent().container.getItem(0)).level, 235);
});
test('before-interaction places a charged jar with preserved item charge', () => {
  const dim = blockGrid(), base = dim.getBlock({ x: 44, y: 0, z: 0 }); base.setType('minecraft:stone');
  const held = rift.chargedJar(0.55), player = fakePlayer(held);
  const event = { player, block: base, blockFace: 'Up', itemStack: held, cancel: false };
  for (const fn of callbacks.get('beforeInteract')) fn(event);
  assert.equal(event.cancel, true);
  while (deferred.length) deferred.shift()();
  assert.equal(base.above().typeId, 'psychedelicraft:rift_jar');
  assert.equal(machines.loadState(base.above()).currentRiftFraction, 0.55);
});

const crafting = await exportsOf('behavior_pack/scripts/lib/crafting.js');
const rift = await exportsOf('behavior_pack/scripts/lib/rift.js');
const wood = await exportsOf('behavior_pack/scripts/lib/wood.js');
const { RECIPES } = await exportsOf('behavior_pack/scripts/data/recipes.js');

function stack(id, amount = 1, fluid) { const s = new ItemStack(id, amount); if (fluid) fluids.writeItemFluid(s, fluid); return s; }
function blockGrid() {
  const blocks = new Map();
  const dim = {
    id: 'minecraft:overworld', getEntities: () => [], spawnItem: () => {},
    getBlock(pos) {
      const key = `${pos.x},${pos.y},${pos.z}`;
      if (blocks.has(key)) return blocks.get(key);
      const b = { location: pos, dimension: dim, typeId: 'minecraft:air', isAir: true, isSolid: false,
        permutation: { type: { id: 'minecraft:air' }, getState: () => undefined, getAllStates: () => ({}) },
        setType(id) { this.setPermutation({ id, states: {} }); },
        setPermutation(p) {
          this.typeId = p.id; this.isAir = p.id === 'minecraft:air'; this.isSolid = !this.isAir;
          const states = p.states;
          this.permutation = { type: { id: p.id }, getState: (key) => states[key], getAllStates: () => states, withState: (key, value) => ({ id: p.id, states: { ...states, [key]: value } }) };
        }, above(n = 1) { return dim.getBlock({ ...pos, y: pos.y + n }); }, below(n = 1) { return dim.getBlock({ ...pos, y: pos.y - n }); },
      }; blocks.set(key, b); return b;
    },
  };
  return dim;
}
function fakePlayer(held) { const slots = [held]; return { selectedSlotIndex: 0, isSneaking: false, getRotation: () => ({ x: 0, y: 0 }), getGameMode: () => 'survival', getComponent: () => ({ container: { getItem: (i) => slots[i], setItem: (i, s) => { slots[i] = s; } } }) }; }

coreTests({ test, assert, fs, path, root, crafting, rift, wood, fluids, machines, RECIPES, ItemStack, stack, blockGrid, fakePlayer, formResults, items });

test('paper bag stores matching items, rejects mixtures, and conserves counts', () => {
  const bag = stack('psychedelicraft:paper_bag');
  assert.equal(bags.insertBag(bag, stack('minecraft:cookie', 64)), 64);
  assert.equal(bags.insertBag(bag, stack('minecraft:cookie', 20)), 20);
  assert.equal(bags.insertBag(bag, stack('minecraft:spider_eye')), 0);
  assert.equal(bags.insertBag(bag, stack('minecraft:diamond')), 0);
  assert.equal(bags.withdrawBag(bag, 1).amount, 1);
  assert.equal(bags.withdrawBag(bag).amount, 64);
  assert.equal(bags.withdrawBag(bag).amount, 19);
  assert.equal(bags.readBag(bag), null);
});
test('paper bag preserves fluid and dye properties and bottle capacity is one', () => {
  const bag = stack('psychedelicraft:paper_bag');
  const bottle = stack('psychedelicraft:bottle', 1, { ...fluids.makeFluidState('red_grapes', 1234), distillation: 5 });
  bottle.setDynamicProperty('ps:dye', 'blue');
  assert.equal(bags.insertBag(bag, bottle), 1);
  assert.equal(bags.insertBag(bag, bottle), 0);
  const out = bags.withdrawBag(bag);
  assert.equal(fluids.readItemFluid(out).level, 1234);
  assert.equal(fluids.readItemFluid(out).distillation, 5);
  assert.equal(out.getDynamicProperty('ps:dye'), 'blue');
});
test('paper bag form inserts and drops through the user interface', async () => {
  const slots = [stack('psychedelicraft:paper_bag'), stack('minecraft:cookie', 10)];
  const dropped = [];
  const player = { selectedSlotIndex: 0, location: {}, dimension: { spawnItem: (s) => dropped.push(s) }, getComponent: () => ({ container: { size: 2, getItem: (i) => slots[i]?.clone(), setItem: (i, s) => { slots[i] = s; } } }) };
  formResults.push({ selection: 2 }); await bags.openPaperBag(player);
  assert.equal(slots[1], undefined); assert.equal(bags.readBag(slots[0]).count, 10);
  formResults.push({ selection: 0 }); await bags.openPaperBag(player);
  assert.equal(dropped[0].amount, 1); assert.equal(bags.readBag(slots[0]).count, 9);
});
test('paper bag removes spawned drop when its inventory commit fails', async () => {
  const original = stack('psychedelicraft:paper_bag');
  bags.insertBag(original, stack('minecraft:cookie', 10));
  let removed = false;
  const player = { selectedSlotIndex: 0, location: {}, dimension: { spawnItem: () => ({ remove: () => { removed = true; } }) }, getComponent: () => ({ container: { size: 1, getItem: () => original.clone(), setItem: () => { throw new Error('inventory unavailable'); } } }) };
  formResults.push({ selection: 0 });
  await assert.rejects(bags.openPaperBag(player), /inventory unavailable/);
  assert.equal(removed, true);
  assert.equal(bags.readBag(original).count, 10);
});
test('nightshade harvesting damages shears without consuming the tool', () => {
  const dim = blockGrid(), block = dim.getBlock({ x: 70, y: 0, z: 0 });
  block.setPermutation({ id: 'psychedelicraft:jimsonweed', states: { 'psychedelicraft:age': 7 } });
  const held = stack('minecraft:shears'); const durability = { maxDurability: 238, damage: 0 };
  held.getComponent = () => durability;
  const player = fakePlayer(held);
  registeredBlocks.get('psychedelicraft:nightshade').onPlayerInteract({ block, player, itemStack: held });
  assert.equal(player.getComponent().container.getItem(0), held);
  assert.equal(durability.damage, 1);
  assert.equal(block.permutation.getState('psychedelicraft:age'), 6);
});
test('bottle crafting refuses insufficient output slots without changing inputs', () => {
  const recipe = RECIPES.shaped_fluid.find((r) => r.id === 'psychedelicraft:bottle');
  const input = [stack('minecraft:blue_stained_glass', 6), undefined];
  assert.equal(crafting.planRecipe(input, recipe), null);
  assert.equal(input[0].amount, 6);
});
test('registered item components have actual event handlers', () => {
  for (const [id, handlers] of registeredItems) assert.ok(Object.values(handlers).some((handler) => typeof handler === 'function'), id);
});
function molotovDimension() {
  const impacts = { explosions: [], particles: [], sounds: [], removed: 0 };
  const dimension = {
    spawnEntity(typeId, location) {
      const props = new Map();
      const component = { shoot: (velocity) => { impacts.velocity = velocity; } };
      const entity = { typeId, location, isValid: true, getComponent: () => component, getDynamicProperty: (k) => props.get(k), setDynamicProperty: (k, v) => props.set(k, v), remove: () => { entity.isValid = false; impacts.removed++; } };
      impacts.entity = entity; return entity;
    },
    createExplosion: (location, radius, options) => impacts.explosions.push({ location, radius, options }),
    spawnParticle: (id) => impacts.particles.push(id), playSound: (id) => impacts.sounds.push(id),
  };
  return { dimension, impacts };
}
test('molotov Java formula applies volume before clamp and scales combustion again', () => {
  for (const fluid of [null, fluids.makeFluidState('minecraft:water', 2000), fluids.makeFluidState('red_grapes', 2000)]) {
    const result = molotov.combustion(fluid);
    assert.equal(result.fire, 0); assert.equal(result.explosion, 0); assert.equal(result.damage, 4);
  }
  const small = molotov.combustion({ ...fluids.makeFluidState('red_grapes', 500), fermentation: 2 });
  assert.ok(Math.abs(small.fire - 0.275) < 1e-12);
  assert.ok(Math.abs(small.explosion - 0.0825) < 1e-12);
  const full = molotov.combustion({ ...fluids.makeFluidState('red_grapes', 2000), fermentation: 2 });
  assert.equal(full.fire, 4); assert.equal(full.explosion, 1.2); assert.equal(full.fireSeconds, 0.6);
  const distilled = molotov.combustion({ ...fluids.makeFluidState('red_grapes', 500), fermentation: 2, distillation: 16 });
  assert.ok(distilled.fire > small.fire); assert.ok(distilled.explosion > small.explosion);
});
test('survival pouring fills a molotov and conserves fluid before launching', () => {
  const wine = { ...fluids.makeFluidState('red_grapes', 1200), fermentation: 2 };
  const plan = crafting.planPour([stack('psychedelicraft:bottle', 1, wine), stack(molotov.MOLOTOV)], 0, 1);
  assert.ok(plan);
  assert.equal(fluids.readItemFluid(plan[1]).level, 1200);
  assert.equal(molotov.combustion(fluids.readItemFluid(plan[1])).fire, 1.584);
});
test('molotov item dispatch snapshots fluid and consumes exactly once', () => {
  const { dimension, impacts } = molotovDimension();
  const held = stack(molotov.MOLOTOV, 1, { ...fluids.makeFluidState('red_grapes', 500), fermentation: 2, maturation: 4 });
  const player = fakePlayer(held); player.dimension = dimension; player.location = { x: 0, y: 80, z: 0 };
  player.getViewDirection = () => ({ x: 1, y: 0, z: 0 }); player.getHeadLocation = () => ({ x: 0, y: 81, z: 0 });
  registeredItems.get('psychedelicraft:molotov').onUse({ source: player, itemStack: held });
  assert.equal(player.getComponent().container.getItem(0), undefined);
  const copied = JSON.parse(impacts.entity.getDynamicProperty('ps:molotovFluid'));
  assert.equal(copied.level, 500); assert.equal(copied.maturation, 4);
  assert.equal(impacts.velocity.x, 0.5);
  assert.equal(impacts.entity.getComponent().owner, player);
});
test('molotov registered impact callbacks distinguish water from alcohol and cannot detonate twice', () => {
  for (const combustible of [false, true]) {
    const { dimension, impacts } = molotovDimension();
    const fluid = combustible ? { ...fluids.makeFluidState('red_grapes', 2000), fermentation: 2 } : fluids.makeFluidState('minecraft:water', 2000);
    const projectile = molotov.launchMolotov(dimension, { x: 0, y: 80, z: 0 }, { x: 0, y: 0, z: 1 }, fluid);
    const damage = [], fire = [], target = { applyDamage: (n) => damage.push(n), setOnFire: (n) => fire.push(n) };
    const event = { projectile, dimension, location: projectile.location, getEntityHit: () => ({ entity: target }) };
    for (const callback of callbacks.get('projectileHitEntity')) callback(event);
    assert.equal(damage[0], 4); assert.equal(fire.length, combustible ? 1 : 0);
    assert.equal(impacts.explosions.length, combustible ? 1 : 0);
    if (combustible) { assert.equal(fire[0], 1); assert.equal(impacts.explosions[0].radius, 1.2); assert.equal(impacts.explosions[0].options.breaksBlocks, false); }
    else { assert.equal(impacts.particles.length, 0); assert.ok(impacts.sounds.includes('random.fizz')); }
    for (const callback of callbacks.get('projectileHitBlock')) callback(event);
    assert.equal(impacts.removed, 1); assert.equal(damage.length, 1);
  }
});
test('molotov ground fire respects mobGriefing and never replaces solid blocks', () => {
  const originalRandom = context.Math.random; context.Math.random = () => 0;
  try {
    for (const allowed of [false, true]) {
      mockWorld.gameRules.mobGriefing = allowed;
      const { dimension, impacts } = molotovDimension(); let fire = 0;
      dimension.getBlock = () => ({ isAir: true, below: () => ({ isSolid: true }), setType: (id) => { assert.equal(id, 'minecraft:fire'); fire++; } });
      const entity = molotov.launchMolotov(dimension, { x: 0, y: 80, z: 0 }, {}, { ...fluids.makeFluidState('red_grapes', 2000), fermentation: 2 });
      molotov.impactMolotov({ projectile: entity, dimension, location: entity.location });
      assert.equal(fire > 0, allowed); assert.equal(impacts.removed, 1);
    }
    mockWorld.gameRules.mobGriefing = true;
    const { dimension } = molotovDimension();
    dimension.getBlock = () => ({ isAir: false, setType: () => assert.fail('solid block was replaced') });
    const entity = molotov.launchMolotov(dimension, {}, {}, { ...fluids.makeFluidState('red_grapes', 2000), fermentation: 2 });
    molotov.impactMolotov({ projectile: entity, dimension, location: { x: 0, y: 80, z: 0 } });
  } finally { context.Math.random = originalRandom; mockWorld.gameRules.mobGriefing = false; }
});
test('molotov cleanup tolerates engine removal during its explosion', () => {
  const { dimension, impacts } = molotovDimension();
  const entity = molotov.launchMolotov(dimension, {}, {}, { ...fluids.makeFluidState('red_grapes', 2000), fermentation: 2 });
  dimension.createExplosion = () => { entity.isValid = false; };
  molotov.impactMolotov({ projectile: entity, dimension, location: {} });
  assert.equal(impacts.removed, 0);
});
test('empty containers have no invented fluid; full process stages round-trip', () => {
  const stack = new ItemStack('psychedelicraft:bottle');
  assert.equal(fluids.readItemFluid(stack), null);
  const fluid = { ...fluids.makeFluidState('red_grapes', 735), distillation: 16, maturation: 16 };
  fluids.writeItemFluid(stack, fluid);
  assert.equal(fluids.readItemFluid(stack).level, 735);
  assert.equal(fluids.readItemFluid(stack).distillation, 16);
  assert.equal(fluids.readItemFluid(stack).maturation, 16);
});
test('drinking decrements actual volume rather than reconstructing a full bottle', () => {
  const stack = new ItemStack('psychedelicraft:bottle');
  fluids.writeItemFluid(stack, { ...fluids.makeFluidState('red_grapes', 735), fermentation: 2 });
  const result = items.container.onUse({ itemStack: stack });
  assert.equal(result.setItemFluid.level, 235);
  assert.ok(result.addInfluences.length > 0);
});
test('bong consumes precisely one ingredient, never deletes its whole stack', () => {
  const stack = new ItemStack('psychedelicraft:dried_tobacco', 5);
  const inv = { size: 1, getItem: () => stack, setItem: (_, value) => { assert.equal(value.amount, 4); } };
  const result = items.bong.onUse({ player: { getComponent: () => ({ container: inv }) }, itemStack: new ItemStack('psychedelicraft:bong') });
  assert.equal(stack.amount, 4);
  assert.ok(result.addInfluences.length);
});
test('seeds resolve a crop permutation, not an age state on air', () => {
  let placed;
  const target = { isAir: true, setPermutation: (value) => { placed = value; } };
  const result = items.seeds.onUseOn({ itemStack: new ItemStack('psychedelicraft:cannabis_seeds'), block: { typeId: 'minecraft:farmland', above: () => target } });
  assert.equal(placed.id, 'psychedelicraft:cannabis');
  assert.equal(result.consumeItem, true);
});
test('tank deposits preserve overflow and do not alias input state', () => {
  const fluid = fluids.makeFluidState('red_grapes', 2000);
  const state = { capacity: 1000 };
  const result = machines.tankDeposit(state, fluid);
  assert.equal(result.remaining, 1000);
  assert.equal(fluid.level, 2000);
  assert.equal(state.fluid.level, 1000);
});
test('machine state persists on World and is consumed once on removal', () => {
  const block = { dimension: { id: 'minecraft:overworld' }, location: { x: 1, y: 2, z: 3 } };
  machines.saveState(block, { items: { 1: { id: 'psychedelicraft:tobacco', amount: 1 } } });
  assert.ok(properties.size);
  assert.equal(machines.dropMachineContents({ block }, 'barrel').drops.length, 1);
  assert.equal(machines.dropMachineContents({ block }, 'barrel').drops.length, 0);
  assert.equal(properties.has('ps:machine:minecraft:overworld:1,2,3'), false);
});
test('all source modifier formulas fully parse at multiple strengths', () => {
  assert.equal(drugs.evalFormula('v>0.6? v*0.8 : v*0.2', { v: 1, t: 100 }), 0.8);
  assert.equal(drugs.evalFormula('v>0.6? v*0.8 : v*0.2', { v: 0.5, t: 100 }), 0.1);
  for (const drug of CONTENT.drugs) for (const formula of Object.values(drug.modifiers ?? {})) {
    for (const v of [0, 0.5, 1]) assert.ok(Number.isFinite(drugs.evalFormula(formula, { v, t: 100 })));
  }
});
test('every generated block geometry uses bones and 2D UVs', () => {
  for (const filename of fs.readdirSync(path.join(root, 'resource_pack/models/blocks'))) {
    const json = JSON.parse(fs.readFileSync(path.join(root, 'resource_pack/models/blocks', filename)));
    assert.ok(json.format_version, filename);
    for (const geo of json['minecraft:geometry']) {
      assert.ok(geo.bones?.length, filename);
      for (const bone of geo.bones) for (const cube of bone.cubes ?? []) {
        if (Array.isArray(cube.uv)) assert.equal(cube.uv.length, 2, filename);
        else for (const face of Object.values(cube.uv ?? {})) assert.equal(face.uv.length, 2, filename);
      }
    }
  }
});
test('all placeable items bind the block placer component', () => {
  for (const item of CONTENT.items.filter((item) => item.kind === 'placeable')) {
    const json = JSON.parse(fs.readFileSync(path.join(root, `behavior_pack/items/${item.id}.json`)));
    assert.equal(json['minecraft:item'].components['minecraft:block_placer'].block, `psychedelicraft:${item.block}`);
  }
});
