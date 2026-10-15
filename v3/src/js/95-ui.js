/* UI                                                                  */
/* ================================================================== */
const meter = $('#meter'), mctx = meter.getContext('2d');
let meterTick = 0;
function drawMeter() {
  if (++meterTick % 15 === 0) {
    $('#status').textContent = S.demo ? 'Demo groove' : A.live ? 'Listening' : 'No mic';
    $('#dot').classList.toggle('live', S.demo || A.live);
  }
  if (!panel.classList.contains('open')) return;
  const w = meter.width, h = meter.height, bw = w / NB;
  mctx.clearRect(0, 0, w, h);
  for (let b = 0; b < NB; b++) { const v = A.bands[b], bh = Math.max(3, v * (h - 6)); mctx.fillStyle = `rgba(255,${Math.round(79 + b * 10)},${Math.round(216 + b * 2)},${0.25 + v * 0.7})`; mctx.fillRect(b * bw + 2, h - bh, bw - 4, bh); }
  if (meterTick % 15 === 0) $('#micStat').textContent = `Level ${String(Math.round(A.level * 99)).padStart(2, '0')} · ${A.onsetRate.toFixed(1)} hits/s`;
}
const panel = $('#panel'), menuBtn = $('#menuBtn');
let toastT = 0, nameT = 0, lastUI = 0, uiHidden = false;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }
function showLookName() {
  const w = WORLDS[cur]; if (!w) return;
  const el = $('#lookName'); el.querySelector('i').textContent = ROMAN[cur]; el.querySelector('b').textContent = w.name; el.querySelector('span').textContent = w.blurb;
  el.classList.add('show'); clearTimeout(nameT); nameT = setTimeout(() => el.classList.remove('show'), 3200);
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function pills(boxId, items, onClick) {
  const box = $(boxId); box.textContent = '';
  items.forEach((lab, i) => { const b = document.createElement('button'); b.className = 'pill'; b.innerHTML = lab; b.addEventListener('click', () => { onClick(i); poke(); }); box.appendChild(b); });
}
const LENSES = ['Off', 'Glass', 'Holo foil', 'Displace', 'Ghost', 'Window'];
const cap = s => s.charAt(0) + s.slice(1).toLowerCase();
const fmt = (v, st) => st >= 1 ? String(Math.round(v)) : (+v).toFixed(2);
let saveT = 0;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }
function buildUI() {
  pills('#worlds', WORLDS.map((w, i) => `<i>${ROMAN[i]}</i>${w.name}`), i => setWorld(i, tSim));
  pills('#kaleidos', MIRRORS.map(m => m ? m + ' fold' : 'No mirror'), i => { S.kaleido = i; save(); updateUI(); });
  pills('#grades', GRADES.map(g => cap(g.name)), i => { S.grade = i; save(); updateUI(); });
  pills('#cams', ['Off', 'Front', 'Back'], i => setCam(['off', 'user', 'environment'][i]));
  pills('#lenses', LENSES, i => { S.lens = i; save(); updateUI(); });
  pills('#lensPos', ['Center', 'Lower third'], i => { S.lensPos = i; save(); updateUI(); });
  document.querySelectorAll('input[data-k]').forEach(el => {
    const out = el.parentElement.querySelector('output'), show = () => { if (out) out.textContent = (+S[el.dataset.k]).toFixed(2); };
    el.value = S[el.dataset.k]; show();
    el.addEventListener('input', () => { S[el.dataset.k] = parseFloat(el.value); show(); saveSoon(); if (el.dataset.k === 'detail') { clearTimeout(detailT); detailT = setTimeout(rebuildAll, 250); } });
  });
  pills('#slots', ['1', '2', '3', '4', '5', '6'], i => { if (storeMode) { storeSlot(i); storeMode = false; } else recallSlot(i); syncCamUI(); });
  pills('#tours', ['Off', 'Glide', 'Cut on beat', 'Cut on drop'], i => { S.tour = i; tourKicks = 0; save(); syncCamUI(); });
  const tev = $('#c_tev'); tev.value = S.tourEvery; tev.parentElement.querySelector('output').textContent = S.tourEvery + ' beats';
  tev.addEventListener('input', () => { S.tourEvery = +tev.value; tev.parentElement.querySelector('output').textContent = S.tourEvery + ' beats'; saveSoon(); });
  buildWorldSettings(); buildPresets(); buildCamUI();
}
let detailT = 0, storeMode = false;

