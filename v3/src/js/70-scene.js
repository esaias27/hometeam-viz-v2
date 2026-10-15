/* ================================================================== */
/* Travelling between worlds                                           */
/* ================================================================== */
let WORLDS = [], cur = 0, prev = -1, trStart = -99, snapMode = false, TR_DUR = 2.6, autoT = 0, kicksSince = 0, NA = 0, naSnap = 0;
let tint = PAL.violet.slice(), tintFrom = PAL.violet.slice();
// copy both float targets of one MRT framebuffer to another (used to freeze the frame when a morph is interrupted)
function copyTarget(src, dst) {
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.fb);
  for (let k = 0; k < 2; k++) {
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + k);
    gl.drawBuffers(k === 0 ? [gl.COLOR_ATTACHMENT0, gl.NONE] : [gl.NONE, gl.COLOR_ATTACHMENT1]);
    gl.blitFramebuffer(0, 0, TW, TH, 0, 0, TW, TH, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  }
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); gl.readBuffer(gl.COLOR_ATTACHMENT0);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
}
function freezeFrame() { copyTarget(finT, snapT); naSnap = NA; snapMode = true; }
function setWorld(s, t, quiet) {
  if (s === cur || s < 0 || s >= WORLDS.length) return;
  if (t - trStart < TR_DUR) freezeFrame(); else snapMode = false;
  tintFrom = tint.slice(); prev = cur; cur = s; trStart = t;
  S.world = s; save(); autoT = 0; kicksSince = 0;
  updateUI(); if (!quiet) showLookName();
}
function buildWorld(i) {
  const name = NAMES[i], P = WP[name];
  const w = FACTORIES[i](P); w.P = P; w.tl = 0;
  return w;
}
// structural parameters (counts, divisions) rebuild the world; the new one morphs out of the old one's light
const rebuildAt = {};
function scheduleRebuild(name) { rebuildAt[name] = tSim + 0.35; }
function rebuildAll() { for (const n of NAMES) scheduleRebuild(n); }
function checkRebuilds(t) {
  for (const name in rebuildAt) {
    if (t < rebuildAt[name]) continue;
    delete rebuildAt[name];
    const i = NAMES.indexOf(name), P = WP[name];
    for (const d of schemaOf(name)) if (d.rb) P[d.k] = WT[name][d.k];
    const old = WORLDS[i], w = buildWorld(i); w.tl = old.tl;
    if (i === cur) { freezeFrame(); prev = cur; trStart = t; tintFrom = tint.slice(); }
    else if (i === prev) prev = -1;
    WORLDS[i] = w;
  }
}
// live values glide toward their targets so every slider move, preset and mutation is a morph
function tweenParams(dt) {
  const kf = 1 - Math.exp(-dt * 2.4);
  for (const name of NAMES) {
    const P = WP[name], T = WT[name];
    for (const d of schemaOf(name)) { if (d.rb) continue; if (d.st >= 1) P[d.k] = T[d.k]; else P[d.k] += (T[d.k] - P[d.k]) * kf; }
  }
}
function autoNext(t) {
  let n; do { n = Math.floor(Math.random() * WORLDS.length); } while (n === cur && WORLDS.length > 1);
  setWorld(n, t);
}

/* ================================================================== */
/* Wisps: three orbiting lights with comet trails that light the scene */
/* ================================================================== */
const WTRL = 46, wispPh = new Float32Array([0, 2.1, 4.2]), wispFlash = new Float32Array(WISP), wispPos = new Float32Array(WISP * 3);
const wispFil = new Fil(WISP * WTRL);
for (let k = 0; k < WISP; k++) { let par = -1; for (let j = 0; j < WTRL; j++) par = wispFil.add(0, 0, 0, j * 0.05, k / 3, 0.007 * (1 - j / WTRL) + 0.0012, par); }
let wispCols = [PAL.cyan, PAL.pink, PAL.gold].map(c => c.slice()), coreFlash = 0;
function updateWisps(dt, t) {
  const INC = [0.45, -0.8, 1.1];
  for (let k = 0; k < WISP; k++) {
    const dir = k % 2 ? -1 : 1;
    wispPh[k] += dt * (0.32 + 0.11 * k) * dir * (1 + A.level * 1.3);
    wispFlash[k] *= Math.exp(-dt * 3.2);
    const R = 2.1 + 0.3 * k, node = t * 0.04 + k * 2.1, cn = Math.cos(node), sn = Math.sin(node), si = Math.sin(INC[k]), ci = Math.cos(INC[k]);
    for (let j = 0; j < WTRL; j++) {
      const i = k * WTRL + j, q = i * 3, ph = wispPh[k] - j * 0.04 * dir, rr = R + 0.06 * Math.sin(t * 0.9 + k);
      const x = Math.cos(ph) * rr, y = Math.sin(ph) * rr * si, z = Math.sin(ph) * rr * ci;
      wispFil.c[q] = x * cn + z * sn; wispFil.c[q + 1] = y + 0.1 * Math.sin(t * 0.7 + k); wispFil.c[q + 2] = -x * sn + z * cn;
      const f = 1 - j / WTRL;
      wispFil.I[i] = f * f * (0.5 + wispFlash[k] * 1.6 + A.level * 0.6);
      setCol(wispFil.col, i, wispCols[k]);
    }
    wispPos[k * 3] = wispFil.c[k * WTRL * 3]; wispPos[k * 3 + 1] = wispFil.c[k * WTRL * 3 + 1]; wispPos[k * 3 + 2] = wispFil.c[k * WTRL * 3 + 2];
  }
}

