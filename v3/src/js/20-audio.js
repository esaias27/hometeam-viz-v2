/* ================================================================== */
/* Audio: 16 log bands, per-band auto gain, kick / snare / hat onsets  */
/* ================================================================== */
const NB = 16;
const A = { level: 0, low: 0, mid: 0, high: 0, presence: 0, centroid: 0.35, bands: new Float32Array(NB), onsetRate: 0, motion: 0, live: false };
let actx = null, analyser = null, micStream = null, micSrc = null, tBuf = null, fBuf = null;
const bandBins = [], bandFc = [], bFloor = new Float32Array(NB).fill(-100), bPeak = new Float32Array(NB).fill(-60), prevV = new Float32Array(NB);
let lFloor = -80, lPeak = -40, onsetCount = 0, onsetWindow = 0;
const GROUPS = [{ kind: 'kick', a: 0, b: 5, avg: 0.05, last: -9, gap: 0.2, k: 1.55 }, { kind: 'snare', a: 5, b: 11, avg: 0.05, last: -9, gap: 0.14, k: 1.7 }, { kind: 'hat', a: 11, b: 16, avg: 0.05, last: -9, gap: 0.09, k: 1.8 }];
const follow = (cur, target, dt, att, rel) => cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? att : rel)));
function ensureCtx() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return actx; }
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.3;
  tBuf = new Float32Array(analyser.fftSize); fBuf = new Float32Array(analyser.frequencyBinCount);
  const hz = actx.sampleRate / analyser.fftSize;
  for (let b = 0; b < NB; b++) {
    const lo = 45 * Math.pow(11000 / 45, b / NB), hi = 45 * Math.pow(11000 / 45, (b + 1) / NB);
    const i0 = Math.max(1, Math.floor(lo / hz)), i1 = Math.max(i0 + 1, Math.ceil(hi / hz));
    bandBins.push([i0, Math.min(i1, fBuf.length)]); bandFc.push(Math.sqrt(lo * hi));
  }
  return actx;
}
async function startMic() {
  if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('nomd'), { name: 'NoMediaDevices' });
  ensureCtx();
  const resumeP = actx.resume();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
  await resumeP.catch(() => {});
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (micSrc) { try { micSrc.disconnect(); } catch (e) {} }
  micStream = stream; micSrc = actx.createMediaStreamSource(stream); micSrc.connect(analyser);
  A.live = true;
  stream.getAudioTracks()[0].addEventListener('ended', () => { A.live = false; toast('Mic disconnected · tap Reconnect Mic'); updateUI(); });
  S.demo = false; updateUI();
}
function analyze(dt, t) {
  if (S.demo) { demoGroove(dt, t); return; }
  if (!analyser || !A.live) {
    A.level = follow(A.level, 0, dt, 0.05, 0.4);
    for (let b = 0; b < NB; b++) A.bands[b] = follow(A.bands[b], 0, dt, 0.05, 0.4);
    A.low = follow(A.low, 0, dt, 0.1, 0.4); A.mid = follow(A.mid, 0, dt, 0.1, 0.4); A.high = follow(A.high, 0, dt, 0.1, 0.4);
    A.presence = follow(A.presence, 0, dt, 1.2, 2.6); A.onsetRate = follow(A.onsetRate, 0, dt, 0.5, 1.5);
    return;
  }
  const curve = 1.5 / S.sens;
  analyser.getFloatTimeDomainData(tBuf);
  let s = 0; for (let i = 0; i < tBuf.length; i++) s += tBuf[i] * tBuf[i];
  const db = 20 * Math.log10(Math.sqrt(s / tBuf.length) + 1e-9);
  if (db < lFloor) lFloor = follow(lFloor, db, dt, 0.25, 0.25); else lFloor += dt * 0.6;
  lFloor = clamp(lFloor, -100, -22);
  lPeak = Math.max(db, lPeak - dt * 3, lFloor + 22);
  const lLo = Math.max(lFloor + 5, lPeak - 40);
  const lt = Math.pow(clamp((db - lLo) / (lPeak - lLo), 0, 1), curve);
  A.level = follow(A.level, lt, dt, 0.022, 0.2);
  analyser.getFloatFrequencyData(fBuf);
  const gate = smooth(0.03, 0.14, lt);
  const flux = [0, 0, 0];
  let cw = 0, cs = 0;
  for (let b = 0; b < NB; b++) {
    const [i0, i1] = bandBins[b];
    let p = 0; for (let i = i0; i < i1; i++) { const v = fBuf[i]; p += v > -200 ? Math.pow(10, v / 10) : 0; }
    const bdb = 10 * Math.log10(p / (i1 - i0) + 1e-14) + 3 * Math.log2(bandFc[b] / 500);
    if (bdb < bFloor[b]) bFloor[b] = follow(bFloor[b], bdb, dt, 0.3, 0.3); else bFloor[b] += dt * 0.6;
    bPeak[b] = Math.max(bdb, bPeak[b] - dt * 4, bFloor[b] + 20);
    const lo = Math.max(bFloor[b] + 4, bPeak[b] - 46);
    const v = Math.pow(clamp((bdb - lo) / (bPeak[b] - lo), 0, 1), curve * 1.25) * gate;
    flux[b < 5 ? 0 : b < 11 ? 1 : 2] += Math.max(0, v - prevV[b]); prevV[b] = v;
    A.bands[b] = follow(A.bands[b], v, dt, 0.03, 0.18);
    cw += A.bands[b] * b; cs += A.bands[b];
  }
  bandGroups(dt);
  if (cs > 0.05) A.centroid = follow(A.centroid, cw / cs / 15, dt, 0.1, 0.4);
  A.presence = follow(A.presence, clamp(A.level * 1.6, 0, 1), dt, 1.2, 2.6);
  for (let g = 0; g < 3; g++) {
    const G = GROUPS[g], f = flux[g] / (G.b - G.a);
    if (f > G.avg * G.k + 0.03 && t - G.last > G.gap && lt > 0.1) { fire(G.kind, clamp(0.35 + f * 4.2, 0.3, 1.4)); G.last = t; }
    G.avg = follow(G.avg, f, dt, 0.25, 0.25);
  }
  onsetWindow += dt;
  if (onsetWindow > 1) { A.onsetRate = lerp(A.onsetRate, onsetCount / onsetWindow, 0.5); onsetCount = 0; onsetWindow = 0; }
}
function bandGroups() {
  let l = 0, m = 0, h = 0;
  for (let b = 0; b < 5; b++) l += A.bands[b];
  for (let b = 5; b < 11; b++) m += A.bands[b];
  for (let b = 11; b < 16; b++) h += A.bands[b];
  A.low = l / 5; A.mid = m / 6; A.high = h / 5;
}
// Demo groove: a 120 bpm groove with build-ups and drops, so it all works without a mic
let demoBeat = -1, demo8 = -1;
function demoGroove(dt, t) {
  const bt = t * 2, ph = bt % 1, beat = Math.floor(bt), e8 = Math.floor(bt * 2);
  const sec = Math.floor(bt / 32) % 4, dyn = [0.55, 1, 0.75, 1.1][sec];
  const kick = Math.pow(1 - ph, 5), sn = (beat % 2) ? Math.pow(1 - ph, 7) : 0, hat = Math.pow(1 - (bt * 2 % 1), 10);
  for (let b = 0; b < NB; b++) {
    let v = b < 5 ? 0.2 + 0.75 * kick * (1 - b * 0.08) : b < 11 ? 0.18 + 0.12 * Math.sin(t * 1.3 + b) + 0.55 * sn : 0.1 + 0.55 * hat * (sec % 2 ? 1 : 0.5) + 0.1 * Math.sin(t * 2.1 + b);
    A.bands[b] = follow(A.bands[b], clamp(v * dyn, 0, 1), dt, 0.02, 0.15);
  }
  bandGroups(dt);
  let s = 0; for (let b = 0; b < NB; b++) s += A.bands[b];
  A.level = follow(A.level, clamp(s / NB * 1.6, 0, 1), dt, 0.02, 0.2);
  A.presence = follow(A.presence, clamp(A.level * 1.6, 0, 1), dt, 1.2, 2.6);
  A.centroid = 0.35 + 0.15 * Math.sin(t * 0.2);
  if (demoBeat < 0) { demoBeat = beat; demo8 = e8; }
  if (beat !== demoBeat) { demoBeat = beat; fire('kick', clamp((0.65 + (beat % 4 === 0 ? 0.3 : 0)) * dyn, 0.3, 1.3)); if (beat % 2) fire('snare', 0.6 * dyn); }
  if (e8 !== demo8) { demo8 = e8; if (e8 % 2 && sec % 2) fire('hat', 0.5 * dyn); }
  onsetWindow += dt;
  if (onsetWindow > 1) { A.onsetRate = lerp(A.onsetRate, onsetCount / onsetWindow, 0.5); onsetCount = 0; onsetWindow = 0; }
}