/* ---- camera panel ---- */
let camFor = '';
function buildCamUI() {
  const name = NAMES[cur], box = $('#camset'); box.textContent = ''; camFor = name; $('#camTitle').textContent = cap(name);
  const groups = [];
  for (const d of CAM_FIELDS) { if (d.k === 'layer' && !WORLDS[cur].camLayer) continue; let g = groups.find(x => x.name === d.g); if (!g) groups.push(g = { name: d.g, defs: [] }); g.defs.push(d); }
  groups.forEach((g, gi) => {
    const det = document.createElement('details'); det.className = 'grp'; if (gi < 2) det.open = true;
    det.innerHTML = `<summary>${g.name}</summary><div class="body"></div>`;
    const body = det.querySelector('.body');
    for (const d of g.defs) {
      const row = document.createElement('div'), id = 'cam_' + d.k; row.className = 'ctl';
      const lab = d.k === 'layer' && WORLDS[cur].camLayer.label ? WORLDS[cur].camLayer.label : d.l;
      row.innerHTML = `<label for="${id}">${lab}</label><output></output><input type="range" id="${id}" min="${d.min}" max="${d.max}" step="${d.st}">`;
      const inp = row.querySelector('input');
      inp.dataset.ck = d.k;
      inp.addEventListener('input', () => { camT()[d.k] = parseFloat(inp.value); camTouched(); syncCamUI(); });
      body.appendChild(row);
    }
    box.appendChild(det);
  });
  syncCamUI();
}
function syncCamUI() {
  camUIdirty = false;
  if (!WORLDS.length) return;
  if (camFor !== NAMES[cur]) { buildCamUI(); return; }
  const T = camT();
  $('#camset').querySelectorAll('input[data-ck]').forEach(inp => {
    const k = inp.dataset.ck, d = CAM_FIELDS.find(x => x.k === k), v = T[k];
    if (document.activeElement !== inp) inp.value = v;
    inp.parentElement.querySelector('output').textContent = (d.st >= 1 ? Math.round(v) : d.st >= 0.5 ? (+v).toFixed(1) : (+v).toFixed(2)) + d.u;
  });
  const sl = S.slots[NAMES[cur]];
  $('#slots').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('has', !!sl[i]));
  $('#tours').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('on', i === S.tour));
  $('#storeBtn').classList.toggle('on', storeMode);
  $('#flyBtn').classList.toggle('on', S.fly); $('#flyBtn2').classList.toggle('on', S.fly); $('#flyBtn').setAttribute('aria-pressed', S.fly ? 'true' : 'false');
}
function setFly(on) { S.fly = on; syncCamUI(); toast(on ? 'Fly: drag to orbit · two fingers to pan and pinch' : 'Fly off · taps send shockwaves'); }
$('#storeBtn').addEventListener('click', () => { storeMode = !storeMode; syncCamUI(); if (storeMode) toast('Tap a slot to store this angle'); });
$('#camReset').addEventListener('click', () => { resetCamera(); syncCamUI(); });
$('#flyBtn').addEventListener('click', e => { e.stopPropagation(); setFly(!S.fly); poke(); });
$('#flyBtn2').addEventListener('click', () => setFly(!S.fly));

