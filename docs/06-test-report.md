# I. TEST REPORT (§18, §33-38)

**Honesty statement:** this build environment has no Minecraft Bedrock runtime. Everything below
distinguishes EXECUTED tests (real results) from PENDING-RUNTIME tests (procedures defined, results
NOT yet claimed). No test result on this page is simulated.

## Compatibility correction (2026-10-02)

Prior static PASS results did not imply Bedrock runtime compatibility. See docs/09 for the repaired geometry, item events, persistence, fluid and UI defects and the new nine-test Node mock suite. Container aux packing below is historical and **incorrect** for full 0–16 stages: four bits cannot retain stage 16. Runtime containers now use ItemStack dynamic properties. All client/server-engine tests remain pending.

## EXECUTED — historical static/validation suite (`tools/validate.mjs`, run at final build)

| Check | Result |
|---|---|
| JSON well-formedness (466 pack JSON files) | PASS |
| Manifest integrity (UUID format/uniqueness, script entry, BP→RP dependency) | PASS |
| Block identifiers (59) unique + textures/geometry/components resolve | PASS |
| Item identifiers (97) unique + icons/components resolve | PASS |
| Recipes (46) unique + ingredient/result referential integrity | PASS |
| Lang coverage (tile+item names for all 156 ids) | PASS (0 warnings) |
| Script syntax (15 ES modules, node --check) | PASS |
| Drug/fluid cross-references (18 drugs, 27 fluids, modifier names) | PASS |
| Worldgen feature rules resolve to features | PASS |
| Texture completeness vs Java source (300/300 PNGs accounted) | PASS |
| Zip packaging (925 files, manifests at pack roots) | PASS |

## EXECUTED — script-level logic review (code-trace against Java)

| System | Verified |
|---|---|
| DrugInfluence.update / SimpleDrug.update | line-for-line math match (decay, smoothing clamp, delivery) |
| Alcohol state machine | processing times, cycle wrap, slurry byproduct, acetify quirk match source |
| Alcohol content formula | fermentation/distillation/maturation coefficients match PSFluids |
| Drink variant resolution | StatePredicate semantics + all 130+ variant entries transcribed from PSFluids |
| Drying table | heat formula ((l²h)²), rain reset, 19200/14400 tick durations, x3 outputs |
| Distillery | heat rates 1/3/7, fermented-only + unmatured gate |
| MessageDistorter | per-char/word probabilities + rewind + word lists verbatim |
| Loot evaluator | binomial_with_bonus_count(n=level+extra, p), table_bonus chances, alternatives, dynamic contents |
| Container aux packing | 16-bit layout holds all fluid states exactly (5+2+4+4+1) |

## PENDING-RUNTIME — procedures defined (§18, §34-38)

| Suite | Procedure | Status |
|---|---|---|
| Block/item/crop tests | place all 59 blocks, grow each crop stage, harvest with/without shears/fortune/silk | PENDING |
| Machine tests | barrel aging, distillery over lava/fire, mash tub recipes, drying tables under rain/light changes | PENDING |
| Recipe tests | craft all 46 recipes + fluid flows (fill/pour/mash/heat) | PENDING |
| Effect tests | each of 18 drugs via items; verify decay curves and modifier ranges | PENDING |
| Fluid tests | container round-trips, vinegar transition, distillation byproducts | PENDING |
| UI tests | machine forms insert/extract, drink naming (localization) | PENDING |
| Worldgen tests | new world: verify all 12 patches + juniper growth | PENDING |
| Loot tests | break each block at each age/tool; compare drops to Java tables | PENDING |
| Persistence tests | reload/relog/server-restart with machines mid-process and active drug states | PENDING |
| Multiplayer tests | 2+ players, simultaneous machine access, join/respawn state sync | PENDING |
| Duplication tests | rapid insert/extract, break-machine-with-contents while extracting, death during trade | PENDING |
| Fuzz tests | invalid inputs, full inventories, unloaded-chunk ticks, rapid interactions | PENDING |
| Torture tests | 100+ machines/crops loaded, tick spike profiling | PENDING |
| Hallucination/rift tests | trip on LSD/shrooms: tint pulses, drift, hallucination entities, rift spawn/capture | PENDING |
| Regression suite | after each fix: re-run validate + checklist above | validate = EXECUTED each iteration |

**Runtime acceptance script (for the first in-game pass):**
1. Import `Psychedelicraft-Bedrock.mcaddon`, create a test world with both packs + scripts enabled.
2. `/give @s psychedelicraft:cannabis_seeds` → plant → bone meal → verify stage textures 0-3.
3. `/give @s psychedelicraft:joint` → use → verify breath sounds, then `/give @s psychedelicraft:lsd_pill` → verify tint pulses, drift camera, hallucination entities, chat distortion.
4. Wait for (or force via `/summon psychedelicraft:reality_rift`) a rift → verify spin/bob/particles → place rift_jar nearby → capture + sound.
5. Mash tub: `/give @s psychedelicraft:agave_leaf` x7 + water → verify agave fluid; barrel → mature; distillery over lava → verify speed + slurry.
6. Reload world → verify machine + drug state persisted.
