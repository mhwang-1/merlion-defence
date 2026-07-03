/* ===== small helpers ===== */
'use strict';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/** Deterministic RNG (mulberry32) so wave layouts are stable per level. */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build cumulative-length data for a waypoint path. */
function buildPath(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const len = dist(x1, y1, x2, y2);
    segs.push({ x1, y1, x2, y2, len, start: total });
    total += len;
  }
  return { points, segs, total };
}

/** Position + direction at distance d along a built path. */
function pointAt(path, d) {
  d = clamp(d, 0, path.total - 0.001);
  for (const s of path.segs) {
    if (d <= s.start + s.len) {
      const t = (d - s.start) / s.len;
      return {
        x: lerp(s.x1, s.x2, t),
        y: lerp(s.y1, s.y2, t),
        dx: (s.x2 - s.x1) / s.len,
        dy: (s.y2 - s.y1) / s.len,
      };
    }
  }
  const s = path.segs[path.segs.length - 1];
  return { x: s.x2, y: s.y2, dx: (s.x2 - s.x1) / s.len, dy: (s.y2 - s.y1) / s.len };
}

/** Shortest distance from point to a built path (approximate, per segment). */
function distToPath(path, x, y) {
  let best = Infinity;
  for (const s of path.segs) {
    const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
    const t = clamp(((x - s.x1) * vx + (y - s.y1) * vy) / (s.len * s.len), 0, 1);
    best = Math.min(best, dist(x, y, s.x1 + vx * t, s.y1 + vy * t));
  }
  return best;
}

const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : '' + Math.round(n);
