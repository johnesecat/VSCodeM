# D. DEPENDENCY / REFERENCE GRAPH (§5)

## Registration chain (entrypoint → gameplay)

```
fabric.mod.json
  main: ivorius.psychedelicraft.Psychedelicraft.onInitialize()
    ├─ PSBlocks.bootstrap()      → PSBlockEntities, flammability, strippable, sign support
    ├─ PSItems.bootstrap()       → FuelRegistry (7 fuels), TerraformBoat items
    ├─ PSTags.bootstrap()        → 56 tag files consumed by recipes/loot/machines
    ├─ PSItemGroups.bootstrap()  → creative tabs (ItemGroups.displayContext via AW)
    ├─ PSFluids.bootstrap()      → 28 fluid definitions (variants/alcohol/tick rates)
    ├─ PSRecipes.bootstrap()     → 7 serializers + chest-loot injection hook
    ├─ PSEntities.bootstrap()    → molotov projectile, reality rift, villager trades
    ├─ PSWorldGen.bootstrap()    → tilled/untilled patches, juniper tree, jigsaw pools
    ├─ PSGameRules.bootstrap()   → custom game rules (GameRules.register via AW)
    ├─ PSCommands.bootstrap()    → /drug commands
    ├─ PSSounds/PSScreenHandlers/Channel/PSCriteria/PSParticles/PSDamageTypes
    └─ DrugProperties event wiring (copy-on-death, join sync, dimension change)
  client: PsychedelicraftClient (renderers, shaders, screens, particles)
  emi/modmenu: compat entrypoints
```

## Block → state → model → texture → loot → interaction (worked examples)

```
psychedelicraft:cannabis (CannabisPlantBlock, AGE 0-15 + GROWING + NATURAL)
  → blockstates/cannabis.json (age→model)
  → models/block/cannabis_stage{0-3}.json
  → textures/block/cannabis_stage{0-3}.png
  → loot_tables/blocks/cannabis.json (age-based leaf/seed/bud drops + fortune)
  → item cannabis_seeds (AliasedBlockItem) → placement on farmland
  → harvest → drying_table recipes → dried_cannabis_buds → bong/joint influences
  → DrugInfluence(CANNABIS, …) → CannabisDrug modifiers
```

```
psychedelicraft:oak_barrel (BarrelBlockEntity, capacity 16000)
  → AlcoholicFluid process MATURE (ticksPerMaturation from PSConfig)
  → DrinkTypes variant resolution (StatePredicate)
  → tap interaction (timeLeftTapOpen, brewing-stand sound every 5 ticks)
  → FluidContainer fill/withdraw (FluidVolumes) → drinking → ALCOHOL influence
```

## Machine graph (§17)

```
ingredients ──► MASH_TUB (FERMENT, VAT 32000) ──mashing recipes──► base fluid
      │                │ (2 fermentation steps)
      │                ▼
      │         BARREL (MATURE, BARREL 16000) ──maturation 0-16──► aged fluid
      │                │
water + leaves        ▼
      └──► DISTILLERY (DISTILL, heat-scaled) ──► spirits + SLURRY byproduct
                    │ (requires fermented & unmatured fluid,
                    │  outputs into adjacent flask via facing)
                    ▼
              FLASK / containers (BOTTLE 2000, MUG 500, CUP 250, CHALLICE 200,
              SHOT 40, GLASS_BOTTLE 125, BOWL 50, SYRINGE 10)

DRYING_TABLE (10 slots) ──drying recipes (9)──► dried outputs (x3)
```

## Dangling / orphan analysis

- **Referenced but absent:** none — every texture/model/lang key referenced by
  registrations resolves within the repository (verified by tools/validate.mjs).
- **Present but unreferenced:** `graphics/` + `bbmodel/` authoring sources,
  `assets/generate_assets.sh` (texture upscaling tooling), shader sources — kept
  as evidence, not consumed by the port.
- **Terraform boat items** (`juniper_boat`, `juniper_chest_boat`): recipes reference
  items that require a custom vehicle entity; recipes preserved as data, marked
  blocked in the ledger.
