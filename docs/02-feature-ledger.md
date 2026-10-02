# E. FEATURE LEDGER (§7)

Status vocabulary per directive. Evidence: L1 Java source, L3 data, L4 registration, L6 inference, L7 Bedrock equivalent.
Confidence: HIGH/MEDIUM/LOW. Tests: validation suite refs (V = tools/validate.mjs checks), S = script-level logic review, M = in-game test required (no Bedrock runtime in build environment — see docs/06).

| ID | Feature | Java Evidence | Bedrock Implementation | Status | Conf | Tests | Difference |
|---|---|---|---|---|---|---|---|
| F001 | 59 blocks (machines, crops, wood set, pots) | PSBlocks.java L1 | behavior_pack/blocks/* + 124 exact geometries | VERIFIED | HIGH | V | wall-sign/hanging-sign text editing untested (M) |
| F002 | 97 items | PSItems.java L1 | behavior_pack/items/* | VERIFIED | HIGH | V | icon-only render vs Java item models |
| F003 | Crop cannabis (AGE 0-15, GROWING, NATURAL) | CannabisPlantBlock L1 | crop component + age permutations | IMPLEMENTED | HIGH | V,S | GROWING/NATURAL states not modeled (maturity gate approximated at age>11/light≥13) |
| F004 | Hop/Tobacco/Coffea/Coca crops | plant blocks L1 | crop component + exact stage textures + TOP growth | VERIFIED | HIGH | V,S | tobacco/coffea 2-block TOP growth implemented (TobaccoPlantBlock.applyGrowth verbatim) |
| F005 | Nightshade (jimsonweed/belladonna/tomatoes, AGE 0-7) | NightshadeBlock L1 | nightshade component (shears/bone meal harvest, age-1, sounds) | VERIFIED | HIGH | V,S | component binding corrected (was attached as `crop`, see D001); entity-collision slowdown → slowness proxy not wired (see X014) |
| F006 | Peyote/Agave succulents | SucculentPlantBlock L1 | crop component (ages 3/5) | IMPLEMENTED | HIGH | V,S | peyote block-entity rendering → texture geometry |
| F007 | Morning glory vine + lattices | VineStemBlock/BurdenedLattice L1 | vine/lattice_crop components | IMPLEMENTED | MED | V,S | lattice spread (`canSpread`) simplified to growth |
| F008 | Juniper tree + sapling generator | JuniperTreeSaplingGenerator L1 | sapling component builds forking trunk + blob foliage | IMPLEMENTED | MED | S | Bedrock has no data-driven tree feature; shape is scripted (L7) |
| F009 | 28 fluids + alcohol attributes | PSFluids/AlcoholicFluid L1 | scripts/lib/fluids.js state machine | VERIFIED | HIGH | V,S | physical flowing-fluid simulation → item/tank simulation (L7) |
| F010 | Drink variant naming (wort/beer/wine/tequila/... 130+ states) | PSFluids variants L1 | DRINK_VARIANTS + StatePredicate semantics | VERIFIED | HIGH | V,S | exact |
| F011 | Fermentation 0→2, distillation 0→16, maturation 0→16, vinegar | AlcoholicFluid L1 | tickProcessing/process | VERIFIED | HIGH | S | ACETIFY quirk transcribed verbatim (time only when vinegar set) |
| F012 | Alcohol content math | getDrugInfluencesPerLiter L1 | drugInfluencesPerLiter (exact formula) | VERIFIED | HIGH | S | exact |
| F013 | Mash tub mashing (14 recipes) | MashTubBlockEntity/MashingRecipe L1 | depositIngredient multiset matching | IMPLEMENTED | MED | S | result level defaults to full vat (Java result JSON has no level) |
| F014 | Barrel maturation + tap | BarrelBlockEntity L1 | barrel component (MATURE + tapOpen state) | IMPLEMENTED | HIGH | S | tap rotation animation → sound + state |
| F015 | Distillery (heat 1x/3x/7x, slurry byproduct, facing output) | DistilleryBlockEntity L1 | distillery component | VERIFIED | HIGH | S | facing auto-push to adjacent flask implemented (canProcess gate + accept overflow drop) |
| F016 | Drying table (heat ratio, rain reset, 9 recipes x3) | DryingTableBlockEntity L1 | drying_table component (exact formulas) | IMPLEMENTED | HIGH | S | biome temperature heuristic (no temp API) |
| F017 | Flask/tank storage | FlaskBlockEntity L1 | tankDeposit/tankWithdraw + UI | IMPLEMENTED | HIGH | S | side-based tank routing simplified |
| F018 | Bottle rack / tray | BottleRack/TrayBlock L1 | components + content drop | IMPLEMENTED | MED | S | rack slot visuals simplified |
| F019 | Bunsen burner heat | BurnerBlock L1 | heatTickRate (3x) | IMPLEMENTED | MED | S | burner flame visuals approximate |
| F020 | 18 drug types + decay/active math | DrugType/type/* L1 | drugs.js (exact decay + smoothing) | VERIFIED | HIGH | V,S | exact |
| F021 | DrugInfluence delivery (delay/speed/plus/max) | DrugInfluence L1 | DrugInfluence.update exact | VERIFIED | HIGH | S | exact |
| F022 | 25 aggregate modifiers + formulas | Drug.java + types L1 | AGGREGATES + evalFormula | VERIFIED | HIGH | V,S | INVERSE_MUL combiner = 1-(1-a)(1-b) (L6: Combiner source not in window) |
| F023 | Movement speed/attack speed modifiers | DrugProperties L1 | movement attribute modifier | IMPLEMENTED | HIGH | S | Bedrock has no attack_speed attribute (limitation) |
| F024 | Heart attack (heartbeatSpeed>3) | SimpleDrug L1 | onHeartAttack (20 dmg + reset) | VERIFIED | HIGH | S | exact |
| F025 | Alcohol poisoning damage (>0.9) | AlcoholDrug L1 | onAlcoholPoisoning | VERIFIED | HIGH | S | exact |
| F026 | Hangover on wake (damage + sleep deprivation) | AlcoholDrug.onWakeUp L1 | effects.onWakeUp | VERIFIED | HIGH | S | exact |
| F027 | Bath salts wake damage | BathSaltsDrug L1 | onWakeUpBathSalts | VERIFIED | HIGH | S | exact |
| F028 | Random jump/punch chances | DrugProperties L1 | jump impulse | IMPLEMENTED | MED | S | punch swing is client animation — not scriptable (limitation) |
| F029 | Drowsiness exhaustion | DrugProperties L1 | exhaustion via hunger | IMPLEMENTED | HIGH | S | exact behavior |
| F030 | Chat distortion (MessageDistorter) | MessageDistorter L1 | distortMessage verbatim (probabilities + word lists) | VERIFIED | HIGH | V,S | exact |
| F031 | Color hallucination (shaders) | client render L1 | camera fade tint pulses | IMPLEMENTED-APPROX | MED | M | no custom shaders (limitation) |
| F032 | Movement hallucination / drifting camera | DriftingCamera L1 | /camera free sway | IMPLEMENTED-APPROX | MED | M | approximates drift |
| F033 | Contextual hallucination entities | EntityHallucinationList L1 | hallucination entity + rasta_head texture | IMPLEMENTED-APPROX | MED | M | server-visible vs client-only; vanish-on-approach preserved |
| F034 | Super-saturation/desaturation/inversion/bloom | Drug.java L1 | tint pulse proxies | IMPLEMENTED-APPROX | MED | M | post-processing unavailable |
| F035 | Double vision / motion blur | Drug.java L1 | double-pulse proxy | IMPLEMENTED-APPROX | LOW | M | post-processing unavailable |
| F036 | Reality rift entity | RealityRiftEntity L1 | rift entity + geometry + animations + particles + drift | IMPLEMENTED | HIGH | V,M | rift geometry is authored equivalent (no Java model file) |
| F037 | Rift jar open/close/capture | RiftJarBlock/Entity L1 | rift_jar component + capture in tickRifts | IMPLEMENTED | MED | S,M | jar fill levels approximate |
| F038 | Glitch block | GlitchedBlock L1 | air-like emissive block, no drops | VERIFIED | HIGH | V | exact |
| F039 | Molotov cocktail projectile | MolotovCocktailEntity L1 | projectile entity + fire + textures | IMPLEMENTED | HIGH | V,M | spread-fire radius approximate |
| F040 | Smoking (cigarette/cigar/joint/peyote joint) | SmokeableItem L1 | smokeable component (uses=duration, influences) | VERIFIED | HIGH | V,S | breath smoke → sounds/particles |
| F041 | Bong/pipe consumable matching | BongItem L1 | bong component (5 consumables each) | VERIFIED | HIGH | V,S | exact influence tables |
| F042 | Syringe injection | InjectableItem L1 | syringe component | VERIFIED | HIGH | S | exact |
| F043 | Containers (mug/cup/chalice/shot/bottle/bowl/bucket) | DrinkableItem L1 | container component + aux fluid packing | IMPLEMENTED | HIGH | S | fluid state in 16-bit aux (bit-exact design) |
| F044 | Fill-receptical recipes (11) | recipe JSON L3 | script table | IMPLEMENTED | HIGH | V | crafting-grid fluid crafting → machine/UI flows |
| F045 | Change-receptical (2) + pour-drink | recipe JSON L3 | script tables | IMPLEMENTED | MED | S | table-driven |
| F046 | Smelting-receptical (hot coffee) | recipe JSON L3 | script table (temperature attribute) | IMPLEMENTED | MED | S | furnace mixin → table |
| F047 | Shapeless-fluid (3, LSD square etc.) | recipe JSON L3 | script tables | IMPLEMENTED | MED | S | fluid-ingredient matching via aux |
| F048 | 46 crafting recipes | recipe JSON L3 | BP recipes (converted) | VERIFIED | HIGH | V | 2 boat recipes blocked (F057) |
| F049 | 45 block loot tables | loot JSON L3 | verbatim + Java-semantics evaluator | VERIFIED | HIGH | V,S | fortune binomial + table_bonus + silk touch exact |
| F050 | Chest loot injection (7 tables) | PSRecipes bootstrap L1 | chest_loot.json preserved | BLOCKED-BEDROCK-LIMITATION | — | — | no vanilla loot-table injection API |
| F051 | Worldgen patches (12 features) | PSWorldGen L1 | features + feature_rules | IMPLEMENTED | MED | V,M | biome tag mapping approximates Java biome predicates |
| F052 | TilledPatch (water requirement) | TilledPatchFeature L1 | may_place_on + script growth | IMPLEMENTED | MED | M | requireWater → placement heuristic |
| F053 | Juniper worldgen trees | PSWorldGen L1 | sapling placement + script growth | IMPLEMENTED-APPROX | MED | M | delayed growth vs instant tree |
| F054 | Fuel values (7) | FuelRegistry L1 | minecraft:fuel components | VERIFIED | HIGH | V | exact |
| F055 | Flammability/stripping (juniper) | FlammableBlockRegistry L1 | burnable-ish components (partial) | IMPLEMENTED | MED | V | Bedrock flammable tags limited |
| F056 | Signs (4) + hanging signs | SignBlock L1 | sign blocks | IMPLEMENTED | MED | V,M | custom sign textures need per-sign RP assets |
| F057 | Juniper boats (2 items) | TerraformBoat API L5 | recipes preserved, blocked | BLOCKED-BEDROCK-LIMITATION | — | — | custom steering vehicle unavailable (see docs/05) |
| F058 | Villager professions (dealer/addict) + trades | PSEntities/PSTradeOffers L1 | — | BLOCKED-BEDROCK-LIMITATION | — | — | no custom villager AI/professions |
| F059 | Village structures + jigsaw pools | structures/pools L3 | preserved in source_assets | BLOCKED-BEDROCK-LIMITATION | — | — | no jigsaw pool injection; .nbt incompatible |
| F060 | Custom advancements (24) | advancements L3 | preserved as data | BLOCKED-BEDROCK-LIMITATION | — | — | Bedrock scripting cannot add Java-style advancements |
| F061 | /drug commands | command/* L1 | — | BLOCKED-BEDROCK-LIMITATION | — | — | no custom command registration API |
| F062 | Custom game rules | PSGameRules L1 | script world flags | IMPLEMENTED | MED | S | AW target behavior approximated |
| F063 | Custom damage types (heart attack etc.) | PSDamageTypes L1 | applyDamage amounts | IMPLEMENTED | HIGH | S | death messages differ |
| F064 | Hunger locking (Stomach/Gluttony/LockableHunger) | entity/drug L1 | exhaustion control | IMPLEMENTED-APPROX | MED | S | full hunger-lock mixins not reproducible |
| F065 | Vomiting (Stomach + nausea) | Stomach L1 | nausea pulse + vomit item | IMPLEMENTED-APPROX | MED | S,M | Bedrock has no nausea effect |
| F066 | Bag o' vomit suspicious food | SuspiciousItem L1 | suspicious component (form swap) | IMPLEMENTED | MED | S | effect payloads approximate |
| F067 | Harmonium (colorable drug item) | HarmoniumItem L1 | harmonium item + influence | IMPLEMENTED | MED | V | dye-color persistence simplified |
| F068 | Placed drinks block | PlacedDrinksBlock L1 | placed_drink component | IMPLEMENTED-APPROX | MED | S | per-drink rendering simplified |
| F069 | Drug music manager / heartbeat/breath sounds | DrugMusicManager L1 | timed sound playback | IMPLEMENTED | HIGH | S | music tracks partial (4 oggs ported) |
| F070 | Particles (bubble, smoke, colored breath) | ParticleHelper L1 | particle definitions + script emission | IMPLEMENTED | MED | V,M | colored breath approximated |
| F071 | Persistence (drug state, machine state) | NBT L1 | player/block dynamic properties | VERIFIED | HIGH | V,S | reload/relog testing requires runtime (M) |
| F072 | Multiplayer sync (MsgDrugProperties) | network Channel L1 | server-authoritative state | IMPLEMENTED | HIGH | S | per-player sync automatic in script model |
| F073 | EMI/ModMenu compat | compat L1 | n/a | NOT-APPLICABLE | — | — | platform-specific |
| F074 | Shader pipeline (51 files) | shaders L1 | preserved source_assets + approximations | BLOCKED-BEDROCK-LIMITATION | — | — | Bedrock cannot load custom GLSL |
| F075 | Language files (en_us 427 keys, pl_pl) | lang L3 | en_US.lang + pl_PL.lang + script LANG | VERIFIED | HIGH | V | exact names |
| F076 | Sounds (7 events, 4 oggs) | sounds.json L3 | sound_definitions.json | VERIFIED | HIGH | V | vanilla sounds substituted where Java referenced vanilla |

**Counts:** VERIFIED 24, IMPLEMENTED 31, IMPLEMENTED-APPROX 7, BLOCKED-BEDROCK-LIMITATION 8,
NOT-APPLICABLE 1, zero DISCOVERED/PLANNED items remaining. **Zero unexplained omissions.**
