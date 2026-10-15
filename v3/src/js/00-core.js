(() => {
'use strict';

/* ================================================================== */
/* Utilities                                                           */
/* ================================================================== */
const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const wrap = (v, lo, hi) => { const s = hi - lo; return ((v - lo) % s + s) % s + lo; };
function rngFrom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = rngFrom(7171);
function lin(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.pow(c / 255, 2.2)); }
const PAL = {
  pink: lin('#FF4FD8'), violet: lin('#9B5CFF'), cyan: lin('#3CF2FF'), gold: lin('#FFC46B'), ember: lin('#FF6A2B'), rose: lin('#FF8FB8'),
  pearl: lin('#EFEAFF'), azure: lin('#5A8CFF'), teal: lin('#38E8C8'), indigo: lin('#4434B8'), lime: lin('#B8FF5A'), white: lin('#FFF7EC'),
  red: lin('#FF2E3A'), biolum: lin('#8DFFE6'), magenta: lin('#D25CFF'), amber: lin('#FFA43A')
};
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const grad = (stops, u) => { u = clamp(u, 0, 1) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(u)); return mixC(stops[i], stops[i + 1], u - i); };
const HOLO = [PAL.cyan, PAL.azure, PAL.violet, PAL.magenta, PAL.pink];
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// value noise + a cheap curl-ish vector field
const perm = new Uint8Array(512);
{ const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const X = xi & 255, Y = yi & 255, Z = zi & 255, k = 1 / 127.5;
  const A0 = perm[X] + Y, B0 = perm[X + 1] + Y, AA = perm[A0] + Z, AB = perm[A0 + 1] + Z, BA = perm[B0] + Z, BB = perm[B0 + 1] + Z;
  const a = lerp(perm[AA] * k - 1, perm[BA] * k - 1, u), b = lerp(perm[AB] * k - 1, perm[BB] * k - 1, u);
  const c = lerp(perm[AA + 1] * k - 1, perm[BA + 1] * k - 1, u), d = lerp(perm[AB + 1] * k - 1, perm[BB + 1] * k - 1, u);
  return lerp(lerp(a, b, v), lerp(c, d, v), w);
}
const cv = new Float32Array(3);
function curl3(x, y, z) { cv[0] = noise3(x, y, z); cv[1] = noise3(x + 31.4, y - 7.2, z + 11.9); cv[2] = noise3(x - 17.7, y + 23.3, z - 5.1); return cv; }

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */
const DEF = { world: 0, auto: true, grade: 0, cycle: true, logo: false, logoSize: 0.4, camAmt: 0.55, camMotion: false, flow: true, flowAmt: 1, flowHold: 0.8, sens: 1.1,
  glow: 0.6, trail: 0.3, dof: 0.5, quality: 1, stats: false, kaleido: 0, echo: 0.2,
  exposure: 0.95, rolloff: 0.6, white: 4, sat: 1.05, contrast: 1.0, hot: 0.4, thr: 0.12, limiter: 0.45,
  lens: 0, lensSize: 0.55, lensAmt: 0.7, lensPulse: 0.5, lensPos: 0, lensSpin: false,
  detail: (window.matchMedia && matchMedia('(pointer:coarse)').matches) ? 0.6 : 1, fly: false, tour: 0, tourEvery: 16, wisps: true, echoZoom: 0 };
// keys that travel with a preset or share link, besides the world's own parameters
const LOOK_KEYS = ['wisps', 'kaleido', 'echo', 'echoZoom', 'glow', 'trail', 'dof', 'grade', 'cycle', 'exposure', 'rolloff', 'white', 'sat', 'contrast', 'hot', 'thr', 'limiter',
  'logo', 'logoSize', 'lens', 'lensSize', 'lensAmt', 'lensPulse', 'lensPos', 'lensSpin'];