/* ---- per-world settings, generated from the schema ---- */
let wsetFor = '';
function buildWorldSettings() {
  const name = NAMES[cur], T = WT[name], box = $('#wset');
  box.textContent = ''; wsetFor = name; $('#wsetTitle').textContent = cap(name);
  const defs = SCHEMA[name].concat(COMMON), groups = [];
  for (const d of defs) { let g = groups.find(x => x.name === d.g); if (!g) groups.push(g = { name: d.g, defs: [] }); g.defs.push(d); }
  groups.forEach((g, gi) => {
    const det = document.createElement('details'); det.className = 'grp'; if (gi === 0) det.open = true;
    det.innerHTML = `<summary>${g.name}</summary><div class="body"></div>`;
    const body = det.querySelector('.body');
    for (const d of g.defs) {
      if (d.opts) {
        const lab = document.createElement('div'); lab.className = 'sub'; lab.textContent = d.l; body.appendChild(lab);
        const row = document.createElement('div'); row.className = 'row'; row.dataset.wopt = d.k;
        d.opts.forEach((o, oi) => { const b = document.createElement('button'); b.className = 'pill' + (Math.round(T[d.k]) === oi ? ' on' : ''); b.textContent = o;
          b.addEventListener('click', () => { T[d.k] = oi; row.querySelectorAll('.pill').forEach((x, xi) => x.classList.toggle('on', xi === oi)); saveSoon(); poke(); }); row.appendChild(b); });
        body.appendChild(row); continue;
      }
      const row = document.createElement('div'), id = 'w_' + d.k; row.className = 'ctl';
      row.innerHTML = `<label for="${id}">${d.l}${d.rb ? '<em>rebuild</em>' : ''}</label><output></output><input type="range" id="${id}" min="${d.min}" max="${d.max}" step="${d.st}">`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.dataset.wk = d.k; inp.value = T[d.k]; out.textContent = fmt(T[d.k], d.st);
      inp.addEventListener('input', () => { T[d.k] = parseFloat(inp.value); out.textContent = fmt(T[d.k], d.st); if (d.rb) scheduleRebuild(name); saveSoon(); });
      body.appendChild(row);
    }
    box.appendChild(det);
  });
}
function syncWorldSettings() {
  const name = NAMES[cur]; if (wsetFor !== name) { buildWorldSettings(); return; }
  const T = WT[name], defs = schemaOf(name);
  $('#wset').querySelectorAll('input[data-wk]').forEach(inp => {
    const k = inp.dataset.wk, d = defs.find(x => x.k === k);
    if (+inp.value !== +T[k]) { inp.value = T[k]; inp.parentElement.querySelector('output').textContent = fmt(T[k], d.st); }
  });
  $('#wset').querySelectorAll('[data-wopt]').forEach(row => row.querySelectorAll('.pill').forEach((x, xi) => x.classList.toggle('on', xi === Math.round(T[row.dataset.wopt]))));
}
function rebuildIfNeeded(name) { if (schemaOf(name).some(d => d.rb && WT[name][d.k] !== WP[name][d.k])) scheduleRebuild(name); }
function resetWorld() { const name = NAMES[cur]; Object.assign(WT[name], WORLD_DEF[name]); rebuildIfNeeded(name); save(); syncWorldSettings(); toast(cap(name) + ' reset'); }
// Mutate: nudge every look-and-motion setting of this world somewhere new; the tweening turns it into a slow morph
function mutate() {
  const name = NAMES[cur], T = WT[name];
  for (const d of SCHEMA[name].concat(COMMON.filter(c => c.g === 'Look' && !c.rb))) {
    if (d.rb || ['foldSync', 'layout', 'speed'].includes(d.k)) continue;
    let v = T[d.k] + (Math.random() - 0.5) * (d.max - d.min) * 0.45;
    if (d.st >= 1) v = Math.round(v);
    T[d.k] = clamp(v, d.min, d.max);
  }
  save(); syncWorldSettings(); toast('Mutating ' + cap(name));
}

