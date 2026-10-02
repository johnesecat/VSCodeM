# H. BEDROCK LIMITATION REPORT (§43)

Each entry: Java behavior → exact Bedrock limitation → alternatives investigated → implemented equivalent → remaining difference.

1. **Custom shader pipeline (51 GLSL files: color hallucination, bloom, motion blur, double vision, desaturation, inversion, heat/water distortion)**
   - Limitation: Bedrock loads no user GLSL; render pipelines are closed to addons.
   - Alternatives: camera fade tints, fog, camera shake, status effects.
   - Equivalent: `/camera fade color` pulses scaled by the exact aggregate strengths (color/superSat/desat/inversion/bloom/doubleVision/motionBlur), camera-shake tremble.
   - Remaining: no pixel-level post-processing; visuals are tint-pulse approximations.

2. **Custom villager professions + AI tasks (dealer/addict), jigsaw village injection**
   - Limitation: no API for custom villager professions, tasks, or structure-pool injection.
   - Alternatives: wandering-trader offer editing (no stable API), custom NPC entity (large divergence).
   - Equivalent: none implemented; trade data preserved in `data/psychedelicraft/ported_data.json`.
   - Remaining: drug-dealer villagers and their village houses absent.

3. **Custom commands (/drug…), custom advancements (24)**
   - Limitation: no custom command/advancement registration API.
   - Equivalent: script event-driven equivalents possible; not implemented (low gameplay value vs divergence).
   - Remaining: command/advancement surfaces absent; advancement data preserved.

4. **TerraformBoat custom boats (juniper_boat/chest_boat)**
   - Limitation: custom steering-driven vehicle behavior is hardcoded for vanilla boats; script vehicles cannot replicate steering physics.
   - Equivalent: none; recipes preserved as data (`blocked: boat_entity`).
   - Remaining: no rideable juniper boat.

5. **Flowing custom fluids (physical simulation: flow levels, spread, PlacedFluidBlock)**
   - Limitation: no custom fluid registration; only water/lava physics exist.
   - Equivalent: controlled simulation — tank/container fluid state machines (fill/pour/process), fluid appearance via textures in the RP.
   - Remaining: spilled fluids don't flow in the world.

6. **Nausea effect, punch-swing animation, hunger-lock mixins**
   - Limitation: Bedrock lacks the nausea effect; hand animations aren't server-scriptable; HungerManager isn't mixin-able.
   - Equivalent: camera shake pulses for nausea, jump impulses for involuntary movement, exhaustion control for hunger behavior.
   - Remaining: cosmetic deltas.

7. **Attack-speed attribute**
   - Limitation: Bedrock has no attack_speed attribute.
   - Equivalent: movement modifier only (as Java multiplies both by the same value).
   - Remaining: attack cadence unaffected by drugs.

8. **Java structure .nbt templates**
   - Limitation: Bedrock uses `.mcstructure` (different schema); no converter without world mediation.
   - Equivalent: sources preserved in `behavior_pack/source_assets/structures/`.
   - Remaining: village houses absent (see 2).

9. **Loot on non-player/non-explosion destruction**
   - Limitation: no loot event for every destruction source (dragon charge, piston edge cases).
   - Equivalent: script loot covers player breaks + block explosions (`playerBreakBlock`, `blockExplode`), matching the Java tables exactly for those sources.
   - Remaining: rare destruction sources drop nothing.

10. **Bedrock block-state/permutation model (orientation variants)**
    - Limitation: Java blockstates encode facing/half/shape permutations; Bedrock needs traits + per-rotation geometry.
    - Equivalent: exact geometry for declared states (age/top); orientation collapses to base orientation for template shapes (stairs/doors/trapdoors).
    - Remaining: some wood-set shapes don't rotate with placement direction.
