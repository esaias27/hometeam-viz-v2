/* ================================================================== */
/* Shockwaves: shared by every world, launched by kicks, taps, motion  */
/* ================================================================== */
const RMAX = 14, rX = new Float32Array(RMAX), rY = new Float32Array(RMAX), rZ = new Float32Array(RMAX), rAge = new Float32Array(RMAX).fill(99), rStr = new Float32Array(RMAX), rSpd = new Float32Array(RMAX);
function pushRipple(x, y, z, s, spd) {
  let k = 0; for (let j = 1; j < RMAX; j++) if (rAge[j] > rAge[k]) k = j;
  rX[k] = x; rY[k] = y; rZ[k] = z; rAge[k] = 0; rStr[k] = s; rSpd[k] = spd || 2.1;
}
function ageRipples(dt) { for (let k = 0; k < RMAX; k++) rAge[k] += dt; }

/* ================================================================== */
/* Filament trees, pulses and helpers                                  */
/* ================================================================== */
class Fil {
  constructor(max) {
    this.max = max; this.n = 0; this.ns = 0; this.sMax = 1e-3;
    this.p = new Float32Array(max * 3); this.c = new Float32Array(max * 3); this.s = new Float32Array(max); this.h = new Float32Array(max);
    this.w = new Float32Array(max); this.col = new Float32Array(max * 3); this.I = new Float32Array(max); this.par = new Int32Array(max).fill(-1);
    this.len = new Float32Array(max); this.seg = new Uint16Array(max * 2 + 64); this.leaves = [];
  }
  reset() { this.n = 0; this.ns = 0; this.sMax = 1e-3; this.leaves.length = 0; }
  add(x, y, z, s, h, w, par) {
    if (this.n >= this.max) return -1;
    const i = this.n++, q = i * 3;
    this.p[q] = this.c[q] = x; this.p[q + 1] = this.c[q + 1] = y; this.p[q + 2] = this.c[q + 2] = z;
    this.s[i] = s; this.h[i] = h; this.w[i] = w; this.par[i] = par; this.I[i] = 0;
    if (par >= 0) { const r = par * 3; this.len[i] = Math.hypot(x - this.p[r], y - this.p[r + 1], z - this.p[r + 2]) || 1e-3; this.link(par, i); }
    if (s > this.sMax) this.sMax = s;
    return i;
  }
  link(a, b) { if (this.ns * 2 + 1 >= this.seg.length) return; this.seg[this.ns * 2] = a; this.seg[this.ns * 2 + 1] = b; this.ns++; }
  paint(fn) { for (let i = 0; i < this.n; i++) { const c = fn(this.s[i] / this.sMax, i); this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2]; } }
  poly(pts, h, w, closed) { let par = -1, first = -1; for (let j = 0; j < pts; j++) { par = this.add(0, 0, 0, j / Math.max(1, pts - 1), h, w, par); if (j === 0) first = par; } if (closed) this.link(par, first); return first; }
}
function deflect(dx, dy, dz, ang, r, planar) {
  if (planar) { const a = ang * (r() < 0.5 ? -1 : 1), c = Math.cos(a), s = Math.sin(a); return [dx * c - dy * s, dx * s + dy * c, dz]; }
  let ax = Math.abs(dy) < 0.9 ? 0 : 1, ay = Math.abs(dy) < 0.9 ? 1 : 0;
  let ux = dy * 0 - dz * ay, uy = dz * ax - dx * 0, uz = dx * ay - dy * ax;
  const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
  const ph = r() * TAU, c = Math.cos(ph), s = Math.sin(ph), px = ux * c + vx * s, py = uy * c + vy * s, pz = uz * c + vz * s;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return [dx * ca + px * sa, dy * ca + py * sa, dz * ca + pz * sa];
}
function growTree(F, o) {
  const r = o.rng, root = F.add(o.root[0], o.root[1], o.root[2], 0, r(), o.w0, -1);
  if (root < 0) return;
  const so = r() * 40, peel = o.peel || 9;
  const stack = [{ x: o.root[0], y: o.root[1], z: o.root[2], dx: o.dir[0], dy: o.dir[1], dz: o.dir[2], w: o.w0, depth: 0, par: root, s: 0, h: F.h[root], len: o.len, turn: null }];
  while (stack.length) {
    const b = stack.pop(); let { x, y, z, dx, dy, dz, w, par, s } = b;
    const steps = Math.max(2, Math.floor(b.len / o.step));
    for (let k = 0; k < steps; k++) {
      if (b.turn && k < peel) { const f = 0.12 + 0.1 * k / peel; dx += (b.turn[0] - dx) * f; dy += (b.turn[1] - dy) * f; dz += (b.turn[2] - dz) * f; }
      const n = curl3(x * o.cf + so, y * o.cf, z * o.cf);
      dx += n[0] * o.curl; dy += n[1] * o.curl; dz += o.planar ? 0 : n[2] * o.curl;
      if (o.bias) { const q = o.bias(x, y, z); dx += q[0]; dy += q[1]; dz += q[2]; }
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      x += dx * o.step; y += dy * o.step; z += dz * o.step; s += o.step; w *= o.taper;
      if (o.post) { const q = o.post(x, y, z); x = q[0]; y = q[1]; z = q[2]; }
      const idx = F.add(x, y, z, s, b.h, w, par); if (idx < 0) return; par = idx;
      const rem = (steps - k - 1) * o.step;
      if (b.depth < o.maxDepth && rem > o.step * 6 && k > 3 && r() < o.branch) {
        const e = deflect(dx, dy, dz, o.spread * (0.55 + 0.8 * r()), r, o.planar);
        if (o.onBranch) o.onBranch(idx);
        stack.push({ x, y, z, dx, dy, dz, w: w * 0.88, depth: b.depth + 1, par: idx, s, h: r(), len: rem * o.child, turn: e });
        w *= 0.93;
      }
    }
    F.leaves.push(par);
  }
}
// Lightning: a midpoint-displaced channel with side branches that taper and fork again
function mdPath(ax, ay, az, bx, by, bz, depth, rough, r) {
  let pts = [ax, ay, az, bx, by, bz];
  for (let d = 0; d < depth; d++) {
    const np = [pts[0], pts[1], pts[2]];
    for (let i = 0; i + 5 < pts.length; i += 3) {
      const px = pts[i], py = pts[i + 1], pz = pts[i + 2], qx = pts[i + 3], qy = pts[i + 4], qz = pts[i + 5];
      const ex = qx - px, ey = qy - py, ez = qz - pz, L = Math.hypot(ex, ey, ez) || 1e-4;
      let rx = r() * 2 - 1, ry = r() * 2 - 1, rz = r() * 2 - 1;
      const dd = (rx * ex + ry * ey + rz * ez) / (L * L); rx -= ex * dd; ry -= ey * dd; rz -= ez * dd;
      const k = rough * L;
      np.push((px + qx) / 2 + rx * k, (py + qy) / 2 + ry * k, (pz + qz) / 2 + rz * k, qx, qy, qz);
    }
    pts = np;
  }
  return pts;
}
function addBolt(F, pts, w0, w1, level, par, s0, r, opt) {
  const n = pts.length / 3, ids = [];
  let s = s0, px = pts[0], py = pts[1], pz = pts[2];
  for (let j = 0; j < n; j++) {
    const x = pts[j * 3], y = pts[j * 3 + 1], z = pts[j * 3 + 2];
    if (j > 0) s += Math.hypot(x - px, y - py, z - pz);
    const id = (j === 0 && par >= 0) ? par : F.add(x, y, z, s, level, lerp(w0, w1, j / (n - 1)), j === 0 ? par : ids[j - 1]);
    if (id < 0) return ids;
    ids.push(id); px = x; py = y; pz = z;
  }
  if (level < opt.levels) {
    for (let j = 2; j < n - 3; j++) {
      if (r() > opt.branch * (level ? 0.6 : 1)) continue;
      const id = ids[j], x = pts[j * 3], y = pts[j * 3 + 1], z = pts[j * 3 + 2];
      let dx = pts[(j + 1) * 3] - x, dy = pts[(j + 1) * 3 + 1] - y, dz = pts[(j + 1) * 3 + 2] - z;
      const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      const e = deflect(dx, dy, dz, 0.45 + r() * 0.6, r, false);
      const L = opt.len * (0.25 + r() * 0.35) * (1 - j / n) * (level ? 0.6 : 1);
      const sub = mdPath(x, y, z, x + e[0] * L, y + e[1] * L, z + e[2] * L, level ? 4 : 5, opt.rough, r);
      const wj = lerp(w0, w1, j / (n - 1)) * 0.5;
      addBolt(F, sub, wj, wj * 0.2, level + 1, id, F.s[id], r, opt);
    }
  }
  return ids;
}
function makeBolt(F, a, b, w, r, opt) {
  F.reset();
  const pts = mdPath(a[0], a[1], a[2], b[0], b[1], b[2], 6, opt.rough, r);
  opt.len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  addBolt(F, pts, w, w * 0.45, 0, -1, 0, r, opt);
  F.lv = F.lv || new Float32Array(F.max);
  for (let i = 0; i < F.n; i++) F.lv[i] = F.h[i];
}
class Pulses {
  constructor() { this.list = []; }
  push(dir, str, cov, spd) { if (this.list.length > 16) this.list.shift(); this.list.push({ age: 0, dir, str, cov, spd, seed: Math.random() }); }
  step(dt, sMax) { for (const p of this.list) p.age += dt; this.list = this.list.filter(p => p.age * p.spd < sMax + 3 && p.age < 8); }
  eval(s, h, sMax) {
    let v = 0;
    for (const p of this.list) {
      const front = p.dir > 0 ? p.age * p.spd : sMax - p.age * p.spd, x = (s - front) * p.dir;
      if (x > 0.3 || x < -2.2) continue;
      let m = h + p.seed; m -= Math.floor(m); if (m > p.cov) continue;
      v += p.str * (x > 0 ? Math.exp(-x * x * 60) : Math.exp(x * 2.6)) * Math.exp(-p.age * 0.3);
    }
    return v;
  }
}
function rotPts(arr, n, stride, ay, ax) {
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  for (let i = 0, o = 0; i < n; i++, o += stride) {
    const x = arr[o], y = arr[o + 1], z = arr[o + 2], x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    arr[o] = x1; arr[o + 1] = y * cx - z1 * sx; arr[o + 2] = y * sx + z1 * cx;
  }
}
function rot1(p, ay, ax) { const a = new Float32Array(p); rotPts(a, 1, 3, ay, ax); return a; }
function setCol(col, i, c) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
const band = u => A.bands[clamp(Math.round(u * 15), 0, 15)];

/* ================================================================== */