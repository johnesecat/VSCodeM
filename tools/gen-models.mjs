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
  "minecraft:block/outer_stairs": { textures: { bottom: "", top: "", side: "" }, elements: [q([0, 0, 0], [16, 8, 16], "#side"), q([0, 8, 0], [16, 16, 4], "#side")] },
  "minecraft:block/pressure_plate_up": { textures: { texture: "" }, elements: [q([1, 0, 1], [15, 1, 15], "#texture")] },
  "minecraft:block/pressure_plate_down": { textures: { texture: "" }, elements: [q([1, 0, 1], [15, 2, 15], "#texture")] },
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
  "minecraft:block/template_fence_gate_open": null,
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
for (const name of ["template_fence_gate_open", "template_fence_gate_wall", "template_fence_gate_wall_open"]) {
  VANILLA_PARENTS[`minecraft:block/${name}`] = VANILLA_PARENTS["minecraft:block/template_fence_gate"];
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
    const f = faces[face];
    if (f && f.uv) {
      uv[face] = { uv: f.uv, uv_size: [f.uv[2] - f.uv[0], f.uv[3] - f.uv[1]] };
    } else {
      uv[face] = { uv: [0, 0, 0, 0], uv_size: [0, 0] }; // hidden face (Java omits)
    }
  }
  cube.uv = uv;
  return cube;
}

function geometryForModel(modelName, geometryName) {
  const { elements, textures } = resolveModel(modelName);
  const cubes = elements.map((el) => toCube(el, textures));
  return {
    "geometry.format_version": "1.12.0",
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
        cubes,
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
    resolved = `textures/blocks/${name}`;
  }
  terrain.texture_data[name] = { textures: resolved };
  writeJson(terrainPath, terrain);
}

function materialInstances(modelName, fallbackTex, renderMethod) {
  const faces = faceTextureMap(modelName);
  const main = firstTextureOf(modelName) ?? fallbackTex ?? "lattice";
  ensureTerrainEntry(main);
  const material = { "*": { texture: main, render_method: renderMethod } };
  for (const [dir, tex] of Object.entries(faces)) {
    ensureTerrainEntry(tex);
    if (tex !== main) material[dir] = { texture: tex, render_method: renderMethod };
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

  // collect per-state models
  const states = bs.variants ?? {};
  const models = new Map(); // modelName -> geometryName
  const entries = [];
  for (const [key, val] of Object.entries(states)) {
    const model = (Array.isArray(val) ? val[0] : val).model;
    if (!model) continue;
    if (!models.has(model)) models.set(model, `${id}_${models.size}`);
    entries.push({ key, model, condition: key });
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
      condParts.push(`q.block_state('${propPath}') == ${value}`);
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
        "minecraft:material_instances": materialInstances(entry.model, null, renderMethod),
      },
    });
  }
  if (permutations.length) block["minecraft:block"].permutations = permutations;

  writeJson(blockPath, block);
}

console.log(`models: ${generated.length} geometries emitted`);
