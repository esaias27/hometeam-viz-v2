/* VI. TIDE — The sound as an ocean.
   Every moment of the sound becomes a ridgeline that rolls away from you, so the recent past stretches to the horizon as
   terrain. By default the ridge is the live waveform, trigger-locked like an oscilloscope and mirrored at the centre; it can
   also be the plain trace, the spectrum, the trace shaped by the spectrum, rings thrown out by kicks, or a noise ocean.
   The whole field is drawn on the GPU from a history texture, so it can be dense. */
const TIDE_MAXC = 512, TIDE_MAXR = 256;
const TIDE_SHARED = `
uniform sampler2D uHist; uniform int uCOLS, uROWS, uHead; uniform float uRowT, uZ0, uZ1; uniform vec2 uKR[8];
vec4 histAt(float x, int r){ int row = (uHead - r + uROWS * 8) % uROWS; return texture(uHist, vec2(x * float(uCOLS - 1) / float(${TIDE_MAXC}) + 0.5 / float(${TIDE_MAXC}), (float(row) + 0.5) / float(${TIDE_MAXR}))); }
vec4 histB(float x, int r){ float b = p_blur * 0.02; return b < 0.0005 ? histAt(x, r) : (histAt(x - b, r) + histAt(x, r) * 2.0 + histAt(x + b, r)) * 0.25; }
float tideZ(int r){ return uZ1 - (float(r) + uRowT) * (uZ1 - uZ0) / float(uROWS); }
float tideX(int c, float z){ return (float(c) / float(uCOLS - 1) - 0.5) * (8.0 + (uZ1 - z) * 0.45) * p_width; }
// height of one node; signed sources sit on a mid baseline, spectrum sources rise from the floor
float tideH(int c, int r, float x, float z, out float mag){
  float xn = float(c) / float(uCOLS - 1), xm = abs(xn - 0.5) * 2.0;
  int src = int(p_source + 0.5); float v = 0.0;
  if (src == 0) { vec4 h = histB(xm, r); v = h.r * 0.75 + h.g * p_specMix * 0.9; }
  else if (src == 1) { vec4 h = histB(xn, r); v = h.r * 0.75 + h.g * p_specMix * 0.9; }
  else if (src == 2) { vec4 h = histB(xm, r); v = h.g * 1.2 - 0.3; }
  else if (src == 3) { vec4 h = histB(xm, r); v = h.r * (0.25 + h.g * 1.4); }
  else if (src == 4) {
    float zc = uZ1 - 1.0, d = length(vec2(x, (z - zc) * 0.8));
    for (int k = 0; k < 8; k++) { float age = uKR[k].x; if (age > 6.0) continue; float f = (d - age * 3.2) / 0.55; if (f > -3.0 && f < 3.0) v += uKR[k].y * exp(-f * f) * exp(-age * 0.45) * 0.9; }
    v += histB(xm, r).g * p_specMix * 0.5;
  }
  else { v = fbm3(vec3(x * 0.35, z * 0.3 - uT * 0.35 * p_roll, uT * 0.05)) * (0.6 + uLevel * 1.4); }
  v += vnoise(vec3(x * 0.25, z * 0.22 + uT * 0.15, 3.0)) * p_swell * 0.35;
  mag = abs(v);
  return v * p_gain;
}
vec3 tideNode(int c, int r, out float fade, out float mag){
  float z = tideZ(r), x = tideX(c, z), h = tideH(c, r, x, z, mag);
  fade = sm(uZ0, uZ0 + 7.0, z) * (1.0 - sm(uZ1 - 0.6, uZ1, z));
  return vec3(x, -1.25 + h * 1.15 + 0.04 * sin(x * 1.3 + uT * 0.9 + z * 0.6), z);
}
vec3 tideCol(float m){ return g5(C_azure, C_teal, C_cyan, C_gold, C_white, m * 1.05); }`;
const TIDE_LINE_H = `
${TIDE_SHARED}
uniform float uLineW;
void seg(int id, out vec3 A, out vec3 B, out float wA, out float wB, out vec4 cA, out vec4 cB){
  int per = uCOLS - 1, r = id / per, c = id - r * per;
  float fa, fb, ma, mb;
  A = tideNode(c, r, fa, ma); B = tideNode(c + 1, r, fb, mb);
  wA = wB = uLineW;
  cA = vec4(tideCol(ma), (0.035 + ma * 0.75) * fa * p_lines); cB = vec4(tideCol(mb), (0.035 + mb * 0.75) * fb * p_lines);
}`;
const TIDE_LINE_V = `
${TIDE_SHARED}
uniform float uLineW;
void seg(int id, out vec3 A, out vec3 B, out float wA, out float wB, out vec4 cA, out vec4 cB){
  int per = uROWS - 1, c = id / per, r = id - c * per;
  float fa, fb, ma, mb;
  A = tideNode(c, r, fa, ma); B = tideNode(c, r + 1, fb, mb);
  wA = wB = uLineW * 0.8;
  cA = vec4(tideCol(ma), (0.05 + ma * 0.5) * fa * p_cross); cB = vec4(tideCol(mb), (0.05 + mb * 0.5) * fb * p_cross);
}`;
const TIDE_GLSL = `
${TIDE_SHARED}
uniform int uPC, uPS;
void particle(int i, vec4 s, inout vec3 p, inout float r, inout vec3 c, inout float e, inout float g){
  int pr = i / uPC, pc = i - pr * uPC, cc = min(uCOLS - 1, pc * uPS), rr = pr * uPS;
  if (rr >= uROWS) return;
  float f, m;
  p = tideNode(cc, rr, f, m);
  r = (0.004 + m * 0.009) * f * p_pearls * sqrt(float(uPS) * 150.0 / float(uCOLS));
  c = tideCol(m * 0.9);
  e = (0.14 + m * 1.3 + tw(s, uT) * 0.25) * f;
}`;
const tideHistTex = dataTex(TIDE_MAXC, TIDE_MAXR, gl.RGBA16F, gl.LINEAR);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, TIDE_MAXC, TIDE_MAXR, 0, gl.RGBA, gl.FLOAT, new Float32Array(TIDE_MAXC * TIDE_MAXR * 4));
function makeTide(P) {
  const COLS = clamp(Math.round(P.cols * Math.min(1, 0.4 + S.detail * 0.6)), 32, TIDE_MAXC), ROWS = clamp(Math.round(P.rows * Math.min(1, 0.4 + S.detail * 0.6)), 16, TIDE_MAXR);
  const PSTEP = COLS > 256 ? 3 : 2, PC = Math.ceil(COLS / PSTEP), PR = Math.ceil(ROWS / PSTEP), N = Math.min(CAP, PC * PR);
  const row = new Float32Array(TIDE_MAXC * 4), prev = new Float32Array(TIDE_MAXC * 2);
  let rowT = 0, head = 0, lift = 0;
  const kr = new Float32Array(16).fill(0); for (let k = 0; k < 8; k++) kr[k * 2] = 99;
  const shared = p => {
    bindT(p, 'uHist', tideHistTex);
    gl.uniform1i(p.u('uCOLS'), COLS); gl.uniform1i(p.u('uROWS'), ROWS); gl.uniform1i(p.u('uHead'), head);
    gl.uniform1f(p.u('uRowT'), rowT); gl.uniform1f(p.u('uZ0'), -11 * P.length); gl.uniform1f(p.u('uZ1'), 2.4); gl.uniform2fv(p.u('uKR[0]'), kr);
    gl.uniform1f(p.u('uLineW'), 0.0035 * Math.sqrt(75 / COLS) * 1.3);
  };
  const W = {
    n: N, name: 'TIDE', blurb: 'The sound, rolling in as an ocean', tint: PAL.azure, flash: PAL.cyan, coreLight: PAL.teal, coreGain: 0.8, coreLocal: [0, 0.6, -2],
    wisps: [PAL.cyan, PAL.gold, PAL.violet], fils: [], ay: 0, ax: 0, dofMul: 0.4,
    cam0: { tx: 0, ty: -1.3, tz: -4.5, dist: 10.5, h: 0, p: -24, b: 0, f: 32 },
    prog: progFor('TIDE', 'TIDE', TIDE_GLSL),
    lines: [
      { prog: progFor('TIDE_H', 'TIDE', TIDE_LINE_H, true), count: ROWS * (COLS - 1), uniforms: p => shared(p), active: () => P.lines > 0.005 },
      { prog: progFor('TIDE_V', 'TIDE', TIDE_LINE_V, true), count: COLS * (ROWS - 1), uniforms: p => shared(p), active: () => P.cross > 0.005 }],
    get fog() { return { d: 0.04 * P.fog, col: [0.004, 0.01, 0.03] }; },
    onset(kind, s) {
      if (kind === 'kick' || kind === 'touch') { lift = Math.max(lift, s); let k = 0; for (let j = 1; j < 8; j++) if (kr[j * 2] > kr[k * 2]) k = j; kr[k * 2] = 0; kr[k * 2 + 1] = s; }
    },
    update(dt, t) {
      lift *= Math.exp(-dt * 4);
      for (let k = 0; k < 8; k++) kr[k * 2] += dt;
      captureWave(dt, t);
      rowT += dt * (14 + A.level * 10) * P.roll;
      let added = 0;
      while (rowT >= 1 && added < 8) {
        rowT -= 1; head = (head + 1) % ROWS; added++;
        for (let c = 0; c < COLS; c++) {
          const x = c / (COLS - 1), wi = x * (WAVE_N - 1), w0 = wi | 0, wf = wi - w0;
          const wv = (wave[w0] * (1 - wf) + wave[Math.min(WAVE_N - 1, w0 + 1)] * wf) * (1 + lift * 0.5);
          const f = x * 15, i0 = Math.min(15, Math.floor(f)), sp = lerp(A.bands[i0], A.bands[Math.min(15, i0 + 1)], f - i0) * (0.85 + lift * 0.5);
          prev[c * 2] = lerp(wv, prev[c * 2], P.smoothing); prev[c * 2 + 1] = lerp(sp, prev[c * 2 + 1], P.smoothing);
          row[c * 4] = prev[c * 2]; row[c * 4 + 1] = prev[c * 2 + 1]; row[c * 4 + 2] = A.level; row[c * 4 + 3] = lift;
        }
        gl.bindTexture(gl.TEXTURE_2D, tideHistTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, head, TIDE_MAXC, 1, gl.RGBA, gl.FLOAT, row);
      }
      if (rowT >= 1) rowT = 0.99;
      W.ay = 0.1 * Math.sin(t * 0.04); W.ax = 0.03 * Math.sin(t * 0.05);
    },
    uniforms(p) { shared(p); gl.uniform1i(p.u('uPC'), PC); gl.uniform1i(p.u('uPS'), PSTEP); }
  };
  return W;
}
