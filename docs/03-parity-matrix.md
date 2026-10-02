# F. JAVA vs BEDROCK PARITY MATRIX (§39-40)

Every ledger row (docs/02) maps 1:1 here; columns: Java Feature | Java Evidence | Bedrock Implementation | Exact? | Equivalent? | Limitation | Tested?

## Summary by domain

| Java Feature | Java Evidence | Bedrock Implementation | Exact | Equivalent | Limitation | Tested |
|---|---|---|---|---|---|---|
| Blocks (59) + states | PSBlocks.java | blocks/*.json + 124 exact geometries | ✔ (models/textures/ages) | | orientation variants collapsed | V |
| Items (97) | PSItems.java | items/*.json + custom components | ✔ (ids/names/consumption) | icon rendering | Java 3D item models | V |
| Crops (10 families) | plant blocks | crop/nightshade/vine/lattice components | ✔ (ages, harvest, drops) | 2-block tobacco/coffea | | V,S |
| Fluids (28) + attributes | PSFluids/AlcoholicFluid | fluids.js state machine | ✔ (state math, naming) | tank-based simulation | no flowing liquid blocks | V,S |
| Drink variants (130+) | PSFluids variants | DRINK_VARIANTS + StatePredicate | ✔ | | | V,S |
| Machines (barrel/distillery/mash tub/drying/flask) | block entities | machines.js (exact formulas) | ✔ (processing math) | UI = forms | side-routing, tap anim | S |
| Drugs (18) + influences | DrugType/type/* | drugs.js | ✔ (decay, smoothing, delivery) | | | V,S |
| Modifier aggregates (25) | Drug.java | AGGREGATES + formula evaluator | ✔ | INVERSE_MUL combiner (L6) | | V,S |
| Heart attack / poisoning / hangover | SimpleDrug/AlcoholDrug | effects.js | ✔ | | | S |
| Chat distortion | MessageDistorter | distortMessage verbatim | ✔ | | | V,S |
| Color/movement/contextual hallucinations | hallucination pkg + shaders | camera fades + drift + hallucination entities | | ✔ observable | custom shaders | M |
| Reality rift + jar + glitch | RealityRift/RiftJar | entity + animations + particles + capture | | ✔ observable | rift shape authored (no Java model) | V,M |
| Molotov projectile | MolotovCocktailEntity | projectile entity + fire | ✔ mechanics | | fire radius | V,M |
| Smoking/bong/syringe/consumables | item classes | item components | ✔ (influences, uses) | | 3D item render | V,S |
| Containers + fluid packing | FluidVolumes | aux-packed fluid state | ✔ (volumes, math) | | | S |
| Recipes (90) | recipe JSON + types | 46 BP recipes + 44 script tables | ✔ (48 of 50 mechanical) | fluid crafting flows | 2 boat recipes | V |
| Loot (45 tables) | loot JSON | verbatim evaluator (fortune/silk/alternatives) | ✔ | | non-player/non-explosion breaks | V,S |
| Worldgen (12 patches) | PSWorldGen | features + feature_rules | | ✔ | biome tag mapping | V,M |
| Trees | JuniperTreeSaplingGenerator | scripted growth | | ✔ shape | no tree feature API | S,M |
| Persistence | NBT | dynamic properties | ✔ | | | V,S |
| Multiplayer | network Channel | server-authoritative script state | | ✔ | | S |
| Villagers (dealer/addict), jigsaw villages | entity/worldgen | preserved data only | ✖ | | no villager AI/jigsaw API | — |
| Advancements (24) | data | preserved data only | ✖ | | no advancement API | — |
| Commands (/drug) | command pkg | ✖ | ✖ | | no custom command API | — |
| Shaders (51) | shaders | approximations + preserved sources | ✖ | partial observables | no custom GLSL | M |
| Boats | TerraformBoat API | recipes preserved | ✖ | | custom steering vehicle | — |

## Exactness statement (§40)

- **100% ACCOUNTED FOR:** yes — all 76 ledger features classified (docs/02), zero unexplained omissions.
- **100% BEHAVIORALLY IDENTICAL:** **NO** — exact parity is blocked for shader post-processing,
  villager professions/jigsaw villages, custom commands/advancements, custom vehicle steering, and
  flowing-fluid simulation. All other systems are exact or explicitly equivalent per the ledger.
