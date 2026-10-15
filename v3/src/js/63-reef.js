/* IV. REEF — The endless reef.
   You glide forward forever through a kelp forest rising out of murky water: hundreds of stalks over coral beds, thickening
   into groves and thinning into clearings as a slow density field rolls past. Bass is the current, kicks run light up every
   stalk to the polyps, and marine snow drifts past the lens. Stalks are drawn entirely on the GPU from a few grown templates. */
const REEF_NT = 16, REEF_NODES = 128, REEF_BEADS = 24, REEF_ZF = -44, REEF_ZN = 7.5;
const REEF_SHARED = `
uniform sampler2D uTmpl, uSlot; uniform float uCurrent; uniform vec4 uPz[12];
const float ZF = ${REEF_ZF.toFixed(1)}, ZN = ${REEF_ZN.toFixed(1)};
float pulses(float s, float h){
  float v = 0.0;
  for (int k = 0; k < 12; k++) {
    vec4 q = uPz[k]; if (q.y <= 0.0) continue;
    float front = q.x * q.w, x = s - front;
    if (x > 0.3 || x < -2.2) continue;
    float m = fract(h + q.z * 7.31); if (m > q.z) continue;
    v += q.y * (x > 0.0 ? exp(-x * x * 60.0) : exp(x * 2.6)) * exp(-q.x * 0.3);
  }
  return v;
}
vec3 reefPal(float pal, float u){
  if (pal < 0.5) return g4(C_indigo, C_teal, C_biolum, C_cyan, u);
  if (pal < 1.5) return g4(C_indigo, C_violet, C_magenta, C_pink, u);
  return g4(C_azure, C_teal, C_lime, C_biolum, u);
}
// one node of one stalk, swaying in the current
vec3 reefNode(int stalk, int node, out float I, out vec3 col, out float vis, out float w, out int parent){
  vec4 S0 = texelFetch(uSlot, ivec2(stalk, 0), 0), S1 = texelFetch(uSlot, ivec2(stalk, 1), 0);
  int tm = int(S1.y);
  vec4 N0 = texelFetch(uTmpl, ivec2(node, tm * 3), 0), N1 = texelFetch(uTmpl, ivec2(node, tm * 3 + 1), 0);
  float sc = S0.z * p_height; vec3 rest = N0.xyz * sc; float u = clamp(rest.y / 4.0, 0.0, 1.0), h = N1.y * 6.28;
  float amp = uCurrent * pow(u, 1.5), cr = cos(S0.w), sn = sin(S0.w);
  float xr = rest.x * cr - rest.z * sn, zr = rest.x * sn + rest.z * cr, z = S0.y;
  vec3 P = vec3(S0.x + xr + (sin(uT * 0.55 + S0.x * 0.7 + h * 0.2) * 0.7 + sin(uT * 1.3 + rest.y * 1.6 + h) * 0.6) * amp,
                -1.9 + rest.y - amp * amp * 0.4,
                z + zr + sin(uT * 0.43 + z + rest.y * 1.1 + h) * amp * 0.6);
  vis = S1.x * sm(ZF, ZF + 10.0, z) * (1.0 - sm(ZN - 1.5, ZN, z));
  I = vis * (0.05 + 0.07 * uLevel + pulses(N0.w, N1.y) * 1.3 + 0.05 * pow(max(0.0, sin(N0.w * 3.0 - uT * 1.4 + h)), 6.0));
  col = reefPal(S1.z, N1.w);
  w = N1.z * sqrt(sc); parent = int(N1.x);
  return P;
}`;
const REEF_LINE = `
${REEF_SHARED}
void seg(int id, out vec3 A, out vec3 B, out float wA, out float wB, out vec4 cA, out vec4 cB){
  int stalk = id / ${REEF_NODES}, node = id - stalk * ${REEF_NODES};
  float I1, I0, v1, v0; vec3 c1, c0; int par, pp;
  B = reefNode(stalk, node, I1, c1, v1, wB, par);
  if (par < 0 || v1 <= 0.001) { A = B; wA = 0.0; cA = vec4(0.0); cB = vec4(0.0); return; }
  A = reefNode(stalk, par, I0, c0, v0, wA, pp);
  cA = vec4(c0, I0); cB = vec4(c1, I1);
}`;
const REEF_GLSL = `
${REEF_SHARED}
uniform int uSL, uCO0, uSN0, uSA0, uNClump; uniform float uTravel, uKick;
uniform float uSparkleT;
void particle(int i, vec4 s, inout vec3 p, inout float r, inout vec3 c, inout float e, inout float g){
  float t = uT;
  if (i < uCO0) {
    // polyps and beads riding the stalks
    int stalk = i / ${REEF_BEADS}, k = i - stalk * ${REEF_BEADS};
    int tm = int(texelFetch(uSlot, ivec2(stalk, 1), 0).y);
    vec4 bd = texelFetch(uTmpl, ivec2(k, tm * 3 + 2), 0);
    if (bd.x < 0.0) return;
    float I, vis, w; vec3 col; int par;
    p = reefNode(stalk, int(bd.x), I, col, vis, w, par);
    if (vis <= 0.001) return;
    bool tip = bd.y > 0.5;
    float sp = step(h1(i, int(t * 4.0)), 0.02) * uHigh * 2.0;
    r = bd.z * p_polyp * (1.0 + I * 0.5 + (tip ? uHigh * 0.3 : 0.0)) * vis;
    c = tip ? (s.y < 0.4 ? C_pink : s.y < 0.75 ? C_magenta : C_gold) : mix(col, C_pearl, 0.25);
    e = 0.06 + I * 1.2 + (tip ? (0.25 + 0.2 * sin(t * 1.2 + s.w * 20.0) + sp) * vis : 0.0);
    return;
  }
  float LEN = ZN - ZF;
  if (i < uSN0) {
    // coral beds on the sea floor
    int k = (i - uCO0) / 140; float kf = float(k);
    float hx = h1(k, 31), hz = h1(k, 32), ht = h1(k, 33), vis = step(h1(k, 34), 0.8);
    float cx = (hx - 0.5) * 18.0; cx += sign(cx) * 0.8;
    float cz = ZF + mod(hz * LEN + uTravel, LEN);
    float fade = vis * sm(ZF, ZF + 10.0, cz) * (1.0 - sm(ZN - 1.5, ZN, cz));
    if (fade <= 0.001) return;
    int j = (i - uCO0) - k * 140;
    float size = 0.18 + 0.45 * h1(k, 35);
    vec3 lp;
    if (ht < 0.45) { vec3 d = fib(j, 140, kf); d.y = abs(d.y); lp = d * size * (0.85 + 0.15 * vnoise(d * 6.0 + kf)); }
    else if (ht < 0.75) { float a = (s.x - 0.5) * 2.2, rr = sqrt(s.y) * size * 1.6; lp = vec3(sin(a) * rr, cos(a) * rr * 1.1, (s.z - 0.5) * 0.05); float ra = h1(k, 36) * 6.28; lp = vec3(lp.x * cos(ra), lp.y, lp.x * sin(ra) + lp.z); }
    else { float br = floor(s.x * 7.0), a = br / 7.0 * 6.28 + h1(k, 37) * 6.28, u = s.y; lp = vec3(cos(a) * u * size * 0.6, u * size * 1.7, sin(a) * u * size * 0.6) + vec3(0.0, 0.0, 0.0); }
    p = vec3(cx, -1.92, cz) + lp;
    vec3 cc = ht < 0.33 ? C_pink : ht < 0.55 ? C_ember : ht < 0.75 ? C_magenta : ht < 0.9 ? C_gold : C_violet;
    c = mix(cc, C_pearl, s.w * 0.2);
    r = (0.006 + 0.006 * s.z) * fade;
    e = (0.08 + uKick * 0.3 + tw(s, t) * 0.3 + uHigh * 0.2 * s.w) * fade + pulses(2.0, s.x) * 0.3 * fade;
    return;
  }
  if (i < uSA0) {
    float z = ZF + mod(s.y * LEN + uTravel * (0.85 + 0.3 * s.z), LEN);
    float y = -1.8 + mod(s.z * 5.2 - t * (0.02 + 0.03 * s.w), 5.2);
    float x = (s.x - 0.5) * 16.0 + vnoise(vec3(s.x * 9.0, y * 0.5, t * 0.06)) * 0.6 + sin(t * 0.55 + y) * uCurrent * 0.5;
    float near = 1.0 - sm(ZN - 2.5, ZN, z);
    p = vec3(x, y, z); r = (0.003 + 0.005 * s.y) * near;
    c = s.z < 0.6 ? C_biolum : s.z < 0.85 ? C_pearl : C_pink;
    e = 0.08 + tw(s, t) * 0.9 + uHigh * 0.3 * s.z; g = s.w < 0.75 ? 1.0 : 0.0;
    return;
  }
  float z = ZF + mod(s.y * LEN + uTravel, LEN);
  p = vec3((s.x - 0.5) * 20.0, -1.93 + s.w * 0.03, z);
  r = 0.004 * (1.0 - sm(ZN - 2.0, ZN, z)); c = mix(C_gold, C_pearl, s.z);
  e = 0.04 + tw(s, t) * 0.6 + uKick * 0.2;
}`;
// grow a handful of kelp templates once; every stalk is one of them, scaled and turned
let REEF_TMPL = null;
const reefTmplTex = dataTex(REEF_NODES, REEF_NT * 3), reefSlotTex = dataTex(512, 2);
function buildReefTemplates() {
  if (REEF_TMPL) return;
  const d = new Float32Array(REEF_NODES * REEF_NT * 3 * 4), r = rngFrom(808);
  for (let t = 0; t < REEF_NT; t++) {
    const F = new Fil(REEF_NODES);
    growTree(F, { rng: r, root: [0, 0, 0], dir: [(r() - 0.5) * 0.25, 1, (r() - 0.5) * 0.25], len: 2.2 + r() * 2.0, step: 0.085, branch: 0.07, spread: 0.5,
      maxDepth: 2, child: 0.6, curl: 0.09, cf: 0.7, w0: 0.012, taper: 0.995, peel: 8, bias: () => [0, 0.11, 0] });
    const row0 = t * 3 * REEF_NODES * 4, row1 = (t * 3 + 1) * REEF_NODES * 4, row2 = (t * 3 + 2) * REEF_NODES * 4;
    for (let i = 0; i < REEF_NODES; i++) {
      if (i < F.n) { d.set([F.p[i * 3], F.p[i * 3 + 1], F.p[i * 3 + 2], F.s[i]], row0 + i * 4); d.set([F.par[i], F.h[i], F.w[i], F.s[i] / F.sMax], row1 + i * 4); }
      else { d.set([0, 0, 0, 0], row0 + i * 4); d.set([-1, 0, 0, 0], row1 + i * 4); }
    }
    let m = 0;
    for (const id of F.leaves) { if (m >= 8) break; d.set([id, 1, 0.022 + 0.02 * r(), 0], row2 + m * 4); m++; }
    const step = Math.max(2, Math.floor(F.n / (REEF_BEADS - m)));
    for (let j = 4; j < F.n && m < REEF_BEADS; j += step) { d.set([j, 0, 0.005 + 0.004 * r(), 0], row2 + m * 4); m++; }
    for (; m < REEF_NODES; m++) d.set([-1, 0, 0, 0], row2 + m * 4);
  }
  uploadData(reefTmplTex, REEF_NODES, REEF_NT * 3, d);
  REEF_TMPL = true;
}
function makeReef(P) {
  buildReefTemplates();
  const SL = Math.min(512, Math.round(P.stalks * Math.min(1, 0.5 + S.detail * 0.5))), LEN = REEF_ZN - REEF_ZF;
  const NB = SL * REEF_BEADS, NCO = Math.floor(cnt(19000, P, P.coral) / 140) * 140, NSNOW = cnt(10000, P, P.snow), NSAND = cnt(8000, P);
  const CO0 = NB, SN0 = CO0 + NCO, SA0 = SN0 + NSNOW, N = Math.min(CAP, SA0 + NSAND);
  const slot = new Float32Array(512 * 2 * 4), slotZ = new Float32Array(SL), slotPrev = new Float32Array(SL);
  const dens = d => clamp(0.55 + P.variation * (noise3(d * 0.045, 3.3, 1.1) * 1.3 + noise3(d * 0.13, 7.1, 2.2) * 0.5), 0.02, 1);
  let travel = 0, distIdx = 0, current = 0, kick = 0;
  function place(k, d) {
    const de = dens(d), vis = Math.random() < 0.2 + de * 0.95 ? 1 : 0;
    let x = (Math.random() - 0.5) * 17; if (Math.abs(x) < 0.7) x += Math.sign(x || 1) * 0.9;
    const o0 = k * 4, o1 = (512 + k) * 4;
    slot[o0] = x; slot[o0 + 2] = (0.45 + de * 0.95) * (0.7 + Math.random() * 0.6); slot[o0 + 3] = Math.random() * TAU;
    slot[o1] = vis; slot[o1 + 1] = Math.floor(Math.random() * REEF_NT); slot[o1 + 2] = k % 3; slot[o1 + 3] = Math.random();
  }
  for (let k = 0; k < SL; k++) { slotZ[k] = REEF_ZF + (k + Math.random()) / SL * LEN; slotPrev[k] = slotZ[k]; place(k, slotZ[k]); }
  const pz = [], uPz = new Float32Array(48);
  const push = (str, cov, spd) => { if (pz.length >= 12) pz.shift(); pz.push({ age: 0, str, cov, spd }); };
  const fogCol = () => grad([PAL.indigo, PAL.azure, PAL.teal, PAL.biolum, PAL.violet, PAL.indigo], P.fogHue).map(c => c * 0.1);
  const W = {
    n: N, name: 'REEF', blurb: 'The endless reef', tint: PAL.teal, flash: PAL.biolum, coreLight: PAL.biolum, coreGain: 0.8, coreLocal: [0, 0.6, -3],
    wisps: [PAL.biolum, PAL.pink, PAL.cyan], fils: [], ay: 0, ax: 0, swayMul: 0.35, driftMul: 0.4,
    cam0: { tx: 0, ty: -0.25, tz: 0, dist: 8.6, h: 0, p: -1, b: 0, f: 40 },
    prog: progFor('REEF', 'REEF', REEF_GLSL),
    lines: [{ prog: progFor('REEF_L', 'REEF', REEF_LINE, true), count: SL * REEF_NODES }],
    get fog() { return { d: 0.05 * P.fog, col: fogCol() }; },
    onset(kind, s) {
      if (kind === 'kick' || kind === 'touch') { push(0.7 + s, clamp(0.35 + s * 0.5, 0, 1), 2.4); kick = Math.max(kick, s); }
      else if (kind === 'snare') push(0.5 + s * 0.5, 0.3, 3.2);
      else if (kind === 'idle') push(0.5, 0.25, 1.6);
    },
    update(dt, t) {
      for (const q of pz) q.age += dt;
      while (pz.length && (pz[0].age * pz[0].spd > 7.5 || pz[0].age > 8)) pz.shift();
      kick *= Math.exp(-dt * 2);
      current = lerp(current, P.current * (0.12 + A.low * 0.45 + A.presence * 0.1), 1 - Math.exp(-dt * 2));
      const v = P.travel * (0.9 + A.level * 1.2 + kick * 1.5);
      travel += dt * v; distIdx += dt * v;
      for (let k = 0; k < SL; k++) {
        const z = wrap(slotZ[k] + travel, REEF_ZF, REEF_ZN);
        if (z < slotPrev[k] - LEN * 0.5) place(k, distIdx + LEN);
        slotPrev[k] = z; slot[k * 4 + 1] = z;
      }
      uploadData(reefSlotTex, 512, 2, slot);
      W.ay = 0.08 * Math.sin(t * 0.04); W.ax = 0.02 * Math.sin(t * 0.06);
      uPz.fill(0);
      pz.forEach((q, k) => { uPz[k * 4] = q.age; uPz[k * 4 + 1] = q.str; uPz[k * 4 + 2] = q.cov; uPz[k * 4 + 3] = q.spd; });
    },
    shared(p) {
      bindT(p, 'uTmpl', reefTmplTex); bindT(p, 'uSlot', reefSlotTex);
      gl.uniform1f(p.u('uCurrent'), current); gl.uniform4fv(p.u('uPz[0]'), uPz);
    },
    uniforms(p) {
      W.shared(p);
      gl.uniform1i(p.u('uCO0'), CO0); gl.uniform1i(p.u('uSN0'), SN0); gl.uniform1i(p.u('uSA0'), SA0);
      gl.uniform1f(p.u('uTravel'), travel); gl.uniform1f(p.u('uKick'), kick);
    }
  };
  W.lines[0].uniforms = p => W.shared(p);
  return W;
}
