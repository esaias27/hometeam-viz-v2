/* ================================================================== */
/* Frame                                                               */
/* ================================================================== */
let fovNow = 30 * Math.PI / 180;
let tPrev = 0, tSim = 0, nextThought = 2.5, running = false;
const light = (() => { const v = [0.45, 0.62, 0.64], l = Math.hypot(...v); return v.map(x => x / l); })();
const LP = new Float32Array(16), LC = new Float32Array(12);
const cam = { px: 0, py: 0, pz: 8, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: -1, Cx: 0, Cy: 0, Cz: 0, sc: 1, aspect: 1 };
function perspective(fovy, aspect, near, far) { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]); }
function drawFS() { gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
function bindTex(unit, tex, p, name) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(p.u(name), unit); }
const VIEW = new Float32Array(16), MV = new Float32Array(16), VP = new Float32Array(16);
function mul4(o, a, b) { for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
function buildView() {
  const c = cam;
  VIEW.set([c.rx, c.ux, -c.fx, 0, c.ry, c.uy, -c.fy, 0, c.rz, c.uz, -c.fz, 0,
    -(c.rx * c.px + c.ry * c.py + c.rz * c.pz), -(c.ux * c.px + c.uy * c.py + c.uz * c.pz), (c.fx * c.px + c.fy * c.py + c.fz * c.pz), 1]);
  // model: the drifting, breathing world (scale sc, offset C) before the view
  const s = c.sc;
  for (let r = 0; r < 4; r++) { MV[r] = VIEW[r] * s; MV[4 + r] = VIEW[4 + r] * s; MV[8 + r] = VIEW[8 + r] * s; MV[12 + r] = VIEW[r] * c.Cx + VIEW[4 + r] * c.Cy + VIEW[8 + r] * c.Cz + VIEW[12 + r]; }
}
const toViewM = (m, x, y, z, o, k) => { o[k] = m[0] * x + m[4] * y + m[8] * z + m[12]; o[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; o[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]; };
// Turn a screen position into a point in the world's own space, on the plane through the target facing the camera
function screenHit(u, v, s, fromCam) {
  if (!WORLDS.length) return;
  const th = Math.tan(fovNow / 2), nx = (u * 2 - 1) * th * cam.aspect, ny = (v * 2 - 1) * th;
  const dx = cam.fx + cam.rx * nx + cam.ux * ny, dy = cam.fy + cam.ry * nx + cam.uy * ny, dz = cam.fz + cam.rz * nx + cam.uz * ny;
  const den = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  const tt = (cam.focusD || 8) / den;
  const wx = cam.px + dx * tt, wy = cam.py + dy * tt, wz = cam.pz + dz * tt;
  pushRipple((wx - cam.Cx) / cam.sc, (wy - cam.Cy) / cam.sc, (wz - cam.Cz) / cam.sc, s * 1.15, 2.3);
  fire('touch', s * (fromCam ? 0.7 : 1));
}
// A world hears the spectrum through its own bass / mid / treble response
const bandSave = new Float32Array(NB);
function withGains(P, fn) {
  if (P.gLow === 1 && P.gMid === 1 && P.gHigh === 1) { fn(); return; }
  bandSave.set(A.bands); const l = A.level, lo = A.low, mi = A.mid, hi = A.high;
  for (let b = 0; b < NB; b++) A.bands[b] = Math.min(1.25, A.bands[b] * (b < 5 ? P.gLow : b < 11 ? P.gMid : P.gHigh));
  bandGroups(); A.level = Math.min(1.25, l * (P.gLow * 0.45 + P.gMid * 0.35 + P.gHigh * 0.2));
  try { fn(); } finally { A.bands.set(bandSave); A.level = l; A.low = lo; A.mid = mi; A.high = hi; }
}
function stepWorld(w, dt) { const dts = dt * w.P.speed; w.tl += dts; withGains(w.P, () => w.update(dts, w.tl)); }
const fogC = [0, 0, 0], uRip = new Float32Array(56), uRipS = new Float32Array(28), uWisp = new Float32Array(12), uWispC = new Float32Array(9);
let limG = 1, lensMode = 0, lensMix = 0, camUIdirty = true;
const PERF = { frames: 0, last: 0, cpu: 0, low: 0, high: 0, fpsAvg: 60 };
const PROF = { on: false, t: {}, skip: {}, warp: 1 }; let profT = 0;
function mark(name) { if (!PROF.on) return; gl.finish(); const n = performance.now(); PROF.t[name] = (PROF.t[name] || 0) * 0.8 + (n - profT) * 0.2; profT = n; }

function drawLines(w, weight, proj, pxs, focus, ap, sc, hot) {
  if (weight <= 0.004 || !w.lines) return;
  for (const L of w.lines) {
    if (!L.count || (L.active && !L.active())) continue;
    const p = L.prog; gl.useProgram(p); texUnit = 0;
    withGains(w.P, () => { setCommon(p, w, w.tl); if (L.uniforms) L.uniforms(p); });
    if (L.fromFin) { bindT(p, 'uFP', finT.tex[0]); bindT(p, 'uFC', finT.tex[1]); gl.uniform2f(p.u('uRot'), 0, 0); }
    gl.uniformMatrix4fv(p.u('uProj'), false, proj); gl.uniformMatrix4fv(p.u('uMV'), false, MV);
    gl.uniform1f(p.u('uPx'), pxs); gl.uniform1f(p.u('uFocus'), focus); gl.uniform1f(p.u('uAp'), ap * 0.8); gl.uniform1f(p.u('uSc'), sc);
    gl.uniform1f(p.u('uWeight'), weight * w.P.bright); gl.uniform1f(p.u('uHue'), hueNow); gl.uniform1f(p.u('uHot'), hot);
    gl.uniform1f(p.u('uFogD'), cam.fogD); gl.uniform1f(p.u('uFogS'), cam.fogS); gl.uniform3fv(p.u('uFogC'), fogC);
    gl.bindVertexArray(lineVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, L.count);
    gpuSegs += L.count;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const cpu0 = performance.now();
  const dt = clamp((now - tPrev) / 1000, 0, 0.05) * PROF.warp; tPrev = now;
  tSim += dt; const t = tSim;
  resize();
  camTick(dt);
  analyze(dt, t);
  ageRipples(dt);
  coreFlash *= Math.exp(-dt * 3);
  if (A.level < 0.05 && !S.demo) {
    nextThought -= dt;
    if (nextThought <= 0) { const s = 0.18 + Math.random() * 0.14; pushRipple(0, 0, 0, s); fire('idle', s); nextThought = 2.8 + Math.random() * 3.5; }
  } else nextThought = Math.max(nextThought, 1.5);
  if (S.auto) { autoT += dt; if ((autoT > 34 && A.level > 0.05) || autoT > 70 || (kicksSince >= 64 && autoT > 20)) autoNext(t); }
  tweenParams(dt);
  checkRebuilds(t);
  tweenCameras(dt);
  tourTick(dt, kickedThisFrame); kickedThisFrame = false;

  const k = (t - trStart) / TR_DUR, inTr = k < 1 && prev >= 0;
  const wCur = WORLDS[cur], wPrev = prev >= 0 ? WORLDS[prev] : null;
  const prevLive = inTr && !snapMode && wPrev && wPrev !== wCur;
  NA = inTr ? Math.max(wCur.n, snapMode ? naSnap : wPrev.n) : wCur.n;
  stepWorld(wCur, dt);
  if (prevLive) stepWorld(wPrev, dt);
  const tk = inTr ? ease(clamp(k, 0, 1)) : 1;
  echoZoomNow = lerp(wPrev && inTr ? (wPrev.echoZoom ?? 1) : (wCur.echoZoom ?? 1), wCur.echoZoom ?? 1, tk);
  tint = mixC(tintFrom, wCur.tint, tk);
  const flashC = wPrev && inTr ? mixC(wPrev.flash, wCur.flash, tk) : wCur.flash;
  for (let w = 0; w < WISP; w++) wispCols[w] = wPrev && inTr ? mixC(wPrev.wisps[w], wCur.wisps[w], tk) : wCur.wisps[w].slice();
  updateWisps(dt, t);
  wispAmt = lerp(wispAmt, S.wisps ? 1 : 0, 1 - Math.exp(-dt * 2));
  updateLook(dt);
  updateLogo(dt);

  // camera: each world's own camera, blended across the morph
  const aspect = W / H;
  let C = resolveCam(wCur, NAMES[cur], t, aspect, camA);
  if (wPrev && inTr && wPrev !== wCur) C = lerpCam(resolveCam(wPrev, NAMES[prev], t, aspect, camB), camA, tk);
  {
    const fd = wCur.fog ? wCur.fog.d : 0, fpd = wPrev && inTr && wPrev.fog ? wPrev.fog.d : 0;
    cam.fogD = inTr && wPrev ? lerp(fpd, fd, tk) : fd;
    const fc = wCur.fog ? wCur.fog.col : null, fp = wPrev && inTr && wPrev.fog ? wPrev.fog.col : null, a = fp || fc || fogC, b = fc || fp || fogC;
    for (let j = 0; j < 3; j++) fogC[j] = lerp(a[j], b[j], inTr ? tk : 1);
  }
  const dm = C.drift;
  const Cx = dm * (0.55 * Math.sin(t * 0.061) + 0.22 * Math.sin(t * 0.143 + 2.1));
  const Cy = dm * (0.25 * Math.sin(t * 0.083 + 0.7) + 0.1 * Math.sin(t * 0.19));
  const Cz = dm * 0.45 * Math.sin(t * 0.051 + 1.9);
  const sc = 1 + 0.018 * Math.sin(t * 0.55) + A.level * 0.035;
  const tx = C.tx + Cx * 0.4, ty = C.ty + Cy * 0.4, tz = C.tz + Cz * 0.4;
  const px = C.ex + Cx * 0.4, py = C.ey + Cy * 0.4, pz = C.ez + Cz * 0.4;
  let fx = tx - px, fy = ty - py, fz = tz - pz; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; let rl = Math.hypot(rx, ry, rz); if (rl < 1e-4) { rx = 1; rz = 0; rl = 1; } rx /= rl; ry /= rl; rz /= rl;
  let ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  if (Math.abs(C.bank) > 1e-4) {
    const cr = Math.cos(C.bank), sr = Math.sin(C.bank), Rx = rx, Ry = ry, Rz = rz;
    rx = Rx * cr + ux * sr; ry = Ry * cr + uy * sr; rz = Rz * cr + uz * sr;
    ux = -Rx * sr + ux * cr; uy = -Ry * sr + uy * cr; uz = -Rz * sr + uz * cr;
  }
  fovNow = 2 * Math.atan(C.tanH);
  Object.assign(cam, { px, py, pz, rx, ry, rz, ux, uy, uz, fx, fy, fz, Cx, Cy, Cz, sc, aspect, focusD: C.focus });
  buildView();
  const focus = C.focus, ap = V.dof * C.ap;
  cam.fogS = Math.max(2, focus * 0.55);

  // lights in view space: the world's core light and the three wisps
  {
    const cl = rot1(wCur.coreLocal, wCur.ay, wCur.ax);
    let cc = wCur.coreLight, cg = wCur.coreGain;
    if (wPrev && inTr) { const pl = rot1(wPrev.coreLocal, wPrev.ay, wPrev.ax); for (let a = 0; a < 3; a++) cl[a] = lerp(pl[a], cl[a], tk); cc = mixC(wPrev.coreLight, wCur.coreLight, tk); cg = lerp(wPrev.coreGain, wCur.coreGain, tk); }
    toViewM(MV, cl[0], cl[1], cl[2], LP, 0);
    LP[3] = (0.3 + A.level * 1.8 + coreFlash * 1.3 + A.presence * 0.3) * cg;
    LC[0] = cc[0]; LC[1] = cc[1]; LC[2] = cc[2];
  }
  for (let w = 0; w < WISP; w++) {
    toViewM(MV, wispPos[w * 3], wispPos[w * 3 + 1], wispPos[w * 3 + 2], LP, 4 + w * 4);
    LP[7 + w * 4] = (0.5 + 0.25 * Math.sin(t * 1.3 + w * 2) + wispFlash[w] * 1.8 + A.level * 0.7) * wispAmt;
    LC[3 + w * 3] = wispCols[w][0]; LC[4 + w * 3] = wispCols[w][1]; LC[5 + w * 3] = wispCols[w][2];
    uWisp.set([wispPos[w * 3], wispPos[w * 3 + 1], wispPos[w * 3 + 2], (1.6 + wispFlash[w] * 2.5 + A.level * 0.8) * wispAmt], w * 4); uWispC.set(wispCols[w], w * 3);
  }
  const hc = [0, 0, 0];
  for (let a = 0; a < 4; a++) { hc[0] = LC[a * 3]; hc[1] = LC[a * 3 + 1]; hc[2] = LC[a * 3 + 2]; hueRotJS(hc, hueNow, hc); LC[a * 3] = hc[0]; LC[a * 3 + 1] = hc[1]; LC[a * 3 + 2] = hc[2]; }

  fcount = 0; gpuSegs = 0;
  const gNew = inTr ? ease(clamp(k * 1.25, 0, 1)) : 1;
  for (const F of wCur.fils) gatherFil(F, wCur.P.bright, gNew);
  const wOld = prevLive ? (1 - smooth(0, 0.6, k)) * wPrev.P.bright : 0;
  if (prevLive) for (const F of wPrev.fils) gatherFil(F, wOld, 1);
  gatherFil(wispFil, wispAmt, 1);

  const ex = tx - px, ey = ty - py, ez = tz - pz;
  const evx = ex * rx + ey * ry + ez * rz, evy = ex * ux + ey * uy + ez * uz, evz = ex * fx + ey * fy + ez * fz;
  const f = 1 / Math.tan(fovNow / 2), cu = 0.5 + 0.5 * (f / aspect) * evx / evz, cvv = 0.5 + 0.5 * f * evy / evz;
  const proj = perspective(fovNow, aspect, 0.1, 140), pxs = 2 * Math.tan(fovNow / 2) / H;
  const hot = 0.15 + V.hot * 2.1;
  limG = follow(limG, 1 / (1 + V.limiter * (A.level * 0.45 + coreFlash * 0.55)), dt, 0.04, 0.7);
  if (lensMode !== S.lens) { lensMix -= dt * 3; if (lensMix <= 0 || lensMode === 0) { lensMix = 0; lensMode = S.lens; } }
  else lensMix = Math.min(1, lensMix + dt * 1.4);
  const cpuMid = performance.now();

  /* ---- particles on the GPU: each world writes its light, then the blend pass morphs them ---- */
  if (PROF.on) { gl.finish(); profT = performance.now(); }
  if (!PROF.skip.worlds) renderWorld(wCur, slotCur, wCur.tl);
  if (prevLive) renderWorld(wPrev, slotPrev, wPrev.tl);
  mark('worlds');
  {
    gl.bindFramebuffer(gl.FRAMEBUFFER, finT.fb); gl.viewport(0, 0, TW, rowsFor(WO + NA));
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    const p = pBlend; gl.useProgram(p); texUnit = 0;
    bindT(p, 'uCP', slotCur.tex[0]); bindT(p, 'uCC', slotCur.tex[1]);
    bindT(p, 'uPP', snapMode ? snapT.tex[0] : slotPrev.tex[0]); bindT(p, 'uPC', snapMode ? snapT.tex[1] : slotPrev.tex[1]); bindT(p, 'uLogoPts', logoPtsTex);
    gl.uniform1i(p.u('uNC'), wCur.n); gl.uniform1i(p.u('uNP'), inTr ? (snapMode ? naSnap : wPrev.n) : 0); gl.uniform1i(p.u('uPOff'), snapMode ? WO : 0);
    gl.uniform1i(p.u('uMode'), inTr ? 1 : 0); gl.uniform1i(p.u('uLGN'), Math.min(LG, LOGO.n));
    gl.uniform1f(p.u('uK'), clamp(k, 0, 1)); gl.uniform1f(p.u('uT'), t); gl.uniform1f(p.u('uLevel'), A.level); gl.uniform1f(p.u('uLow'), A.low); gl.uniform1f(p.u('uHigh'), A.high); gl.uniform1f(p.u('uFlash'), coreFlash);
    gl.uniform1fv(p.u('uB[0]'), A.bands);
    for (let r = 0; r < RMAX; r++) { uRip.set([rX[r], rY[r], rZ[r], rAge[r]], r * 4); uRipS[r * 2] = rStr[r]; uRipS[r * 2 + 1] = rSpd[r]; }
    gl.uniform4fv(p.u('uRip[0]'), uRip); gl.uniform2fv(p.u('uRipS[0]'), uRipS);
    const xf = wCur.logoXf;
    gl.uniform1f(p.u('uLW'), logoW); gl.uniform1f(p.u('uLSz'), LX.sz); gl.uniform1f(p.u('uLY0'), LX.y0); gl.uniform1f(p.u('uLZ0'), LX.z0); gl.uniform1f(p.u('uLFollow'), LX.follow);
    gl.uniform1f(p.u('uLAy'), wCur.ay); gl.uniform1f(p.u('uLAx'), wCur.ax); gl.uniform1f(p.u('uLTipF'), xf && xf.tip ? (wCur.tipFlash || 0) : 0); gl.uniform3fv(p.u('uLTip'), xf && xf.tip ? xf.tip : [0, 0, 0]);
    gl.uniform4fv(p.u('uWisp[0]'), uWisp); gl.uniform3fv(p.u('uWispC[0]'), uWispC);
    bindT(p, 'uFlow', flowTex); gl.uniform1f(p.u('uFlowOn'), flowLive && S.flow ? 1 : 0);
    mul4(VP, proj, MV); gl.uniformMatrix4fv(p.u('uVP'), false, VP);
    gl.uniform3f(p.u('uCR'), cam.rx, cam.ry, cam.rz); gl.uniform3f(p.u('uCU'), cam.ux, cam.uy, cam.uz);
    gl.uniform1f(p.u('uTanH'), Math.tan(fovNow / 2)); gl.uniform1f(p.u('uAsp'), aspect); gl.uniform1f(p.u('uScI'), 1 / sc);
    drawFS();
  }
  mark('blend');

  /* ---- render ---- */
  gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb); gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(pBg);
  gl.uniform2f(pBg.u('uRes'), W, H); gl.uniform1f(pBg.u('uTime'), t); gl.uniform1f(pBg.u('uLevel'), A.level); gl.uniform2f(pBg.u('uCenter'), cu, cvv);
  { const th = hueRotJS(tint, hueNow, [0, 0, 0]), lum = 0.2126 * th[0] + 0.7152 * th[1] + 0.0722 * th[2] + 1e-3, kk = Math.min(0.32 / lum, 1.3); gl.uniform3f(pBg.u('uTint'), th[0] * kk, th[1] * kk, th[2] * kk); }
  gl.uniform1f(pBg.u('uCamAmt'), CAM.on ? S.camAmt : 0); gl.uniform1f(pBg.u('uCamAsp'), CAM.aspect); gl.uniform1f(pBg.u('uCamMirror'), CAM.mirror ? 1 : 0); gl.uniform1f(pBg.u('uMotion'), A.motion);
  gl.uniform3fv(pBg.u('uFogC'), fogC); gl.uniform1f(pBg.u('uFogAmt'), Math.min(1, cam.fogD * 7));
  bindTex(2, camTex, pBg, 'uCam');
  drawFS();

  const nInst = WO + NA;
  const partPass = pass => {
    const p = pPart; gl.useProgram(p); texUnit = 0;
    bindT(p, 'uFP', finT.tex[0]); bindT(p, 'uFC', finT.tex[1]);
    gl.uniformMatrix4fv(p.u('uProj'), false, proj); gl.uniformMatrix4fv(p.u('uMV'), false, MV); gl.uniformMatrix4fv(p.u('uV'), false, VIEW);
    gl.uniform1f(p.u('uPx'), pxs); gl.uniform1f(p.u('uAp'), ap); gl.uniform1f(p.u('uFocus'), focus); gl.uniform1f(p.u('uEcap'), 1.2 + V.hot * 5);
    gl.uniform1f(p.u('uPass'), pass); gl.uniform1f(p.u('uCentroid'), A.centroid); gl.uniform1f(p.u('uSc'), sc); gl.uniform3fv(p.u('uFlashC'), flashC);
    gl.uniform3f(p.u('uL'), light[0], light[1], light[2]); gl.uniform1f(p.u('uTime'), t); gl.uniform1f(p.u('uHue'), hueNow);
    gl.uniform1f(p.u('uHot'), hot); gl.uniform1f(p.u('uFogD'), cam.fogD); gl.uniform1f(p.u('uFogS'), cam.fogS); gl.uniform3fv(p.u('uFogC'), fogC);
    gl.uniform4fv(p.u('uLp[0]'), LP); gl.uniform3fv(p.u('uLc[0]'), LC);
    gl.bindVertexArray(quadVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nInst);
  };
  // pass 1: in-focus pearls, opaque, into the depth buffer
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
  mark('bg');
  if (!PROF.skip.pearls) partPass(0);
  mark('pearls');
  // pass 2: everything that glows, added on top and hidden behind pearls
  gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  if (fcount > 0) {
    gl.useProgram(pFil);
    gl.uniformMatrix4fv(pFil.u('uProj'), false, proj); gl.uniformMatrix4fv(pFil.u('uMV'), false, MV);
    gl.uniform1f(pFil.u('uPx'), pxs); gl.uniform1f(pFil.u('uFocus'), focus); gl.uniform1f(pFil.u('uAp'), ap * 0.8); gl.uniform1f(pFil.u('uHue'), hueNow); gl.uniform1f(pFil.u('uSc'), sc); gl.uniform1f(pFil.u('uWeight'), 1);
    gl.uniform1f(pFil.u('uHot'), hot); gl.uniform1f(pFil.u('uFogD'), cam.fogD); gl.uniform1f(pFil.u('uFogS'), cam.fogS); gl.uniform3fv(pFil.u('uFogC'), fogC);
    gl.bindVertexArray(FV.vao); gl.bindBuffer(gl.ARRAY_BUFFER, FV.ib); gl.bufferSubData(gl.ARRAY_BUFFER, 0, finst, 0, fcount * FSTRIDE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fcount);
  }
  if (!PROF.skip.lines) drawLines(wCur, (inTr ? smooth(0.35, 1, k) : 1), proj, pxs, focus, ap, sc, hot);
  if (prevLive) drawLines(wPrev, 1 - smooth(0, 0.5, k), proj, pxs, focus, ap, sc, hot);
  mark('lines');
  if (!PROF.skip.glows) partPass(1);
  mark('glows');
  gl.bindVertexArray(null); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true);

  const tw_ = trails[trailIdx], tr_ = trails[1 - trailIdx];
  gl.bindFramebuffer(gl.FRAMEBUFFER, tw_.fb);
  gl.useProgram(pTrail);
  bindTex(0, scene.tex, pTrail, 'uScene'); bindTex(1, tr_.tex, pTrail, 'uPrev');
  { const tf = Math.max(wCur.trailFloor || 0, 0), trl = Math.max(V.trail, tf), dT = trl > 0.01 ? 0.55 + 0.38 * trl : 0, dE = V.echo > 0.01 ? 0.8 + 0.17 * V.echo : 0;
    gl.uniform1f(pTrail.u('uDecay'), Math.pow(Math.max(dT, dE), dt * 60));
    gl.uniform1f(pTrail.u('uZoom'), 1 - V.echo * 0.022 * (1 + A.level * 0.8) * echoZoomNow);
    gl.uniform1f(pTrail.u('uRot'), V.echo * 0.006 * Math.sin(t * 0.045 + 0.7));
    gl.uniform1f(pTrail.u('uAsp'), aspect); }
  drawFS();

  gl.useProgram(pDown);
  let src = tw_;
  for (let i = 0; i < mips.length; i++) {
    const m = mips[i]; gl.bindFramebuffer(gl.FRAMEBUFFER, m.fb); gl.viewport(0, 0, m.w, m.h);
    bindTex(0, src.tex, pDown, 'uTex'); gl.uniform2f(pDown.u('uTexel'), 1 / src.w, 1 / src.h); gl.uniform1f(pDown.u('uFirst'), i === 0 ? 1 : 0); gl.uniform1f(pDown.u('uThr'), V.thr);
    drawFS(); src = m;
  }
  gl.useProgram(pUp); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = mips.length - 1; i > 0; i--) {
    const m = mips[i], dst = mips[i - 1]; gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
    bindTex(0, m.tex, pUp, 'uTex'); gl.uniform2f(pUp.u('uTexel'), 1 / m.w, 1 / m.h); drawFS();
  }
  gl.disable(gl.BLEND);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
  gl.useProgram(pComp);
  bindTex(0, tw_.tex, pComp, 'uScene'); bindTex(1, mips[0].tex, pComp, 'uBloom'); bindTex(3, logoTex, pComp, 'uLogo');
  gl.uniform2f(pComp.u('uRes'), W, H); gl.uniform1f(pComp.u('uBloomStr'), 0.01 + V.glow * 0.065); gl.uniform1f(pComp.u('uFlash'), coreFlash);
  gl.uniform1f(pComp.u('uMirN'), mirN); gl.uniform1f(pComp.u('uMirMix'), mirN > 0 ? mirMix : 0); gl.uniform1f(pComp.u('uMirRot'), mirRot);
  gl.uniform1f(pComp.u('uGradeMix'), gradeMix); gl.uniform1f(pComp.u('uGradeHue'), hueNow);
  gl.uniform3fv(pComp.u('uG0'), gradeCur[0]); gl.uniform3fv(pComp.u('uG1'), gradeCur[1]); gl.uniform3fv(pComp.u('uG2'), gradeCur[2]); gl.uniform3fv(pComp.u('uG3'), gradeCur[3]);
  gl.uniform1f(pComp.u('uTime'), t); gl.uniform1f(pComp.u('uCA'), 0.02); gl.uniform1f(pComp.u('uGrain'), SCENE_HDR ? 0.03 : 0.02);
  gl.uniform1f(pComp.u('uExpo'), V.exposure * limG); gl.uniform1f(pComp.u('uRoll'), V.rolloff); gl.uniform1f(pComp.u('uWhite'), V.white);
  gl.uniform1f(pComp.u('uSat'), V.sat); gl.uniform1f(pComp.u('uCon'), V.contrast);
  gl.uniform1f(pComp.u('uLens'), logoSdfOK ? lensMode : 0); gl.uniform1f(pComp.u('uLensMix'), lensMix * V.lensAmt);
  gl.uniform1f(pComp.u('uLensSize'), V.lensSize * (1 + S.lensPulse * coreFlash * 0.07));
  gl.uniform2f(pComp.u('uLensOff'), 0, -0.27 * V.lensPos); gl.uniform1f(pComp.u('uLensRot'), S.lensSpin ? mirRot * 3 : 0);
  gl.uniform1f(pComp.u('uLevel'), A.level); gl.uniform1f(pComp.u('uKick'), coreFlash * (0.4 + S.lensPulse));
  drawFS();
  mark('post');
  trailIdx = 1 - trailIdx;

  drawMeter();
  if (camUIdirty && panel.classList.contains('open')) syncCamUI();
  perfTick(now, cpuMid - cpu0, dt);
}
let kickedThisFrame = false, echoZoomNow = 1, wispAmt = 1;

