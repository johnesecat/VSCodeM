# Functionality audit — 2026-10-05

## Release status

**Not 100% functional Java parity.** This pass repairs confirmed defects and verifies a packaged-server smoke test, not every player interaction or visual effect. Historical VERIFIED/exact labels must not be read as client certification.

Deliverable: `Psychedelicraft-Bedrock.mcaddon`, containing behavior and resource packs. Requires Bedrock **1.21.120 or newer**, stable `@minecraft/server` **2.0.0**, and `@minecraft/server-ui` **2.0.0**. Live smoke target: Dedicated Server **1.26.52.3**. Earlier 1.15.0/1.3.0 declarations were replaced to align with modern component registration.

## Repairs and added emulation

- Nightshade harvest damages shears instead of deleting the tool; mature bone-meal harvest does not consume it in this handler, matching Java `NightshadeBlock`.
- Paper bags now open a real storage form from item use. Store one source-tag-approved item type, up to 64,000 units (bottles: one), and drop one item or one stack. Fluid/dye dynamic properties, name, lore, durability and enchantments are serialized. Insertions use rollback-aware inventory commits; form responses revalidate the held bag. Failed drop commits remove the spawned item to avoid duplication. This replaces Java inventory right-clicks; automatic neighboring-slot collection and dispenser behavior remain unimplemented.
- Removed the empty jar item registration; charged placement already belongs to the before-interaction path.
- Removed the incorrect claim that SuspiciousItem physically transforms eaten items: Java disguises appearance/name while tripping. The cosmetic disguise is still missing here.
- Modern `minecraft:enchantable.getEnchantments()` enables fortune/silk-touch discovery in central loot dispatch.
- Central consumption/durability helpers preserve creative-mode items. Other direct inventory mutation paths still require a creative-mode audit.
- Custom sound namespaces now resolve to the shipped definitions. Java vanilla OGG paths for jar toggles are mapped to a native event alias instead of nonexistent files. Static validation checks local sound assets; audibility is client-unverified.
- Generated blocks/items use named custom components and format 1.21.120 rather than removed legacy component arrays. Redstone blocks no longer fail schema upgrade.
- Worldgen evaluates X and Z before heightmap Y, avoiding undefined `variable.worldx` errors.
- Fluid crafting splits recipe output across each item's actual maximum stack size; it no longer relies on impossible stacks of eight single-stack bottles/four molotovs. Insufficient output space is rejected without consuming input.
- Packaging omits generator intermediate `behavior_pack/data/` and incompatible `source_assets/` trees. All source evidence stays in the repository; runtime tables remain under `scripts/data/`. Preserved Java shader/NBT files are not advertised as executable Bedrock content.

## Usage

1. Import the `.mcaddon` in Minecraft and activate both packs in a test world.
2. Sneak-interact with a crafting table for fluid-aware recipe/pouring forms.
3. Interact with machines for insert/extract controls; drying tables expose input/output controls.
4. Use one separated paper bag to choose storage or drop actions.
5. Rift jar: interact to open/close; sneak-interact to switch absorption/discharge. Item charge survives the custom placement/drop path.

## Verification

- `npm run validate`: JSON, identifiers, bindings, geometry/UVs/textures, sound assets, recipes, script syntax and worldgen references.
- `npm test`: Node VM regression suite including form-driven bag insert/drop, metadata conservation, nightshade dispatch and stack-limit recipe planning. Mocks do not prove Bedrock APIs or rendering.
- `npm run package:addon`: rebuilds the exact root deliverable.
- `npm run test:bedrock`: runs the archive in an isolated server installation using `BDS_DIR` (default `.runtime/server`). Needs a Linux BDS installation and a local `worlds/TestWorld` fixture. Copies system library packs as well as vanilla packs: omitting `server_library` caused a harness-only unrecognized native-module error during initial runs.
- Final smoke run must show native script initialization/self-test, three successful block placements, no error lines, and normal shutdown. Logs are retained under `.runtime/smoke-*/`. Headless testing does not certify forms, textures, sounds, multiplayer behavior or survival progression.

### Final results

- Repository validator: **PASS**, 0 errors/0 warnings.
- VM regression tests: **42 passed**, 0 failed/skipped.
- Rebuilt archive: **3.10 MB**; ZIP integrity and required file/exclusion checks passed.
- Packaged BDS smoke test: **PASS**, 1.26.52.3, three block placements and normal shutdown. Final evidence: `.runtime/smoke-uN9y4B/`.
- Creator Tools 0.19.0 archive `validate main --isolated`: **0 errors, 372 warnings, 164 recommendations**, not warning-clean. Findings include four render-controller `uv_anim` schema warnings, unused preserved textures, script-analysis recommendations and vanilla reference checks unavailable in isolated mode. This result is not full engine/client certification.

## Open work before a complete release