const COLOR_KEYS = ['exposure', 'rolloff', 'white', 'sat', 'contrast', 'hot', 'thr', 'limiter'];
const S = Object.assign({}, DEF);
try { Object.assign(S, JSON.parse(localStorage.getItem('htv3') || '{}')); } catch (e) {}
S.cam = 'off'; S.demo = false; S.fly = false;
function save() { try { const o = Object.assign({}, S); delete o.cam; delete o.demo; localStorage.setItem('htv3', JSON.stringify(o)); } catch (e) {} }

/* ================================================================== */
/* WebGL                                                               */
/* ================================================================== */
const canvas = $('#c');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
function fatal(msg) { const el = $('#err'); el.style.display = 'grid'; el.innerHTML = msg; }
if (!gl) { fatal('This needs WebGL2.<br>Open it in Safari on iOS 15 or newer, or a current Chrome.'); return; }
let HDR = !!gl.getExtension('EXT_color_buffer_float');
const HALF_RT = HDR || !!gl.getExtension('EXT_color_buffer_half_float');
gl.getExtension('OES_texture_float_linear');
// particle state lives in float textures; full float where the GPU can render to it, half float otherwise
const SIM_FMT = HDR ? gl.RGBA32F : gl.RGBA16F;
if (!HALF_RT) { fatal('This GPU cannot render to float textures, which the v3 particle engine needs.<br>Try <a href="../">v2</a>.'); return; }

function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src.trim()); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s), lines = src.trim().split('\n'), m = /ERROR: \d+:(\d+)/.exec(log || '');
    console.error('shader error', log, m ? '\n>> ' + lines.slice(Math.max(0, +m[1] - 3), +m[1] + 1).join('\n>> ') : '');
    throw new Error('shader');
  }
  return s;
}
function program(vs, fs) {
  const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); throw new Error('link'); }
  const cache = {}; p.u = n => (n in cache) ? cache[n] : (cache[n] = gl.getUniformLocation(p, n));
  return p;
}

const HUE = `
vec3 hueRot(vec3 c, float a){
  float cs = cos(a), sn = sin(a);
  mat3 m = mat3(
    0.213 + cs * 0.787 - sn * 0.213, 0.213 - cs * 0.213 + sn * 0.143, 0.213 - cs * 0.213 - sn * 0.787,
    0.715 - cs * 0.715 - sn * 0.715, 0.715 + cs * 0.285 + sn * 0.140, 0.715 - cs * 0.715 + sn * 0.715,
    0.072 - cs * 0.072 + sn * 0.928, 0.072 - cs * 0.072 - sn * 0.283, 0.072 + cs * 0.928 + sn * 0.072);
  return max(m * c, 0.0);
}`;

