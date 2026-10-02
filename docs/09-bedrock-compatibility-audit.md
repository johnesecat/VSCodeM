# Bedrock compatibility repair audit — 2026-10-02

## Status and target

Candidate pack version **1.0.1**, minimum engine **1.21.50** (matching the declared `@minecraft/server` 1.15.0 dependency). This is NOT a certified in-game release or a claim of 100% Java parity. No Minecraft client or Bedrock Dedicated Server was available for this pass. Node mocks verify logic, not engine loading/rendering.

The earlier validation and VERIFIED ledger labels were too strong: successful JSON parsing, identifier checks and syntax checks did not detect malformed geometry, unsupported API calls or incomplete gameplay wiring. Interpret those historical claims as static/source accounting only; this audit supersedes their runtime implications.

## Fixed defects

- Generated geometry used `geometry.format_version` instead of `format_version` and put cubes outside bones. Generators now emit bones with cubes.
- Per-face UVs contained four coordinates; implicit Java face UVs became invisible zero-area rectangles. Conversion now emits two-coordinate UV origins, two-coordinate sizes, implicit UVs and per-face texture material bindings.
- Vanilla wood atlas references used Java filename order (`oak_planks`) instead of Bedrock filenames (`planks_oak`). Corrected the six vanilla plank paths; PNGs from vanilla are explicitly distinguished from pack-owned files.
- Placeable custom items lacked `minecraft:block_placer`. All declared placeable items now bind their blocks.
- Custom item callback events expose `source`, whereas handlers expected `player`. Dispatch now normalizes those fields. Unsupported `onHitBlock` item registration was removed; molotov collision remains entity-projectile behavior.
- Seed handlers tried adding an age state to air before placing the crop. They now resolve the crop permutation directly.
- Bong inventory lookup returned a container, not the matched slot, and consumed entire ingredient stacks. It now consumes one item in the matching slot.
- Consumable influences were attached to both completion and consumption paths. They now apply once on consumption.
- Fluid state used a nonexistent ItemStack `durability` field and lost volume. Fluid storage now uses `ps:fluid` ItemStack dynamic properties with full process stages 0–16 and actual volume. Empty containers no longer invent fluid index zero.
- Container handler results (`setItemAux`, `playSound`) were ignored. Fluid changes and item sounds are now dispatched.
- Machine storage used unsupported Block dynamic properties. Position-keyed World dynamic properties now provide persistence, plus consume-once removal.
- Drop paths supplied plain objects to `Dimension.spawnItem`; they now construct ItemStacks.
- Machine forms recreated bottles using `/give` aux and failed to decrement inserted containers. Forms now transfer actual fluid volumes in the held ItemStack, reload state after awaiting user input, and use tank capacities.
- Drying forms had no insert/extract controls. They now support input insertion, output retrieval and input return with inventory-full remainder handling.
- Drug math ran once per second rather than once per tick. Properties now update each tick, with slower visual/effect/persistence updates retained.
- Modifier parsing silently ignored LSD's conditional expression and spaces. The parser now handles the source conditional and requires complete, finite results.
- Camera fade/free-camera/clear commands used malformed syntax. Corrected command assembly.
- Rift render controller bound eight textures simultaneously rather than selecting a frame. It now indexes the original eight-frame sequence.
- Fluid flipbooks referenced nonexistent paths, ignored source timing and treated frame counts as frame arrays. Paths/timing/frame lists now derive from source metadata.
- Sound definitions lacked the Bedrock `sound_definitions` envelope. Conversion now emits it.
- Movement attributes used Java-style methods unavailable in Bedrock Script API. Speed/slowness and haste/mining-fatigue provide explicitly approximate gameplay equivalents.
- Fluid-aware crafting: Implemented `behavior_pack/scripts/lib/crafting.js` providing source recipe planning (`fill_receptical`, `change_receptical`, `shapeless_fluid`, `shaped_fluid`), tag ingredient matching (`c:glass_blocks`, `minecraft:wool`, etc.), pour transfers, heating (furnace/campfire), world fluid filling (water/lava), and rollback-safe inventory commits.
- Rift Jar block entity mechanics: Implemented `behavior_pack/scripts/lib/rift.js` transcribed directly from `RiftJarBlockEntity.java`. Includes Java-exact absorption math (`[-2..3, 0..10, -2..3]`, fractional open timing 0.02/tick, drains rifts unless critical size > 3 or instability > 0), discharge to survival players in `[-5..6, -5..6, -2..6]` adding `zero` and `power` drugs, overload explosion/rift release when fraction > 1, and persistent charged jar item drop (`ps:riftFraction`).
- Juniper wood set complete behaviors: Implemented `behavior_pack/scripts/lib/wood.js` handling axe log/wood stripping (preserving axis), double-slab merging, door lower/upper pair placement & destruction synchronization, fence connection topology, stair corner shape detection (`outer_left`, `outer_right`, `inner_left`, `inner_right`), redstone signals (`minecraft:redstone_producer` for buttons and pressure plates, input detection for doors/gates), and sign modal editing (`ModalFormData`), waxing, and glowing.
- Boat items: Added `juniper_boat` and `juniper_chest_boat` items, recipes, and steerable vanilla boat spawning equivalents.
- Visual frame sequences & heat distortion: Implemented `tools/gen-effects.mjs` parsing original PNGs (with Adam7 interlacing support), compiling frame sequences (`zero_screen_0..7`, `lightning_0..3`) into vertical particle flipbooks (`rift_frames`, `power_frames`), and sampling `heat_distortion_noise.png` velocities into camera rotation sway in `behavior_pack/scripts/data/heat_noise.js`.

