/* ================================================================== */
/* Worlds                                                              */
/* ================================================================== */
// Each world: a GLSL particle function, CPU logic for hits and filaments, and a default camera.
const PROGS = {};
const progFor = (key, name, src, line) => PROGS[key] || (PROGS[key] = line ? lineProgram(name, src) : worldProgram(name, src));
const oldest = a => { let k = 0; for (let j = 1; j < a.length; j++) if (a[j] > a[k]) k = j; return k; };

/* I. TOWER — The transmitter.
   The tower is the HOME TEAM logo in thousands of holographic pearls. Every height of the spine is a band of the spectrum:
   bass pulses leave the base, treble leaves the antenna. Each pulse is a ring of light that expands outward and toward you,
   sweeping past the lens. Kicks fire a full spherical shell from the antenna that passes through the camera. */
const TOWER_GLSL = `
uniform int uRP, uSH0, uNSH, uR0, uSP0, uST0;
uniform vec4 uRing[48], uRing2[48]; uniform vec2 uShell[2], uGnd[6];
uniform vec3 uTip; uniform float uFlash;
vec3 ringCol(float g){ return g5(C_pink, C_magenta, C_violet, C_azure, C_cyan, 1.0 - g / 7.0); }
void particle(int i, vec4 s, inout vec3 p, inout float r, inout vec3 c, inout float e, inout float g){
  float t = uT;
  if (i < uSH0) {
    int k = i / uRP, j = i - k * uRP;
    vec4 R = uRing[k], R2 = uRing2[k]; float age = R.x;
    if (age >= p_life) return;
    float fade = sm(0.0, 0.08, age) * pow(1.0 - age / p_life, 1.3);
    float rad = 0.18 + age * p_expand * (1.0 + R.w * 0.05), zc = age * p_toward * 0.9, en = R.z * fade * exp(-rad * 0.1);
    float a = float(j) / float(uRP) * TAU + R2.x + (s.x - 0.5) * 0.04, rj = rad * (0.93 + 0.14 * s.y);
    float y = R.y + (s.z - 0.5) * p_thick * 0.3 * (1.0 + age * 0.6) + sin(a + R2.x) * p_tilt * R2.y * rad * 0.22;
    p = vec3(cos(a) * rj, y, sin(a) * rj + zc);
    r = (0.0055 + 0.005 * s.w) * (1.0 + age * 0.25);
    c = ringCol(R.w);
    e = en * (0.8 + 1.8 * band((R.w + 0.5) / 8.0)) + en * tw(s, t) * 0.8;
    return;
  }
  if (i < uR0) {
    int per = max(1, uNSH / 2), k = (i - uSH0) / per, j = i - uSH0 - k * per;
    if (k > 1) return;
    vec2 sh = uShell[k]; if (sh.x > 3.0) return;
    float R = sh.x * 3.2 * p_expand * 0.7, en = sh.y * exp(-sh.x * 0.7) * sm(0.0, 0.05, sh.x);
    vec3 d = fib(j, per, float(k));
    p = uTip + vec3(d.x * R, d.y * R * 0.8, d.z * R + sh.x * p_toward * 0.6);
    r = 0.006 + 0.003 * s.y; c = mix(C_pearl, C_cyan, s.x * 0.5); e = en * (0.8 + tw(s, t));
    return;
  }
  if (i < uSP0) {
    // the receiving field: a disc of pearls the ground rings roll through
    float rr = 0.9 + 4.6 * sqrt(s.x), a = s.y * TAU + t * 0.01, re = 0.0;
    for (int k = 0; k < 6; k++) { float age = uGnd[k].x; if (age > 6.0) continue; float R = 0.45 + age * 2.3, x = (rr - R) / 0.2; if (x > -3.0 && x < 3.0) re += uGnd[k].y * exp(-x * x) * exp(-age * 0.5); }
    float bv = band(fract(a / TAU));
    p = vec3(cos(a) * rr, -1.8 + re * 0.13 + bv * 0.04 + (s.w - 0.5) * 0.02, sin(a) * rr - 0.4);
    r = (0.0045 + 0.004 * s.w) * (1.0 + re * 0.6);
    c = s.z > 0.95 ? C_gold : mix(C_azure, C_pearl, s.z * 0.5);
    e = 0.04 + re * 1.6 + bv * 0.25 + tw(s, t) * 0.4;
    return;
  }
  if (i < uST0) {
    float u = fract(s.x + t * (0.05 + 0.08 * s.y) * (1.0 + uLevel)), a = s.z * TAU + t * (0.6 + s.w), rr = 0.05 + u * 0.9;
    p = uTip + vec3(cos(a) * rr, u * 1.6 - 0.1, sin(a) * rr * 0.6);
    r = 0.007 * (1.0 - u); c = s.z < 0.5 ? C_cyan : C_pink; e = (1.0 - u) * (0.6 + uHigh * 0.8 + uFlash); g = 1.0;
    return;
  }
  p = vec3((s.x - 0.5) * 14.0, 2.4 + s.y * 3.0, -6.0 + s.z * 3.0);
  r = 0.005; c = C_pearl; e = 0.05 + tw(s, t) * 0.8; g = 1.0;
}`;
function makeTower(P) {
  const Hh = 3.2, Y0 = 0.1;
  const RK = Math.round(P.rings), RPn = Math.round(P.ringPts * S.detail * P.density) || 1, NRING = RK * RPn;
  const NSH = cnt(9000, P), NREC = cnt(9000, P), NSP = cnt(1500, P), NST = cnt(1500, P);
  const SH0 = NRING, R0 = SH0 + NSH, SP0 = R0 + NREC, ST0 = SP0 + NSP, N = Math.min(CAP, ST0 + NST);
  const tipE = svgToE(451, 158), tip = [tipE[0] * Hh, tipE[1] * Hh + Y0, 0];
  const baseY = svgToE(451, 600)[1] * Hh + Y0;
  const RS = 6, RP = 160, AS = 6, AP = 48;
  const F = new Fil(RS * RP + AS * 2 * AP);
  for (let k = 0; k < RS; k++) F.poly(RP, k / RS, 0.0035, true);
  const A0 = F.n; for (let k = 0; k < AS * 2; k++) F.poly(AP, k / AS, 0.005, false);
  for (let i = 0; i < F.n; i++) setCol(F.col, i, i < A0 ? mixC(PAL.cyan, PAL.pearl, 0.4) : mixC(PAL.pink, PAL.pearl, 0.3));
  const BS = 4, bolts = [], bAge = new Float32Array(BS).fill(99), bStr = new Float32Array(BS);
  for (let k = 0; k < BS; k++) { const b = new Fil(700); b.grow = 0; bolts.push(b); }
  const gAge = new Float32Array(RS).fill(99), gStr = new Float32Array(RS), arcAge = new Float32Array(AS).fill(99), arcStr = new Float32Array(AS);
  const pAge = new Float32Array(Math.max(1, RK)).fill(99), pY = new Float32Array(RK), pStr = new Float32Array(RK), pG = new Float32Array(RK), pPh = new Float32Array(RK), pTl = new Float32Array(RK);
  const acc = new Float32Array(8), shAge = [99, 99], shStr = [0, 0];
  const uRing = new Float32Array(48 * 4), uRing2 = new Float32Array(48 * 4), uShell = new Float32Array(4), uGnd = new Float32Array(12);
  const br = rngFrom(606);
  let flash = 0;
  function ring(g, s) {
    if (!RK) return;
    const k = oldest(pAge); pAge[k] = 0; pStr[k] = s; pG[k] = g;
    pY[k] = lerp(baseY, tip[1], (g + 0.5) / 8) + (Math.random() - 0.5) * 0.12; pPh[k] = Math.random() * TAU; pTl[k] = (Math.random() - 0.5) * 2;
  }
  function bolt(s) {
    const k = oldest(bAge); bAge[k] = 0; bStr[k] = s;
    const side = Math.random() < 0.5 ? -1 : 1, ang = side < 0 ? Math.PI - 0.15 - Math.random() * 0.9 : 0.15 + Math.random() * 0.9, L = 1.3 + Math.random() * 1.2;
    makeBolt(bolts[k], [tip[0] + side * 0.12, tip[1] + 0.05, 0], [tip[0] + Math.cos(ang) * L, tip[1] + Math.sin(ang) * L * 0.55 - 0.2, (Math.random() - 0.5) * 0.8], 0.009, br, { rough: 0.24, branch: 0.16, levels: 2 });
    bolts[k].paint(() => mixC(PAL.white, PAL.cyan, 0.25));
    flash = Math.max(flash, s);
  }
  const W = {
    n: N, name: 'TOWER', blurb: 'The transmitter', tint: PAL.violet, flash: PAL.white, coreLight: PAL.pink, coreGain: 1.1, coreLocal: tip,
    wisps: [PAL.cyan, PAL.pink, PAL.gold], fils: [F, ...bolts], lines: [], ay: 0, ax: 0,
    cam0: { tx: 0, ty: 0.05, tz: 0, dist: 8.6, h: 0, p: -4, b: 0, f: 45 },
    prog: progFor('TOWER', 'TOWER', TOWER_GLSL),
    logoXf: { sz: Hh, y0: Y0, z0: 0, follow: true, tip },
    get tipFlash() { return flash; },
    onset(kind, s) {
      if (kind === 'kick' || kind === 'touch' || kind === 'idle') {
        const k = oldest(gAge); gAge[k] = 0; gStr[k] = kind === 'idle' ? 0.35 : s; flash = Math.max(flash, s * 0.5);
        ring(0, s); ring(1, s * 0.8);
        if (kind !== 'idle' && P.shell > 0.01) { const j = shAge[0] > shAge[1] ? 0 : 1; shAge[j] = 0; shStr[j] = s * P.shell; }
      } else if (kind === 'snare') { const k = oldest(arcAge); arcAge[k] = 0; arcStr[k] = s; ring(3 + (Math.random() * 2 | 0), s); }
      else if (kind === 'hat') { ring(6 + (Math.random() * 2 | 0), s * 0.8); if (Math.random() < 0.4 * P.bolts) bolt(s); }
      if (kind === 'kick' && s > 0.95 && Math.random() < P.bolts) bolt(s);
    },
    update(dt, t) {
      for (let k = 0; k < RS; k++) gAge[k] += dt;
      for (let k = 0; k < AS; k++) arcAge[k] += dt;
      for (let k = 0; k < RK; k++) pAge[k] += dt;
      shAge[0] += dt; shAge[1] += dt;
      flash *= Math.exp(-dt * 3);
      for (let g = 0; g < 8; g++) {
        const bv = (A.bands[g * 2] + A.bands[g * 2 + 1]) * 0.5;
        acc[g] += dt * P.pulseRate * (0.12 + bv * bv * 3.2);
        if (acc[g] >= 1) { acc[g] = 0; ring(g, 0.35 + bv * 0.9); }
      }
      for (let k = 0; k < BS; k++) {
        bAge[k] += dt; const B = bolts[k], age = bAge[k];
        const env = age > 1 ? 0 : (age < 0.05 ? 1.7 : 1.7 * Math.exp(-(age - 0.05) * 6.5)) * (age < 0.35 && Math.random() < 0.25 ? 0.3 : 1) * bStr[k];
        for (let i = 0; i < B.n; i++) B.I[i] = env * (B.lv[i] === 0 ? 1 : B.lv[i] === 1 ? 0.6 : 0.35);
        B.grow = clamp(age / 0.07, 0, 1);
      }
      W.ay = 0.45 * Math.sin(t * 0.055); W.ax = 0.06 + 0.05 * Math.sin(t * 0.07);
      for (let k = 0; k < RS; k++) {
        const R = 0.45 + gAge[k] * 2.3, I = gAge[k] > 6 ? 0 : gStr[k] * Math.exp(-gAge[k] * 0.5) * 0.75;
        for (let j = 0; j < RP; j++) { const i = k * RP + j, q = i * 3, a = j / RP * TAU; F.c[q] = Math.cos(a) * R; F.c[q + 1] = -1.79; F.c[q + 2] = Math.sin(a) * R - 0.4; F.I[i] = I; }
      }
      for (let k = 0; k < AS; k++) for (let side = 0; side < 2; side++) {
        const age = arcAge[k], R = 0.22 + age * 1.5, I = age > 4 ? 0 : arcStr[k] * Math.exp(-age * 1.3) * Math.min(1, age / 0.04) * 1.1;
        for (let j = 0; j < AP; j++) {
          const i = A0 + (k * 2 + side) * AP + j, q = i * 3, a = (j / (AP - 1) - 0.5) * 1.6;
          F.c[q] = tip[0] + (side ? -1 : 1) * Math.cos(a) * R; F.c[q + 1] = tip[1] + Math.sin(a) * R; F.c[q + 2] = 0;
          F.I[i] = I * (0.55 + 0.45 * Math.cos(a * 1.9));
        }
      }
      rotPts(F.c, F.n, 3, W.ay, W.ax);
      for (const B of bolts) { B.c.set(B.p.subarray(0, B.n * 3)); rotPts(B.c, B.n, 3, W.ay, W.ax); }
    },
    uniforms(p) {
      for (let k = 0; k < Math.min(48, RK); k++) { uRing[k * 4] = pAge[k]; uRing[k * 4 + 1] = pY[k]; uRing[k * 4 + 2] = pStr[k]; uRing[k * 4 + 3] = pG[k]; uRing2[k * 4] = pPh[k]; uRing2[k * 4 + 1] = pTl[k]; }
      uShell[0] = shAge[0]; uShell[1] = shStr[0]; uShell[2] = shAge[1]; uShell[3] = shStr[1];
      for (let k = 0; k < RS; k++) { uGnd[k * 2] = gAge[k]; uGnd[k * 2 + 1] = gStr[k]; }
      gl.uniform1i(p.u('uRP'), RPn); gl.uniform1i(p.u('uSH0'), SH0); gl.uniform1i(p.u('uNSH'), NSH); gl.uniform1i(p.u('uR0'), R0);
      gl.uniform1i(p.u('uSP0'), SP0); gl.uniform1i(p.u('uST0'), ST0);
      gl.uniform4fv(p.u('uRing[0]'), uRing); gl.uniform4fv(p.u('uRing2[0]'), uRing2); gl.uniform2fv(p.u('uShell[0]'), uShell); gl.uniform2fv(p.u('uGnd[0]'), uGnd);
      gl.uniform3fv(p.u('uTip'), tip); gl.uniform1f(p.u('uFlash'), flash);
    }
  };
  return W;
}
