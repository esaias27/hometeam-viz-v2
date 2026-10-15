/* ================================================================== */
/* Camera: a real orbit camera, navigated like Maya or Cinema 4D       */
/* ================================================================== */
// Each world keeps its own camera: target point, distance, heading / pitch / bank in degrees (pitch up is positive),
// focal length in mm on a full-frame back, f-stop and focus offset. Motion layers ride on top: sway, drift,
// auto-orbit and the world's own move (Lot's crane). Six stored angles per world can be recalled, toured or cut between.
const CAM_FIELDS = [
  { k: 'f', l: 'Focal length', min: 12, max: 200, st: 1, u: 'mm', g: 'Lens' },
  { k: 'fstop', l: 'f-stop', min: 1.4, max: 22, st: 0.1, u: '', g: 'Lens' },
  { k: 'focusOff', l: 'Focus offset', min: -8, max: 8, st: 0.05, u: '', g: 'Lens' },
  { k: 'dist', l: 'Distance', min: 0.6, max: 40, st: 0.05, u: '', g: 'Position' },
  { k: 'h', l: 'Heading', min: -180, max: 180, st: 0.5, u: '°', g: 'Position' },
  { k: 'p', l: 'Pitch', min: -89, max: 89, st: 0.5, u: '°', g: 'Position' },
  { k: 'b', l: 'Bank', min: -180, max: 180, st: 0.5, u: '°', g: 'Position' },
  { k: 'tx', l: 'Target X', min: -15, max: 15, st: 0.01, u: '', g: 'Position' },
  { k: 'ty', l: 'Target Y', min: -10, max: 10, st: 0.01, u: '', g: 'Position' },
  { k: 'tz', l: 'Target Z', min: -40, max: 15, st: 0.01, u: '', g: 'Position' },
  { k: 'sway', l: 'Sway', min: 0, max: 3, st: 0.01, u: '', g: 'Motion' },
  { k: 'drift', l: 'Drift', min: 0, max: 2, st: 0.01, u: '', g: 'Motion' },
  { k: 'orbit', l: 'Auto orbit', min: -30, max: 30, st: 0.5, u: '°/s', g: 'Motion' },
  { k: 'layer', l: 'World move', min: 0, max: 2, st: 0.01, u: '', g: 'Motion' }
];
const CAM_EXTRA = { fstop: 4, focusOff: 0, sway: 1, drift: 1, orbit: 0, layer: 1 };
const CAM_DEF = {}, CT = {}, CL = {};   // defaults, targets (saved), live (glides toward the target)
S.cam3 = S.cam3 || {}; S.slots = S.slots || {};
let camGlide = 10;
function initCameras() {
  WORLDS.forEach((w, i) => {
    const name = NAMES[i];
    CAM_DEF[name] = Object.assign({}, CAM_EXTRA, w.cam0);
    CT[name] = Object.assign({}, CAM_DEF[name], S.cam3[name] || {});
    for (const k in CT[name]) if (!(k in CAM_DEF[name])) delete CT[name][k];
    CL[name] = Object.assign({}, CT[name]);
    S.cam3[name] = CT[name];
    if (!Array.isArray(S.slots[name])) S.slots[name] = [null, null, null, null, null, null];
  });
}
const camT = () => CT[NAMES[cur]];
function camTouched(glide) { camGlide = glide || 30; saveSoon(); camUIdirty = true; }
function tweenCameras(dt) {
  const kf = 1 - Math.exp(-dt * camGlide);
  for (const name of NAMES) {
    const T = CT[name], L = CL[name];
    T.h = wrap(T.h + T.orbit * dt, -180, 180);
    for (const k in T) {
      if (k === 'h' || k === 'b') L[k] += wrap(T[k] - L[k], -180, 180) * kf;
      else if (k === 'dist' || k === 'f') L[k] = Math.exp(lerp(Math.log(L[k]), Math.log(T[k]), kf));
      else L[k] += (T[k] - L[k]) * kf;
    }
    L.h = wrap(L.h, -180, 180);
  }
  camGlide = Math.min(10, camGlide + dt * 0.5 * (camGlide < 10 ? 1 : 0));
}
// stored angles
function storeSlot(k) { S.slots[NAMES[cur]][k] = Object.assign({}, camT()); save(); toast(`Camera ${k + 1} stored`); camUIdirty = true; }
function recallSlot(k, cut) {
  const sl = S.slots[NAMES[cur]][k]; if (!sl) { toast(`Camera ${k + 1} is empty · Shift+${k + 1} to store`); return false; }
  Object.assign(camT(), sl);
  if (cut) Object.assign(CL[NAMES[cur]], sl); else camGlide = 1.4;
  camUIdirty = true; saveSoon(); return true;
}
function resetCamera() { Object.assign(camT(), CAM_DEF[NAMES[cur]]); camGlide = 1.6; camUIdirty = true; save(); toast('Camera reset'); }
// tours: glide or cut through the stored angles on the beat, or cut on drops
let tourIdx = 0, tourKicks = 0, tEFast = 0, tESlow = 0, tCool = 0;
function tourStep(cut) {
  const name = NAMES[cur], slots = S.slots[name], filled = slots.map((s, k) => s ? k : -1).filter(k => k >= 0);
  if (filled.length >= 2) { tourIdx = (tourIdx + 1) % filled.length; recallSlot(filled[tourIdx], cut); return; }
  // no stored angles yet: invent one near the home angle
  const d = CAM_DEF[name], T = camT();
  Object.assign(T, { h: d.h + (Math.random() - 0.5) * 80, p: clamp(d.p + (Math.random() - 0.5) * 24, -80, 80), dist: d.dist * (0.65 + Math.random() * 0.7), b: (Math.random() - 0.5) * 10 });
  if (cut) Object.assign(CL[name], T); else camGlide = 1.2;
  camUIdirty = true;
}
function tourTick(dt, kick) {
  tEFast = follow(tEFast, A.level, dt, 0.15, 0.4); tESlow = follow(tESlow, A.level, dt, 5, 5); tCool -= dt;
  if (!S.tour) return;
  if (kick) { tourKicks++; if ((S.tour === 1 || S.tour === 2) && tourKicks >= S.tourEvery) { tourKicks = 0; tourStep(S.tour === 2); } }
  if (S.tour === 3 && tCool <= 0 && tEFast > 0.35 && tEFast > tESlow * 1.7 + 0.05) { tCool = 3; tourStep(true); }
}