## Effects and video evidence

No `.mp4`, `.webm`, `.gif`, `.avi`, `.mov` or similar source videos were found in the audited resource tree. `assets/generate_assets.sh` uses ffmpeg to resize PNG textures, not play movies.

`tools/gen-effects.mjs` converts the original eight rift screen PNGs and four power-lightning PNGs into vertical RGBA frame strips plus Bedrock particle flipbook definitions. Rift frame particles are used by scripted rifts; power frames activate for the power drug. Original lens-flare images are different flare shapes, not a movie; they are preserved but not misrepresented as a chronological video sequence.

The original `heat_distortion_noise.png` is decoded (including Adam7 interlace). Its two sample velocities from `heat_distortion.fsh` drive a generated noise table and a subtle camera-motion proxy near heat sources / in the Nether; underwater motion is disabled. This heat detection is an approximation, not Java's biome-temperature/sunlight model.

**Not reproduced:** Java's heat shader reads `DiffuseSampler` and `DepthSampler`, then displaces individual scene pixels according to depth. Standard Bedrock add-ons do not expose that framebuffer/depth access or arbitrary GLSL/OpenGL shader loading. Camera motion and prerecorded frames cannot reproduce that operation exactly. We did not add an inert shader file or require patched clients while claiming portable compatibility.

## Research and corrections

- [Microsoft custom components](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/custom-components?view=minecraft-bedrock-stable): block/item registries are valid. Earlier claims that these registry property names were wrong were retracted.
- [Microsoft item icon](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_icon?view=minecraft-bedrock-stable): `textures.default` is a newer schema, NOT the dead legacy format previously described. This candidate uses the simpler string representation with its older JSON format.
- [Bedrock item events](https://wiki.bedrock.dev/items/item-events): callback `source`, consumption and use requirements; modern examples use v2, whereas this candidate retains v1 custom-component arrays and the v1 worldInitialize fallback.
- [Block visuals](https://wiki.bedrock.dev/blocks/block-visuals-intro): material-instance bindings and vanilla atlas merging.
- [Animated block textures](https://learn.microsoft.com/en-us/minecraft/creator/documents/createanimatedblocktexture?view=minecraft-bedrock-stable): original vertical fluid strips map to Bedrock flipbooks.

## Executed checks

- Full generation including `node tools/gen-content.mjs`, `node tools/gen-models.mjs`, and `node tools/gen-effects.mjs`.
- `node tools/validate.mjs`: strengthened geometry schema/UV, real texture-file and flipbook-path checks across 480 files (PASS: 0 errors, 0 warnings).
- `node --experimental-vm-modules --test tools/test-runtime.mjs`: 35 comprehensive regression tests covering fluid storage, 0–16 stage retention, drinking volume, bong single-stack consumption, seed placement, tank overflow, machine persistence/consume-once, source formulas, geometry bones/2D UVs, placeable items, crafting recipe planner, container changes, pour conservation, obsidian recipes, heating, mashing tag resolution, rift absorption/discharge/critical overload, wood stripping/slabs/doors/stairs/fences/redstone, and sign text/waxing.
- The tests run in automated Node mocks. They verify script logic, data consistency, and component bindings, but do not replace live client/server testing on target hardware.

## Still open / required before calling this functional parity

- In-game content-log validation on the user's exact Bedrock version and platform (runtime environment without client UI cannot run Bedrock Dedicated Server/client).
- Native custom boat entity with custom models (currently maps to steerable vanilla boat equivalents for gameplay utility).
- Exact screen refraction, double vision, motion blur, and arbitrary scene depth-buffer displacement remain technically impossible under standard Bedrock RenderDragon engine constraints (no GLSL/OpenGL custom post-processing shaders). Approximated via particle flipbooks, camera rotation sway, and camera fade pulses.

No previous GitHub Release asset was overwritten or published by this pass. The rebuilt local `Psychedelicraft-Bedrock.mcaddon` is a repair candidate, not the old v1.0.0 asset.