| Domain | Current implementation / missing behavior |
|---|---|
| Molotovs | Fluid snapshot, Java-derived alcohol/volume combustion, direct damage/ignition, native blast, trails, ground fire and cleanup implemented. Six live BDS collision cases pass; see molotov verification below. Differences: instant-use launch instead of Java release charging, native blast physics, solid-block protection also preserves replaceable plants, burn duration rounds up to whole seconds. Java's apparent repeated-direct-target splash bug is not reproduced. |
| Villagers / village houses | Dealer/addict trades, custom NPC equivalents and source house conversion/placement are not implemented. Source data is evidence only. |
| Commands / advancements | No `/drug` or script-event equivalents, progression tracker, or advancement notifications. Feasible emulations should be designed and tested. |
| Machine interactions | Burner returns an undispatched toggle result; tray/rack and placed-drink slot semantics need source comparison and user-interface tests. Existing tank forms are not proof of every Java machine action. |
| Suspicious items / harmonium | Tripping-dependent disguise and dye rendering are not reproduced. |
| World fluids | Tanks/containers/pour conservation implemented; world spill spreading/physical flow absent. A bounded script simulation is possible work, not native fluid parity. |
| Visuals | Camera/particle approximations exist. Exact Java framebuffer/depth refraction, double vision and bloom cannot be loaded as GLSL in standard Bedrock addons. Client review still required. |
| Boats / signs / wood | Boats use native models, not juniper-specific entities. Sign form text persists but client-facing text rendering and every wood collision/redstone configuration need verification. |
| Persistence / multiplayer | Short regression and smoke coverage only; restart, respawn, inventory races and simultaneous machine users need longer integration tests. |
| Survival completeness | Acquisition/recipes for every Java registered item/block and all production chains need a source-to-playthrough audit; current inventory counts do not establish completeness. |

## Fluid-dependent molotov verification

Use the existing sneak-crafting-table pouring form to transfer fluid into a molotov, or convert a filled bottle with wool using the fluid-aware recipe. Use the molotov to throw it; survival consumes one item, creative retains it. Fluid state is copied onto the projectile before item consumption. No native fixed-fire throwable path remains.

Java `DrugFluid.getAlcohol` scales alcohol influences by volume, clamps the sum to 0–1, then computes `fire = alcohol * liters * 2` and `explosion = alcohol * liters * 0.6`. This includes Java's double volume scaling. Fermentation, distillation, maturation and partial fill all contribute through the existing source-derived fluid formulas. Empty, water, coffee and alcohol-free juices do not combust. Direct glass impact still deals Java's minimum four damage, even when nonflammable.

Run `npm run test:bedrock -- --molotov` for six real projectile collisions on BDS 1.26.52.3. The test-only module is inserted into an isolated copy, never into the shipped archive. Final live evidence: `.runtime/smoke-ST2W3N/smoke-output.log`.

| Live case | Fire / explosion strengths | Observed result |
|---|---|---|
| Empty block hit | 0 / 0 | Nearby pig 10/10 health; no ignition; projectile removed |
| Water block hit | 0 / 0 | Nearby pig 10/10 health; no ignition; projectile removed |
| 500 mB fermented wine block hit | 0.275 / 0.0825 | Small native blast; distant pig unaffected; projectile removed |
| 2000 mB fermented wine block hit | 4 / 1.2 | Nearby pig health reduced from 10 to 0.24025; solid wall intact |
| Water entity hit | 0 / 0 | Pig health reduced from 10 to 6; zero fire ticks |
| Wine entity hit | 0.275 / 0.0825 | Pig health reduced from 10 to 6; 20 fire ticks observed |

Live testing exposed and corrected invalid projectile damage options, explosion-triggered projectile removal, and Bedrock truncating fractional-second ignition to zero. Damage now uses `damagingProjectile`; cleanup checks `isValid`; burn time rounds up to whole seconds (Java minimum is 10 ticks). Bedrock does not issue the expected explosion after-event for these protected-block blasts, so the test checks actual nearby-entity health rather than treating event count as proof.

The complete VM suite now has **48 passing tests**, including volume-before-clamp formulas, distilled strength, actual item callback routing, metadata/owner transfer, survival pouring, no double impact, mobGriefing-aware air-only ground ignition and explosion cleanup. Final repository validation passes with zero errors/warnings. Rebuilt deliverable is **3.11 MB**. Native explosion damage/knockback is a Bedrock equivalent, not byte-for-byte Java physics. Standard portable APIs do not expose Java's replaceability predicate; all solid blocks are protected. Java's source apparently re-damages the original hit target in its nearby-entity loop; this bug is deliberately not duplicated, while native explosion splash damages nearby entities.

These are actionable gaps, not grounds for a 100% completion claim. No commit, push, deployment, or publication was performed in this pass.