/* ---- presets: factory looks, your own, share links ---- */
const FACTORY = [
  { name: 'Broadcast', world: 'TOWER', wp: {} },
  { name: 'Transmission storm', world: 'TOWER', wp: { pulseRate: 2.2, toward: 1.8, expand: 2, bolts: 2, life: 3 }, look: { echo: 0.45 } },
  { name: 'Quiet signal', world: 'TOWER', wp: { pulseRate: 0.45, expand: 0.8, toward: 0.4, bolts: 0.25, thick: 0.1 } },
  { name: 'Fourth of July', world: 'LOT', wp: { fwRate: 2.4, fwSize: 1.3, fwSparks: 1.5, finale: 0.8, variety: 1 } },
  { name: 'Lantern festival', world: 'LOT', wp: { fwRate: 0.25, lanterns: 2, beams: 3, sweep: 0.4 } },
  { name: 'Grand finale', world: 'LOT', wp: { fwRate: 3, fwSize: 1.6, fwSparks: 2, variety: 1, streak: 1.6 }, look: { echo: 0.3 } },
  { name: 'Supercell', world: 'STORM', wp: {} },
  { name: 'Rope tornado', world: 'STORM', wp: { baseWidth: 0.6, noiseAmt: 2, noiseScale: 1.6, funnel: 1.5, psize: 0.7 } },
  { name: 'Wedge', world: 'STORM', wp: { baseWidth: 2.8, noiseAmt: 0.5, subVort: 6, debris: 2, inflow: 1.8 } },
  { name: 'Violet storm', world: 'STORM', wp: { palette: 1 } },
  { name: 'Kelp cathedral', world: 'REEF', wp: { height: 1.6, variation: 0.35, travel: 0.6, stalks: 320 } },
  { name: 'Night dive', world: 'REEF', wp: { fog: 2, snow: 2, fogHue: 0.85, travel: 1.4 } },
  { name: 'Coral garden', world: 'REEF', wp: { coral: 2, stalks: 120, height: 0.7, travel: 0.5 } },
  { name: 'Endless blossom', world: 'BLOOM', wp: {} },
  { name: 'Mandala', world: 'BLOOM', wp: { foldSync: 1, sharp: 1.6, twist: 0.3 }, look: { kaleido: 3, echo: 0.4 } },
  { name: 'Rose', world: 'BLOOM', wp: { petals: 5, ruffle: 2.6, sharp: 0.5, cup: 2.2, palette: 3 } },
  { name: 'Oscilloscope sea', world: 'TIDE', wp: {} },
  { name: 'Spectrum ridges', world: 'TIDE', wp: { source: 2, specMix: 0, gain: 1.1 } },
  { name: 'Kick rings', world: 'TIDE', wp: { source: 4, gain: 1.4, cross: 0.6 } },
  { name: 'Wireframe ocean', world: 'TIDE', wp: { source: 5, cross: 1, pearls: 0.2, gain: 1.3 } },
  { name: 'Night drive', world: 'HIGHWAY', wp: {} },
  { name: 'Hyperspace', world: 'HIGHWAY', wp: { drive: 3.4, variance: 0.8, radius: 2.4, curve: 0.3 }, look: { echo: 0.6 } },
  { name: 'Bass road', world: 'HIGHWAY', wp: { ripple: 2.4, rdecay: 0.4, wavelen: 3, rspeed: 8 } },
  { name: 'Glass mandala', world: 'BLOOM', wp: { foldSync: 1 }, look: { lens: 1, kaleido: 2, lensSize: 0.6 } },
  { name: 'Holo tunnel', world: 'HIGHWAY', wp: {}, look: { lens: 2, kaleido: 3, echo: 0.35 } },
  { name: 'Through the letters', world: 'REEF', wp: {}, look: { lens: 5, lensSize: 0.8 } }
];
let USER = [];
try { USER = JSON.parse(localStorage.getItem('htv3-presets') || '[]').filter(p => p && NAMES.includes(p.world)); } catch (e) { USER = []; }
function saveUser() { try { localStorage.setItem('htv3-presets', JSON.stringify(USER)); } catch (e) {} }
function snapshot(name) {
  const w = NAMES[cur], look = {};
  for (const k of LOOK_KEYS) look[k] = S[k];
  return { name, world: w, wp: Object.assign({}, WT[w]), look, cam: Object.assign({}, CT[w]), slots: S.slots[w].map(x => x && Object.assign({}, x)) };
}
function applyPreset(p, quiet) {
  const name = p.world, i = NAMES.indexOf(name); if (i < 0) return;
  const T = WT[name];
  for (const d of schemaOf(name)) { const v = p.wp && Number.isFinite(+p.wp[d.k]) ? +p.wp[d.k] : d.d; T[d.k] = clamp(v, d.min, d.max); }
  if (p.look) for (const k of LOOK_KEYS) if (k in p.look && typeof p.look[k] === typeof DEF[k]) S[k] = p.look[k];
  if (p.cam && CT[name]) { for (const k in CAM_DEF[name]) if (Number.isFinite(+p.cam[k])) CT[name][k] = +p.cam[k]; camGlide = 1.4; }
  if (Array.isArray(p.slots) && S.slots[name]) S.slots[name] = p.slots.slice(0, 6).map(x => x && typeof x === 'object' ? Object.assign({}, x) : null);
  if (WORLDS.length) {
    if (i !== cur) { for (const d of schemaOf(name)) if (d.rb) WP[name][d.k] = T[d.k]; WORLDS[i] = buildWorld(i); setWorld(i, tSim, quiet); }
    else rebuildIfNeeded(name);
  }
  S.auto = false; save();
  if (!WORLDS.length) return;
  updateUI(); syncWorldSettings(); camUIdirty = true;
  if (!quiet) toast(p.name + (p.look ? '' : ' · ' + cap(name)));
}
function buildPresets() {
  const box = $('#presets'); box.textContent = '';
  const here = NAMES[cur], all = FACTORY.map(p => ({ p, user: false })).concat(USER.map((p, j) => ({ p, user: true, j })));
  const sorted = all.filter(x => x.p.world === here).concat(all.filter(x => x.p.world !== here));
  let lastHere = null;
  for (const x of sorted) {
    const isHere = x.p.world === here;
    if (isHere !== lastHere) { const l = document.createElement('div'); l.className = 'lab'; l.textContent = isHere ? 'This world' : 'Elsewhere'; box.appendChild(l); lastHere = isHere; }
    const b = document.createElement('button'); b.className = 'pill';
    b.innerHTML = `<small>${ROMAN[NAMES.indexOf(x.p.world)]}</small>${x.p.name.replace(/[<>&]/g, '')}${x.user ? '<span class="x" title="Delete">×</span>' : ''}`;
    b.addEventListener('click', e => {
      if (e.target.classList.contains('x')) { USER.splice(x.j, 1); saveUser(); buildPresets(); toast('Preset deleted'); return; }
      applyPreset(x.p); poke();
    });
    box.appendChild(b);
  }
}
const b64e = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = str => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
function shareCode() {
  const p = snapshot('Shared look'), d = WORLD_DEF[p.world], wp = {};
  for (const k in p.wp) if (Math.abs(p.wp[k] - d[k]) > 1e-4) wp[k] = Math.round(p.wp[k] * 1000) / 1000;
  const cm = {}; for (const k in p.cam) cm[k] = Math.round(p.cam[k] * 100) / 100;
  return b64e(JSON.stringify({ v: 3, w: p.world, p: wp, l: p.look, c: cm }));
}
function readShare(code) { const o = JSON.parse(b64d(code)); return { name: 'Shared look', world: o.w, wp: Object.assign({}, WORLD_DEF[o.w], o.p || {}), look: o.l || null, cam: o.c || null }; }
$('#savePreset').addEventListener('click', () => {
  const el = $('#presetName'), nm = (el.value.trim() || `${cap(NAMES[cur])} ${USER.filter(p => p.world === NAMES[cur]).length + 1}`).slice(0, 40);
  const snap2 = snapshot(nm), j = USER.findIndex(p => p.name === nm && p.world === snap2.world);
  if (j >= 0) USER[j] = snap2; else USER.push(snap2);
  saveUser(); buildPresets(); el.value = ''; el.blur(); toast('Saved · ' + nm);
});
$('#presetName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#savePreset').click(); });
$('#shareBtn').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#p=' + shareCode();
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: 'HOME TEAM FM · ' + cap(NAMES[cur]), url }); return; }
    await navigator.clipboard.writeText(url); toast('Link copied');
  } catch (e) { if (e && e.name === 'AbortError') return; const el = $('#presetName'); el.value = url; el.select(); toast('Copy the link from the name field'); }
});
$('#exportBtn').addEventListener('click', () => {
  if (!USER.length) { toast('Save a preset first'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'hometeam-v3', presets: USER }, null, 1)], { type: 'application/json' }));
  a.download = 'hometeam-presets.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  try {
    const o = JSON.parse(await f.text()), list = (o.presets || o).filter(p => p && p.name && NAMES.includes(p.world));
    for (const p of list) { const j = USER.findIndex(q => q.name === p.name && q.world === p.world); if (j >= 0) USER[j] = p; else USER.push(p); }
    saveUser(); buildPresets(); toast(`Imported ${list.length} preset${list.length === 1 ? '' : 's'}`);
  } catch (err) { toast('That file is not a preset export'); }
  e.target.value = '';
});
$('#mutateBtn').addEventListener('click', mutate);
$('#resetBtn').addEventListener('click', resetWorld);
$('#colorReset').addEventListener('click', () => { for (const k of COLOR_KEYS) S[k] = DEF[k]; save(); updateUI(); toast('Color reset'); });
$('#lensSpinBtn').addEventListener('click', () => toggle('lensSpin'));

