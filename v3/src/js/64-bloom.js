/* V. BLOOM — The endless blossom.
   Flowers are born as buds at the heart and open outward forever, each generation a new species: three petals, then
   thirteen, then a star, then a ruffled rose. You are always falling into the next one. The music sets the speed of
   blossoming, kicks pulse the newest heart, hats flash the petal rims, and the spectrum runs around every flower. */
const BLOOM_PALS = [
  [PAL.gold, PAL.amber, PAL.pink, PAL.magenta, PAL.violet], [PAL.white, PAL.cyan, PAL.azure, PAL.violet, PAL.indigo],
  [PAL.gold, PAL.rose, PAL.pink, PAL.magenta, PAL.cyan], [PAL.biolum, PAL.teal, PAL.azure, PAL.violet, PAL.pink],
  [PAL.amber, PAL.ember, PAL.rose, PAL.violet, PAL.indigo], [PAL.pearl, PAL.lime, PAL.teal, PAL.cyan, PAL.azure]];
const BLOOM_GLSL = `
uniform int uG, uPER, uNP, uST0, uPO0, uYoung; uniform float uClock, uSpin, uHeart, uRim, uLogR, uPS, uYsc;
uniform vec4 uSA0[10], uSA1[10], uSB0[10], uSB1[10]; uniform float uPal[10];
const vec3 BP[30] = vec3[30](${BLOOM_PALS.flat().map(c => `vec3(${c.map(x => x.toFixed(4)).join(',')})`).join(',')});
vec3 bpal(int k, float u){ u = clamp(u, 0.0, 1.0) * 4.0; int i = min(3, int(u)); return mix(BP[k * 5 + i], BP[k * 5 + i + 1], u - float(i)); }
const float GA = 2.39996323;
void stamen(int k, float u, float sc, out vec3 o){
  float a = float(k) * GA * 3.0 + uSpin * 0.6, h = (0.35 + 0.25 * float((k * 7) % 5) / 5.0) * sc * 2.2, rr = sin(u * 1.4) * 0.22 * sc + 0.01;
  o = vec3(cos(a) * rr, sin(a) * rr, u * h + 0.03 * sin(uT * 1.3 + float(k)));
}
void particle(int i, vec4 s, inout vec3 p, inout float r, inout vec3 c, inout float e, inout float g){
  float t = uT;
  if (i < uNP) {
    int gi = i / uPER, j = i - gi * uPER;
    float ph = fract(uClock + float(gi) / float(uG)), sc = 0.07 * exp(ph * uLogR), alpha = sm(0.0, 0.1, ph) * (1.0 - sm(0.78, 1.0, ph));
    float m = sm(0.15, 0.85, ph), open = sm(0.0, 0.35, ph);
    vec4 a0 = uSA0[gi], a1 = uSA1[gi], b0 = uSB0[gi], b1 = uSB1[gi];
    float k = a0.x, sharp = mix(a0.y, b0.y, m), depth = mix(a0.z, b0.z, m), ruffle = mix(a0.w, b0.w, m);
    float twist = mix(a1.x, b1.x, m), dir = a1.y, cup = mix(a1.z, b1.z, m), phase = a1.w;
    float u = sqrt(float(j) / float(uPER));
    float th = float(j) * GA + uSpin * dir * (1.0 - u * 0.4) + twist * p_twist * u + float(gi) * 1.3;
    float b = band(fract(th / TAU));
    float cpet = pow(abs(cos(k * 0.5 * th + phase)), sharp * p_sharp), dpt = clamp(depth * p_depth, 0.0, 0.95);
    float pet = (1.0 - dpt) + dpt * cpet + ruffle * p_ruffle * cos(k * 2.0 * th + u * 9.0);
    float rr = sc * u * pet * (0.45 + 0.55 * open) * (1.0 + b * 0.07 * u);
    float z = cup * p_cup * sc * 0.35 * pow(u, 1.6) * (1.4 - open) - ph * 0.6;
    float heart = gi == uYoung ? uHeart * (1.0 - u) : 0.0;
    p = vec3(cos(th) * rr, sin(th) * rr, z);
    r = (0.006 + 0.016 * u) * uPS * (0.25 + sc * 1.15) * alpha * (1.0 + b * 0.4 + heart * 0.8);
    c = bpal(int(uPal[gi]), u);
    e = (0.08 + (1.0 - u) * (0.35 + uLevel * 0.4) + heart * 1.6 + b * 0.45 * u + uRim * pow(u, 6.0) * 2.0 + tw(s, t) * 0.25) * (0.4 + 0.6 * alpha);
    return;
  }
  if (i < uPO0) {
    int k = (i - uST0) / 8, j = i - uST0 - k * 8; float u = float(j + 1) / 8.0;
    stamen(k, u, uYsc, p);
    r = j == 7 ? 0.012 * (1.0 + uHeart * 0.5) : 0.004; c = j == 7 ? C_gold : C_pearl;
    e = 0.3 + uHeart * 1.2 + uHigh * 0.4 * u;
    return;
  }
  float u = fract(s.x + t * 0.05 * (1.0 + uLevel)), a = s.y * TAU + t * 0.2, rr = 0.15 + u * 2.4;
  p = vec3(cos(a) * rr, sin(a) * rr, u * 1.4); r = 0.005; c = s.z < 0.5 ? C_gold : C_pearl; e = (1.0 - u) * 0.7 + tw(s, t) * 0.4; g = 1.0;
}`;
// web lines: each petal point links to its 21st and 34th neighbour along the spiral, read straight from the morphed particles
const BLOOM_LINE = `
uniform sampler2D uFP, uFC; uniform int uWO, uPER, uNP; uniform float uWeb;
void seg(int id, out vec3 A, out vec3 B, out float wA, out float wB, out vec4 cA, out vec4 cB){
  int a = id / 2, which = id - a * 2, j = a % uPER, off = which == 0 ? 21 : 34;
  wA = wB = 0.0018; cA = cB = vec4(0.0); A = B = vec3(0.0);
  if (a >= uNP || j + off >= uPER || (which == 1 && j % 2 == 1)) return;
  vec4 pa = fetch(uFP, uWO + a), pb = fetch(uFP, uWO + a + off), ca = fetch(uFC, uWO + a), cb = fetch(uFC, uWO + a + off);
  if (pa.w <= 0.0 || pb.w <= 0.0) return;
  A = pa.xyz; B = pb.xyz;
  cA = vec4(ca.rgb, (0.05 + max(0.0, ca.a - 0.2) * 0.75) * uWeb);
  cB = vec4(cb.rgb, (0.05 + max(0.0, cb.a - 0.2) * 0.75) * uWeb);
}`;
function makeBloom(P) {
  const G = Math.round(P.gens), PER = Math.max(100, Math.round(P.per * S.detail)), NP = G * PER, NS = 34, SB = 8, ST0 = NP, PO0 = NP + NS * SB;
  const N = Math.min(CAP, PO0 + cnt(1500, P));
  const SPECIES = [3, 5, 6, 8, 13, 5, 7, 4], r = rngFrom(1313), gen = [];
  function petalCount() {
    let k = P.petals >= 1 ? Math.round(P.petals) : SPECIES[Math.floor(r() * SPECIES.length)];
    const folds = MIRRORS[S.kaleido] || 0;
    if (P.foldSync >= 0.5 && folds) k = folds * (r() < 0.5 ? 1 : 2);
    return k;
  }
  function species(g, init) {
    const sp = { k: petalCount(), sharp: 0.4 + r() * 2.2, depth: 0.3 + r() * 0.55, ruffle: r() < 0.4 ? 0.04 + r() * 0.08 : 0,
      twist: (r() - 0.5) * 1.6, pal: P.palette >= 1 ? Math.round(P.palette) - 1 : Math.floor(r() * BLOOM_PALS.length), dir: r() < 0.5 ? -1 : 1, cup: 0.2 + r() * 0.5, phase: r() * TAU };
    const G0 = gen[g] || {};
    gen[g] = Object.assign(G0, { a: init ? Object.assign({}, sp) : (G0.b || sp), b: sp });
  }
  for (let g = 0; g < G; g++) species(g, true);
  const SP = 24, F = new Fil(NS * SP);
  for (let k = 0; k < NS; k++) F.poly(SP, k / NS, 0.0024, false);
  for (let i = 0; i < F.n; i++) setCol(F.col, i, mixC(PAL.gold, PAL.pearl, (i % SP) / SP));
  const lastP = new Float32Array(G).fill(-1);
  const uSA0 = new Float32Array(40), uSA1 = new Float32Array(40), uSB0 = new Float32Array(40), uSB1 = new Float32Array(40), uPal = new Float32Array(10);
  let clock = 0, heart = 0, rim = 0, spin = 0, young = 0, ysc = 0.3;
  const W = {
    n: N, name: 'BLOOM', blurb: 'An endless blossom', tint: PAL.pink, flash: PAL.gold, coreLight: PAL.gold, coreGain: 1.2, coreLocal: [0, 0, 0.2],
    wisps: [PAL.gold, PAL.pink, PAL.violet], fils: [F], ay: 0, ax: 0,
    cam0: { tx: 0, ty: 0, tz: 0, dist: 8.6, h: 0, p: -3, b: 0, f: 45 },
    prog: progFor('BLOOM', 'BLOOM', BLOOM_GLSL),
    lines: [{ prog: progFor('BLOOM_L', 'BLOOM', BLOOM_LINE, true), count: NP * 2, fromFin: true,
      uniforms(p) { gl.uniform1i(p.u('uWO'), WO); gl.uniform1i(p.u('uPER'), PER); gl.uniform1i(p.u('uNP'), NP); gl.uniform1f(p.u('uWeb'), P.web); } }],
    onset(kind, s) { if (kind === 'kick' || kind === 'touch') { heart = Math.max(heart, s * P.pulse); clock += 0.012 * s * P.pulse; } if (kind === 'hat' || kind === 'snare') rim = Math.max(rim, s * 0.8); },
    update(dt, t) {
      clock += dt * (0.028 + A.level * 0.06 + A.presence * 0.025) * P.bloomSpeed;
      spin += dt * (0.04 + A.level * 0.15) * P.spin;
      heart *= Math.exp(-dt * 3); rim *= Math.exp(-dt * 3.5);
      let yp = 2;
      for (let g = 0; g < G; g++) { const p = (clock + g / G) % 1; if (p < lastP[g]) species(g, false); lastP[g] = p; if (p < yp) { yp = p; young = g; } }
      ysc = 0.07 * Math.exp(Math.max(yp, 0.05) * Math.log(Math.max(2, P.span))) + 0.25;
      const o3 = [0, 0, 0];
      for (let k = 0; k < NS; k++) for (let j = 0; j < SP; j++) {
        const i = k * SP + j, q = i * 3, u = j / (SP - 1), a = k * 2.39996 * 3 + spin * 0.6, h = (0.35 + 0.25 * ((k * 7) % 5) / 5) * ysc * 2.2, rr = Math.sin(u * 1.4) * 0.22 * ysc + 0.01;
        F.c[q] = Math.cos(a) * rr; F.c[q + 1] = Math.sin(a) * rr; F.c[q + 2] = u * h + 0.03 * Math.sin(t * 1.3 + k);
        F.I[i] = 0.08 + A.level * 0.22 + heart * 0.6 * (j / SP);
      }
      W.ay = 0.16 * Math.sin(t * 0.05); W.ax = -0.32 + 0.06 * Math.sin(t * 0.07);
      rotPts(F.c, F.n, 3, W.ay, W.ax);
    },
    uniforms(p) {
      for (let g = 0; g < G; g++) {
        const a = gen[g].a, b = gen[g].b;
        uSA0.set([a.k, a.sharp, a.depth, a.ruffle], g * 4); uSA1.set([a.twist, a.dir, a.cup, a.phase], g * 4);
        uSB0.set([a.k, b.sharp, b.depth, b.ruffle], g * 4); uSB1.set([b.twist, a.dir, b.cup, a.phase], g * 4); uPal[g] = b.pal;
      }
      gl.uniform1i(p.u('uG'), G); gl.uniform1i(p.u('uPER'), PER); gl.uniform1i(p.u('uNP'), NP); gl.uniform1i(p.u('uST0'), ST0); gl.uniform1i(p.u('uPO0'), PO0); gl.uniform1i(p.u('uYoung'), young);
      gl.uniform1f(p.u('uClock'), clock); gl.uniform1f(p.u('uSpin'), spin); gl.uniform1f(p.u('uHeart'), heart); gl.uniform1f(p.u('uRim'), rim);
      gl.uniform1f(p.u('uLogR'), Math.log(Math.max(2, P.span))); gl.uniform1f(p.u('uPS'), Math.sqrt(440 / PER) * 1.15); gl.uniform1f(p.u('uYsc'), ysc);
      gl.uniform4fv(p.u('uSA0[0]'), uSA0); gl.uniform4fv(p.u('uSA1[0]'), uSA1); gl.uniform4fv(p.u('uSB0[0]'), uSB0); gl.uniform4fv(p.u('uSB1[0]'), uSB1); gl.uniform1fv(p.u('uPal[0]'), uPal);
    }
  };
  return W;
}
