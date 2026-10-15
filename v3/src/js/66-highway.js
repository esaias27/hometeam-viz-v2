/* VII. HIGHWAY — The drive home.
   A tunnel of light rings rushing past with the city sliding by on both sides. The car surges and coasts on its own; the
   music pushes the throttle, and every bass hit sends a bulge of displacement rolling down the tunnel through the rings. */
const HW_SHARED = `
uniform int uNR, uRPn; uniform float uZoff, uRoll; uniform vec2 uRip[10]; uniform vec4 uRF[40];
const float ZMIN = -36.0, ZMAX = 7.8;
float fadeZ(float z){ return sm(ZMIN, ZMIN + 9.0, z) * (1.0 - sm(5.6, ZMAX, z)); }
vec2 center(float z){ float k = sm(-8.0, 6.0, z), cv = p_curve, t = uT; return vec2((sin(z * 0.11 + t * 0.18) - sin(0.66 + t * 0.18)) * 1.2 * cv * (1.0 - k * 0.85), (cos(z * 0.08 + t * 0.13) - cos(0.48 + t * 0.13)) * 0.6 * cv * (1.0 - k * 0.85)); }
float bulge(float z){ float b = 0.0; for (int k = 0; k < 10; k++) { float age = uRip[k].x; if (age > 6.0) continue; float zr = ZMAX - 2.0 - age * p_rspeed, x = (z - zr) / p_wavelen; if (x > -3.0 && x < 3.0) b += uRip[k].y * exp(-x * x) * exp(-age * p_rdecay); } return b * p_ripple; }
float ringZ(int k){ float L = ZMAX - ZMIN; return ZMIN + mod(float(k) * (L / float(uNR)) + uZoff, L); }
float ringFlash(int k){ vec4 q = uRF[k / 4]; int m = k - (k / 4) * 4; return m == 0 ? q.x : m == 1 ? q.y : m == 2 ? q.z : q.w; }
vec3 ringPt(int k, int j, out float I, out float b, out float bg, out float fz){
  float z = ringZ(k); fz = fadeZ(z); b = uB[k % 16]; bg = bulge(z);
  vec2 c = center(z); float fl = ringFlash(k);
  float R = p_radius + 0.3 * sin(z * 0.25 + uT * 0.5) + b * 0.55 + fl * 0.25 + bg * 0.8;
  float a = float(j) / float(uRPn) * TAU + float(k) * 0.21 + uRoll;
  I = (0.12 + b * 0.8 + fl * 1.3 + bg * 1.2) * fz;
  return vec3(c.x + cos(a) * R, c.y + sin(a) * R * 0.8, z);
}
vec3 ringCol(int k){ return g4(C_violet, C_pink, C_cyan, C_azure, fract(float(k) * 0.137)); }`;
const HW_LINE = `
${HW_SHARED}
void seg(int id, out vec3 A, out vec3 B, out float wA, out float wB, out vec4 cA, out vec4 cB){
  int k = id / uRPn, j = id - k * uRPn;
  float I, b, bg, fz, I2, b2, bg2, fz2;
  A = ringPt(k, j, I, b, bg, fz); B = ringPt(k, (j + 1) % uRPn, I2, b2, bg2, fz2);
  float fl = ringFlash(k), L = (0.07 + b * 0.45 + fl + bg * 0.8) * fz;
  wA = wB = 0.003; vec3 c = ringCol(k); cA = vec4(c, L); cB = vec4(c, L);
}`;
const HW_GLSL = `
${HW_SHARED}
uniform int uLANE0, uTL0, uSK0, uCT0; uniform float uLow2;
void particle(int i, vec4 s, inout vec3 p, inout float r, inout vec3 c, inout float e, inout float g){
  float t = uT, L = ZMAX - ZMIN;
  if (i < uLANE0) {
    int k = i / uRPn, j = i - k * uRPn; float I, b, bg, fz;
    p = ringPt(k, j, I, b, bg, fz);
    r = fz > 0.02 ? 0.013 * (1.0 + b * 0.4 + bg * 0.6) : 0.0; c = ringCol(k); e = I + tw(s, t) * 0.2 * fz;
    return;
  }
  if (i < uTL0) {
    int j = i - uLANE0, n = (uTL0 - uLANE0) / 2; float side = j % 2 == 1 ? 1.0 : -1.0; int m = j / 2;
    float z = ZMIN + mod(float(m) / float(max(1, n)) * L + uZoff, L), fz = fadeZ(z); vec2 cc = center(z);
    p = vec3(cc.x + side * 0.7, cc.y - 1.15 + bulge(z) * 0.2, z);
    r = 0.01 * fz * ((m % 4) < 2 ? 1.0 : 0.0); c = C_gold; e = 0.6 * fz + uLow * 0.3;
    return;
  }
  if (i < uSK0) {
    int j = i - uTL0, car = j / 2; float side = j % 2 == 1 ? 0.1 : -0.1;
    float z = -26.0 + float(car % 24) * 0.9 + sin(t * 0.2 + float(car)) * 1.2; vec2 cc = center(z);
    float lane = car < 24 ? -0.35 : 0.35;
    p = vec3(cc.x + lane + side, cc.y - 1.0, z); r = 0.02 * fadeZ(z); c = C_red; e = 0.9 + uLow * 0.6;
    return;
  }
  if (i < uCT0) {
    float z = ZMIN + mod(s.x * L + uZoff * 1.8, L), fz = fadeZ(z); vec2 cc = center(z);
    float a = s.y * TAU, rr = (0.6 + 0.8 * s.z) * p_radius / 1.6 + bulge(z) * 0.4;
    p = vec3(cc.x + cos(a) * rr, cc.y + sin(a) * rr, z); r = fz > 0.02 ? 0.006 : 0.0;
    c = s.z < 0.5 ? C_pearl : C_cyan; e = (0.35 + uLevel * 0.8) * fz; g = 1.0;
    return;
  }
  // the city sliding past on both sides
  float z = ZMIN + mod(s.x * L + uZoff * 0.55, L), fz = fadeZ(z); vec2 cc = center(z);
  float side = s.y < 0.5 ? -1.0 : 1.0, d = 3.2 + 9.0 * pow(h1(i, 2), 1.5);
  float bx = floor(z * 0.6 + s.y * 40.0), hgt = 0.5 + 4.5 * h1(int(bx) + int(side * 50.0), 3);
  p = vec3(cc.x + side * d, -1.4 + s.z * hgt, z);
  r = 0.0045 + 0.004 * s.w; c = s.w < 0.5 ? C_amber : s.w < 0.75 ? C_azure : C_pearl;
  e = (0.25 + tw(s, t) * 0.6 + uLevel * 0.2) * fz * (h1(i, 4) < 0.7 ? 1.0 : 0.2);
}`;
function makeHighway(P) {
  const NR = Math.round(P.rings), RP = Math.max(8, Math.round(P.ringPts * Math.min(1, 0.5 + S.detail * 0.5))), RG = NR * RP;
  const NLANE = cnt(1200, P), NTL = 96, NSTREAK = cnt(14000, P, P.streaks), NCITY = cnt(16000, P);
  const LANE0 = RG, TL0 = LANE0 + NLANE, SK0 = TL0 + NTL, CT0 = SK0 + NSTREAK, N = Math.min(CAP, CT0 + NCITY);
  const flash = new Float32Array(160), RIP = 10, rip = new Float32Array(RIP * 2);
  for (let k = 0; k < RIP; k++) rip[k * 2] = 99;
  let zoff = 0, boost = 0, roll = 0, lowPrev = 0, ripCool = 0;
  const ZMIN = -36, ZMAX = 7.8, LEN = ZMAX - ZMIN;
  function ripple(s) { let k = 0; for (let j = 1; j < RIP; j++) if (rip[j * 2] > rip[k * 2]) k = j; rip[k * 2] = 0; rip[k * 2 + 1] = s; }
  const shared = p => {
    gl.uniform1i(p.u('uNR'), NR); gl.uniform1i(p.u('uRPn'), RP); gl.uniform1f(p.u('uZoff'), zoff); gl.uniform1f(p.u('uRoll'), roll);
    gl.uniform2fv(p.u('uRip[0]'), rip); gl.uniform4fv(p.u('uRF[0]'), flash);
  };
  const W = {
    n: N, name: 'HIGHWAY', blurb: 'The drive home', tint: PAL.violet, flash: PAL.white, coreLight: PAL.cyan, coreGain: 1.1, coreLocal: [0, 0, -3],
    wisps: [PAL.cyan, PAL.pink, PAL.gold], fils: [], ay: 0, ax: 0, dofMul: 0.2, swayMul: 0.05, driftMul: 0.15,
    cam0: { tx: 0, ty: 0, tz: 0, dist: 8.6, h: 0, p: 0, b: 0, f: 45 },
    prog: progFor('HIGHWAY', 'HIGHWAY', HW_GLSL),
    lines: [{ prog: progFor('HIGHWAY_L', 'HIGHWAY', HW_LINE, true), count: RG, uniforms: p => shared(p) }],
    onset(kind, s) {
      if (kind === 'kick' || kind === 'touch') { boost = Math.min(2, boost + s * 0.6); ripple(s); }
      let best = 0, bd = 99; for (let k = 0; k < NR; k++) { const z = wrap(ZMIN + k * (LEN / NR) + zoff, ZMIN, ZMAX), d = Math.abs(z + 7); if (d < bd) { bd = d; best = k; } }
      flash[best] = Math.max(flash[best], kind === 'hat' ? s * 0.5 : s);
    },
    update(dt, t) {
      boost *= Math.exp(-dt * 1.8); ripCool -= dt;
      if (A.low - lowPrev > 0.12 && A.low > 0.45 && ripCool <= 0) { ripple(A.low); ripCool = 0.18; }
      lowPrev = follow(lowPrev, A.low, dt, 0.08, 0.08);
      for (let k = 0; k < RIP; k++) rip[k * 2] += dt;
      const vary = 1 + P.variance * 1.4 * noise3(t * P.varRate, 0.5, 9.1);
      zoff += dt * Math.max(0.05, P.drive * vary) * (1.8 + A.level * 6 + boost * 4); roll += dt * P.roll * 0.5;
      for (let k = 0; k < NR; k++) flash[k] *= Math.exp(-dt * 2.2);
      W.ay = 0.06 * Math.sin(t * 0.03); W.ax = 0.04 * Math.sin(t * 0.04);
    },
    uniforms(p) { shared(p); gl.uniform1i(p.u('uLANE0'), LANE0); gl.uniform1i(p.u('uTL0'), TL0); gl.uniform1i(p.u('uSK0'), SK0); gl.uniform1i(p.u('uCT0'), CT0); }
  };
  return W;
}

const FACTORIES = [makeTower, makeLot, makeStorm, makeReef, makeBloom, makeTide, makeHighway];
const NAMES = ['TOWER', 'LOT', 'STORM', 'REEF', 'BLOOM', 'TIDE', 'HIGHWAY'];