// The raw trace for Tide: a trigger-aligned slice of the waveform (so it stands still like an oscilloscope), auto-gained to fill the range
const WAVE_N = 512, wave = new Float32Array(WAVE_N);
let wavePeak = 0.05;
function captureWave(dt, t) {
  const quiet = smooth(0.0, 0.25, A.level);
  if (S.demo || !analyser || !A.live) {
    let norm = 0;
    for (let b = 0; b < NB; b++) norm += A.bands[b] * (1 - b * 0.03);
    norm = 1 / Math.max(0.6, norm * 0.55);
    for (let j = 0; j < WAVE_N; j++) {
      const x = j / (WAVE_N - 1); let v = 0;
      for (let b = 0; b < NB; b++) v += A.bands[b] * (1 - b * 0.045) * Math.sin(TAU * x * (0.9 * Math.pow(1.24, b)) + t * (0.9 + b * 0.31) + b * 1.7);
      wave[j] = v * norm * quiet;
    }
    return;
  }
  const n = tBuf.length, span = 1024;
  let start = 0;
  for (let i = 1; i < n - span; i++) if (tBuf[i - 1] < 0 && tBuf[i] >= 0) { start = i; break; }
  let pk = 0;
  for (let j = 0; j < WAVE_N; j++) {
    const f = start + j / (WAVE_N - 1) * (span - 1), i0 = f | 0, a = f - i0, v = tBuf[i0] * (1 - a) + tBuf[Math.min(n - 1, i0 + 1)] * a;
    wave[j] = v; pk = Math.max(pk, Math.abs(v));
  }
  wavePeak = Math.max(pk, wavePeak * Math.exp(-dt * 0.7), 0.004);
  const g = quiet / wavePeak;
  for (let j = 0; j < WAVE_N; j++) wave[j] *= g;
}
