# G. SOURCE COMPLETENESS REPORT (§6, §44)

**Provenance:** `github.com/Sollace/Psychedelicraft` branch `1.20.1` @ `319a4ea0160d6600cffcd5f5cc9e363ceaab44a1`
(README.md in this workspace was a placeholder; the user authorized fetching the canonical upstream source).

## Source Completeness Matrix

| System | Source Available | Compiled Available | Data Available | Behavior Provable |
|---|---|---|---|---|
| Registration (blocks/items/fluids/entities) | ✅ full (293 .java) | n/a (not needed) | ✅ | ✅ Level 1 |
| Drug system (types/influences/properties) | ✅ full | n/a | ✅ | ✅ Level 1 |
| Alcohol state machine | ✅ full | n/a | ✅ | ✅ Level 1 |
| Machines (barrel/distillery/mash tub/drying/flask) | ✅ full | n/a | ✅ | ✅ Level 1 |
| Recipes (all 7 custom types) | ✅ full | n/a | ✅ (90 JSON) | ✅ Level 1+3 |
| Loot | ✅ (event wiring) | n/a | ✅ (52 JSON) | ✅ Level 3 |
| Worldgen | ✅ full | n/a | ✅ (features/pools) | ✅ Level 1 |
| Items (smokeables/bongs/containers) | ✅ full | n/a | ✅ | ✅ Level 1 |
| Chat distortion | ✅ full | n/a | ✅ (word lists) | ✅ Level 1 |
| Hallucinations | ✅ manager/classes | n/a | ✅ (textures) | ⚠️ behavior classes read; shader math is GLSL (see below) |
| Shaders (color/bloom/motion/double-vision) | ✅ .glsl/.fsh/.vsh | n/a | ✅ (noise textures) | ⚠️ GLSL present but not executable on Bedrock → observable proxies (Level 7) |
| Villager professions/trades | ✅ full | n/a | ✅ (trade data) | ✅ Level 1 (implementation blocked by platform) |
| Client rendering (models) | ✅ blockstates/models | n/a | ✅ | ✅ Level 3 (converted exactly) |
| Entity models (rift/barrel/peyote/boat) | ❌ model geometry is in Java ModelPart code, partly client-only | n/a | ✅ textures only | ⚠️ shape rebuilt from textures/behavior (Level 6-7) |
| Networking (Channel/MsgDrugProperties) | ✅ full | n/a | — | ✅ Level 1 |
| Config balancing values | ✅ PSConfig | n/a | ✅ | ✅ Level 1 |

## Source-Missing Records (§44)

1. **Reality Rift / Barrel / Peyote entity-model geometry**
   - Feature: exact model meshes of block-entity renderers.
   - Available Evidence: 9 rift textures, 6 barrel textures, 4 peyote textures, bbmodel sources for block models.
   - Missing Evidence: no ModelPart JSON (meshes are defined in Java renderer code).
   - Inferred Behavior: rift = crossed portal planes + pulsing screen plane; barrel/peyote = exact Java block models (converted).
   - Implementation: `resource_pack/models/entity/*.geo.json`.
   - Confidence: MEDIUM. Uncertainty: exact vertex positions of the rift mesh.

2. **AggregateModifier.Combiner.INVERSE_MUL semantics**
   - Feature: combination rule for tremble/double-vision/desat aggregates.
   - Available Evidence: `AggregateModifier.create(initial, modifier, combiner)` usage with init 0.
   - Missing Evidence: Combiner enum body not in read window.
   - Inferred Behavior: `1-(1-a)(1-b)` (yields observed 0..1 ranges).
   - Implementation: `scripts/lib/drugs.js` AGGREGATES.
   - Confidence: MEDIUM-HIGH (mathematically constrained by init values).

3. **MashingRecipe result level**
   - Feature: produced fluid amount when mashing completes.
   - Available Evidence: `result: {fluid}` without level; FillRecepticalRecipe treats `level<=0` as "default stack".
   - Missing Evidence: `getDefaultStack` default for VAT-scale tanks.
   - Inferred Behavior: result fills the tub (VAT capacity).
   - Implementation: `machines.js depositIngredient`. Confidence: MEDIUM.

Everything else in the ledger is Level 1/3 evidence (direct source/data transcription).
