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
  setDynamicProperty(key, value) { if (value === undefined) this.props.delete(key); else this.props.set(key, value); }
  setLore(value) { this.lore = value; }
  clone() { const copy = new ItemStack(this.typeId, this.amount); copy.props = new Map(this.props); copy.lore = this.lore; return copy; }
}
const callbacks = new Map();
const signal = (name) => ({ subscribe: (fn) => { const list = callbacks.get(name) ?? []; list.push(fn); callbacks.set(name, list); } });
const events = ['playerBreakBlock','blockExplode','playerInteractWithBlock','playerSpawn','playerLeave'];
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
      const api = { ItemStack, BlockPermutation: { resolve: (id, states = {}) => ({ id, states, getAllStates: () => states }) }, world: mockWorld, system: mockSystem };
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