/* adaptive quality: drop render scale if the device can't hold ~50 fps, creep back up when it can */
function perfTick(now, cpuMs, dt) {
  PERF.frames++; PERF.cpu = lerp(PERF.cpu || cpuMs, cpuMs, 0.1);
  if (dt > 0) PERF.fpsAvg = lerp(PERF.fpsAvg, 1 / Math.max(dt, 1e-3), 0.05);
  if (now - PERF.last > 500) {
    const fps = PERF.frames * 1000 / (now - PERF.last); PERF.frames = 0; PERF.last = now;
    if (tSim > 4) {
      if (fps < 48) { PERF.low++; PERF.high = 0; } else if (fps > 58) { PERF.high++; PERF.low = 0; } else { PERF.low = 0; PERF.high = 0; }
      if (PERF.low >= 4 && rscale > 0.55) { rscale = Math.max(0.55, rscale - 0.1); PERF.low = 0; }
      if (PERF.high >= 12 && rscale < 1) { rscale = Math.min(1, rscale + 0.05); PERF.high = 0; }
    }
    if (S.stats) $('#stats').textContent =
      `FPS        ${fps.toFixed(0)}\nFrame JS   ${PERF.cpu.toFixed(1)} ms\nRender     ${W} x ${H}  (${(Math.min(S.quality, rscale) * 100).toFixed(0)}%)\nParticles  ${(WO + NA).toLocaleString()}\nLines      ${(fcount + gpuSegs).toLocaleString()}\nDetail     ${S.detail.toFixed(2)}\nWorld      ${WORLDS[cur].name}\nAudio      ${S.demo ? 'demo' : A.live ? 'mic' : 'none'} · ${A.onsetRate.toFixed(1)} hits/s`;
  }
}