// resolve a world's camera into an eye, a target and lens values, with its motion layers applied
function resolveCam(w, name, t, aspect, o) {
  const L = CL[name], lay = w.camLayer, ls = L.layer;
  const sw = (reduceMotion ? 0.05 : 0.22) * L.sway * (w.swayMul ?? 1);
  let az = L.h * Math.PI / 180 + sw * (Math.sin(t * 0.05) * 0.8 + Math.sin(t * 0.021 + 1.3) * 0.2) + (lay ? lay.az * ls : 0);
  let el = -L.p * Math.PI / 180 + 0.06 * Math.sin(t * 0.037) * Math.min(1, L.sway) + (lay ? lay.el * ls : 0);
  el = clamp(el, -1.5, 1.5);
  const dist = L.dist * (lay ? lerp(1, lay.dist, ls) : 1);
  const tx = L.tx, ty = L.ty + (lay ? lay.ty * ls : 0), tz = L.tz;
  o.ex = tx + Math.sin(az) * Math.cos(el) * dist; o.ey = ty + Math.sin(el) * dist; o.ez = tz + Math.cos(az) * Math.cos(el) * dist;
  o.tx = tx; o.ty = ty; o.tz = tz; o.bank = L.b * Math.PI / 180;
  // focal length on a 36x24 back; portrait screens widen the lens so the subject still fits
  o.tanH = (12 / L.f) * Math.pow(Math.max(1, 1.15 / aspect), 0.6);
  o.focus = Math.max(0.3, dist + L.focusOff); o.ap = 0.05 * (4 / L.fstop) * (w.dofMul ?? 1);
  o.drift = (reduceMotion ? 0.3 : 0.75) * L.drift * (w.driftMul ?? 1);
  return o;
}
const camA = {}, camB = {};
function lerpCam(a, b, k) { for (const key in a) a[key] = key === 'bank' ? a.bank + wrap(b.bank - a.bank, -Math.PI, Math.PI) * k : lerp(a[key], b[key], k); return a; }

/* ---- navigation: Alt + left / middle / right drag to tumble / track / dolly, wheel to dolly; Fly mode for touch ---- */
const nav = { mode: null, x: 0, y: 0, ptrs: new Map(), span: 0, cx: 0, cy: 0 };
function navOrbit(dx, dy) { const T = camT(); T.h = wrap(T.h - dx * 0.25, -180, 180); T.p = clamp(T.p - dy * 0.25, -89, 89); camTouched(); }
function navPan(dx, dy) {
  const T = camT(), k = T.dist * (12 / T.f) * 2 / Math.max(1, canvas.clientHeight);
  T.tx -= (cam.rx * dx - cam.ux * dy) * k; T.ty -= (cam.ry * dx - cam.uy * dy) * k; T.tz -= (cam.rz * dx - cam.uz * dy) * k; camTouched();
}
function navDolly(f) { const T = camT(); T.dist = clamp(T.dist * f, 0.6, 40); camTouched(); }
function navStart(e) {
  if (!(e.altKey || S.fly)) return false;
  if (e.pointerType === 'touch') {
    nav.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    nav.mode = nav.ptrs.size >= 2 ? 'pinch' : 'orbit';
    if (nav.mode === 'pinch') { const p = [...nav.ptrs.values()]; nav.span = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); nav.cx = (p[0].x + p[1].x) / 2; nav.cy = (p[0].y + p[1].y) / 2; }
  } else nav.mode = e.button === 1 ? 'pan' : e.button === 2 ? 'dolly' : (e.shiftKey ? 'pan' : 'orbit');
  nav.x = e.clientX; nav.y = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  return true;
}
function navMove(e) {
  if (!nav.mode) return false;
  if (e.pointerType === 'touch' && nav.ptrs.has(e.pointerId)) {
    nav.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (nav.mode === 'pinch' && nav.ptrs.size >= 2) {
      const p = [...nav.ptrs.values()], span = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
      if (nav.span > 0 && span > 0) navDolly(nav.span / span);
      navPan(cx - nav.cx, cy - nav.cy); nav.span = span; nav.cx = cx; nav.cy = cy;
      return true;
    }
  }
  const dx = e.clientX - nav.x, dy = e.clientY - nav.y; nav.x = e.clientX; nav.y = e.clientY;
  if (nav.mode === 'orbit') navOrbit(dx, dy); else if (nav.mode === 'pan') navPan(dx, dy); else if (nav.mode === 'dolly') navDolly(Math.exp(-(dx + dy) * 0.005));
  return true;
}
function navEnd(e) {
  if (!nav.mode) return false;
  nav.ptrs.delete(e.pointerId);
  if (e.pointerType === 'touch' && nav.ptrs.size === 1) { const p = [...nav.ptrs.values()][0]; nav.mode = 'orbit'; nav.x = p.x; nav.y = p.y; return true; }
  if (nav.ptrs.size === 0) nav.mode = null;
  return true;
}
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); if (!WORLDS.length) return; navDolly(Math.exp(clamp(e.deltaY, -200, 200) * 0.0015)); }, { passive: false });
