/* III. STORM — The supercell.
   Seen from the grass, looking up. A rotating deck of cloud feeds a tornado whose trunk is shoved around by big, slow 3D noise
   climbing from the ground into the cloud, so it never bends the same way twice. Debris fills the empty air around it: dust and
   litter spiral in along inflow bands, get sucked into the base and flung back out. Rain hangs off the deck in curtains.
   Lightning is the only real light, and it shows you how big the thing is. */
const STORM_GLSL = `
uniform int uF0, uSV0, uDB0, uRA0, uG0, uNSVper; uniform float uSpin, uFun, uWide, uWf, uWenv, uFling, uFlashI, uInflowT, uSpinD, uNSV;
uniform vec2 uCL[65]; uniform vec4 uBolt[5];
uniform vec3 uDk0, uDk1, uDk2, uFn0, uFn1, uDb0, uDb1, uRn, uGr;
vec2 cl(float u){ float f = clamp(u, 0.0, 1.0) * 64.0; int i = min(63, int(f)); return mix(uCL[i], uCL[i + 1], f - float(i)); }
float fr(float u){ return 0.035 + (0.7 + uWide * 0.35) * pow(u, 2.3) + p_baseWidth * 0.3 * exp(-u * 9.0) * (1.0 + uLow * 0.4); }
float gss(vec4 s){ return (s.x + s.y + s.z - 1.5) / 1.5; }
float bolts(vec3 x, float k){ float L = 0.0; for (int b = 0; b < 5; b++) { vec3 d = x - uBolt[b].xyz; L += uBolt[b].w * exp(-dot(d, d) * k); } return L; }
void particle(int i, vec4 s, inout vec3 p, inout float r, inout vec3 c, inout float e, inout float g){
  float t = uT;
  if (i < uF0) {
    // the cloud deck: two spiral arms in a slowly turning shelf
    float rr = 0.35 + 5.4 * pow(s.x, 0.75); bool arm = h1(i, 2) < 0.5;
    float a = arm ? (h1(i, 3) < 0.5 ? 0.0 : 3.14159) + log(rr) * 2.3 + gss(vec4(h1(i, 4), h1(i, 5), h1(i, 6), 0.0)) * 0.35 : s.y * TAU;
    a += uSpin * 0.3 / (rr + 0.4);
    float x = cos(a) * rr, z = sin(a) * rr * 0.85;
    float dy = gss(vec4(s.z, s.w, h1(i, 7), 0.0)) * 0.34 * (1.2 - rr / 6.0) - rr * rr * 0.018;
    float y = 1.15 + dy + fbm3(vec3(x * 0.7, z * 0.7, t * 0.07)) * 0.22 - exp(-rr * 1.6) * 0.25;
    p = vec3(x, y, z);
    float L = bolts(p, 0.9);
    g = h1(i, 8) < 0.22 ? 1.0 : 0.0;
    r = (g > 0.5 ? 0.025 + 0.035 * s.w : 0.004 + 0.006 * s.w * s.w) * (1.0 + L * 0.3);
    float k = h1(i, 9);
    c = arm ? (k < 0.3 ? uDk2 : k < 0.6 ? uDk1 : uDk0) : (k < 0.6 ? uDk0 : uDk1);
    e = (0.02 + L * 2.8 + uLow * 0.06 + (1.0 - rr / 5.8) * 0.05 + tw(s, t) * 0.08 + uFlashI * 0.3) * (g > 0.5 ? 0.35 : 1.0);
    return;
  }
  if (i < uSV0) {
    // the funnel: fine grain spinning around a snaking centreline
    float u = fract(s.x + uFun * (0.8 + 0.6 * s.w)), y = -1.85 + u * 2.95, R = fr(u) * (0.7 + 0.55 * s.z);
    float a = s.y * TAU + uSpin * (2.2 / (fr(u) + 0.18)) * 0.35;
    vec2 cc = cl(u);
    float wv = exp(-pow((u - uWf) / 0.08, 2.0)) * uWenv;
    g = h1(i, 2) < 0.06 ? 1.0 : 0.0;
    p = vec3(cc.x + cos(a) * R, y, cc.y + sin(a) * R);
    r = (g > 0.5 ? 0.006 + 0.007 * s.z : 0.0018 + 0.0024 * s.z) * p_psize * (0.7 + u * 0.6);
    c = mix(uFn0, uFn1, h1(i, 3));
    e = (0.05 + (1.0 - u) * 0.16 + wv * 1.5 + uMid * 0.12 + tw(s, t) * 0.2 + bolts(p, 1.4) * 1.4) * (g > 0.5 ? 0.4 : 1.0);
    return;
  }
  if (i < uDB0) {
    // satellite vortices orbiting the base
    int v = (i - uSV0) / max(1, uNSVper); if (float(v) >= uNSV) return;
    vec2 b0 = cl(0.0); float oa = uSpin * 0.9 + float(v) / uNSV * TAU, orb = p_baseWidth * 0.45;
    vec2 o = b0 + vec2(cos(oa), sin(oa)) * orb;
    float u = fract(s.x + t * 0.25), R = 0.02 + 0.15 * u * (1.0 + uLow * 0.5), a = s.y * TAU + uSpin * 6.0;
    p = vec3(o.x + cos(a) * R, -1.85 + u * (0.6 + 0.3 * sin(float(v) + t)), o.y + sin(a) * R);
    r = 0.0035 * p_psize + 0.0015; c = mix(uFn0, uDb0, s.z * 0.6); e = 0.2 + (1.0 - u) * 0.6 + uFling * 0.5;
    return;
  }
  if (i < uRA0) {
    // debris: the air around the funnel full of dust and litter, spiralling in along inflow bands and lifted at the base
    float rr = mix(0.35, 5.2, fract(s.x - uInflowT * (0.04 + 0.05 * s.y)));
    bool inb = s.z < 0.4;
    float a = inb ? (h1(i, 2) < 0.5 ? 0.0 : 3.14159) + log(rr) * 1.9 + (h1(i, 3) - 0.5) * 0.5 : s.w * TAU;
    a += uSpinD * (1.7 / (rr + 0.25));
    float suck = 1.0 - sm(0.35, 2.4, rr);
    float hb = pow(h1(i, 4), 2.2) * (inb ? 0.5 : 2.2) + suck * fract(h1(i, 5) * 7.0 + uInflowT * 0.35) * 2.6;
    float y = -1.86 + hb * (1.0 + uFling * 0.25 * h1(i, 6));
    vec2 cc = cl((y + 1.85) / 2.95) * (0.4 + 0.6 * suck);
    float fl = 1.0 + uFling * 0.5 * h1(i, 7) * (1.0 - suck);
    p = vec3(cc.x + cos(a) * rr * fl, y, cc.y + sin(a) * rr * 0.92 * fl);
    g = h1(i, 8) < 0.08 ? 1.0 : 0.0;
    r = g > 0.5 ? 0.01 + 0.014 * h1(i, 9) : 0.002 + 0.004 * pow(h1(i, 9), 2.0);
    c = h1(i, 10) < 0.6 ? uDb0 : h1(i, 10) < 0.9 ? uDb1 : C_gold;
    e = (0.12 + uFling * 1.2 + uHigh * 0.35 * s.y + suck * 0.25) * (g > 0.5 ? 0.5 : 1.0) + bolts(p, 0.8) * 1.6 + tw(s, t) * 0.2;
    return;
  }
  if (i < uG0) {
    // rain curtains hanging off the deck
    float sector = floor(s.y * 5.0) / 5.0 * TAU + uSpin * 0.04 + (s.y * 5.0 - floor(s.y * 5.0)) * 0.6;
    float rr = 1.3 + 3.8 * s.x, y = 1.0 - mod(s.z * 3.0 + t * (3.2 + uLevel * 2.0) * (0.8 + 0.4 * s.w), 2.95);
    p = vec3(cos(sector) * rr, y, sin(sector) * rr * 0.85);
    r = 0.0025; c = uRn; g = 1.0;
    e = p_rain * (0.15 + uHigh * 0.25 + uFlashI * 0.8) * sm(-1.85, -1.4, y);
    return;
  }
  float rr = 0.3 + 6.0 * sqrt(s.x), a = s.y * TAU;
  p = vec3(cos(a) * rr, -1.87, sin(a) * rr * 0.8);
  r = 0.004 + 0.004 * s.w; c = uGr;
  e = 0.03 + bolts(p, 0.6) * 1.6 + exp(-rr * 1.5) * 0.3 + tw(s, t) * 0.2;
}`;
// sky palettes: deck dark / mid / bright, funnel a / b, debris a / b, rain, ground
const STORM_PALS = [
  [[0.02, 0.03, 0.045], [0.05, 0.09, 0.085], [0.2, 0.27, 0.32], [0.16, 0.22, 0.26], [0.34, 0.42, 0.46], [0.3, 0.2, 0.1], [0.14, 0.16, 0.15], [0.25, 0.33, 0.42], [0.06, 0.09, 0.08]],
  [PAL.indigo, PAL.violet, PAL.pearl, PAL.pearl, PAL.violet, PAL.amber, PAL.gold, mixC(PAL.azure, PAL.pearl, 0.5), mixC(PAL.indigo, PAL.azure, 0.5)],
  [mixC(PAL.indigo, [0, 0, 0], 0.5), PAL.indigo, mixC(PAL.azure, PAL.pearl, 0.5), mixC(PAL.cyan, PAL.pearl, 0.6), PAL.azure, mixC(PAL.azure, PAL.pearl, 0.3), PAL.cyan, PAL.azure, mixC(PAL.indigo, PAL.azure, 0.3)]
];
function makeStorm(P) {
  const ND = cnt(26000, P, P.deck), NF = cnt(26000, P, P.funnel), NSV = cnt(9000, P), NDB = cnt(24000, P, P.debris), NR = cnt(9000, P), NG = cnt(6000, P);
  const F0 = ND, SV0 = F0 + NF, DB0 = SV0 + NSV, RA0 = DB0 + NDB, G0 = RA0 + NR, N = Math.min(CAP, G0 + NG);
  const HL = 12, HP = 120, AR = 2, AP = 160;
  const F = new Fil(HL * HP + AR * AP);
  for (let k = 0; k < HL; k++) F.poly(HP, k / HL, 0.0025, false);
  const AR0 = F.n; for (let k = 0; k < AR; k++) F.poly(AP, k / AR, 0.004, false);
  const BS = 5, bolts = [], bAge = new Float32Array(BS).fill(99), bStr = new Float32Array(BS), bPos = new Float32Array(BS * 3);
  for (let k = 0; k < BS; k++) { const b = new Fil(800); b.grow = 0; bolts.push(b); }
  const br = rngFrom(4242);
  let spin = 0, spinD = 0, fun = 0, last = 0, flashI = 0, wide = 0, waveAge = 9, waveStr = 0, fling = 0, climbT = 0, strikeAcc = 0, inflowT = 0;
  const CLN = 64, uCL = new Float32Array((CLN + 1) * 2), uBolt = new Float32Array(20);
  const fy = u => -1.85 + u * 2.95;
  const fr = u => 0.035 + (0.7 + wide * 0.35) * Math.pow(u, 2.3) + P.baseWidth * 0.3 * Math.exp(-u * 9) * (1 + A.low * 0.4);
  const cl = (u, o) => { const f = clamp(u, 0, 1) * CLN, i = Math.min(CLN - 1, Math.floor(f)), a = f - i; o[0] = lerp(uCL[i * 2], uCL[i * 2 + 2], a); o[1] = lerp(uCL[i * 2 + 1], uCL[i * 2 + 3], a); return o; };
  const c2 = [0, 0], pal = STORM_PALS[0].map(c => c.slice());
  function strike(s) {
    const k = oldest(bAge);
    const a = Math.random() * TAU, rr = 0.6 + Math.random() * 3.2, x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.8, y = 0.95;
    const toGround = Math.random() < 0.65;
    const end = toGround ? [x + (Math.random() - 0.5) * 1.2, -1.85, z + (Math.random() - 0.5) * 0.6] : [x + Math.cos(a + 1.6) * 2.2, 1.0 + (Math.random() - 0.5) * 0.2, z + Math.sin(a + 1.6) * 1.8];
    makeBolt(bolts[k], [x, y, z], end, toGround ? 0.014 : 0.008, br, { rough: toGround ? 0.22 : 0.3, branch: toGround ? 0.14 : 0.2, levels: 2 });
    bolts[k].paint(() => mixC(PAL.white, PAL.cyan, 0.2));
    bAge[k] = 0; bStr[k] = s; bPos[k * 3] = x; bPos[k * 3 + 1] = y; bPos[k * 3 + 2] = z; last = k; flashI = Math.max(flashI, s);
  }
  const W = {
    n: N, name: 'STORM', blurb: 'The supercell touches down', tint: PAL.indigo, flash: PAL.white, coreLight: PAL.cyan, coreGain: 0.6, coreLocal: [0, 0.8, 0],
    wisps: [PAL.cyan, PAL.violet, PAL.pearl], fils: [F, ...bolts], lines: [], ay: 0, ax: 0, dofMul: 0.45,
    cam0: { tx: 0, ty: 0.3, tz: 0, dist: 4.0, h: 0, p: 11.5, b: 0, f: 24 },
    prog: progFor('STORM', 'STORM', STORM_GLSL),
    onset(kind, s) {
      if (kind === 'kick' || kind === 'touch') { waveAge = 0; waveStr = s; strikeAcc += s * P.lightning; if (strikeAcc > 0.6) { strikeAcc = 0; strike(Math.max(s, 0.6)); } fling = Math.max(fling, s * 0.4); }
      else if (kind === 'snare' && Math.random() < 0.45 * P.lightning) strike(s * 0.8);
      else if (kind === 'hat') fling = Math.max(fling, s);
      else if (kind === 'idle' && Math.random() < 0.4 * P.lightning) strike(0.4);
    },
    update(dt, t) {
      const sp = 1 + A.level * 1.6 + A.presence * 0.5;
      spin += dt * sp; spinD += dt * (0.8 + A.low * 1.2) * P.debrisSpin; inflowT += dt * P.inflow * (0.6 + A.level);
      fun += dt * (0.045 + 0.04 * A.level);
      climbT += dt * 0.32 * P.climb * (1 + A.level * 0.8);
      wide = lerp(wide, A.low * 0.9 + A.presence * 0.3, 1 - Math.exp(-dt * 2));
      waveAge += dt; fling *= Math.exp(-dt * 2); flashI *= Math.exp(-dt * 4);
      const amp = P.noiseAmt * (1 + A.low * 0.7 * P.stir), sc = P.noiseScale;
      for (let j = 0; j <= CLN; j++) {
        const u = j / CLN, ph = u * 2.1 * sc - climbT, env = smooth(0, 0.25, u) * (1 - 0.2 * u) * amp;
        uCL[j * 2] = (noise3(ph, 1.7, 3.1) * 0.95 + noise3(ph * 2.3, 5.2, 7.7 + climbT * 0.2) * 0.4) * env;
        uCL[j * 2 + 1] = (noise3(ph, 11.3, 2.2) * 0.95 + noise3(ph * 2.3, 13.7, 4.4 - climbT * 0.2) * 0.4) * env;
      }
      for (let k = 0; k < BS; k++) {
        bAge[k] += dt; const B = bolts[k], age = bAge[k];
        const env = age > 1.2 ? 0 : (age < 0.06 ? 1.9 : 1.9 * Math.exp(-(age - 0.06) * 5)) * (age < 0.45 && Math.random() < 0.22 ? 0.25 : 1) * bStr[k];
        for (let i = 0; i < B.n; i++) B.I[i] = env * (B.lv[i] === 0 ? 1 : B.lv[i] === 1 ? 0.55 : 0.3);
        B.grow = clamp(age / 0.09, 0, 1);
        uBolt[k * 4] = bPos[k * 3]; uBolt[k * 4 + 1] = bPos[k * 3 + 1]; uBolt[k * 4 + 2] = bPos[k * 3 + 2]; uBolt[k * 4 + 3] = age < 1 ? bStr[k] * Math.exp(-age * 3.5) : 0;
      }
      W.coreLocal = [bPos[last * 3], bPos[last * 3 + 1] - 0.3, bPos[last * 3 + 2]];
      W.coreGain = 0.4 + flashI * 3.5;
      const target = STORM_PALS[clamp(Math.round(P.palette), 0, 2)], kk = 1 - Math.exp(-dt * 1.5);
      for (let a = 0; a < pal.length; a++) for (let ch = 0; ch < 3; ch++) pal[a][ch] += (target[a][ch] - pal[a][ch]) * kk;
      W.tint = mixC(pal[1], PAL.indigo, 0.4);
      const wf = waveAge * 1.6, wenv = waveStr * Math.exp(-waveAge * 0.5);
      for (let k = 0; k < HL; k++) for (let j = 0; j < HP; j++) {
        const i = k * HP + j, q = i * 3, u = j / (HP - 1), R = fr(u) * 0.95, a = k / HL * TAU + spin * (2.2 / (fr(u) + 0.18)) * 0.35 + u * 4;
        cl(u, c2);
        F.c[q] = c2[0] + Math.cos(a) * R; F.c[q + 1] = fy(u); F.c[q + 2] = c2[1] + Math.sin(a) * R;
        F.I[i] = 0.035 + 0.08 * (1 - u) + Math.exp(-(((u - wf) / 0.07) ** 2)) * wenv * 1.1 + flashI * 0.1;
        setCol(F.col, i, mixC(pal[3], pal[4], u));
      }
      for (let k = 0; k < AR; k++) for (let j = 0; j < AP; j++) {
        const i = AR0 + k * AP + j, q = i * 3, r = 0.35 + j / (AP - 1) * 5.0, a = k * Math.PI + Math.log(r) * 2.3 + spin * 0.3 / (r + 0.4);
        F.c[q] = Math.cos(a) * r; F.c[q + 1] = 1.12 - r * r * 0.018; F.c[q + 2] = Math.sin(a) * r * 0.85;
        F.I[i] = (0.04 + A.low * 0.06) * (1 - j / AP) + flashI * 0.25;
        setCol(F.col, i, mixC(pal[2], pal[1], j / AP));
      }
      W.ay = t * 0.025; W.ax = 0.05 + 0.03 * Math.sin(t * 0.05);
      rotPts(F.c, F.n, 3, W.ay, W.ax);
      for (const B of bolts) { B.c.set(B.p.subarray(0, B.n * 3)); rotPts(B.c, B.n, 3, W.ay, W.ax); }
      W._wf = wf; W._wenv = wenv;
    },
    uniforms(p) {
      gl.uniform1i(p.u('uF0'), F0); gl.uniform1i(p.u('uSV0'), SV0); gl.uniform1i(p.u('uDB0'), DB0); gl.uniform1i(p.u('uRA0'), RA0); gl.uniform1i(p.u('uG0'), G0);
      gl.uniform1i(p.u('uNSVper'), Math.floor(NSV / 6)); gl.uniform1f(p.u('uNSV'), Math.round(P.subVort));
      gl.uniform1f(p.u('uSpin'), spin); gl.uniform1f(p.u('uFun'), fun); gl.uniform1f(p.u('uWide'), wide); gl.uniform1f(p.u('uWf'), W._wf || 0); gl.uniform1f(p.u('uWenv'), W._wenv || 0);
      gl.uniform1f(p.u('uFling'), fling); gl.uniform1f(p.u('uFlashI'), flashI); gl.uniform1f(p.u('uInflowT'), inflowT); gl.uniform1f(p.u('uSpinD'), spinD);
      gl.uniform2fv(p.u('uCL[0]'), uCL); gl.uniform4fv(p.u('uBolt[0]'), uBolt);
      ['uDk0', 'uDk1', 'uDk2', 'uFn0', 'uFn1', 'uDb0', 'uDb1', 'uRn', 'uGr'].forEach((n, k) => gl.uniform3fv(p.u(n), pal[k]));
    }
  };
  return W;
}