function setCam(mode) { S.cam = mode; if (mode === 'off') stopCam(); else startCam(mode); updateUI(); }
let presetsFor = '';
function updateUI() {
  if (!WORLDS.length) return;
  $('#worlds').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('on', i === cur));
  $('#grades').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('on', i === S.grade));
  $('#kaleidos').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('on', i === S.kaleido));
  $('#lenses').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('on', i === S.lens));
  $('#lensPos').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('on', i === Math.round(S.lensPos)));
  document.querySelectorAll('input[data-k]').forEach(el => { if (+el.value !== +S[el.dataset.k]) { el.value = S[el.dataset.k]; const o = el.parentElement.querySelector('output'); if (o) o.textContent = (+S[el.dataset.k]).toFixed(2); } });
  $('#cams').querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('on', ['off', 'user', 'environment'][i] === S.cam));
  [['#autoBtn', 'auto'], ['#cycleBtn', 'cycle'], ['#logoBtn', 'logo'], ['#motionBtn', 'camMotion'], ['#demoBtn', 'demo'], ['#statsBtn', 'stats'], ['#lensSpinBtn', 'lensSpin']].forEach(([id, k]) => $(id).classList.toggle('on', !!S[k]));
  $('#stats').hidden = !S.stats;
  if (wsetFor !== NAMES[cur]) buildWorldSettings();
  if (presetsFor !== NAMES[cur]) { presetsFor = NAMES[cur]; buildPresets(); }
  if (camFor !== NAMES[cur]) buildCamUI();
}
const toggle = (k, msgOn, msgOff) => { S[k] = !S[k]; save(); updateUI(); if (msgOn) toast(S[k] ? msgOn : msgOff); };
$('#autoBtn').addEventListener('click', () => toggle('auto', 'Auto travel on', 'Staying in this world'));
$('#cycleBtn').addEventListener('click', () => toggle('cycle'));
$('#logoBtn').addEventListener('click', () => toggle('logo'));
$('#motionBtn').addEventListener('click', () => toggle('camMotion'));
$('#statsBtn').addEventListener('click', () => toggle('stats'));
$('#demoBtn').addEventListener('click', () => { S.demo = !S.demo; demoBeat = -1; updateUI(); toast(S.demo ? 'Demo groove on' : A.live ? 'Listening to the mic' : 'Demo off · no mic connected'); });
$('#micBtn').addEventListener('click', async () => { try { await startMic(); toast('Mic live · play some music'); } catch (e) { showMicHelp(e); } });
$('#fsBtn').addEventListener('click', toggleFS);
function toggleFS() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) { const r = req.call(el); if (r && r.catch) r.catch(() => toast('Full screen is not available here')); }
  else toast('On iPhone, add to Home Screen for full screen');
}
function openPanel() { panel.classList.add('open'); menuBtn.setAttribute('aria-expanded', 'true'); poke(); }
function closePanel() { panel.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', e => { e.stopPropagation(); panel.classList.contains('open') ? closePanel() : openPanel(); });
panel.addEventListener('pointerdown', () => poke());
function poke() { lastUI = performance.now(); menuBtn.classList.remove('idle'); document.body.classList.remove('nocursor'); }
setInterval(() => {
  const idle = performance.now() - lastUI > 3500 && !panel.classList.contains('open');
  menuBtn.classList.toggle('idle', idle); menuBtn.classList.toggle('hidden', uiHidden);
  const fb = $('#flyBtn'); fb.classList.toggle('idle', idle && !S.fly); fb.classList.toggle('hidden', uiHidden);
  document.body.classList.toggle('nocursor', idle && running);
}, 500);
window.addEventListener('mousemove', poke, { passive: true });

// touch: every tap is a shockwave from where you touched; dragging leaves a wake
const ptrs = new Map();
const toUV = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; };
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (actx && actx.state !== 'running') actx.resume();
  if (navStart(e)) { poke(); return; }
  if (panel.classList.contains('open')) { closePanel(); return; }
  const [u, v] = toUV(e);
  ptrs.set(e.pointerId, { u, v, t: performance.now() });
  screenHit(u, v, 1, false);
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
}, { passive: false });
canvas.addEventListener('pointermove', e => {
  if (navMove(e)) return;
  const p = ptrs.get(e.pointerId); if (!p) return;
  const [u, v] = toUV(e), now = performance.now();
  if (now - p.t > 70 && Math.hypot(u - p.u, v - p.v) > 0.03) { pushRippleAt(u, v, 0.45); p.u = u; p.v = v; p.t = now; }
});
function pushRippleAt(u, v, s) {
  const th = Math.tan(fovNow / 2), nx = (u * 2 - 1) * th * cam.aspect, ny = (v * 2 - 1) * th;
  const dx = cam.fx + cam.rx * nx + cam.ux * ny, dy = cam.fy + cam.ry * nx + cam.uy * ny, dz = cam.fz + cam.rz * nx + cam.uz * ny;
  const tt = ((cam.Cx - cam.px) * cam.fx + (cam.Cy - cam.py) * cam.fy + (cam.Cz - cam.pz) * cam.fz) / (dx * cam.fx + dy * cam.fy + dz * cam.fz);
  pushRipple((cam.px + dx * tt - cam.Cx) / cam.sc, (cam.py + dy * tt - cam.Cy) / cam.sc, (cam.pz + dz * tt - cam.Cz) / cam.sc, s, 1.8);
}
const endPtr = e => { navEnd(e); ptrs.delete(e.pointerId); };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);