/* ================================================================== */
/* Hits: every onset routes through here                               */
/* ================================================================== */
function fire(kind, s) {
  if (!WORLDS.length) return;
  const hit = w => { const P = w.P, g = kind === 'kick' ? P.gLow : kind === 'snare' ? P.gMid : kind === 'hat' ? P.gHigh : 1; if (s * g > 0.04) withGains(P, () => w.onset(kind, Math.min(s * g, 1.6))); };
  hit(WORLDS[cur]);
  if (prev >= 0 && prev !== cur && tSim - trStart < TR_DUR && !snapMode) hit(WORLDS[prev]);
  if (kind === 'kick') { pushRipple(0, 0, 0, s * 0.8); kicksSince++; kickedThisFrame = true; }
  coreFlash = Math.max(coreFlash, kind === 'idle' ? 0.25 : kind === 'hat' ? s * 0.4 : s);
  const k = Math.floor(Math.random() * WISP); wispFlash[k] = Math.max(wispFlash[k], kind === 'idle' ? 0.4 : s);
  onsetCount++;
}

/* ================================================================== */
/* Logo pool state (the pearls themselves live in the blend pass)      */
/* ================================================================== */
let logoW = 0;
const LX = { sz: 2.0, y0: 0.05, z0: 0.5, follow: 0 };
function updateLogo(dt) {
  const wc = WORLDS[cur], xf = wc.logoXf;
  logoW = lerp(logoW, (S.logo || xf) ? 1 : 0, 1 - Math.exp(-dt * (xf ? 1.6 : 1.1)));
  const kk = 1 - Math.exp(-dt * 2.5);
  LX.sz = lerp(LX.sz, xf ? xf.sz : 1.0 + S.logoSize * 2.6, kk); LX.y0 = lerp(LX.y0, xf ? xf.y0 : 0.05, kk);
  LX.z0 = lerp(LX.z0, xf ? xf.z0 : 0.5, kk); LX.follow = lerp(LX.follow, xf && xf.follow ? 1 : 0, kk);
}