const FS_VERT = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// Background: deep night gradient, slow nebula, a halo behind the entity, and the camera as an edge-lit backdrop
const BG_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uRes, uCenter; uniform float uTime, uLevel, uCamAmt, uCamAsp, uCamMirror, uMotion, uFogAmt; uniform vec3 uTint, uFogC; uniform sampler2D uCam;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float luma(vec2 uv){ return dot(texture(uCam, uv).rgb, vec3(0.299, 0.587, 0.114)); }
void main(){
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  vec3 col = vec3(0.0035, 0.003, 0.009) + vec3(0.006, 0.003, 0.012) * (1.0 - vUv.y);
  float n = fbm(p * 1.3 + vec2(uTime * 0.01, -uTime * 0.006));
  float n2 = fbm(p * 2.4 - n * 0.9 + uTime * 0.013);
  col += uTint * 0.024 * smoothstep(0.4, 0.95, n2) * n;
  vec2 c = (uCenter - 0.5) * vec2(asp, 1.0);
  float d = length(p - c);
  col += uTint * (0.012 + 0.05 * uLevel) * exp(-d * d * 3.0);
  col += vec3(0.30, 0.20, 0.55) * 0.008 * exp(-d * d * 0.7);
  // water / haze: the far distance glows faintly in the fog's colour, brighter toward the surface
  col += uFogC * uFogAmt * (0.08 + 0.22 * smoothstep(0.1, 1.0, vUv.y)) * (0.75 + 0.25 * n);
  if (uCamAmt > 0.001) {
    vec2 uv = vUv; float r = asp / uCamAsp;
    if (r > 1.0) uv.y = (uv.y - 0.5) / r + 0.5; else uv.x = (uv.x - 0.5) * r + 0.5;
    if (uCamMirror > 0.5) uv.x = 1.0 - uv.x;
    uv.y = 1.0 - uv.y;
    vec2 tx = 1.5 / vec2(textureSize(uCam, 0));
    float l = luma(uv);
    float gx = luma(uv + vec2(tx.x, 0)) - luma(uv - vec2(tx.x, 0));
    float gy = luma(uv + vec2(0, tx.y)) - luma(uv - vec2(0, tx.y));
    float e = smoothstep(0.05, 0.35, length(vec2(gx, gy)) * 2.0);
    vec3 lc = pow(vec3(l), vec3(2.2));
    vec3 cam = uTint * lc * 0.3 + mix(uTint * 2.2, vec3(1.0, 0.95, 1.0), 0.35) * e * (0.35 + uMotion * 0.6);
    col += cam * uCamAmt * smoothstep(1.2, 0.35, length((vUv - 0.5) * vec2(1.0, 1.2)) * 1.3);
  }
  o = vec4(col, 1.0);
}`;

// Trails and echo: the last frame is fed back slightly zoomed and turned, so light recedes into an endless tunnel
const TRAIL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uPrev; uniform float uDecay, uZoom, uRot, uAsp;
void main(){
  vec3 sc = texture(uScene, vUv).rgb;
  vec2 c = vUv - 0.5; c.x *= uAsp;
  float cs = cos(uRot), sn = sin(uRot);
  c = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y) * uZoom; c.x /= uAsp;
  vec2 pu = c + 0.5;
  vec3 pv = (pu.x < 0.0 || pu.x > 1.0 || pu.y < 0.0 || pu.y > 1.0) ? vec3(0.0) : texture(uPrev, pu).rgb * uDecay;
  o = vec4(max(sc, pv), 1.0);
}`;

