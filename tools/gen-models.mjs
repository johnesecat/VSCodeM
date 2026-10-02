/**
 * Exact model conversion: Java block models (elements/from/to/uv/rotation with
 * parent chain) -> Bedrock geometry cubes (per-face UV).
 *
 * Vanilla Java parents are recreated from their known canonical definitions;
 * mod parents (complex_block, lattice models, drying_table, flask) resolve from
 * the repository. Blockstate variants are re-wired so each permutation carries
 * the exact geometry + texture of its Java model.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MODELS = path.join(ROOT, "reference/psychedelicraft-java/src/main/resources/assets/psychedelicraft/models");
const RP = path.join(ROOT, "resource_pack");
const BP = path.join(ROOT, "behavior_pack");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
};

// ---------------------------------------------------------------------------
// Vanilla Java model parents (canonical element definitions)
// ---------------------------------------------------------------------------
const q = (from, to, tex, extra = {}) => ({ from, to, texture: tex, ...extra });

const VANILLA_PARENTS = {
  "minecraft:block/cross": {
    textures: { cross: "" },
    elements: [
      q([0, 0, 8], [16, 16, 8], "#cross", { rotation: { angle: 45, axis: "y", origin: [8, 8, 8] } }),
      q([0, 0, 8], [16, 16, 8], "#cross", { rotation: { angle: -45, axis: "y", origin: [8, 8, 8] } }),
    ],
  },
  "minecraft:block/tinted_cross": null, // alias of cross (set below)
  "minecraft:block/crop": {
    textures: { crop: "" },
    elements: [
      q([0, 0, 1], [16, 16, 1], "#crop"),
      q([0, 0, 9], [16, 16, 9], "#crop"),
      q([1, 0, 0], [1, 16, 16], "#crop"),
      q([9, 0, 0], [9, 16, 16], "#crop"),
    ],
  },
  "minecraft:block/flower_pot_cross": {
    textures: { plant: "" },
    elements: [
      q([4, 0, 4], [12, 8, 12], "#plant", { rotation: { angle: 45, axis: "y", origin: [8, 8, 8] } }),
      q([4, 0, 4], [12, 8, 12], "#plant", { rotation: { angle: -45, axis: "y", origin: [8, 8, 8] } }),
    ],
  },
  "minecraft:block/thin_block": {
    textures: { texture: "" },
    elements: [
      q([0, 0, 8], [16, 16, 8], "#texture", { rotation: { angle: 45, axis: "y", origin: [8, 8, 8] } }),
      q([0, 0, 8], [16, 16, 8], "#texture", { rotation: { angle: -45, axis: "y", origin: [8, 8, 8] } }),
    ],
  },
  "minecraft:block/cube_all": {
    textures: { all: "" },
    elements: [q([0, 0, 0], [16, 16, 16], "#all")],
  },
  "block/cube_all": null,
  "minecraft:block/leaves": {
    textures: { all: "" },
    elements: [q([0, 0, 0], [16, 16, 16], "#all")],
  },
  "minecraft:block/cube_column": {
    textures: { end: "", side: "" },
    elements: [{ from: [0, 0, 0], to: [16, 16, 16], texture: "#side", faces: { up: { texture: "#end" }, down: { texture: "#end" } } }],
  },
  "minecraft:block/cube_column_horizontal": null,
  "minecraft:block/block": { textures: {}, elements: [] },
  "block/block": { textures: {}, elements: [] },
  // template models (vanilla shapes; textures come from the child model)
  "minecraft:block/slab": { textures: { bottom: "", top: "", side: "" }, elements: [q([0, 0, 0], [16, 8, 16], "#side")] },
  "minecraft:block/slab_top": { textures: { bottom: "", top: "", side: "" }, elements: [q([0, 8, 0], [16, 16, 16], "#side")] },
  "minecraft:block/stairs": { textures: { bottom: "", top: "", side: "" }, elements: [q([0, 0, 0], [16, 8, 16], "#side"), q([0, 8, 0], [16, 16, 8], "#side")] },
  "minecraft:block/inner_stairs": { textures: { bottom: "", top: "", side: "" }, elements: [q([0, 0, 0], [16, 8, 16], "#side"), q([0, 8, 0], [16, 16, 8], "#side"), q([0, 8, 8], [8, 16, 16], "#side")] },
  "minecraft:block/outer_stairs": { textures: { bottom: "", top: "", side: "" }, elements: [q([0, 0, 0], [16, 8, 16], "#side"), q([0, 8, 0], [8, 16, 8], "#side")] },
  "minecraft:block/pressure_plate_up": { textures: { texture: "" }, elements: [q([1, 0, 1], [15, 1, 15], "#texture")] },
  "minecraft:block/pressure_plate_down": { textures: { texture: "" }, elements: [q([1, 0, 1], [15, 0.5, 15], "#texture")] },
  "minecraft:block/button": { textures: { texture: "" }, elements: [q([6, 0, 6], [10, 2, 10], "#texture")] },
  "minecraft:block/button_pressed": { textures: { texture: "" }, elements: [q([6, 0, 6], [10, 1, 10], "#texture")] },
  "minecraft:block/button_inventory": { textures: { texture: "" }, elements: [q([5, 6, 7], [11, 10, 11], "#texture")] },
  "minecraft:block/fence_post": { textures: { texture: "" }, elements: [q([6, 0, 6], [10, 16, 10], "#texture")] },
  "minecraft:block/fence_side": { textures: { texture: "" }, elements: [q([7, 6, 0], [9, 9, 16], "#texture"), q([7, 12, 0], [9, 15, 16], "#texture")] },
  "minecraft:block/fence_inventory": { textures: { texture: "" }, elements: [q([6, 0, 6], [10, 16, 10], "#texture"), q([7, 6, 0], [9, 9, 16], "#texture"), q([7, 12, 0], [9, 15, 16], "#texture")] },
  "minecraft:block/template_trapdoor_bottom": { textures: { texture: "" }, elements: [q([0, 0, 0], [16, 3, 16], "#texture")] },
  "minecraft:block/template_trapdoor_top": { textures: { texture: "" }, elements: [q([0, 13, 0], [16, 16, 16], "#texture")] },
  "minecraft:block/template_trapdoor_open": { textures: { texture: "" }, elements: [q([0, 0, 13], [16, 16, 16], "#texture")] },
  "minecraft:block/template_fence_gate": { textures: { texture: "" }, elements: [q([0, 0, 6], [2, 16, 10], "#texture"), q([14, 0, 6], [16, 16, 10], "#texture"), q([2, 6, 7], [14, 9, 9], "#texture"), q([2, 12, 7], [14, 15, 9], "#texture")] },
  "minecraft:block/template_fence_gate_open": { textures: { texture: "" }, elements: [q([0,0,6],[2,16,10],"#texture"),q([14,0,6],[16,16,10],"#texture"),q([0,6,0],[2,9,6],"#texture"),q([14,6,0],[16,9,6],"#texture"),q([0,12,0],[2,15,6],"#texture"),q([14,12,0],[16,15,6],"#texture")] },
  "minecraft:block/template_fence_gate_wall": null,
  "minecraft:block/template_fence_gate_wall_open": null,
  "minecraft:block/door_bottom_left": { textures: { bottom: "" }, elements: [q([0, 0, 13], [16, 16, 16], "#bottom")] },
  "minecraft:block/door_bottom_right": null,
  "minecraft:block/door_bottom_left_open": null,
  "minecraft:block/door_bottom_right_open": null,
  "minecraft:block/door_top_left": { textures: { top: "" }, elements: [q([0, 0, 13], [16, 16, 16], "#top")] },
  "minecraft:block/door_top_right": null,
  "minecraft:block/door_top_left_open": null,
  "minecraft:block/door_top_right_open": null,
};
// aliases
VANILLA_PARENTS["minecraft:block/tinted_cross"] = VANILLA_PARENTS["minecraft:block/cross"];
VANILLA_PARENTS["block/cube_all"] = VANILLA_PARENTS["minecraft:block/cube_all"];
VANILLA_PARENTS["minecraft:block/cube_column_horizontal"] = VANILLA_PARENTS["minecraft:block/cube_column"];
for (const name of ["template_fence_gate_wall", "template_fence_gate_wall_open"]) {
  VANILLA_PARENTS[`minecraft:block/${name}`] = VANILLA_PARENTS[name.endsWith("open") ? "minecraft:block/template_fence_gate_open" : "minecraft:block/template_fence_gate"];
}
for (const name of ["door_bottom_right", "door_bottom_left_open", "door_bottom_right_open"]) {
  VANILLA_PARENTS[`minecraft:block/${name}`] = VANILLA_PARENTS["minecraft:block/door_bottom_left"];
}
for (const name of ["door_top_right", "door_top_left_open", "door_top_right_open"]) {
  VANILLA_PARENTS[`minecraft:block/${name}`] = VANILLA_PARENTS["minecraft:block/door_top_left"];
}

// ---------------------------------------------------------------------------
// Model resolution (parent chain, "#" texture indirection)
// ---------------------------------------------------------------------------
function loadModel(name) {
  const key = name.replace(/^psychedelicraft:/, "");
  const file = path.join(MODELS, `${key}.json`);
  return fs.existsSync(file) ? readJson(file) : null;
}

function resolveModel(name, depth = 0) {
  if (depth > 10) return { elements: [], textures: {} };
  const model = loadModel(name);
  const source = model ?? VANILLA_PARENTS[name] ?? VANILLA_PARENTS[name.replace(/^minecraft:/, "")];
  if (!source) return { elements: [], textures: {} };

  let elements = source.elements ?? [];
  let textures = { ...(source.textures ?? {}) };

  if (source.parent) {
    const parent = resolveModel(source.parent, depth + 1);
    if (!elements.length) elements = parent.elements;
    textures = { ...parent.textures, ...textures };
  }
  // resolve "#ref" textures to concrete names
  const resolved = {};
  for (const [k, v] of Object.entries(textures)) {
    let val = v;
    let guard = 0;
    while (typeof val === "string" && val.startsWith("#") && guard++ < 10) {
      val = textures[val.slice(1)];
    }
    resolved[k] = typeof val === "string" ? val : "";
  }
  return { elements, textures: resolved };
}

function textureName(ref, textures) {
  if (!ref) return null;
  let val = ref;
  let guard = 0;
  while (val && val.startsWith("#") && guard++ < 10) val = textures[val.slice(1)];
  return typeof val === "string" ? val.split("/").pop().replace(/^psychedelicraft:/, "").replace(/^minecraft:/, "") : null;
}

// ---------------------------------------------------------------------------
// Java element -> Bedrock cube
// ---------------------------------------------------------------------------
function toCube(el, textures) {
  const from = el.from ?? [0, 0, 0];
  const to = el.to ?? [16, 16, 16];
  const cube = {
    origin: [from[0] - 8, from[1], from[2] - 8],
    size: [to[0] - from[0], to[1] - from[1], to[2] - from[2]],
  };
  if (el.rotation) {
    cube.pivot = [el.rotation.origin[0] - 8, el.rotation.origin[1], el.rotation.origin[2] - 8];
    const angle = el.rotation.angle ?? 0;
    cube.rotation = [
      el.rotation.axis === "x" ? angle : 0,
      el.rotation.axis === "y" ? -angle : 0,
      el.rotation.axis === "z" ? angle : 0,
    ];
  }
  // per-face UV
  const faces = el.faces ?? {};
  const uv = {};
  for (const face of ["north", "south", "east", "west", "up", "down"]) {
    const f = faces[face] ?? (el.texture ? { texture: el.texture } : null);
    if (!f) continue; // Omitted Java faces must not render.
    const auto = {
      north: [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]],
      south: [from[0], 16 - to[1], to[0], 16 - from[1]],
      east: [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]],
      west: [from[2], 16 - to[1], to[2], 16 - from[1]],
      up: [from[0], from[2], to[0], to[2]],
      down: [from[0], 16 - to[2], to[0], 16 - from[2]],
    };
    const rect = f.uv ?? auto[face];
    const tex = textureName(f.texture, textures);
    uv[face] = {
      uv: rect.slice(0, 2),
      uv_size: [rect[2] - rect[0], rect[3] - rect[1]],
      ...(f.rotation ? { uv_rotation: f.rotation } : {}),
      ...(tex ? { material_instance: `tex_${tex}` } : {}),
    }; 
  }
  cube.uv = uv;
  return cube;
}

function geometryForModel(modelName, geometryName) {
  const { elements, textures } = resolveModel(modelName);
  const cubes = elements.map((el) => toCube(el, textures));
  return {
    format_version: "1.21.0",
    "minecraft:geometry": [
      {
        description: {
          identifier: `psychedelicraft:geometry.${geometryName}`,
          texture_width: 16,
          texture_height: 16,
          visible_bounds_width: 3,
          visible_bounds_height: 3,
          visible_bounds_offset: [0, 1, 0],
        },
        bones: [{ name: "root", pivot: [0, 0, 0], cubes }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Rewire block JSONs: exact geometry + textures per state
// ---------------------------------------------------------------------------
function firstTextureOf(modelName) {
  const { textures } = resolveModel(modelName);
  const values = Object.values(textures).filter((t) => t);
  // prefer the mod's own textures over vanilla accent textures (planks, glass...)
  const tex = values.find((t) => t.includes("psychedelicraft")) ?? values[0];
  return tex ? tex.split("/").pop().replace(/^psychedelicraft:/, "") : null;
}

// per-face texture mapping from the model's cubes (up/down/north/south/east/west)
function faceTextureMap(modelName) {
  const { elements, textures } = resolveModel(modelName);
  const faces = {};
  for (const el of elements) {
    for (const dir of ["up", "down", "north", "south", "east", "west"]) {
      const f = el.faces?.[dir];
      if (f?.texture && !faces[dir]) {
        const name = textureName(f.texture, textures);
        if (name) faces[dir] = name;
      }
    }
  }
  return faces;
}

// make sure a texture shortname resolves in terrain_texture.json (vanilla fallback)
function ensureTerrainEntry(name) {
  const terrainPath = path.join(RP, "textures/terrain_texture.json");
  const terrain = readJson(terrainPath);
  if (!name || terrain.texture_data[name]) return;
  const candidates = [`textures/blocks/${name}`, `textures/blocks/fluid/${name}`, `textures/items/${name}`];
  let resolved = candidates.find((c) => fs.existsSync(path.join(RP, `${c}.png`)));
  if (!resolved) {
    // vanilla accent textures (oak_planks, glass, ...) resolve to vanilla paths
    const vanilla = { oak_planks: "planks_oak", spruce_planks: "planks_spruce", birch_planks: "planks_birch", jungle_planks: "planks_jungle", acacia_planks: "planks_acacia", dark_oak_planks: "planks_big_oak" };
    resolved = `textures/blocks/${vanilla[name] ?? name}`;
  }
  terrain.texture_data[name] = { textures: resolved };
  writeJson(terrainPath, terrain);
}

function materialInstances(modelName, fallbackTex, renderMethod) {
  const { elements, textures } = resolveModel(modelName);
  const main = firstTextureOf(modelName) ?? fallbackTex ?? "lattice";
  ensureTerrainEntry(main);
  const material = { "*": { texture: main, render_method: renderMethod } };
  for (const el of elements) {
    const refs = [el.texture, ...Object.values(el.faces ?? {}).map((f) => f.texture)];
    for (const ref of refs) {
      const tex = textureName(ref, textures);
      if (!tex) continue;
      ensureTerrainEntry(tex);
      material[`tex_${tex}`] = { texture: tex, render_method: renderMethod };
    }
  }
  return material;
}

const generated = [];
for (const file of fs.readdirSync(path.join(BP, "blocks"))) {
  const id = file.replace(/\.json$/, "");
  const blockPath = path.join(BP, "blocks", file);
  const block = readJson(blockPath);
  const bsFile = path.join(MODELS, "..", "blockstates", `${id}.json`);
  if (!fs.existsSync(bsFile)) continue;
  const bs = readJson(bsFile);

  // Multipart fence: post plus independently visible rails, driven by
  // connection states refreshed by the wood component.
  if (id === "juniper_fence" && bs.multipart) {
    const bones = [];
    for (const [index, part] of bs.multipart.entries()) {
      const { elements, textures } = resolveModel(part.apply.model);
      const name = `part_${index}`;
      bones.push({ name, pivot: [0, 8, 0], rotation: [0, -(part.apply.y ?? 0), 0], cubes: elements.map((el) => toCube(el, textures)) });
    }
    writeJson(path.join(RP, "models/blocks/juniper_fence_connected.geo.json"), { format_version: "1.21.0", "minecraft:geometry": [{ description: { identifier: "psychedelicraft:geometry.juniper_fence_connected", texture_width: 16, texture_height: 16 }, bones }] });
    const visibility = Object.fromEntries(bs.multipart.map((part, index) => [`part_${index}`, part.when ? `q.block_state('psychedelicraft:${Object.keys(part.when)[0]}')` : true]));
    block["minecraft:block"].components["minecraft:geometry"] = { identifier: "psychedelicraft:geometry.juniper_fence_connected", bone_visibility: visibility };
    block["minecraft:block"].components["minecraft:material_instances"] = materialInstances(bs.multipart[0].apply.model, "juniper_planks", "opaque");
    block["minecraft:block"].components["minecraft:collision_box"] = { origin: [-2, 0, -2], size: [4, 16, 4] };
    writeJson(blockPath, block);
    continue;
  }

  // collect per-state models
  const states = bs.variants ?? {};
  const models = new Map(); // modelName -> geometryName
  const entries = [];
  for (const [key, val] of Object.entries(states)) {
    const model = (Array.isArray(val) ? val[0] : val).model;
    if (!model) continue;
    if (!models.has(model)) models.set(model, `${id}_${models.size}`);
    entries.push({ key, model, x: (Array.isArray(val) ? val[0] : val).x ?? 0, y: (Array.isArray(val) ? val[0] : val).y ?? 0 });
  }

  // emit geometry for each unique model
  for (const [model, geoName] of models) {
    writeJson(path.join(RP, "models/blocks", `${geoName}.geo.json`), geometryForModel(model, geoName));
    generated.push(`${geoName} <= ${model}`);
  }
  if (!models.size) continue;

  // base component geometry = first model
  const firstModel = [...models.keys()][0];
  const baseGeo = models.get(firstModel);
  block["minecraft:block"].components["minecraft:geometry"] = `psychedelicraft:geometry.${baseGeo}`;
  const renderMethod0 = block["minecraft:block"].components["minecraft:material_instances"]["*"].render_method ?? "alpha_test";
  block["minecraft:block"].components["minecraft:material_instances"] = materialInstances(firstModel, null, renderMethod0);

  // permutations: attach exact geometry+texture for states the block declares.
  // Java-only states (facing/open/axis/waterlogged/...) are not declared as
  // Bedrock block states here; those variants collapse to the base orientation
  // (documented in docs/05-bedrock-limitation-report.md).
  const declared = Object.keys(block["minecraft:block"].description.states ?? {});
  const renderMethod = block["minecraft:block"].components["minecraft:material_instances"]["*"].render_method ?? "alpha_test";
  const permutations = [];
  const seenConditions = new Set();
  for (const entry of entries) {
    const want = entry.key.split(",").filter((p) => p.includes("="));
    const condParts = [];
    for (const p of want) {
      const [prop, value] = p.split("=");
      const propPath = `psychedelicraft:${prop}`;
      // Java-only states (facing/open/...) are not declared as Bedrock states:
      // those parts collapse (variant falls back to the declared-state model)
      if (!declared.includes(propPath)) continue;
      condParts.push(`q.block_state('${propPath}') == ${/^(true|false|\d+)$/.test(value) ? value : `'${value}'`}`);
    }
    if (!condParts.length) continue;
    const condition = condParts.join(" && ");
    if (seenConditions.has(condition)) continue;
    seenConditions.add(condition);
    const geoName = models.get(entry.model);
    permutations.push({
      condition,
      components: {
        "minecraft:geometry": `psychedelicraft:geometry.${geoName}`,
        "minecraft:transformation": { rotation: [entry.x, -entry.y, 0] },
        "minecraft:material_instances": materialInstances(entry.model, null, renderMethod),
      },
    });
  }
  if (permutations.length) block["minecraft:block"].permutations = permutations;
  if (id.endsWith("_barrel")) {
    const base = geometryForModel(firstModel, baseGeo);
    // Small visual tap handle added separately; Java BE tap mesh/animation is
    // not in the static block model. This is a documented cosmetic equivalent.
    base["minecraft:geometry"][0].bones.push({ name: "tap", pivot: [0, 5, -8], cubes: [{ origin: [-1,4,-9], size: [2,4,1], uv: { north: { uv: [0,0], uv_size: [2,4] } } }] });
    writeJson(path.join(RP, "models/blocks", `${baseGeo}.geo.json`), base);
    const opened = structuredClone(base); opened["minecraft:geometry"][0].description.identifier = `psychedelicraft:geometry.${baseGeo}_tap`;
    opened["minecraft:geometry"][0].bones[1].rotation = [0,0,90];
    writeJson(path.join(RP, "models/blocks", `${baseGeo}_tap.geo.json`), opened);
    block["minecraft:block"].permutations = [{ condition: "q.block_state('psychedelicraft:tap_open') == true", components: { "minecraft:geometry": `psychedelicraft:geometry.${baseGeo}_tap` } }];
  }
  if (/sign$/.test(id)) {
    const sign = geometryForModel(firstModel, baseGeo);
    sign["minecraft:geometry"][0].bones = [{ name: "root", pivot: [0,8,0], cubes: [
      { origin: [-8,7,-1], size: [16,9,2], uv: { north: { uv: [0,0], uv_size: [16,9] }, south: { uv: [0,0], uv_size: [16,9] } } },
      ...(id === "juniper_sign" ? [{ origin: [-1,0,-1], size: [2,7,2], uv: [0,0] }] : []),
    ] }];
    writeJson(path.join(RP, "models/blocks", `${baseGeo}.geo.json`), sign);
    block["minecraft:block"].permutations = ["north", "east", "south", "west"].map((facing, i) => ({ condition: `q.block_state('psychedelicraft:facing') == '${facing}'`, components: { "minecraft:transformation": { rotation: [0, -i * 90, 0] } } }));
  }
  if (["juniper_button", "juniper_pressure_plate"].includes(id)) {
    for (const permutation of block["minecraft:block"].permutations ?? []) permutation.components["minecraft:redstone_producer"] = { power: permutation.condition.includes(":powered') == true") ? 15 : 0, strongly_powered_face: "down", transform_relative: true };
  }
  // Collision follows slab/door/trapdoor/gate states, rather than remaining a
  // full cube when a player opens one. Bounding-box unions are unavailable.
  for (const permutation of block["minecraft:block"].permutations ?? []) {
    const c = permutation.condition;
    if (id === "juniper_slab") permutation.components["minecraft:collision_box"] = c.includes("'double'") ? true : { origin: [-8, c.includes("'top'") ? 8 : 0, -8], size: [16, 8, 16] };
    if (id === "juniper_fence_gate") permutation.components["minecraft:collision_box"] = c.includes(":open') == true") ? false : { origin: [-8, 0, -2], size: [16, 16, 4] };
    if (id === "juniper_door") permutation.components["minecraft:collision_box"] = { origin: [-8, 0, 5], size: [16, 16, 3] };
    if (id === "juniper_trapdoor") permutation.components["minecraft:collision_box"] = c.includes(":open') == true") ? { origin: [-8, 0, 5], size: [16, 16, 3] } : { origin: [-8, c.includes("'top'") ? 13 : 0, -8], size: [16, 3, 16] };
  }

  writeJson(blockPath, block);
}

console.log(`models: ${generated.length} geometries emitted`);