window.addEventListener('keydown', e => {
  if (!running || e.metaKey || e.ctrlKey || (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text')) return;
  const k = e.key.toLowerCase();
  const dig = /^Digit([1-6])$/.exec(e.code), fk = /^F([1-6])$/.exec(e.key);
  if (dig && e.shiftKey) { e.preventDefault(); storeSlot(+dig[1] - 1); return; }
  if (fk && e.shiftKey) { e.preventDefault(); storeSlot(+fk[1] - 1); return; }
  if ((dig && e.altKey) || fk) { e.preventDefault(); recallSlot(+(dig || fk)[1] - 1); return; }
  if (k === 'v') { setFly(!S.fly); poke(); return; }
  if (k >= '1' && k <= '9' && +k <= WORLDS.length) setWorld(+k - 1, tSim);
  else if (k === 'arrowright') setWorld((cur + 1) % WORLDS.length, tSim);
  else if (k === 'arrowleft') setWorld((cur + WORLDS.length - 1) % WORLDS.length, tSim);
  else if (k === 'a') toggle('auto', 'Auto travel on', 'Staying in this world');
  else if (k === 'l') toggle('logo');
  else if (k === 'm') mutate();
  else if (k === 'o') { S.lens = (S.lens + 1) % LENSES.length; save(); updateUI(); toast('Logo overlay · ' + LENSES[S.lens]); }
  else if (k === 'k') { S.kaleido = (S.kaleido + 1) % MIRRORS.length; save(); updateUI(); toast(MIRRORS[S.kaleido] ? MIRRORS[S.kaleido] + ' fold kaleidoscope' : 'Kaleidoscope off'); }
  else if (k === 'e') { S.echo = S.echo > 0.5 ? 0 : S.echo > 0.15 ? 0.85 : 0.35; save(); updateUI(); toast('Echo ' + Math.round(S.echo * 100)); }
  else if (k === 'g') { S.grade = (S.grade + 1) % GRADES.length; save(); updateUI(); toast(GRADES[S.grade].name); }
  else if (k === 'c') setCam({ off: 'user', user: 'environment', environment: 'off' }[S.cam]);
  else if (k === 'd') $('#demoBtn').click();
  else if (k === 'p') toggle('stats');
  else if (k === ' ') { e.preventDefault(); fire('kick', 0.9); }
  else if (k === 'h') { uiHidden = !uiHidden; if (uiHidden) closePanel(); }
  else if (k === 'f') toggleFS();
  else if (k === 'escape') closePanel();
  else return;
  poke();
});

/* mic help */
function showMicHelp(e) {
  const name = (e && e.name) || 'Error';
  let html;
  if (name === 'InsecureContext') html = '<p>The mic only works over https. Open the GitHub Pages link, not a local file.</p>';
  else if (name === 'NoMediaDevices') html = '<p>This browser has no mic access. On iPhone, open the link in Safari.</p>';
  else if (name === 'NotReadableError') html = '<p>Another app is using the mic (a call, voice memo, or another tab). Close it, then try again.</p>';
  else html = `<p>iPhone said no to the mic. To fix it:</p><ol>
    <li>In Safari, tap <b>aA</b> → <b>Website Settings</b> → <b>Microphone</b> → <b>Allow</b>.</li>
    <li>Or open <b>Settings → Apps → Safari → Microphone</b> → <b>Ask</b> or <b>Allow</b>.</li>
    <li>Home Screen app? Same setting. If it's still stuck, delete the icon and add it again.</li></ol>
    <p style="color:var(--dim);font-size:12.5px">Error: ${name}</p>`;
  $('#helpTitle').textContent = name === 'NotAllowedError' ? 'MIC IS BLOCKED' : 'MIC NOT AVAILABLE';
  $('#helpBody').innerHTML = html; $('#help').classList.add('show');
  S.demo = true; demoBeat = -1; updateUI();
}
$('#retryMic').addEventListener('click', async () => { $('#help').classList.remove('show'); try { await startMic(); toast('Mic live · play some music'); } catch (e) { showMicHelp(e); } });
$('#useDemo').addEventListener('click', () => { $('#help').classList.remove('show'); S.demo = true; demoBeat = -1; updateUI(); toast('Demo groove on · tap to send shockwaves'); });

/* wake lock + lifecycle */
let wakeLock = null;
async function keepAwake() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); if (actx && actx.state !== 'running') actx.resume(); tPrev = performance.now(); } });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fatal('Graphics reset by iOS.<br><br><button class="pill on" onclick="location.reload()">RELOAD</button>'); });

