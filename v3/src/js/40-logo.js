/* The HOME TEAM logo, sampled into points                             */
/* ================================================================== */
const LOGO = { n: 0, x: null, y: null, minY: -0.5, maxY: 0.5 };
// The logo as a signed distance field, so the compositor can use it as glass, foil, a weight that bends light, or a window
const logoTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, logoTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
let logoSdfOK = false;
function edt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function edt2(g, w, h) {
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]); }
  return g;
}
function bakeLogoSDF(data, CW, CH) {
  const GW = 320, GH = Math.round(320 * CH / CW), inn = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const sx = Math.min(CW - 1, Math.round((x + 0.5) * CW / GW)), sy = Math.min(CH - 1, Math.round((y + 0.5) * CH / GH)); inn[y * GW + x] = data[(sy * CW + sx) * 4 + 3] > 110 ? 1 : 0; }
  const dOut = new Float64Array(GW * GH), dIn = new Float64Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) { dOut[i] = inn[i] ? 0 : 1e20; dIn[i] = inn[i] ? 1e20 : 0; }
  edt2(dOut, GW, GH); edt2(dIn, GW, GH);
  const px = new Uint8Array(GW * GH);
  for (let r = 0; r < GH; r++) for (let x = 0; x < GW; x++) {
    const i = (GH - 1 - r) * GW + x, sd = (inn[i] ? -(dIn[i] - 0.5) : dOut[i] - 0.5) / GH;
    px[r * GW + x] = Math.round(clamp(0.5 + sd * 4, 0, 1) * 255);
  }
  gl.bindTexture(gl.TEXTURE_2D, logoTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, GW, GH, 0, gl.RED, gl.UNSIGNED_BYTE, px);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  logoSdfOK = true;
}
const svgToE = (sx, sy) => [(sx - 460) / 920, -(sy - 500) / 920];
async function loadLogo() {
  const TARGET = 9000;
  let pts = [];
  try {
    const svg = $('#start .logo svg').cloneNode(true);
    svg.setAttribute('width', '840'); svg.setAttribute('height', '920');
    const src = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const CW = 640, CH = Math.round(640 * 920 / 840);
    const cnv = document.createElement('canvas'); cnv.width = CW; cnv.height = CH;
    const cx = cnv.getContext('2d'); cx.drawImage(img, 0, 0, CW, CH);
    URL.revokeObjectURL(url);
    const data = cx.getImageData(0, 0, CW, CH).data, filled = [];
    try { bakeLogoSDF(data, CW, CH); } catch (e) { console.warn('logo field failed', e); }
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (data[(y * CW + x) * 4 + 3] > 110) filled.push(x, y);
    const nf = filled.length / 2;
    if (nf < 200) throw new Error('empty');
    const r = rngFrom(99), order = Array.from({ length: nf }, (_, i) => i);
    for (let i = nf - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    const md = Math.sqrt(nf / TARGET) * 0.82, cell = md, gw = Math.ceil(CW / cell) + 1, grid = new Map();
    for (const k of order) {
      const x = filled[k * 2] + 0.5, y = filled[k * 2 + 1] + 0.5, gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let ok = true;
      for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) {
        const l = grid.get((gy + b) * gw + gx + a); if (!l) continue;
        for (let m = 0; m < l.length; m += 2) if ((l[m] - x) ** 2 + (l[m + 1] - y) ** 2 < md * md) { ok = false; break; }
      }
      if (!ok) continue;
      const key = gy * gw + gx; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(x, y);
      pts.push(svgToE(40 + x / CW * 840, 40 + y / CH * 920));
    }
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = pts[i]; pts[i] = pts[j]; pts[j] = t; }
    if (pts.length > TARGET) pts.length = TARGET;
  } catch (e) {
    console.warn('logo sampling fell back', e);
    const r = rngFrom(5); pts = [];
    for (let i = 0; i < 900; i++) { const y = r() - 0.5, w = 0.04 + (0.5 - y) * 0.25; pts.push([(r() - 0.5) * w * 2, y]); }
  }
  LOGO.n = pts.length; LOGO.x = new Float32Array(LOGO.n); LOGO.y = new Float32Array(LOGO.n);
  LOGO.minY = 1; LOGO.maxY = -1;
  pts.forEach((p, i) => { LOGO.x[i] = p[0]; LOGO.y[i] = p[1]; LOGO.minY = Math.min(LOGO.minY, p[1]); LOGO.maxY = Math.max(LOGO.maxY, p[1]); });
}
const holoCol = (y, x) => grad(HOLO, clamp((y - LOGO.minY) / (LOGO.maxY - LOGO.minY) + x * 0.15, 0, 1));

/* ================================================================== */