const DOWN_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uFirst, uThr;
vec3 s(vec2 off){ return texture(uTex, vUv + uTexel * off).rgb; }
float kw(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main(){
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2)), d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2)), j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col;
  if (uFirst > 0.5) {
    vec3 g0 = (j + k + l + m) * 0.25, g1 = (a + b + d + e) * 0.25, g2 = (b + c + e + f) * 0.25, g3 = (d + e + g + h) * 0.25, g4 = (e + f + h + i) * 0.25;
    float w0 = kw(g0) * 0.5, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.125;
    col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    float L = dot(col, vec3(0.2126, 0.7152, 0.0722)), kn = uThr * 0.5 + 1e-4, sq = clamp(L - uThr + kn, 0.0, 2.0 * kn);
    col *= max(sq * sq / (4.0 * kn), L - uThr) / max(L, 1e-4);
  } else col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  o = vec4(max(col, 0.0), 1.0);
}`;
const UP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
vec3 s(vec2 off){ return texture(uTex, vUv + uTexel * off).rgb; }
void main(){
  vec3 c = s(vec2(-1, 1)) + 2.0 * s(vec2(0, 1)) + s(vec2(1, 1)) + 2.0 * s(vec2(-1, 0)) + 4.0 * s(vec2(0, 0)) + 2.0 * s(vec2(1, 0))
         + s(vec2(-1, -1)) + 2.0 * s(vec2(0, -1)) + s(vec2(1, -1));
  o = vec4(c / 16.0, 1.0);
}`;
// Composite: bloom, kaleidoscope, the HOME TEAM logo as a lens, then highlight roll-off, grade, saturation and contrast
const COMP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom, uLogo; uniform vec2 uRes, uLensOff;
uniform float uBloomStr, uTime, uCA, uGrain, uGradeMix, uGradeHue, uFlash, uMirN, uMirMix, uMirRot;
uniform float uExpo, uRoll, uWhite, uSat, uCon, uLens, uLensMix, uLensSize, uLensRot, uLevel, uKick;
uniform vec3 uG0, uG1, uG2, uG3;
${HUE}
const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 gradeMap(float l){
  l = clamp(l, 0.0, 1.0);
  if (l < 0.33) return mix(uG0, uG1, l / 0.33);
  if (l < 0.66) return mix(uG1, uG2, (l - 0.33) / 0.33);
  return mix(uG2, uG3, (l - 0.66) / 0.34);
}
vec3 sceneAt(vec2 uv){
  vec2 cc = uv - 0.5; vec2 off = cc * dot(cc, cc) * uCA;
  vec3 sc = vec3(texture(uScene, uv - off).r, texture(uScene, uv).g, texture(uScene, uv + off).b);
  vec3 bl = vec3(texture(uBloom, uv - off * 2.0).r, texture(uBloom, uv).g, texture(uBloom, uv + off * 2.0).b);
  return sc + bl * (uBloomStr + uFlash * 0.06);
}
// Kaleidoscope: fold the frame into mirrored wedges around the centre
vec2 mirrorUV(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float seg = 6.2831853 / uMirN;
  float a = atan(p.y, p.x) - uMirRot; a = mod(a, seg); if (a > seg * 0.5) a = seg - a; a += uMirRot;
  p = length(p) * vec2(cos(a), sin(a));
  return clamp(p / vec2(asp, 1.0) + 0.5, 0.0, 1.0);
}
vec3 sceneK(vec2 uv){
  uv = clamp(uv, 0.0, 1.0);
  vec3 c = sceneAt(uv);
  if (uMirN > 1.5 && uMirMix > 0.001) c = mix(c, sceneAt(mirrorUV(uv)), uMirMix);
  return c;
}
// signed distance to the logo in logo-heights (negative inside), from the baked distance texture
float sdf(vec2 lp){
  vec2 tuv = vec2(lp.x / 0.913 + 0.5, lp.y + 0.5);
  vec2 q = abs(tuv - 0.5) - 0.5;
  return texture(uLogo, clamp(tuv, 0.0, 1.0)).r + length(max(q, 0.0));
}
vec3 film(float x){ return 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + x)); }
void main(){
  float asp = uRes.x / uRes.y;
  vec3 base = sceneK(vUv), col = base;
  if (uLens > 0.5 && uLensMix > 0.001) {
    vec2 p = (vUv - 0.5) * vec2(asp, 1.0) - uLensOff;
    float cs = cos(uLensRot), sn = sin(uLensRot);
    vec2 lp = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y) / uLensSize;
    float d = sdf(lp);
    if (d < 0.12) {
      vec2 e = vec2(0.003, 0.0);
      vec2 g = vec2(sdf(lp + e.xy) - sdf(lp - e.xy), sdf(lp + e.yx) - sdf(lp - e.yx)); g /= length(g) + 1e-5;
      vec2 gs = vec2(cs * g.x - sn * g.y, sn * g.x + cs * g.y); gs.x /= asp;
      float aa = max(fwidth(d) * 0.8, 1e-5);
      float inside = smoothstep(aa, -aa, d), rim = exp(-abs(d) / max(0.004, aa * 1.5)), m = uLensMix;
      int mode = int(uLens + 0.5);
      vec3 c = base;
      if (mode == 1) {
        // glass: a domed slab of crown glass that bends and splits the light behind it
        float h = sqrt(clamp(-d / 0.03, 0.0, 1.0)), bend = (1.0 - h) * inside;
        vec2 off = -gs * bend * uLensSize * (0.16 + uKick * 0.06);
        vec3 r = vec3(sceneK(vUv + off * 0.78).r, sceneK(vUv + off).g, sceneK(vUv + off * 1.25).b);
        vec3 n = normalize(vec3(-g * (1.0 - h) * 1.6, h + 0.25));
        float sp = pow(max(dot(n, normalize(vec3(-0.45, 0.6, 1.0))), 0.0), 28.0);
        float edgeBand = inside * pow(1.0 - h, 3.0);
        c = mix(base, r * 1.12 + vec3(0.85, 0.92, 1.0) * (0.035 + sp * 0.5 * (0.6 + uLevel) + edgeBand * 0.18), inside)
          + film(d * 26.0 + uTime * 0.04 + vUv.y) * rim * (0.18 + 0.4 * uLevel + 0.6 * uKick);
      } else if (mode == 2) {
        // holo foil: thin-film colour that shifts across the face and shimmers with the music
        float L = dot(base, LW);
        vec3 foil = film(d * 14.0 + dot(lp, vec2(1.1, 2.3)) + uTime * 0.07 + uLevel * 0.5);
        float shim = pow(0.5 + 0.5 * sin(lp.x * 16.0 - lp.y * 11.0 + uTime * 1.2), 4.0) * (0.3 + uLevel + uKick);
        vec3 inC = base * (0.3 + foil * 0.95) + foil * (0.09 + 0.2 * shim + 0.25 * L);
        c = mix(base, inC, inside) + foil * rim * (0.2 + 0.4 * uKick);
      } else if (mode == 3) {
        // displace: the logo is an invisible weight that bends the scene around it and pulses on the kick
        float fall = exp(-max(d, 0.0) / 0.06) * (1.0 - 0.4 * inside);
        float wave = 0.55 + 0.45 * sin(d * 60.0 - uTime * 3.2);
        vec2 off = gs * fall * wave * uLensSize * (0.1 + 0.2 * uKick + 0.06 * uLevel);
        vec3 w2 = sceneK(vUv - off);
        c = w2 * (1.0 + inside * 0.35) + film(d * 20.0 + uTime * 0.05) * rim * (0.07 + 0.3 * uKick);
      } else if (mode == 4) {
        // ghost: only the outline, breathing light
        c = base + film(d * 10.0 + uTime * 0.06 + vUv.x) * (exp(-abs(d) / 0.005) * 0.8 + exp(-abs(d) / 0.025) * 0.25) * (0.22 + 0.5 * uLevel + 0.7 * uKick) + base * inside * 0.25;
      } else {
        // window: the world is only visible through the letters
        c = base * mix(0.03, 1.15, inside) + film(d * 12.0 + uTime * 0.05) * rim * (0.05 + 0.25 * uKick);
      }
      col = mix(base, c, m);
    } else if (int(uLens + 0.5) == 5) col = base * mix(1.0, 0.03, uLensMix);
  }
  col *= 1.0 - 0.6 * smoothstep(0.25, 0.95, length((vUv - 0.5) * vec2(asp * 0.75, 1.0)));
  col *= uExpo;
  // highlight roll-off: blend ACES with a hue-preserving curve so hot cores stay coloured instead of clipping to white
  vec3 ta = aces(col);
  float L = dot(col, LW), Lt = L * (1.0 + L / (uWhite * uWhite)) / (1.0 + L);
  vec3 tr = col * (Lt / max(L, 1e-5)); float mx = max(tr.r, max(tr.g, tr.b)); if (mx > 1.0) tr /= mx;
  col = mix(ta, tr * 1.25, uRoll);
  if (uGradeMix > 0.001) {
    float l = dot(col, LW);
    col = mix(col, hueRot(gradeMap(pow(l, 0.85)), uGradeHue), uGradeMix);
  }
  col = max(mix(vec3(dot(col, LW)), col, uSat), 0.0);
  col = pow(min(col, 1.0), vec3(1.0 / 2.2));
  col = clamp((col - 0.5) * uCon + 0.5, 0.0, 1.0);
  col += (hash(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
  o = vec4(col, 1.0);
}`;

const pBg = program(FS_VERT, BG_FRAG), pTrail = program(FS_VERT, TRAIL_FRAG),
  pDown = program(FS_VERT, DOWN_FRAG), pUp = program(FS_VERT, UP_FRAG), pComp = program(FS_VERT, COMP_FRAG);
const emptyVao = gl.createVertexArray();
