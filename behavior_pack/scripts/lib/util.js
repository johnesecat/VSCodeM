// Math helpers — transcribed from util/MathUtils.java (Level 1 evidence).

export function inverseLerp(value, min, max) {
  return clamp01((value - min) / (max - min));
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// MathUtils.nearValue(current, target, speed, plus): approaches target
export function nearValue(current, target, speed, plus) {
  if (current < target) return Math.min(target, current + (target - current) * speed + plus);
  return Math.max(target, current - (current - target) * speed - plus);
}

export function approach(current, target, step) {
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

// MathUtils.progress(metric, delta) = 1 - delta / (1 + metric)   [MathUtils.java:110]
export function progress(metric, delta = 1) {
  return 1 - delta / (1 + metric);
}

export function mixColors(a, b, ratio) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff, aa = (a >>> 24) & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff, ba = (b >>> 24) & 0xff;
  const r = Math.round(ar + (br - ar) * ratio);
  const g = Math.round(ag + (bg - ag) * ratio);
  const bl = Math.round(ab + (bb - ab) * ratio);
  const al = Math.round(aa + (ba - aa) * ratio);
  return ((al << 24) | (r << 16) | (g << 8) | bl) >>> 0;
}

export function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