/* ================================================================== */
/* Start                                                               */
/* ================================================================== */
function startEngine() {
  if (running) return;
  running = true; resize();
  requestAnimationFrame(t => { tPrev = t; frame(t); });
}
async function init() {
  await loadLogo();
  let shared = null;
  if (location.hash.startsWith('#p=')) {
    try { shared = readShare(location.hash.slice(3)); applyPreset(shared, true); S.world = NAMES.indexOf(shared.world); S.auto = false; } catch (e) { console.warn('bad share link', e); }
    history.replaceState(null, '', location.pathname + location.search);
  }
  for (const n of NAMES) for (const d of schemaOf(n)) WP[n][d.k] = WT[n][d.k];
  WORLDS = NAMES.map((_, i) => buildWorld(i));
  initCameras(); uploadLogoPoints();
  if (shared && shared.cam) { const n = shared.world; for (const k in CAM_DEF[n]) if (Number.isFinite(+shared.cam[k])) CT[n][k] = CL[n][k] = +shared.cam[k]; }
  cur = clamp(S.world | 0, 0, WORLDS.length - 1);
  tint = WORLDS[cur].tint.slice(); tintFrom = tint.slice();
  buildUI(); updateUI();
  const go = $('#go'); go.disabled = false; go.textContent = 'Tap to start';
  go.addEventListener('click', async () => {
    $('#start').classList.add('gone');
    keepAwake(); startEngine(); showLookName(); poke();
    try { await startMic(); toast('Mic live · play some music'); } catch (e) { showMicHelp(e); }
  });
  if (new URLSearchParams(location.search).has('autostart')) { $('#start').classList.add('gone'); S.demo = true; startEngine(); updateUI(); }
}
init().catch(e => { console.error(e); fatal('Something went wrong starting up.<br><br><button class="pill on" onclick="location.reload()">RELOAD</button>'); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {});

window.__HT2 = { PROF, rebuildAll, S, CT, CL, recallSlot, storeSlot, navOrbit, navPan, navDolly, get na() { return NA; }, get segs() { return fcount + gpuSegs; }, A, fire, setWorld: i => setWorld(i, tSim), screenHit, get worlds() { return WORLDS.map(w => w.name); }, get cur() { return cur; }, get fcount() { return fcount; }, get t() { return tSim; }, get fps() { return PERF.fpsAvg; }, get cpu() { return PERF.cpu; }, setTime: x => { tSim = x; } };
})();