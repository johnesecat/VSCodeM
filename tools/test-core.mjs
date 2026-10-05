// Imported by test-runtime.mjs after its harness is initialized.
export function coreTests({ test, assert, fs, path, root, crafting, rift, wood, fluids, machines, RECIPES, ItemStack, stack, blockGrid, fakePlayer, formResults, items }) {
  test('juniper boat items spawn steerable vanilla boat and chest boat equivalents', () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 30, y: 0, z: 0 }); block.setType('minecraft:water');
    const spawned = []; dim.spawnEntity = (id) => spawned.push(id);
    for (const id of ['juniper_boat', 'juniper_chest_boat']) {
      const itemStack = stack(`psychedelicraft:${id}`);
      assert.equal(items.boat.onUseOn({ block, player: fakePlayer(itemStack), itemStack }).consumeItem, true);
    }
    assert.equal(spawned.join(','), 'minecraft:boat,minecraft:chest_boat');
  });
  test('sign text persists, wax locks edits and axes remove wax', async () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 21, y: 2, z: 3 }); block.setType('psychedelicraft:juniper_sign');
    const player = fakePlayer(stack('minecraft:stick')); player.sendMessage = () => {};
    formResults.push({ canceled: false, formValues: ['Hello\\nJuniper'] });
    await wood.editSign(player, block);
    assert.equal(machines.loadState(block).frontText, 'Hello\\nJuniper');
    wood.wood.onPlayerInteract({ block, player: fakePlayer(stack('minecraft:honeycomb')) });
    assert.equal(machines.loadState(block).waxed, true);
    await wood.editSign(player, block);
    assert.equal(machines.loadState(block).frontText, 'Hello\\nJuniper');
    wood.wood.onPlayerInteract({ block, player: fakePlayer(stack('minecraft:iron_axe')) });
    assert.equal(machines.loadState(block).waxed, false);
  });
  test('wood redstone input opens gate and pressure plate detects an entity', () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 23, y: 2, z: 3 });
    block.setPermutation({ id: 'psychedelicraft:juniper_fence_gate', states: { 'psychedelicraft:open': false } });
    block.getRedstonePower = () => 15;
    wood.wood.onTick({ block }); assert.equal(wood.getState(block, 'open'), true);
    block.getRedstonePower = () => 0;
    wood.wood.onTick({ block }); assert.equal(wood.getState(block, 'open'), false);
    block.setType('psychedelicraft:juniper_pressure_plate');
    dim.getEntities = () => [{ location: { x: 23.5, y: 2.1, z: 3.5 } }];
    wood.wood.onTick({ block }); assert.equal(wood.getState(block, 'powered'), true);
    dim.getEntities = () => [];
    wood.wood.onTick({ block }); assert.equal(wood.getState(block, 'powered'), false);
  });
  test('inventory commit rolls back if a write fails', () => {
    const before = [stack('minecraft:paper'), undefined], slots = [...before]; let fail = true;
    const inv = { size: 2, getItem: (i) => slots[i], setItem: (i, value) => { if (i === 1 && fail) { fail = false; throw new Error('write failed'); } slots[i] = value; } };
    assert.throws(() => crafting.commitPlan(inv, [undefined, stack('psychedelicraft:bottle')]));
    assert.equal(slots[0].typeId, 'minecraft:paper'); assert.equal(slots[1], undefined);
  });
  test('world filling stores water/lava and generated buttons emit redstone', () => {
    for (const id of ['minecraft:water', 'minecraft:lava']) {
      const held = stack('psychedelicraft:filled_bucket'), player = fakePlayer(held); player.selectedSlotIndex = 0;
      assert.equal(crafting.fillFromWorld(player, { typeId: id }), true);
      assert.equal(fluids.readItemFluid(held).id, id);
    }
    for (const id of ['juniper_button', 'juniper_pressure_plate']) {
      const block = JSON.parse(fs.readFileSync(path.join(root, `behavior_pack/blocks/${id}.json`)))['minecraft:block'];
      assert.equal(block.components['minecraft:redstone_producer'].power, 0);
      assert.ok(block.permutations.some((p) => p.components['minecraft:redstone_producer'].power === 15));
    }
  });
  test('rift release transfers charge to an existing entity', () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 25, y: 2, z: 3 });
    let size = 0.4;
    const entity = { location: { x: 25, y: 3, z: 3 }, getDynamicProperty: (key) => key === 'ps:riftSize' ? size : 0, setDynamicProperty: (_, value) => { size = value; } };
    dim.getEntities = () => [entity];
    const state = { currentRiftFraction: 0.5 };
    rift.releaseRift(block, state); assert.equal(size, 0.9); assert.equal(state.currentRiftFraction, 0);
  });
  test('every fill recipe executes with source quantities and receptacle capacity', () => {
    for (const recipe of RECIPES.fill_receptical) {
      const receptacle = recipe.receptical.tag.includes('hot') ? 'stone_cup' : recipe.receptical.tag.includes('drug') ? 'syringe' : 'bottle';
      const input = [stack(`psychedelicraft:${receptacle}`), ...recipe.ingredients.map((i) => stack(i.item ?? 'psychedelicraft:morning_glory')), ...Array(8).fill(undefined)];
      const plan = crafting.planRecipe(input, recipe, 0);
      assert.ok(plan, recipe.id);
      assert.equal(fluids.readItemFluid(plan[0]).id, recipe.result.fluid.replace('psychedelicraft:', ''));
      assert.equal(fluids.readItemFluid(plan[0]).level, Math.min(crafting.capacityOf(plan[0]), recipe.result.level));
      assert.equal(fluids.readItemFluid(input[0]), null);
      if (recipe.ingredients.some((i) => i.item?.endsWith('_bucket'))) assert.ok(plan.some((s) => s?.typeId === 'minecraft:bucket'));
    }
  });
  test('fill requires all repeated ingredients and refuses a full output inventory', () => {
    const recipe = RECIPES.fill_receptical.find((r) => r.id.endsWith('holder_with_caffeine'));
    assert.equal(crafting.planRecipe([stack('psychedelicraft:syringe'), stack('psychedelicraft:coffee_beans')], recipe), null);
    const bucketRecipe = RECIPES.fill_receptical.find((r) => r.id.endsWith('holder_with_coffee'));
    assert.equal(crafting.planRecipe([stack('psychedelicraft:stone_cup'), stack('minecraft:water_bucket', 2), stack('psychedelicraft:coffee_beans', 3)], bucketRecipe), null);
  });
  test('container change retains fluid stages, dye, and inverse conversion', () => {
    const bottle = stack('psychedelicraft:bottle', 1, { ...fluids.makeFluidState('red_grapes', 1300), fermentation: 2, distillation: 16 });
    bottle.setDynamicProperty('ps:dye', 'blue');
    const plan = crafting.planRecipe([bottle, stack('minecraft:white_wool'), undefined], RECIPES.change_receptical[0]);
    const molotov = plan.find((s) => s?.typeId === 'psychedelicraft:molotov_cocktail');
    assert.equal(fluids.readItemFluid(molotov).distillation, 16);
    assert.equal(molotov.getDynamicProperty('ps:dye'), 'blue');
    const reverse = crafting.planRecipe([molotov, undefined], RECIPES.change_receptical[1]);
    assert.equal(fluids.readItemFluid(reverse.find(Boolean)).level, 1300);
  });
  test('fluid restriction drains exactly one unit and preserves the source receptacle', () => {
    const recipe = RECIPES.shapeless_fluid.find((r) => r.id.endsWith('lsa_square'));
    const fluid = { ...fluids.makeFluidState('morning_glory_extract', 50), distillation: 2 };
    const input = [stack('minecraft:paper'), stack('psychedelicraft:bottle', 1, fluid), undefined];
    const plan = crafting.planRecipe(input, recipe);
    assert.ok(plan.some((s) => s?.typeId === 'psychedelicraft:lsd_square'));
    assert.equal(fluids.readItemFluid(plan.find((s) => s?.typeId === 'psychedelicraft:bottle')).level, 49);
    fluid.distillation = 1;
    assert.equal(crafting.planRecipe([stack('minecraft:paper'), stack('psychedelicraft:bottle', 1, fluid), undefined], recipe), null);
  });
  test('pour conserves total volume and rejects mismatched fluid/attributes', () => {
    const fluid = { ...fluids.makeFluidState('red_grapes', 1200), fermentation: 2 };
    const input = [stack('psychedelicraft:bottle', 1, fluid), stack('psychedelicraft:wooden_mug')];
    const plan = crafting.planPour(input, 0, 1);
    assert.equal(fluids.readItemFluid(plan[0]).level, 700);
    assert.equal(fluids.readItemFluid(plan[1]).level, 500);
    assert.equal(fluids.readItemFluid(input[0]).level, 1200);
    const wrong = [input[0], stack('psychedelicraft:wooden_mug', 1, { ...fluid, level: 100, fermentation: 1 })];
    assert.equal(crafting.planPour(wrong, 0, 1), null);
    assert.equal(crafting.planPour(input, 0, 0), null);
  });
  test('obsidian recipes check lava and return vanilla bucket remainder', () => {
    const recipe = RECIPES.shapeless_fluid.find((r) => r.id.endsWith('obsidian_bottle'));
    const plan = crafting.planRecipe([stack('psychedelicraft:filled_glass_bottle', 1, fluids.makeFluidState('minecraft:lava', 125)), stack('minecraft:water_bucket'), undefined], recipe);
    assert.ok(plan.some((s) => s?.typeId === 'psychedelicraft:obsidian_bottle'));
    assert.ok(plan.some((s) => s?.typeId === 'minecraft:bucket'));
    const dust = crafting.planRecipe([stack('psychedelicraft:obsidian_bottle'), undefined], RECIPES.shapeless_fluid.find((r) => r.id.endsWith('obsidian_dust')));
    assert.ok(dust.some((s) => s?.typeId === 'psychedelicraft:obsidian_dust'));
  });
  test('source heat modifications preserve container and volume', () => {
    const input = [stack('psychedelicraft:stone_cup', 1, fluids.makeFluidState('coffee', 250))];
    const plan = crafting.planHeat(input, 0, RECIPES.smelting_receptical[0]);
    assert.equal(fluids.readItemFluid(plan[0]).temperature, 1);
    assert.equal(fluids.readItemFluid(plan[0]).level, 250);
    assert.equal(fluids.readItemFluid(input[0]).temperature, 0);
  });
  test('bottle and molotov shaped recipes execute and retain glass dye metadata', () => {
    for (const recipe of RECIPES.shaped_fluid.filter((r) => !r.blocked)) {
      const ingredients = recipe.pattern.flatMap((row) => [...row].filter((c) => c !== ' ').map((c) => recipe.key[c]));
      const input = [...ingredients.map((i) => stack(i.item ?? 'minecraft:blue_stained_glass')), ...Array(recipe.result.count).fill(undefined)];
      const plan = crafting.planRecipe(input, recipe);
      assert.ok(plan, recipe.id);
      const outputs = plan.filter((s) => s?.typeId === recipe.result.item);
      assert.equal(outputs.reduce((n, s) => n + s.amount, 0), recipe.result.count);
      for (const output of outputs) {
        assert.ok(output.amount <= output.maxAmount);
        assert.equal(output.getDynamicProperty('ps:dye'), 'blue');
      }
    }
  });
  test('mashing requires real base fluid, supports tags, and retains pool volume', () => {
    assert.equal(machines.depositIngredient({}, 'minecraft:apple').accepted, false);
    const state = { fluid: fluids.makeFluidState('minecraft:water', 1200) };
    for (let i = 0; i < 8; i++) machines.depositIngredient(state, 'minecraft:apple');
    assert.equal(state.fluid.id, 'apple'); assert.equal(state.fluid.level, 1200);
    assert.equal(machines.depositIngredient(state, 'minecraft:diamond').accepted, false);
  });
  test('rift absorption conserves size and charge with exact fractional opening', () => {
    const jar = { isOpening: true }, rifts = [{ size: 1, instability: 0 }, { size: 0.5, instability: 0 }];
    rift.jarTick(jar, rifts, [], {}, () => {});
    assert.equal(jar.fractionOpen, 0.02);
    assert.ok(Math.abs(jar.currentRiftFraction - 0.00002) < 1e-12);
    assert.ok(Math.abs(rifts.reduce((n, r) => n + r.size, jar.currentRiftFraction) - 1.5) < 1e-12);
    jar.isOpening = false;
    rift.jarTick(jar, rifts, [], {}, () => {});
    assert.equal(jar.currentRiftFraction, 0.00002);
  });
  test('rift discharge applies zero/power and excludes creative players', () => {
    const jar = { suckingRifts: false, currentRiftFraction: 0.5, isOpening: true, fractionOpen: 1 };
    const effects = [];
    const players = [{ location: { x: 0, y: 0, z: 0 }, getGameMode: () => 'survival' }, { location: { x: 0, y: 0, z: 0 }, getGameMode: () => 'creative' }];
    rift.jarTick(jar, [], players, { x: 0, y: 0, z: 0 }, (_, drug, amount) => effects.push([drug, amount]));
    assert.equal(effects.length, 2);
    assert.ok(Math.abs(effects[0][1] - 0.003) < 1e-12);
    assert.ok(Math.abs(jar.currentRiftFraction - 0.4994) < 1e-12);
  });
  test('critical rift absorption overloads jar without draining critical rift', () => {
    const jar = { currentRiftFraction: 0.9, isOpening: true, fractionOpen: 1 }, rifts = [{ size: 4, instability: 0 }];
    assert.equal(rift.jarTick(jar, rifts, [], {}, () => {}), true);
    assert.equal(rifts[0].size, 4);
  });
  test('charged jar item persists fill and broken jars yield no item', () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 11, y: 2, z: 3 });
    machines.saveState(block, { currentRiftFraction: 0.65 });
    assert.equal(rift.jarDrop(block)[0].getDynamicProperty('ps:riftFraction'), 0.65);
    machines.saveState(block, { jarBroken: true, currentRiftFraction: 1.1 });
    assert.equal(rift.jarDrop(block).length, 0);
  });
  test('log stripping keeps axis and slab merge consumes one item', () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 0, y: 0, z: 0 });
    block.setPermutation({ id: 'psychedelicraft:juniper_log', states: { 'psychedelicraft:axis': 'x' } });
    assert.equal(wood.stripLog(block, stack('minecraft:iron_axe')), true);
    assert.equal(block.typeId, 'psychedelicraft:stripped_juniper_log');
    assert.equal(wood.getState(block, 'axis'), 'x');
    block.setPermutation({ id: 'psychedelicraft:juniper_slab', states: { 'psychedelicraft:type': 'bottom' } });
    assert.equal(wood.mergeSlab(block, stack(block.typeId), fakePlayer(stack(block.typeId))), true);
    assert.equal(wood.getState(block, 'type'), 'double');
    assert.equal(wood.mergeSlab(block, stack(block.typeId), fakePlayer(stack(block.typeId))), false);
  });
  test('door placement creates paired halves; opening syncs and breaking removes partner', () => {
    const dim = blockGrid(), soil = dim.getBlock({ x: 0, y: 0, z: 0 }); soil.setType('minecraft:stone');
    const item = stack('psychedelicraft:juniper_door');
    assert.equal(wood.placeWood({ player: fakePlayer(item), itemStack: item, block: soil, blockFace: 'Up' }), true);
    const lower = soil.above(), upper = lower.above();
    assert.equal(wood.getState(lower, 'half'), 'lower'); assert.equal(wood.getState(upper, 'half'), 'upper');
    wood.toggleWood(lower); assert.equal(wood.getState(upper, 'open'), true);
    wood.breakDoorPartner(lower, lower.permutation); assert.equal(upper.isAir, true);
  });
  test('doors cannot place with blocked upper space; gates/trapdoors toggle', () => {
    const dim = blockGrid(), base = dim.getBlock({ x: 0, y: 0, z: 0 }); base.setType('minecraft:stone'); base.above(2).setType('minecraft:stone');
    const item = stack('psychedelicraft:juniper_door');
    assert.equal(wood.placeWood({ player: fakePlayer(item), itemStack: item, block: base, blockFace: 'Up' }), false);
    for (const id of ['juniper_trapdoor', 'juniper_fence_gate']) {
      const block = base.above(); block.setPermutation({ id: `psychedelicraft:${id}`, states: { 'psychedelicraft:open': false } });
      assert.equal(wood.toggleWood(block), true); assert.equal(wood.getState(block, 'open'), true);
    }
  });
  test('button auto-reset and fence connections update', () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 0, y: 0, z: 0 });
    block.setPermutation({ id: 'psychedelicraft:juniper_button', states: { 'psychedelicraft:powered': false } });
    wood.toggleWood(block);
    for (let i = 0; i < 30; i++) wood.wood.onTick({ block });
    assert.equal(wood.getState(block, 'powered'), false);
    block.setType('psychedelicraft:juniper_fence');
    dim.getBlock({ x: 0, y: 0, z: -1 }).setType('minecraft:stone');
    wood.wood.onTick({ block });
    assert.equal(wood.getState(block, 'north'), true); assert.equal(wood.getState(block, 'south'), false);
  });
  test('stairs recognize outer corner and generated wood variants have proper states', () => {
    const dim = blockGrid(), block = dim.getBlock({ x: 0, y: 0, z: 0 });
    block.setPermutation({ id: 'psychedelicraft:juniper_stairs', states: { 'psychedelicraft:facing': 'north', 'psychedelicraft:half': 'bottom' } });
    dim.getBlock({ x: 0, y: 0, z: -1 }).setPermutation({ id: block.typeId, states: { 'psychedelicraft:facing': 'west', 'psychedelicraft:half': 'bottom' } });
    assert.equal(wood.stairShape(block), 'outer_left');
    for (const id of ['juniper_log', 'juniper_slab', 'juniper_stairs', 'juniper_door', 'juniper_trapdoor', 'juniper_button', 'juniper_pressure_plate', 'juniper_fence_gate']) {
      const json = JSON.parse(fs.readFileSync(path.join(root, `behavior_pack/blocks/${id}.json`)));
      const block = json['minecraft:block']; assert.ok(Object.keys(block.description.states).length);
      assert.ok(block.permutations.length, id);
      assert.ok(Object.hasOwn(block.components, 'psychedelicraft:wood'));
    }
  });
}
