# C. FORENSIC INVENTORY — Psychedelicraft (Java 1.20.1 Fabric)

**Evidence root:** `reference/psychedelicraft-java/` — upstream `github.com/Sollace/Psychedelicraft`,
branch `1.20.1`, commit `319a4ea0160d6600cffcd5f5cc9e363ceaab44a1` (verified identical to
`refs/heads/1.20.1` at fetch time).

## File census (1,346 files)

| Type | Count | Purpose | Consumed by |
|---|---|---|---|
| `.java` | 293 | Full mod implementation (Level 1 evidence) | audit + port |
| `.json` | 633 | recipes, loot, tags, advancements, worldgen, blockstates, models, lang, sounds, structures | converted/preserved |
| `.png` | 305 | block/item/entity/GUI/environment textures | copied to RP |
| `.bbmodel` | 35 | Blockbench source models | geometry reference |
| `.mcmeta` | 26 | animated texture metadata | flipbook_textures.json |
| `.fsh/.glsl/.vsh/.gvsh/.gfsh` | 26 | custom shader pipeline (core/program/post/include) | **not portable** (see limitations) |
| `.nbt` | 6 | Java structure templates (village jigsaw additions) | **not portable** (see limitations) |
| `.ogg` | 4 | heartbeat, breath, rift jar, drug sounds | copied to RP |
| `.aw` | 1 | `psychedelicraft.aw` access widener | audited |
| `.yml/.xml/.properties/.gradle/misc` | 16 | build + CI + code style | build metadata only |

## Source-side systems inventory (293 Java files by package)

| Package | Files | Systems |
|---|---|---|
| root (`ivorius.psychedelicraft`) | 8 | `Psychedelicraft` entrypoint, `PSSounds`, `PSTags`, `PSGameRules`, `PSDamageTypes`, `ParticleHelper` |
| `block/` | 33 | 59 registered blocks: 16 machines/functional, 10 crops, 3 lattices, 18 juniper wood set, 7 pots, vines, glitch |
| `block/entity/` | 13 | Barrel, Distillery, MashTub, DryingTable, Flask, BottleRack, Peyote, RiftJar + inventory/fluid plumbing |
| `item/` | 23 | 97 registered items: containers, smokeables, bongs, foods, seeds, syringe, molotov, harmonium, etc. |
| `fluid/` | 17 | 28 fluids (16 alcohol, 5 drug drinks, 3 injectables, 3 extracts, slurry) + physical fluid simulation |
| `entity/` | 8 | MolotovCocktailEntity, RealityRiftEntity, villager task lists, trade offers |
| `entity/drug/` | 6 | DrugProperties, DrugType registry (18 drugs), DrugInfluence, Stomach, MessageDistorter |
| `entity/drug/type/` | 17 | 17 drug behavior classes (modifier formulas transcribed) |
| `entity/drug/hallucination/` | 12 | HallucinationManager + entity/camera hallucination types (client shader-side) |
| `entity/drug/sound/` | 1 | DrugMusicManager |
| `recipe/` | 11 | 7 custom recipe types + fluid-aware crafting |
| `screen/` | 4 | FluidContraptionScreenHandler, DryingTableScreenHandler |
| `client/` | 45 | renderers, shaders, screens, particles, sounds (client-side) |
| `mixin/` | 25 | 11 server + 14 client mixins (audited individually) |
| `world/` | 5 | PSWorldGen, TilledPatchFeature, JuniperTreeSaplingGenerator, MutableStructurePool |
| `network/`, `command/`, `advancement/`, `config/`, `util/`, `compat/`, `particle/` | 23 | sync channel, /drug commands, criteria, JSON config (balancing values), EMI/modmenu compat |

## Data inventory (`src/main/resources/data/`)

| Namespace | Content | Count | Port action |
|---|---|---|---|
| `psychedelicraft/recipes` | 38 shaped, 2 fluid-shaped, 9 shapeless, 3 shapeless-fluid, 14 mashing, 11 fill-receptical, 9 drying, 2 change-receptical, 1 smelting-receptical, 1 pour-drink | 90 | 46 → BP recipes; 44 → script tables |
| `psychedelicraft/loot_tables/blocks` | block drops | 45 | preserved verbatim + script evaluator |
| `psychedelicraftmc/loot_tables/chests` | village/dungeon chest injection | 7 | preserved (injection blocked, see limitations) |
| `psychedelicraft/advancements` | custom criteria | 24 | preserved as data (Bedrock no custom advancement API) |
| `psychedelicraft/tags`, `minecraft/tags`, `c/tags` | block/item/damage tags | 56 | preserved as data |
| `psychedelicraft/placeable_drinks` | placed-drink models | 2 | preserved (placed_drink block) |
| `psychedelicraft/structures` | village jigsaw structures | 6 | not portable (limitations) |
| `psychedelicraftmc/worldgen/template_pool` | jigsaw pool injection | 3 | not portable (limitations) |

## Asset inventory (`src/main/resources/assets/`)

86 blockstates, 141 block models (+10 fluid models), 145 item models, 88 block + 52 fluid + 103 item
textures, 27 entity textures, 16 lens-flare textures, 5 GUI textures, 2 particles, 2 lang files
(en_us 427 keys, pl_pl), sounds.json (7 events), 51 shader files, 26 animated texture metadata.

## Mixin forensics (§10) — 25 mixins, all accounted

| Mixin | Target | Observable behavior | Bedrock route |
|---|---|---|---|
| MixinAbstractFurnaceBlockEntity | furnace | fluid-smelting (`smelting_receptical`, hot coffee) | script table + machine UI |
| MixinEntity / MixinLivingEntity | entity | jump invocation, drug properties attachment | script (impulse, effects) |
| MixinPlayerEntity | player | drug properties carrier | player dynamic properties |
| MixinHungerManager | hunger | hunger locking (Stomach/GluttonyManager) | script hunger pinning |
| MixinVillagerEntity / MixinVillagerTaskListProvider / MixinLoseJobOnSiteLossTask | villager | addict/dealer professions & tasks | **limitation** (no custom villager AI) |
| MixinStructurePool | jigsaw | village drug-dealer house injection | **limitation** (no jigsaw injection) |
| MixinVoxelShape | voxel shape | collision tweaks | block collision boxes |
| MixinBlockEntityType | BE types | sign support for juniper wood | Bedrock sign component |
| client.MixinCamera/ChatScreen/ChatMessages/Mouse/GameRenderer/WorldRenderer/HeldItemRenderer/InGameHud/ItemModels/LivingEntityRenderer/EntityRenderDispatcher/ShaderProgram/ShaderStage/GLImportProcessor/SoundSystem | client render/shader/UI | shader post-processing, distortion, tremble, hallucinations | **limitation** (no custom shaders) + camera-shake/fog approximations |

## Access widener forensics (§11)

| Target | Why | Dependent feature | Bedrock route |
|---|---|---|---|
| RenderLayer/RenderPhase internals | custom render layers | shader visuals | limitation |
| PointOfInterestTypes.register | custom villager POI | dealer/addict villagers | limitation |
| GameRules.register (+Boolean/IntRule.create) | custom game rules (PSGameRules) | drug rule toggles | script world flags |
| ItemGroups.displayContext | creative tab assembly | item groups | Bedrock menu_category |
| CropBlock.isMature (extendable) | cannabis maturity logic | crop growth | script growth states |