/* ================================================================== */
/* Color                                                               */
/* ================================================================== */
const GRADES = [
  ['NATIVE', null], ['HOLO', ['#04000a', '#4b1680', '#ff4fd8', '#d4fbff']], ['SUNSET', ['#000000', '#5a0f2a', '#ff7a3c', '#ffe7b8']],
  ['DEEP', ['#000308', '#0d2a6b', '#2fd3c7', '#eafffb']], ['ACID', ['#000000', '#1a4c12', '#c8ff2e', '#fbffe0']],
  ['GOLD', ['#000000', '#3e2408', '#e0a84a', '#fff3d6']], ['INFRA', ['#000000', '#6a0f5c', '#ff5a3c', '#fff0c8']]
].map(([name, st]) => ({ name, stops: st ? st.map(lin) : null }));
const gradeCur = [[0, 0, 0], [0.1, 0.1, 0.1], [0.5, 0.5, 0.5], [1, 1, 1]];
let gradeMix = 0, huePhase = 0, hueNow = 0;
const V = { glow: S.glow, trail: S.trail, dof: S.dof, echo: S.echo, lensSize: S.lensSize, lensAmt: S.lensAmt, lensPos: S.lensPos };
for (const k2 of COLOR_KEYS) V[k2] = S[k2];
const MIRRORS = [0, 3, 4, 6, 8, 12];
let mirN = 0, mirMix = 0, mirRot = 0;
function hueRotJS(c, a, o) {
  const cs = Math.cos(a), sn = Math.sin(a), r = c[0], g = c[1], b = c[2];
  o[0] = Math.max(0, r * (0.213 + cs * 0.787 - sn * 0.213) + g * (0.715 - cs * 0.715 - sn * 0.715) + b * (0.072 - cs * 0.072 + sn * 0.928));
  o[1] = Math.max(0, r * (0.213 - cs * 0.213 + sn * 0.143) + g * (0.715 + cs * 0.285 + sn * 0.140) + b * (0.072 - cs * 0.072 - sn * 0.283));
  o[2] = Math.max(0, r * (0.213 - cs * 0.213 - sn * 0.787) + g * (0.715 - cs * 0.715 + sn * 0.715) + b * (0.072 + cs * 0.928 + sn * 0.072));
  return o;
}
function updateLook(dt) {
  const kf = 1 - Math.exp(-dt * 2.2);
  for (const k in V) V[k] += (S[k] - V[k]) * kf;
  if (S.cycle) huePhase += dt * TAU / 90;
  hueNow = S.cycle ? 0.5 * Math.sin(huePhase) : 0;
  const g = GRADES[S.grade] || GRADES[0];
  gradeMix += ((g.stops ? 0.8 : 0) - gradeMix) * kf;
  if (g.stops) for (let a = 0; a < 4; a++) for (let c = 0; c < 3; c++) gradeCur[a][c] += (g.stops[a][c] - gradeCur[a][c]) * kf;
  const tn = MIRRORS[S.kaleido] || 0;
  if (mirN !== tn) { mirMix -= dt * 2.5; if (mirMix <= 0 || mirN === 0) { mirMix = 0; mirN = tn; } }
  else mirMix = Math.min(1, mirMix + dt * 1.2);
  mirRot += dt * 0.03 * (1 + A.level * 1.5);
}

/* ================================================================== */
/* Camera: edge-lit backdrop plus motion that throws shockwaves        */
/* ================================================================== */
const CAM = { video: null, stream: null, on: false, aspect: 4 / 3, mirror: true, last: -1, cnv: null, ctx: null, prev: null, cool: 0, energy: 0 };
async function startCam(facing) {
  stopCam();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    const v = CAM.video || (CAM.video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true }));
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.srcObject = stream; await v.play().catch(() => {});
    CAM.stream = stream; CAM.on = true; CAM.mirror = facing === 'user'; CAM.prev = null;
  } catch (e) {
    S.cam = 'off'; updateUI();
    toast(e && e.name === 'NotAllowedError' ? 'Camera blocked · allow it in Settings › Apps › Safari › Camera' : 'Camera unavailable');
  }
}
function stopCam() { if (CAM.stream) CAM.stream.getTracks().forEach(t => t.stop()); CAM.stream = null; CAM.on = false; }
function camTick(dt) {
  if (!CAM.on || !CAM.video || CAM.video.readyState < 2 || !CAM.video.videoWidth) { A.motion = follow(A.motion, 0, dt, 0.2, 0.6); return; }
  if (CAM.video.currentTime === CAM.last) return;
  CAM.last = CAM.video.currentTime;
  gl.bindTexture(gl.TEXTURE_2D, camTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, CAM.video);
  CAM.aspect = CAM.video.videoWidth / CAM.video.videoHeight;
  if (!CAM.cnv) { CAM.cnv = document.createElement('canvas'); CAM.cnv.width = 48; CAM.cnv.height = 36; CAM.ctx = CAM.cnv.getContext('2d', { willReadFrequently: true }); }
  CAM.ctx.drawImage(CAM.video, 0, 0, 48, 36);
  const d = CAM.ctx.getImageData(0, 0, 48, 36).data, cur = new Float32Array(48 * 36);
  for (let i = 0; i < cur.length; i++) cur[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  if (CAM.prev) {
    let e = 0, sx = 0, sy = 0;
    for (let y = 0; y < 36; y++) for (let x = 0; x < 48; x++) { const i = y * 48 + x, df = Math.abs(cur[i] - CAM.prev[i]); if (df > 0.08) { e += df; sx += x * df; sy += y * df; } }
    const en = clamp(e / 60, 0, 1);
    A.motion = follow(A.motion, en, dt, 0.05, 0.4);
    CAM.cool -= dt;
    if (S.camMotion && en > 0.12 && en > CAM.energy * 1.6 && CAM.cool <= 0 && e > 0) {
      let u = sx / e / 47, v = sy / e / 35; if (CAM.mirror) u = 1 - u;
      screenHit(u, 1 - v, clamp(0.3 + en * 1.2, 0.3, 1), true);
      CAM.cool = 0.25;
    }
    CAM.energy = follow(CAM.energy, en, dt, 0.3, 0.3);
  }
  CAM.prev = cur;
}

/* ================================================================== */