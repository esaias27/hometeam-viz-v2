/* II. LOT — The show the sky puts on.
   An endless crowd of phone lights under thousands of lanterns and sweeping searchlights. Mortars streak up from behind the
   crowd and break into peonies, chrysanthemums, willows, palms, rings, hearts, strobes, crossettes, crackle and kamuro.
   When the music builds and drops, the lot answers with a finale: volleys of shells, every lantern let go, searchlights lock
   on and strobe, and the camera cranes up. The sparks are simulated on the GPU. */
const FWS = 256, FWCAP = FWS * FWS;
const FW_PAL = '0.55,0.09,0.69, 0.05,0.89,1.0, 1.0,0.55,0.15, 0.33,0.11,1.0, 0.48,1.0,0.1, 1.0,0.03,0.05, 1.0,0.93,0.84, 0.1,0.26,1.0, 1.0,0.37,0.04, 0.63,0.1,1.0';
const FW_SIM = `#version 300 es
${LIB}
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2;
uniform sampler2D uS0, uS1, uS2; uniform float uDt, uGrav; uniform int uNB;
uniform vec4 uBA[16], uBB[16], uBC[16];
vec4 ff(sampler2D t, int i){ return texelFetch(t, ivec2(i % ${FWS}, i / ${FWS}), 0); }
void main(){
  int i = int(gl_FragCoord.y) * ${FWS} + int(gl_FragCoord.x);
  for (int b = 0; b < 16; b++) {
    if (b >= uNB) break;
    int st = int(uBA[b].w), cnt = int(uBB[b].x), j = i - st; if (j < 0) j += ${FWCAP};
    if (j >= cnt) continue;
    // a new spark: direction and speed from the shell type
    int type = int(uBB[b].z); float spd = uBB[b].y, life = uBC[b].x, drag = uBC[b].y, size = uBC[b].z, gm = 1.0, seed = uBC[b].w;
    float hj = h1(i, 3), hk = h1(i, 4), hl = h1(i, 5);
    vec3 dir = fib(j, cnt, hj * 0.3);
    if (type == 1) { if (j % 6 == 0) { spd *= 0.42; size *= 0.8; } spd *= 0.78 + pow(hk, 0.6) * 0.3; }
    else if (type == 2 || type == 10) { gm = 0.6; spd *= 0.85 + hk * 0.3; }
    else if (type == 3) { int arms = 11, arm = j % arms, k = j / arms, per = max(1, cnt / arms); dir = fib(arm, arms, seed * 6.0); dir.y = abs(dir.y) * 0.8 + 0.2; dir = normalize(dir); spd *= 1.0 - float(k) / float(per) * 0.6; size *= k == 0 ? 1.8 : 1.0; }
    else if (type == 4 || type == 5) {
      float th = float(j) / float(cnt) * TAU * (type == 5 ? 2.0 : 1.0), a1 = seed * 2.0 + (type == 5 && j % 2 == 1 ? 1.4 : 0.0), a2 = seed * 17.0;
      vec3 d = vec3(cos(th), sin(th) * cos(a1), sin(th) * sin(a1));
      dir = vec3(d.x * cos(a2) - d.z * sin(a2), d.y, d.x * sin(a2) + d.z * cos(a2)); spd *= 0.97 + hk * 0.06;
    }
    else if (type == 7) { int stars = 16, star = j % stars; dir = fib(star, stars, seed * 5.0); spd *= 0.95 + 0.1 * h1(st + star, 2); }
    else if (type == 9) {
      float th = float(j) / float(cnt) * TAU, x = 16.0 * pow(sin(th), 3.0), y = 13.0 * cos(th) - 5.0 * cos(2.0 * th) - 2.0 * cos(3.0 * th) - cos(4.0 * th);
      vec3 d = vec3(x, y + 2.0, (hk - 0.5) * 2.0) / 17.0; float sa = sin(seed * 6.0) * 0.5; dir = vec3(d.x * cos(sa) - d.z * sin(sa), d.y, d.x * sin(sa) + d.z * cos(sa)); spd *= 1.0;
    }
    else if (type == 12) { dir = normalize(vec3(hj - 0.5, -0.4 - hk, hl - 0.5)); spd *= 0.3 + hk * 0.5; }
    else spd *= 0.72 + pow(hk, 0.6) * 0.36;
    o0 = vec4(uBA[b].xyz, 0.0); o1 = vec4(dir * spd, uBB[b].w * 16.0 + float(type)); o2 = vec4(life * (0.85 + hl * 0.3), drag, size, gm);
    return;
  }
  vec4 s0 = ff(uS0, i), s1 = ff(uS1, i), s2 = ff(uS2, i);
  if (s0.w >= s2.x) { o0 = s0; o1 = s1; o2 = s2; return; }
  float dt = uDt, age = s0.w; int type = int(mod(s1.w, 16.0));
  vec3 v = s1.xyz;
  if (type == 7) { float ts = s2.x * 0.42; if (age < ts && age + dt >= ts) { vec3 d = normalize(vec3(h1(i, 7), h1(i, 8), h1(i, 9)) - 0.5); v = v * 0.4 + d * 1.6; } }
  v *= exp(-s2.y * dt); v.y -= uGrav * s2.w * dt;
  o0 = vec4(s0.xyz + v * dt, age + dt); o1 = vec4(v, s1.w); o2 = s2;
}`;
const LOT_GLSL = `
uniform int uC0, uH0, uST0, uFW0; uniform sampler2D uFS0, uFS1, uFS2;
uniform vec2 uJump[10]; uniform float uHero, uLift, uFlashAt, uRise; uniform float uFlare;
const vec3 FWP[10] = vec3[10](${FW_PAL.split(',').reduce((a, v, k, arr) => k % 3 === 0 ? a.concat(`vec3(${arr[k]},${arr[k + 1]},${arr[k + 2]})`) : a, []).join(',')});
vec4 ff(sampler2D t, int i){ return texelFetch(t, ivec2(i % ${FWS}, i / ${FWS}), 0); }
void particle(int i, vec4 s, inout vec3 p, inout float r, inout vec3 c, inout float e, inout float g){
  float t = uT;
  if (i < uC0) {
    // lanterns rising forever, deep into the distance
    float zd = pow(s.y, 0.55), y = mod(-1.5 + s.z * 9.0 + uRise * (0.06 + 0.06 * s.w), 9.0) - 1.5;
    float fade = sm(-1.5, -0.9, y) * (1.0 - sm(5.5, 7.5, y));
    float z = 1.0 - zd * 42.0, spread = 8.0 + zd * 46.0;
    float x = (s.x - 0.5) * spread + sin(t * 0.3 + s.w * 9.0) * 0.18 + vnoise(vec3(s.x * 5.0, y * 0.4, t * 0.05)) * 0.3;
    bool big = h1(i, 2) < 0.5;
    float fl = uFlare * step(h1(i, int(t * 3.0)), 0.04);
    p = vec3(x, y + zd * 5.0, z);
    r = (big ? 0.016 + 0.016 * s.z : 0.007 + 0.006 * s.z * s.z) * fade * (1.0 + zd * 1.6);
    c = s.w < 0.45 ? C_gold : s.w < 0.8 ? C_amber : C_rose;
    e = 0.5 + fl * 1.6 + uLevel * 0.3 + tw(s, t) * 0.3 + uLow * 0.2 + uLift * 0.8;
    g = big ? 1.0 : 0.0;
    return;
  }
  if (i < uH0) {
    // the crowd: a sea of phone lights, kicks roll through it as jumps
    float rr = 0.5 + 24.0 * pow(s.x, 0.85), a = s.y * TAU, jmp = 0.0;
    for (int k = 0; k < 10; k++) { float age = uJump[k].x; if (age > 6.0) continue; float R = age * 3.4, x = (rr - R) / 0.45; if (x > -3.0 && x < 3.0) jmp += uJump[k].y * exp(-x * x) * exp(-age * 0.6); }
    float sway = sin(t * 1.7 + s.x * 30.0) * 0.02 * (0.3 + uMid);
    float bob = uHero * 0.15 * max(0.0, sin(t * 9.0 + s.x * 20.0));
    p = vec3(cos(a) * rr * 1.3 + sway, -1.8 + jmp * 0.32 + (s.w - 0.5) * 0.14 + bob, -abs(sin(a)) * rr * 1.5 + 1.8);
    r = 0.0045 + 0.004 * s.z;
    c = s.z < 0.4 ? C_azure : s.z < 0.7 ? C_violet : s.z < 0.9 ? C_cyan : C_pearl;
    e = 0.06 + jmp * 1.4 + uHigh * 0.25 * s.w + tw(s, t) * 0.45 + uHero * 0.4 + uFlashAt * 0.15;
    return;
  }
  if (i < uST0) {
    p = vec3((s.x - 0.5) * 30.0, -1.86 + s.z * 0.2, 2.0 - s.y * 34.0);
    r = 0.03 + 0.04 * s.w; c = s.z < 0.5 ? C_amber : C_pink; e = 0.06 + uFlashAt * 0.35 + tw(s, t) * 0.15; g = 1.0;
    return;
  }
  if (i < uFW0) { p = vec3((s.x - 0.5) * 40.0, 4.0 + s.y * 6.0, -22.0 + s.z * 8.0); r = 0.008; c = C_pearl; e = 0.05 + tw(s, t) * 0.8; g = 1.0; return; }
  int j = i - uFW0;
  vec4 a = ff(uFS0, j), b = ff(uFS1, j), d = ff(uFS2, j);
  if (d.x <= 0.0 || a.w >= d.x) return;
  float u = a.w / d.x, code = b.w; int type = int(mod(code, 16.0)); float pal = floor(code / 16.0);
  int pa = int(mod(pal, 16.0)), pb = int(floor(pal / 16.0));
  vec3 ca = FWP[clamp(pa, 0, 9)], cb = FWP[clamp(pb, 0, 9)];
  c = type == 1 ? mix(ca, cb, sm(0.25, 0.7, u)) : h1(j, 2) < 0.33 ? cb : ca;
  float en = pow(1.0 - u, 1.3) * 1.5;
  if (type == 2 || type == 10) { en = (1.0 - u) * 1.2; c = mix(C_gold, C_amber, u); if (type == 10) en *= 0.7 + 0.6 * step(0.5, h1(j, int(a.w * 18.0))); }
  else if (type == 11) en *= h1(j, int(a.w * 14.0)) < 0.35 + uHigh * 0.4 ? 1.8 : 0.15;
  else if (type == 6) en *= step(0.55, fract(a.w * 8.0 + h1(j, 3))) * 2.2;
  else if (type == 8 && u > 0.55) { en = h1(j, int(a.w * 25.0)) > 0.82 ? 3.0 : 0.15; c = C_white; }
  else if (type == 12) { en = 0.9 * (1.0 - u); c = mix(C_white, C_amber, u); }
  p = a.xyz; r = d.z * (type == 12 ? 1.0 - u : 1.0) * (0.85 + 0.3 * h1(j, 6));
  e = en * (1.4 + uLevel * 1.0); g = 1.0;
}`;
function makeLot(P) {
  const NL = cnt(6000, P, P.lanterns), NCROWD = cnt(32000, P, P.crowd), NH = cnt(1500, P), NSTAR = cnt(2500, P);
  const C0 = NL, H0 = C0 + NCROWD, ST0 = H0 + NH, FW0 = ST0 + NSTAR, N = Math.min(CAP, FW0 + FWCAP);
  const simA = simTarget(FWS, FWS, 3), simB = simTarget(FWS, FWS, 3);
  let simR = simA, simW = simB, head = 0, simDt = 0;
  const pSim = PROGS.fwsim || (PROGS.fwsim = program(FS_VERT, FW_SIM));
  const queue = [];
  // type: count, speed, life, drag, size, gravity
  const T = { peony: [0, 600, 3.4, 2.2, 1.25, 0.016, 0.9], chrys: [1, 900, 3.6, 2.8, 1.2, 0.014, 0.8], willow: [2, 700, 2.6, 4.6, 2.0, 0.012, 0.55],
    palm: [3, 600, 4.4, 2.6, 0.9, 0.018, 1.0], ring: [4, 420, 3.6, 2.2, 1.2, 0.016, 0.8], dring: [5, 700, 3.6, 2.2, 1.2, 0.015, 0.8],
    strobe: [6, 520, 3.0, 2.4, 1.3, 0.014, 0.7], crossette: [7, 384, 3.0, 2.0, 0.9, 0.016, 0.9], crackle: [8, 600, 2.4, 1.8, 1.2, 0.013, 0.7],
    heart: [9, 520, 3.0, 2.4, 1.0, 0.015, 0.45], kamuro: [10, 1100, 2.8, 5.2, 1.7, 0.011, 0.5], glitter: [11, 800, 2.9, 2.8, 1.4, 0.011, 0.7], trail: [12, 6, 0.9, 0.7, 2.5, 0.011, 0.5] };
  const BASIC = ['peony', 'ring', 'peony', 'chrys', 'glitter', 'ring'];
  const EXTRA = ['willow', 'palm', 'strobe', 'crossette', 'crackle', 'heart', 'kamuro', 'dring', 'chrys', 'palm'];
  function burst(type, x, y, z, power, pa, pb) {
    const d = T[type], sz = P.fwSize * (0.75 + power * 0.4) * (0.75 + Math.random() * 0.5);
    const n = type === 'trail' ? d[1] : Math.min(FWCAP >> 3, Math.round(d[1] * P.fwSparks * Math.sqrt(sz)));
    queue.push({ x, y, z, start: head, n, spd: d[2] * (type === 'trail' ? 1 : sz), type: d[0], pal: pa + 16 * pb, life: d[3], drag: d[4], size: d[5] * (type === 'trail' ? 1 : Math.sqrt(sz)), seed: Math.random() });
    head = (head + n) % FWCAP;
    if (type !== 'trail') { flashAt = Math.max(flashAt, 0.6 * sz); flashPos = [x, y, z]; flashCol = FWC[pa]; }
  }
  const FWC = [PAL.pink, PAL.cyan, PAL.gold, PAL.violet, PAL.lime, PAL.red, PAL.white, PAL.azure, PAL.amber, PAL.magenta];
  const SH = 24, HIST = 20, shells = [];
  const SF = new Fil(SH * HIST);
  for (let k = 0; k < SH; k++) SF.poly(HIST, k / SH, 0.006, false);
  for (let i = 0; i < SF.n; i++) setCol(SF.col, i, mixC(PAL.amber, PAL.white, 1 - (i % HIST) / HIST));
  const slotFree = Array.from({ length: SH }, (_, k) => k);
  function launch(type, power, x0) {
    if (!slotFree.length) return;
    const slot = slotFree.pop(), x = x0 ?? (Math.random() - 0.5) * 18, z = -8 - Math.random() * 10, h = 1.6 + Math.random() * 2.4 * Math.min(power, 1.3);
    const pa = Math.floor(Math.random() * 10); let pb = Math.floor(Math.random() * 10); if (pb === pa) pb = (pb + 3) % 10;
    shells.push({ slot, x, y: -1.7, z, vx: (Math.random() - 0.5) * 0.5, vy: Math.sqrt(2 * 3.2 * (h + 1.7)) * 0.95, vz: (Math.random() - 0.5) * 0.4, age: 0, type, power, pa, pb, hist: [], dead: -1,
      second: Math.random() < 0.18 * P.variety ? ['ring', 'strobe', 'crackle', 'glitter'][Math.floor(Math.random() * 4)] : null });
  }
  const pickType = () => Math.random() < P.variety ? EXTRA[Math.floor(Math.random() * EXTRA.length)] : BASIC[Math.floor(Math.random() * BASIC.length)];
  let flashAt = 0, flashPos = [0, 3, -10], flashCol = PAL.gold;
  const jumpAge = new Float32Array(10).fill(99), jumpStr = new Float32Array(10), uJump = new Float32Array(20);
  const NBM = Math.round(P.beams), BP = 22, F = new Fil(Math.max(1, NBM * BP)), beamI = new Float32Array(Math.max(1, NBM));
  for (let k = 0; k < NBM; k++) { let par = -1; for (let j = 0; j < BP; j++) par = F.add(0, 0, 0, j / (BP - 1) * 6, k / NBM, 0.012 + j * 0.008, par); }
  F.sMax = 6;
  for (let i = 0; i < F.n; i++) setCol(F.col, i, mixC(Math.floor(i / BP) % 2 ? PAL.pink : PAL.cyan, PAL.pearl, 0.35));
  let beamAlt = 0, kickCool = 0, willowT = 0, lowHold = 0, eFast = 0, eSlow = 0, finaleCool = 30, hero = 0, finaleQ = 0, finaleT = 0, lift = 0, rise = 0, flare = 0, delayed = [];
  function finale() { hero = 1; finaleQ = 14; finaleT = 0; finaleCool = 22; lift = 1; flare = 1; }
  const uBA = new Float32Array(64), uBB = new Float32Array(64), uBC = new Float32Array(64);
  const W = {
    n: N, name: 'LOT', blurb: 'The show the sky puts on', tint: PAL.amber, flash: PAL.gold, coreLight: PAL.amber, coreGain: 0.9, coreLocal: [0, 2.5, -8],
    wisps: [PAL.gold, PAL.pink, PAL.cyan], fils: [F, SF], lines: [], ay: 0, ax: 0, dofMul: 0.15,
    cam0: { tx: 0, ty: 0.6, tz: 0, dist: 8.6, h: 0, p: 2, b: 0, f: 38 },
    camLayer: { el: 0, az: 0, ty: 0, dist: 1, label: 'Crane on the drop' },
    prog: progFor('LOT', 'LOT', LOT_GLSL),
    get trailFloor() { return P.trail; },
    onset(kind, s) {
      if (kind === 'kick' || kind === 'touch') {
        const k = oldest(jumpAge); jumpAge[k] = 0; jumpStr[k] = s;
        if (NBM) { beamI[beamAlt % NBM] = Math.max(beamI[beamAlt % NBM], s * P.strobe); beamI[(beamAlt + (NBM >> 1)) % NBM] = Math.max(beamI[(beamAlt + (NBM >> 1)) % NBM], s * 0.8 * P.strobe); beamAlt++; }
        if (kickCool <= 0 && Math.random() < 0.42 * P.fwRate) {
          const volley = A.level > 0.55 && Math.random() < 0.5 * P.variety ? 2 + (Math.random() * 2 | 0) : 1;
          for (let v = 0; v < volley; v++) launch(pickType(), s, volley > 1 ? (v / (volley - 1) - 0.5) * 12 + (Math.random() - 0.5) * 2 : undefined);
          kickCool = 0.3 / Math.max(0.2, P.fwRate);
        }
      }
      if (kind === 'snare') { flare = Math.max(flare, s * 0.6); if (Math.random() < 0.25 * P.fwRate) launch(Math.random() < 0.5 ? 'crackle' : 'strobe', s * 0.8); }
      if (kind === 'hat') flare = Math.max(flare, s * 0.4);
      if (kind === 'idle' && Math.random() < 0.35 * P.fwRate) launch(pickType(), 0.5);
    },
    update(dt, t) {
      simDt = dt;
      for (let k = 0; k < 10; k++) jumpAge[k] += dt;
      for (let k = 0; k < NBM; k++) beamI[k] *= Math.exp(-dt * 2.2);
      kickCool -= dt; finaleCool -= dt; hero = Math.max(0, hero - dt / 7); lift *= Math.exp(-dt * 0.35); flashAt *= Math.exp(-dt * 3.5); flare *= Math.exp(-dt * 2.4);
      rise += dt * (1 + A.presence * 0.8) + lift * dt * 6;
      eFast = follow(eFast, A.level, dt, 0.15, 0.4); eSlow = follow(eSlow, A.level, dt, 5, 5);
      if (finaleCool <= 0 && P.finale > 0 && eFast > 0.4 && eFast > eSlow * (2.1 - P.finale) + 0.06) finale();
      if (finaleQ > 0) { finaleT -= dt; if (finaleT <= 0) { launch(['peony', 'chrys', 'palm', 'willow', 'dring', 'kamuro', 'crossette', 'glitter'][finaleQ % 8], 1.25); finaleQ--; finaleT = 0.12 + Math.random() * 0.15; } }
      lowHold = A.low > 0.55 ? lowHold + dt : 0; willowT -= dt;
      if (lowHold > 1.4 && willowT <= 0 && P.fwRate > 0) { launch(Math.random() < 0.5 ? 'willow' : 'kamuro', 1); willowT = 2.2 / P.fwRate; }
      for (let d = delayed.length - 1; d >= 0; d--) { delayed[d].t -= dt; if (delayed[d].t <= 0) { const q = delayed[d]; burst(q.type, q.x, q.y, q.z, q.power, q.pa, q.pb); delayed.splice(d, 1); } }
      for (let s2 = shells.length - 1; s2 >= 0; s2--) {
        const sh = shells[s2];
        if (sh.dead >= 0) { sh.dead += dt; if (sh.dead > 0.7) { slotFree.push(sh.slot); shells.splice(s2, 1); } continue; }
        sh.age += dt; sh.vy -= 3.2 * dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.z += sh.vz * dt;
        sh.hist.unshift([sh.x, sh.y, sh.z]); if (sh.hist.length > HIST) sh.hist.pop();
        if (P.streak > 0.05 && queue.length < 8) burst('trail', sh.x, sh.y, sh.z, 1, 8, 6);
        if (sh.vy < 0.4) {
          burst(sh.type, sh.x, sh.y, sh.z, sh.power, sh.pa, sh.pb); sh.dead = 0;
          if (sh.second) delayed.push({ t: 0.35 + Math.random() * 0.2, type: sh.second, x: sh.x, y: sh.y + 0.1, z: sh.z, power: sh.power * 0.8, pa: sh.pb, pb: sh.pa });
        }
      }
      // mortar streaks: each shell drags a hot line of its recent path
      for (let k = 0; k < SH; k++) for (let j = 0; j < HIST; j++) SF.I[k * HIST + j] = 0;
      for (const sh of shells) {
        const fade = sh.dead >= 0 ? Math.max(0, 1 - sh.dead / 0.7) : 1;
        for (let j = 0; j < HIST; j++) {
          const i = sh.slot * HIST + j, h = sh.hist[Math.min(j, sh.hist.length - 1)] || [sh.x, sh.y, sh.z];
          SF.c[i * 3] = h[0]; SF.c[i * 3 + 1] = h[1]; SF.c[i * 3 + 2] = h[2];
          SF.I[i] = (j < sh.hist.length ? 1 : 0) * Math.pow(1 - j / HIST, 1.5) * 1.6 * P.streak * fade;
        }
      }
      const hz = hero;
      W.camLayer.el = 0.06 * Math.sin(t * 0.05) + hz * 0.16; W.camLayer.az = 0.3 * Math.sin(t * 0.03);
      W.camLayer.ty = 0.2 * Math.sin(t * 0.04) + hz * 0.7; W.camLayer.dist = 1 - 0.1 * Math.sin(t * 0.045) - hz * 0.08;
      W.coreGain = 0.5 + flashAt * 2.5; W.coreLight = flashCol;
      for (let k = 0; k < NBM; k++) {
        const bx = -4 + k * 8 / Math.max(1, NBM - 1), free = 0.45 * Math.sin(t * (0.25 + k * 0.05) * P.sweep + k * 1.7), lock = Math.atan2(4, -bx) - Math.PI / 2;
        const ang = Math.PI / 2 + lerp(free, lock, hero), strobe = hero > 0.05 ? (Math.sin(t * 28 + k) > 0.3 ? 1 : 0.1) * hero : 0;
        for (let j = 0; j < BP; j++) {
          const i = k * BP + j, q = i * 3, d = j / (BP - 1) * 9;
          F.c[q] = bx + Math.cos(ang) * d; F.c[q + 1] = -1.7 + Math.sin(ang) * d * 0.95; F.c[q + 2] = -6 + d * 0.22;
          F.I[i] = (0.03 + beamI[k] * 0.5 + A.level * 0.06 + strobe * 0.6) * (1 - j / BP);
        }
      }
      W.ay = 0.18 * Math.sin(t * 0.035); W.ax = 0.04 + 0.03 * Math.sin(t * 0.05);
      rotPts(F.c, F.n, 3, W.ay, W.ax); rotPts(SF.c, SF.n, 3, W.ay, W.ax);
      W.coreLocal = flashPos;
    },
    prepass() {
      // advance the sparks: spawn queued bursts into the ring buffer, integrate the rest
      const nb = Math.min(16, queue.length);
      for (let b = 0; b < nb; b++) {
        const q = queue.shift();
        uBA.set([q.x, q.y, q.z, q.start], b * 4); uBB.set([q.n, q.spd, q.type, q.pal], b * 4); uBC.set([q.life, q.drag, q.size, q.seed], b * 4);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, simW.fb); gl.viewport(0, 0, FWS, FWS); gl.disable(gl.BLEND);
      gl.useProgram(pSim); texUnit = 0;
      bindT(pSim, 'uS0', simR.tex[0]); bindT(pSim, 'uS1', simR.tex[1]); bindT(pSim, 'uS2', simR.tex[2]);
      gl.uniform1f(pSim.u('uDt'), Math.min(simDt, 0.05)); gl.uniform1f(pSim.u('uGrav'), P.gravity); gl.uniform1i(pSim.u('uNB'), nb);
      gl.uniform4fv(pSim.u('uBA[0]'), uBA); gl.uniform4fv(pSim.u('uBB[0]'), uBB); gl.uniform4fv(pSim.u('uBC[0]'), uBC);
      drawFS();
      const tt = simR; simR = simW; simW = tt;
    },
    uniforms(p) {
      for (let k = 0; k < 10; k++) { uJump[k * 2] = jumpAge[k]; uJump[k * 2 + 1] = jumpStr[k]; }
      gl.uniform1i(p.u('uC0'), C0); gl.uniform1i(p.u('uH0'), H0); gl.uniform1i(p.u('uST0'), ST0); gl.uniform1i(p.u('uFW0'), FW0);
      bindT(p, 'uFS0', simR.tex[0]); bindT(p, 'uFS1', simR.tex[1]); bindT(p, 'uFS2', simR.tex[2]);
      gl.uniform2fv(p.u('uJump[0]'), uJump); gl.uniform1f(p.u('uHero'), hero); gl.uniform1f(p.u('uLift'), lift); gl.uniform1f(p.u('uFlashAt'), flashAt);
      gl.uniform1f(p.u('uRise'), rise); gl.uniform1f(p.u('uFlare'), flare);
    }
  };
  return W;
}
