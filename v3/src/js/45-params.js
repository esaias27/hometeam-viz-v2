/* ================================================================== */
/* Parameters                                                          */
/* ================================================================== */
// Every world shares this backbone; each adds its own controls. `rb` = structural: the world is regrown and morphs out of the old one.
const COMMON = [
  { k: 'density', l: 'Density', min: 0.25, max: 2, st: 0.05, d: 1, rb: 1, g: 'Look' },
  { k: 'size', l: 'Particle size', min: 0.3, max: 2.5, st: 0.01, d: 1, g: 'Look' },
  { k: 'bright', l: 'Brightness', min: 0.2, max: 2, st: 0.01, d: 1, g: 'Look' },
  { k: 'turb', l: 'Turbulence', min: 0, max: 1.5, st: 0.01, d: 0, g: 'Look' },
  { k: 'speed', l: 'Speed', min: 0, max: 3, st: 0.01, d: 1, g: 'Look' },
  { k: 'gLow', l: 'Bass response', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Audio' },
  { k: 'gMid', l: 'Mid response', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Audio' },
  { k: 'gHigh', l: 'Treble response', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Audio' }
];
const SCHEMA = {
  TOWER: [
    { k: 'pulseRate', l: 'Pulse rate', min: 0, max: 3, st: 0.01, d: 1, g: 'Pulses' },
    { k: 'expand', l: 'Expansion speed', min: 0.3, max: 4, st: 0.01, d: 1.4, g: 'Pulses' },
    { k: 'toward', l: 'Toward camera', min: 0, max: 2.5, st: 0.01, d: 1.3, g: 'Pulses' },
    { k: 'thick', l: 'Ring thickness', min: 0, max: 1, st: 0.01, d: 0.18, g: 'Pulses' },
    { k: 'tilt', l: 'Ring tilt', min: 0, max: 1, st: 0.01, d: 0.3, g: 'Pulses' },
    { k: 'life', l: 'Pulse life', min: 1, max: 8, st: 0.1, d: 4, g: 'Pulses' },
    { k: 'shell', l: 'Kick shells', min: 0, max: 2, st: 0.01, d: 1, g: 'Pulses' },
    { k: 'rings', l: 'Rings alive', min: 8, max: 48, st: 1, d: 32, rb: 1, g: 'Pulses' },
    { k: 'ringPts', l: 'Points per ring', min: 100, max: 1500, st: 10, d: 600, rb: 1, g: 'Pulses' },
    { k: 'bolts', l: 'Lightning', min: 0, max: 2, st: 0.01, d: 1, g: 'Tower' }
  ],
  LOT: [
    { k: 'fwRate', l: 'Fireworks', min: 0, max: 3, st: 0.01, d: 1, g: 'Fireworks' },
    { k: 'fwSize', l: 'Burst size', min: 0.3, max: 2.5, st: 0.01, d: 1, g: 'Fireworks' },
    { k: 'fwSparks', l: 'Sparks per burst', min: 0.3, max: 2.5, st: 0.01, d: 1, g: 'Fireworks' },
    { k: 'variety', l: 'Variety', min: 0, max: 1, st: 0.01, d: 0.8, g: 'Fireworks' },
    { k: 'gravity', l: 'Gravity', min: 0, max: 2, st: 0.01, d: 1, g: 'Fireworks' },
    { k: 'streak', l: 'Mortar streaks', min: 0, max: 2, st: 0.01, d: 1, g: 'Fireworks' },
    { k: 'trail', l: 'Spark trail length', min: 0, max: 2, st: 0.01, d: 0.7, g: 'Fireworks' },
    { k: 'finale', l: 'Drop sensitivity', min: 0, max: 1, st: 0.01, d: 0.5, g: 'Fireworks' },
    { k: 'lanterns', l: 'Lanterns', min: 0, max: 2, st: 0.05, d: 1, rb: 1, g: 'Lot' },
    { k: 'crowd', l: 'Crowd', min: 0.1, max: 2, st: 0.05, d: 1, rb: 1, g: 'Lot' },
    { k: 'beams', l: 'Searchlights', min: 0, max: 14, st: 1, d: 8, rb: 1, g: 'Searchlights' },
    { k: 'sweep', l: 'Sweep speed', min: 0, max: 3, st: 0.01, d: 1, g: 'Searchlights' },
    { k: 'strobe', l: 'Kick strobe', min: 0, max: 2, st: 0.01, d: 1, g: 'Searchlights' }
  ],
  STORM: [
    { k: 'palette', l: 'Sky (0 supercell · 1 violet · 2 night)', min: 0, max: 2, st: 1, d: 0, g: 'Storm' },
    { k: 'lightning', l: 'Lightning', min: 0, max: 3, st: 0.01, d: 1, g: 'Storm' },
    { k: 'rain', l: 'Rain curtains', min: 0, max: 2, st: 0.01, d: 1, g: 'Storm' },
    { k: 'deck', l: 'Cloud deck', min: 0.2, max: 2, st: 0.05, d: 1, rb: 1, g: 'Storm' },
    { k: 'funnel', l: 'Funnel particles', min: 0.2, max: 2, st: 0.05, d: 1, rb: 1, g: 'Funnel' },
    { k: 'psize', l: 'Funnel grain', min: 0.3, max: 2.5, st: 0.01, d: 1, g: 'Funnel' },
    { k: 'noiseAmt', l: 'Snake', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Funnel' },
    { k: 'noiseScale', l: 'Snake scale', min: 0.2, max: 3, st: 0.01, d: 1, g: 'Funnel' },
    { k: 'climb', l: 'Climb speed', min: 0, max: 3, st: 0.01, d: 1, g: 'Funnel' },
    { k: 'stir', l: 'Bass stir', min: 0, max: 3, st: 0.01, d: 1, g: 'Funnel' },
    { k: 'baseWidth', l: 'Base twist', min: 0.3, max: 3, st: 0.01, d: 1.5, g: 'Funnel' },
    { k: 'subVort', l: 'Sub-vortices', min: 0, max: 6, st: 1, d: 3, g: 'Funnel' },
    { k: 'debris', l: 'Debris', min: 0, max: 2, st: 0.05, d: 1, rb: 1, g: 'Debris' },
    { k: 'debrisSpin', l: 'Debris swirl', min: 0, max: 3, st: 0.01, d: 1, g: 'Debris' },
    { k: 'inflow', l: 'Inflow', min: 0, max: 3, st: 0.01, d: 1, g: 'Debris' }
  ],
  REEF: [
    { k: 'travel', l: 'Travel speed', min: 0, max: 3, st: 0.01, d: 1, g: 'Reef' },
    { k: 'stalks', l: 'Stalks', min: 40, max: 400, st: 5, d: 240, rb: 1, g: 'Reef' },
    { k: 'variation', l: 'Density variation', min: 0, max: 1, st: 0.01, d: 0.6, g: 'Reef' },
    { k: 'height', l: 'Stalk height', min: 0.4, max: 2, st: 0.01, d: 1, g: 'Reef' },
    { k: 'current', l: 'Current', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Reef' },
    { k: 'polyp', l: 'Polyp size', min: 0.3, max: 2.5, st: 0.01, d: 1, g: 'Reef' },
    { k: 'coral', l: 'Coral beds', min: 0, max: 2, st: 0.05, d: 1, rb: 1, g: 'Reef' },
    { k: 'fog', l: 'Fog', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Water' },
    { k: 'fogHue', l: 'Water hue', min: 0, max: 1, st: 0.01, d: 0.5, g: 'Water' },
    { k: 'snow', l: 'Marine snow', min: 0, max: 2, st: 0.05, d: 1, rb: 1, g: 'Water' }
  ],
  BLOOM: [
    { k: 'petals', l: 'Divisions (0 = cycle)', min: 0, max: 16, st: 1, d: 0, g: 'Flower' },
    { k: 'foldSync', l: 'Lock to kaleidoscope', min: 0, max: 1, st: 1, d: 0, g: 'Flower' },
    { k: 'sharp', l: 'Petal sharpness', min: 0.2, max: 3, st: 0.01, d: 1, g: 'Flower' },
    { k: 'depth', l: 'Petal depth', min: 0, max: 2, st: 0.01, d: 1, g: 'Flower' },
    { k: 'ruffle', l: 'Ruffle', min: 0, max: 3, st: 0.01, d: 1, g: 'Flower' },
    { k: 'twist', l: 'Twist', min: 0, max: 3, st: 0.01, d: 1, g: 'Flower' },
    { k: 'spin', l: 'Spin', min: 0, max: 3, st: 0.01, d: 1, g: 'Flower' },
    { k: 'cup', l: 'Cup depth', min: 0, max: 3, st: 0.01, d: 1, g: 'Flower' },
    { k: 'palette', l: 'Palette (0 = cycle)', min: 0, max: 6, st: 1, d: 0, g: 'Flower' },
    { k: 'bloomSpeed', l: 'Blossom speed', min: 0, max: 4, st: 0.01, d: 1, g: 'Blossom' },
    { k: 'span', l: 'Zoom span', min: 6, max: 200, st: 1, d: 48, g: 'Blossom' },
    { k: 'pulse', l: 'Kick pulse', min: 0, max: 3, st: 0.01, d: 1, g: 'Blossom' },
    { k: 'web', l: 'Web lines', min: 0, max: 2, st: 0.01, d: 1, g: 'Blossom' },
    { k: 'gens', l: 'Flowers alive', min: 3, max: 10, st: 1, d: 6, rb: 1, g: 'Blossom' },
    { k: 'per', l: 'Points per flower', min: 300, max: 5000, st: 50, d: 2200, rb: 1, g: 'Blossom' }
  ],
  TIDE: [
    { k: 'source', l: 'Source', min: 0, max: 5, st: 1, d: 0, g: 'Wave', opts: ['Mirrored trace', 'Trace', 'Spectrum', 'Trace × spectrum', 'Kick rings', 'Noise ocean'] },
    { k: 'gain', l: 'Displacement', min: 0, max: 3, st: 0.01, d: 0.7, g: 'Wave' },
    { k: 'specMix', l: 'Spectrum lift', min: 0, max: 1, st: 0.01, d: 0.25, g: 'Wave' },
    { k: 'smoothing', l: 'Time smoothing', min: 0, max: 0.95, st: 0.01, d: 0.2, g: 'Wave' },
    { k: 'blur', l: 'Line smoothing', min: 0, max: 1, st: 0.01, d: 0.15, g: 'Wave' },
    { k: 'roll', l: 'Roll speed', min: 0.1, max: 4, st: 0.01, d: 1, g: 'Wave' },
    { k: 'swell', l: 'Swell', min: 0, max: 2, st: 0.01, d: 0.4, g: 'Wave' },
    { k: 'cols', l: 'Columns', min: 64, max: 512, st: 8, d: 384, rb: 1, g: 'Grid' },
    { k: 'rows', l: 'Rows', min: 32, max: 256, st: 8, d: 160, rb: 1, g: 'Grid' },
    { k: 'length', l: 'Ocean length', min: 0.5, max: 3, st: 0.01, d: 1.4, g: 'Grid' },
    { k: 'width', l: 'Ocean width', min: 0.5, max: 3, st: 0.01, d: 1.2, g: 'Grid' },
    { k: 'lines', l: 'Ridgelines', min: 0, max: 2, st: 0.01, d: 1, g: 'Grid' },
    { k: 'cross', l: 'Cross lines', min: 0, max: 2, st: 0.01, d: 0, g: 'Grid' },
    { k: 'pearls', l: 'Pearls', min: 0, max: 2, st: 0.01, d: 0.6, g: 'Grid' },
    { k: 'fog', l: 'Horizon fog', min: 0, max: 3, st: 0.01, d: 1.4, g: 'Grid' }
  ],
  HIGHWAY: [
    { k: 'drive', l: 'Speed', min: 0, max: 4, st: 0.01, d: 1, g: 'Drive' },
    { k: 'variance', l: 'Speed variance', min: 0, max: 1, st: 0.01, d: 0.4, g: 'Drive' },
    { k: 'varRate', l: 'Variance rate', min: 0.02, max: 1, st: 0.01, d: 0.25, g: 'Drive' },
    { k: 'curve', l: 'Road curve', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Drive' },
    { k: 'roll', l: 'Tunnel roll', min: -1, max: 1, st: 0.01, d: 0.25, g: 'Drive' },
    { k: 'ripple', l: 'Bass ripple', min: 0, max: 2.5, st: 0.01, d: 1, g: 'Ripple' },
    { k: 'wavelen', l: 'Ripple wavelength', min: 0.5, max: 6, st: 0.01, d: 2, g: 'Ripple' },
    { k: 'rspeed', l: 'Ripple speed', min: 2, max: 40, st: 0.1, d: 12, g: 'Ripple' },
    { k: 'rdecay', l: 'Ripple decay', min: 0.1, max: 3, st: 0.01, d: 0.8, g: 'Ripple' },
    { k: 'radius', l: 'Tunnel radius', min: 0.6, max: 3, st: 0.01, d: 1.6, g: 'Tunnel' },
    { k: 'rings', l: 'Rings', min: 20, max: 160, st: 1, d: 72, rb: 1, g: 'Tunnel' },
    { k: 'ringPts', l: 'Points per ring', min: 16, max: 256, st: 4, d: 96, rb: 1, g: 'Tunnel' },
    { k: 'streaks', l: 'Light streaks', min: 0, max: 2, st: 0.05, d: 1, rb: 1, g: 'Tunnel' }
  ]
};
const WORLD_DEF = {};
for (const name in SCHEMA) { WORLD_DEF[name] = {}; for (const d of COMMON.concat(SCHEMA[name])) WORLD_DEF[name][d.k] = d.d; }
const schemaOf = name => COMMON.concat(SCHEMA[name]);
// live values (P) tween toward targets (T); targets are what gets saved
const WP = {}, WT = {};
S.wp = S.wp || {};
for (const name in SCHEMA) {
  WT[name] = Object.assign({}, WORLD_DEF[name], S.wp[name] || {});
  for (const k in WT[name]) if (!(k in WORLD_DEF[name])) delete WT[name][k];
  // saved values always stay inside their slider's range
  for (const d of schemaOf(name)) { const v = +WT[name][d.k]; WT[name][d.k] = Number.isFinite(v) ? clamp(v, d.min, d.max) : d.d; }
  WP[name] = Object.assign({}, WT[name]);
  S.wp[name] = WT[name];
}
// particle counts scale with the world's density and the global detail setting
const cnt = (base, P, extra) => Math.max(0, Math.round(base * P.density * S.detail * (extra ?? 1)));
