import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root = path.resolve(import.meta.dirname, '..');
const rp = path.join(root, 'resource_pack');
function png(file) {
  const input = fs.readFileSync(file);
  const chunks = []; let header; let palette; let alpha;
  for (let pos = 8; pos < input.length;) {
    const length = input.readUInt32BE(pos), type = input.toString('ascii', pos + 4, pos + 8);
    const data = input.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') chunks.push(data);
    if (type === 'PLTE') palette = data;
    if (type === 'tRNS') alpha = data;
    pos += length + 12;
  }
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4), depth = header[8], type = header[9];
  if (depth !== 8) throw new Error(`Unsupported PNG depth: ${file}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`Unsupported PNG type: ${file}`);
  const stride = width * channels, raw = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  const passes = header[12] === 1 ? [[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]] : [[0,0,1,1]];
  let cursor = 0;
  for (const [startX, startY, stepX, stepY] of passes) {
    const w = Math.max(0, Math.ceil((width - startX) / stepX));
    const h = Math.max(0, Math.ceil((height - startY) / stepY));
    if (!w || !h) continue;
    const rowSize = w * channels, decoded = Buffer.alloc(rowSize * h);
    for (let y = 0; y < h; y++) {
      const filter = raw[cursor++];
      if (filter > 4) throw new Error(`Invalid PNG filter: ${file}`);
      for (let x = 0; x < rowSize; x++) {
        const pos = y * rowSize + x;
        const a = x >= channels ? decoded[pos - channels] : 0;
        const b = y ? decoded[pos - rowSize] : 0;
        const c = y && x >= channels ? decoded[pos - rowSize - channels] : 0;
        const predicted = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
        decoded[pos] = (raw[cursor++] + predicted) & 255;
      }
      for (let x = 0; x < w; x++) decoded.copy(pixels, ((startY + y * stepY) * width + startX + x * stepX) * channels, (y * w + x) * channels, (y * w + x + 1) * channels);
    }
  }
  if (cursor !== raw.length) throw new Error(`Unexpected PNG scanline length: ${file}`);
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels, d = i * 4;
    if (type === 3) { const idx = pixels[p]; rgba[d] = palette[idx * 3]; rgba[d + 1] = palette[idx * 3 + 1]; rgba[d + 2] = palette[idx * 3 + 2]; rgba[d + 3] = alpha?.[idx] ?? 255; }
    else if (type === 0 || type === 4) { rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[p]; rgba[d + 3] = type === 4 ? pixels[p + 1] : 255; }
    else { rgba[d] = pixels[p]; rgba[d + 1] = pixels[p + 1]; rgba[d + 2] = pixels[p + 2]; rgba[d + 3] = type === 6 ? pixels[p + 3] : 255; }
  }
  return { width, height, rgba };
}
function crc(data) {
  let c = 0xffffffff;
  for (const byte of data) { c ^= byte; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc(Buffer.concat([name, data])), data.length + 8); return out;
}
function writePng(file, width, height, rgba) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const stride = width * 4, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function json(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function sequence(name, files, fps, size) {
  const frames = files.map((file) => png(path.join(rp, file)));
  const { width, height } = frames[0];
  if (frames.some((frame) => frame.width !== width || frame.height !== height)) throw new Error(`${name}: inconsistent frames`);
  const rgba = Buffer.concat(frames.map((frame) => frame.rgba));
  writePng(path.join(rp, `textures/particles/${name}_frames.png`), width, height * frames.length, rgba);
  json(path.join(rp, `particles/${name}_frames.json`), {
    format_version: '1.10.0', particle_effect: {
      description: { identifier: `psychedelicraft:${name}_frames`, basic_render_parameters: { material: 'particles_blend', texture: `textures/particles/${name}_frames` } },
      components: {
        'minecraft:emitter_rate_instant': { num_particles: 1 },
        'minecraft:emitter_lifetime_once': { active_time: 0.05 },
        'minecraft:particle_lifetime_expression': { max_lifetime: frames.length / fps },
        'minecraft:particle_appearance_billboard': { size: [size, size], facing_camera_mode: 'lookat_xyz', uv: {
          texture_width: width, texture_height: height * frames.length,
          flipbook: { base_UV: [0, 0], size_UV: [width, height], step_UV: [0, height], frames_per_second: fps, max_frame: frames.length, stretch_to_lifetime: false, loop: false },
        } },
      },
    },
  });
  return { name, count: frames.length, fps, width, height };
}
const sequences = [
  sequence('rift', Array.from({ length: 8 }, (_, i) => `textures/misc/entity/reality_rift/zero_screen_${i}.png`), 10, 1),
  sequence('power', Array.from({ length: 4 }, (_, i) => `textures/particles/lightning_${i}.png`), 12, 0.6),
];
// Lens flare images are distinct flare shapes, NOT consecutive video frames.
// Preserve their individual use rather than inventing a flare movie.
const noise = png(path.join(rp, 'textures/misc/shader_noise/heat_distortion_noise.png'));
const samples = [];
function sample(u, v, channel) {
  const x = ((Math.floor(u * noise.width) % noise.width) + noise.width) % noise.width;
  const y = ((Math.floor(v * noise.height) % noise.height) + noise.height) % noise.height;
  return noise.rgba[(y * noise.width + x) * 4 + channel] / 255;
}
for (let i = 0; i < 64; i++) {
  const ticks = i / 20;
  samples.push([0, 1].map((channel) => Number((sample(2 + ticks * 0.324823048, 2 + ticks * 0.48913801, channel) + sample(2 + ticks * 0.52890348, 2 + ticks * 0.6318212, channel) - 1).toFixed(5))));
}
fs.writeFileSync(path.join(root, 'behavior_pack/scripts/data/heat_noise.js'), `// GENERATED from the original heat_distortion_noise.png and shader sample velocities.\nexport const HEAT_NOISE = ${JSON.stringify(samples)};\n`);
json(path.join(root, 'docs/effects-assets.json'), { sequences, heatNoise: { width: noise.width, height: noise.height, samples: samples.length }, limitation: 'Precomputed noise drives a camera-motion proxy. Bedrock add-ons cannot sample DiffuseSampler or DepthSampler, so this does not warp the live framebuffer. No source videos exist in the audited Java resource tree.' });
// Repair malformed four-coordinate box UVs in the hand-authored entity models.
const entityModels = path.join(rp, 'models/entity');
for (const name of fs.readdirSync(entityModels).filter((name) => name.endsWith('.json'))) {
  const file = path.join(entityModels, name), model = JSON.parse(fs.readFileSync(file));
  for (const geometry of model['minecraft:geometry'] ?? []) {
    for (const bone of geometry.bones ?? []) for (const cube of bone.cubes ?? []) {
      if (Array.isArray(cube.uv) && cube.uv.length === 4) {
        const rect = cube.uv;
        cube.uv = Object.fromEntries(['north', 'south', 'east', 'west', 'up', 'down'].map((face) => [face, { uv: rect.slice(0, 2), uv_size: [rect[2] - rect[0], rect[3] - rect[1]] }]));
      }
    }
  }
  json(file, model);
}
console.log('effects: original rift/power sequences converted; original heat noise sampled');
