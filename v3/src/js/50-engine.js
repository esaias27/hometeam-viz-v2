/* ================================================================== */
/* GPU particle engine                                                 */
/* ================================================================== */
// Every world is a fragment shader that writes its particles into two float textures (position + radius, colour + energy).
// A blend pass morphs the outgoing and incoming worlds, adds the logo pool, dust and wisps, and applies shockwaves.
// Then the result is drawn twice: lit pearls into a depth buffer, then glows, bokeh and filaments added on top.
const TW = 512, TH = 512, CAP = TW * TH, WISP = 3;
const LG = 9000, MDUST = 1600, WO = LG + MDUST + 3;   // fin layout: [logo pool | dust | wisps | world]
const GLSL_PAL = Object.entries(PAL).map(([k, v]) => `const vec3 C_${k} = vec3(${v.map(x => x.toFixed(5)).join(', ')});`).join('\n');
const LIB = `
precision highp float; precision highp int; precision highp sampler2D;
#define TAU 6.2831853
#define TW ${TW}
${GLSL_PAL}
uint hashu(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float hf(uint x){ return float(hashu(x)) * (1.0 / 4294967296.0); }
vec4 seeds(int i){ uint u = uint(i) * 4u + 101u; return vec4(hf(u), hf(u + 1u), hf(u + 2u), hf(u + 3u)); }
float h1(int i, int k){ return hf(uint(i) * 2654435761u + uint(k) * 40503u + 7u); }
float hn(ivec3 q){ q += 8192; return hf(uint(q.x) * 73856093u ^ uint(q.y) * 19349663u ^ uint(q.z) * 83492791u) * 2.0 - 1.0; }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); ivec3 q = ivec3(i);
  return mix(mix(mix(hn(q), hn(q + ivec3(1, 0, 0)), u.x), mix(hn(q + ivec3(0, 1, 0)), hn(q + ivec3(1, 1, 0)), u.x), u.y),
             mix(mix(hn(q + ivec3(0, 0, 1)), hn(q + ivec3(1, 0, 1)), u.x), mix(hn(q + ivec3(0, 1, 1)), hn(q + ivec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm3(vec3 p){ return vnoise(p) * 0.6 + vnoise(p * 2.03 + 7.1) * 0.28 + vnoise(p * 4.1 - 3.3) * 0.12; }
vec3 rotP(vec3 p, float ay, float ax){ float cy = cos(ay), sy = sin(ay), cx = cos(ax), sx = sin(ax); float x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy; return vec3(x1, p.y * cx - z1 * sx, p.y * sx + z1 * cx); }
float tw(vec4 s, float t){ return pow(0.5 + 0.5 * sin(t * (0.6 + s.x * 1.6) + s.w * 60.0), 14.0); }
float sm(float a, float b, float x){ return smoothstep(a, b, x); }
float easeIO(float t){ return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
vec3 g3(vec3 a, vec3 b, vec3 c, float u){ u = clamp(u, 0.0, 1.0) * 2.0; return u < 1.0 ? mix(a, b, u) : mix(b, c, u - 1.0); }
vec3 g4(vec3 a, vec3 b, vec3 c, vec3 d, float u){ u = clamp(u, 0.0, 1.0) * 3.0; return u < 1.0 ? mix(a, b, u) : u < 2.0 ? mix(b, c, u - 1.0) : mix(c, d, u - 2.0); }
vec3 g5(vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, float u){ u = clamp(u, 0.0, 1.0) * 4.0; return u < 1.0 ? mix(a, b, u) : u < 2.0 ? mix(b, c, u - 1.0) : u < 3.0 ? mix(c, d, u - 2.0) : mix(d, e, u - 3.0); }
vec3 fib(int j, int n, float jitter){ float y = 1.0 - (float(j) + 0.5) / float(n) * 2.0, r = sqrt(max(0.0, 1.0 - y * y)), th = float(j) * 2.39996 + jitter; return vec3(cos(th) * r, y, sin(th) * r); }
vec4 fetch(sampler2D t, int i){ return texelFetch(t, ivec2(i % TW, i / TW), 0); }
`;
const AUDIO_U = `uniform float uT, uLevel, uLow, uMid, uHigh, uPres, uCentroid; uniform float uB[16]; uniform vec2 uRot;
float band(float u){ return uB[clamp(int(u * 15.0 + 0.5), 0, 15)]; }
float bandAt(float u){ float f = clamp(u, 0.0, 1.0) * 15.0; int i = min(14, int(f)); return mix(uB[i], uB[i + 1], f - float(i)); }`;
const paramU = name => schemaOf(name).map(d => `uniform float p_${d.k};`).join('\n');

function simTex(w, h) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, SIM_FMT, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
// a framebuffer with several float colour targets (MRT)
function simTarget(w, h, n) {
  const fb = gl.createFramebuffer(), tex = [];
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  for (let k = 0; k < n; k++) { const t = simTex(w, h); tex.push(t); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0); }
  gl.drawBuffers(tex.map((_, k) => gl.COLOR_ATTACHMENT0 + k));
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) throw new Error('float render target incomplete');
  return { fb, tex, w, h };
}
const slotCur = simTarget(TW, TH, 2), slotPrev = simTarget(TW, TH, 2), finT = simTarget(TW, TH, 2), snapT = simTarget(TW, TH, 2);
const rowsFor = n => Math.max(1, Math.min(TH, Math.ceil(n / TW)));

// small data textures the CPU fills (logo points, reef slots, tide history)
function dataTex(w, h, fmt, filter) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt || gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  const f = filter || gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function uploadData(t, w, h, data, fmt) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, fmt || gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data); }
const logoPtsTex = dataTex(TW, Math.ceil(LG / TW));
function uploadLogoPoints() {
  const rows = Math.ceil(LG / TW), d = new Float32Array(TW * rows * 4);
  for (let k = 0; k < Math.min(LG, LOGO.n); k++) { d[k * 4] = LOGO.x[k]; d[k * 4 + 1] = LOGO.y[k]; d[k * 4 + 2] = clamp((LOGO.y[k] - LOGO.minY) / (LOGO.maxY - LOGO.minY) + LOGO.x[k] * 0.15, 0, 1); d[k * 4 + 3] = 1; }
  uploadData(logoPtsTex, TW, rows, d);
}

/* ---- world programs ---- */
function worldProgram(name, src) {
  const fs = `#version 300 es
${LIB}
layout(location=0) out vec4 oP; layout(location=1) out vec4 oC;
uniform int uN;
${AUDIO_U}
${paramU(name)}
${src}
void main(){
  int i = int(gl_FragCoord.y) * TW + int(gl_FragCoord.x);
  if (i >= uN) { oP = vec4(0.0); oC = vec4(0.0); return; }
  vec3 p = vec3(0.0), c = vec3(1.0); float r = 0.0, e = 0.0, g = 0.0;
  vec4 s = seeds(i);
  particle(i, s, p, r, c, e, g);
  if (p_turb > 0.002) {
    float tb = p_turb * (0.16 + uLevel * 0.12);
    p += tb * vec3(sin(p.y * 1.7 + uT * 0.61 + p.z * 0.9) + 0.5 * sin(p.z * 3.1 - uT * 0.93 + s.x * 6.0),
                   sin(p.z * 1.3 - uT * 0.53 + p.x * 1.1) + 0.5 * sin(p.x * 2.9 + uT * 0.77 + s.y * 6.0),
                   sin(p.x * 1.5 + uT * 0.47 + p.y * 0.8) + 0.5 * sin(p.y * 2.7 - uT * 0.71 + s.z * 6.0));
  }
  p = rotP(p, uRot.x, uRot.y);
  r *= p_size; e *= p_bright;
  oP = vec4(p, g > 0.5 ? -r : r); oC = vec4(c, e);
}`;
  return program(FS_VERT, fs);
}
// audio + params + a world's own uniforms, shared by particle and line programs
function setCommon(p, w, t) {
  gl.uniform1f(p.u('uT'), t); gl.uniform1f(p.u('uLevel'), A.level); gl.uniform1f(p.u('uLow'), A.low); gl.uniform1f(p.u('uMid'), A.mid);
  gl.uniform1f(p.u('uHigh'), A.high); gl.uniform1f(p.u('uPres'), A.presence); gl.uniform1f(p.u('uCentroid'), A.centroid);
  gl.uniform1fv(p.u('uB[0]'), A.bands); gl.uniform2f(p.u('uRot'), w.ay, w.ax);
  const P = w.P; for (const d of schemaOf(w.name)) { const l = p.u('p_' + d.k); if (l) gl.uniform1f(l, P[d.k]); }
}
let texUnit = 0;
function bindT(p, name, tex) { const l = p.u(name); if (!l) return; gl.activeTexture(gl.TEXTURE0 + 4 + texUnit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(l, 4 + texUnit); texUnit++; }
function renderWorld(w, target, t) {
  if (w.prepass) w.prepass(t);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, TW, rowsFor(w.n));
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  const p = w.prog; gl.useProgram(p); texUnit = 0;
  gl.uniform1i(p.u('uN'), w.n);
  withGains(w.P, () => { setCommon(p, w, t); w.uniforms(p, t); });
  drawFS();
}

/* ---- blend pass: morph, shockwaves, logo pool, dust, wisps ---- */
const BLEND_FRAG = `#version 300 es
${LIB}
layout(location=0) out vec4 oP; layout(location=1) out vec4 oC;
uniform sampler2D uCP, uCC, uPP, uPC, uLogoPts;
uniform int uNC, uNP, uPOff, uMode, uLGN;
uniform float uK, uT, uLevel, uLow, uHigh, uFlash;
uniform float uB[16];
uniform vec4 uRip[14]; uniform vec2 uRipS[14];
uniform float uLW, uLSz, uLY0, uLZ0, uLFollow, uLAy, uLAx, uLTipF; uniform vec3 uLTip;
uniform vec4 uWisp[3]; uniform vec3 uWispC[3];
uniform sampler2D uFlow; uniform mat4 uVP; uniform vec3 uCR, uCU; uniform float uFlowOn, uTanH, uAsp, uScI;
vec3 flowPush(vec3 p, inout float e){
  vec4 c = uVP * vec4(p, 1.0);
  if (c.w < 0.2) return p;
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  if (uv.x < -0.1 || uv.x > 1.1 || uv.y < -0.1 || uv.y > 1.1) return p;
  vec2 f = texture(uFlow, clamp(uv, 0.0, 1.0)).xy;
  float m = length(f); if (m < 1e-4) return p;
  e += min(m * 6.0, 1.5);
  return p + (uCR * f.x * uAsp + uCU * f.y) * 2.0 * uTanH * c.w * uScI;
}
float band(float u){ return uB[clamp(int(u * 15.0 + 0.5), 0, 15)]; }
void main(){
  int idx = int(gl_FragCoord.y) * TW + int(gl_FragCoord.x);
  vec4 s = seeds(idx);
  if (idx < ${LG}) {
    // the logo pool: pearls fly out of the world's own light and spell HOME TEAM
    int k = idx;
    vec4 L = fetch(uLogoPts, k);
    int src = uNC > 0 ? int(hf(uint(k) * 7u + 3u) * float(uNC)) : 0;
    vec4 sp = uNC > 0 ? fetch(uCP, src) : vec4(0.0);
    float w = (k < uLGN && uLW > 0.003) ? easeIO(clamp(uLW * 1.6 - s.w * 0.6, 0.0, 1.0)) : 0.0;
    if (w <= 0.0) { oP = vec4(0.0); oC = vec4(0.0); return; }
    float sz = uLSz, lx = L.x * sz, ly = L.y * sz + uLY0, lz = (s.z - 0.5) * 0.05 * sz + uLZ0 + sin(L.y * 9.0 - uT * 1.6) * uLow * 0.06;
    float ay = mix(0.35 * sin(uT * 0.25), uLAy, uLFollow), ax = mix(0.0, uLAx, uLFollow);
    vec3 lp = rotP(vec3(lx, ly, lz), ay, ax);
    float arc = sin(3.14159 * w) * 0.35;
    vec3 p = mix(sp.xyz, lp, w) + vec3(0.0, arc * (s.y - 0.5), arc);
    float b = band(L.z);
    vec3 col = g5(C_cyan, C_azure, C_violet, C_magenta, C_pink, L.z);
    float tip = uLTipF > 0.0 ? uLTipF * exp(-length(vec2(lx, ly) - uLTip.xy) * 1.6) * 1.3 : 0.0;
    float r = (0.0062 + 0.0042 * s.y) * (sz / 2.6) * (1.0 + b * 0.4) * w;
    float le = 0.0; if (uFlowOn > 0.5) p = flowPush(p, le);
    oP = vec4(p, r); oC = vec4(col, 0.14 + b * 0.5 + uLevel * 0.2 + tw(s, uT) * 0.35 + uFlash * 0.3 + tip);
    return;
  }
  if (idx < ${LG + MDUST}) {
    // dust motes drifting through the whole volume, soft bokeh
    vec4 q = vec4(h1(idx, 5), h1(idx, 6), h1(idx, 7), h1(idx, 8));
    vec3 lo = vec3(-18.0, -10.0, -34.0), hi = vec3(18.0, 10.0, 6.0), sz3 = hi - lo;
    vec3 v = (vec3(h1(idx, 9), h1(idx, 10), h1(idx, 11)) - 0.5) * 0.06 + vec3(0.0, 0.035, 0.0);
    vec3 p = lo + mod(q.xyz * sz3 + v * uT + vec3(sin(uT * 0.21 + q.w * 30.0) * 0.25, sin(uT * 0.17 + q.w * 50.0) * 0.2, 0.0), sz3);
    vec3 col = (q.w < 0.45 ? C_azure : q.w < 0.8 ? C_violet : C_pearl) * 0.8;
    float e = (0.15 + 0.35 * s.x) * (0.7 + 0.6 * pow(0.5 + 0.5 * sin(uT * (0.4 + q.w) + q.w * 90.0), 6.0)) + uHigh * 0.25;
    oP = vec4(p, -(0.006 + 0.012 * s.y)); oC = vec4(col, e);
    return;
  }
  if (idx < ${WO}) { int j = idx - ${LG + MDUST}; oP = vec4(uWisp[j].xyz, -0.026); oC = vec4(uWispC[j], uWisp[j].w); return; }
  int i = idx - ${WO};
  vec4 cp = i < uNC ? fetch(uCP, i) : vec4(0.0), cc = i < uNC ? fetch(uCC, i) : vec4(0.0);
  vec4 P, C;
  if (uMode == 0) { P = cp; C = cc; }
  else {
    vec4 pp = i < uNP ? fetch(uPP, i + uPOff) : vec4(0.0), pc = i < uNP ? fetch(uPC, i + uPOff) : vec4(0.0);
    float e = easeIO(clamp(uK * 1.5 - s.w * 0.5, 0.0, 1.0)), arc = sin(3.14159 * e);
    vec3 p = mix(pp.xyz, cp.xyz, e);
    float hl = length(p.xz) + 1e-4, sw = arc * (0.25 + 0.45 * s.x);
    p.x += (-p.z / hl) * sw; p.z += (p.x / hl) * sw; p.y += arc * (s.y - 0.5) * 0.5;
    float ra = abs(pp.w), rb = abs(cp.w);
    float r = (ra <= 0.0 ? rb * e : rb <= 0.0 ? ra * (1.0 - e) : mix(ra, rb, e)) * (1.0 - 0.25 * arc);
    float kind = rb <= 0.0 ? sign(pp.w) : ra <= 0.0 ? sign(cp.w) : (e > 0.5 ? sign(cp.w) : sign(pp.w));
    P = vec4(p, r * kind); C = vec4(mix(pc.rgb, cc.rgb, e), mix(pc.a, cc.a, e) + arc * 0.35);
  }
  if (P.w != 0.0) {
    // shockwaves from kicks, taps and camera motion
    float push = 0.0; vec3 g = vec3(0.0);
    for (int k = 0; k < 14; k++) {
      float age = uRip[k].w; if (age > 3.0) continue;
      vec3 d = P.xyz - uRip[k].xyz; float dl = length(d) + 1e-4;
      float f = (dl - age * uRipS[k].y) / 0.22; if (f < -3.0 || f > 3.0) continue;
      float wv = uRipS[k].x * exp(-f * f) * exp(-age * 1.15);
      push += wv; g += d / dl * wv;
    }
    if (push > 0.001) { P.xyz += g * 0.11; P.w *= 1.0 + min(push, 1.5) * 0.45; C.a += push * 1.1; }
    if (uFlowOn > 0.5) { float fe = 0.0; P.xyz = flowPush(P.xyz, fe); C.a += fe; }
  }
  oP = P; oC = C;
}`;
const pBlend = program(FS_VERT, BLEND_FRAG);

/* ---- drawing particles ---- */
const P_VERT = `#version 300 es
${LIB}
layout(location=0) in vec2 aCorner;
uniform sampler2D uFP, uFC;
uniform mat4 uProj, uMV, uV; uniform float uPx, uAp, uFocus, uEcap, uPass, uCentroid, uSc; uniform vec3 uFlashC;
out vec2 vUv; out float vR0, vAA, vFocus, vRad, vE, vOp, vGlow, vSeed; out vec3 vCol, vC;
void main(){
  int id = gl_InstanceID; ivec2 tc = ivec2(id % TW, id / TW);
  vec4 P = texelFetch(uFP, tc, 0), C = texelFetch(uFC, tc, 0);
  bool glow = P.w < 0.0, dust = id >= ${LG} && id < ${LG + MDUST};
  float R = abs(P.w) * (dust ? 1.0 : uSc);
  vec3 v = ((dust ? uV : uMV) * vec4(P.xyz, 1.0)).xyz;
  float vz = -v.z;
  float coc = min((dust ? uAp * 1.6 + 0.004 : uAp) * abs(vz - uFocus), (dust ? 0.07 : 0.06) * max(vz, 0.1));
  float focusF = R / (R + coc + 1e-5);
  float op = glow ? 0.0 : smoothstep(0.4, 0.68, focusF);
  bool draw = R > 0.0004 && vz > 0.25;
  if (uPass < 0.5) draw = draw && op > 0.002; else draw = draw && (glow || op < 0.998);
  if (!draw) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float pix = uPx * vz, soft = coc + pix * 1.25, ext = uPass < 0.5 ? R + pix * 0.75 : R + soft;
  gl_Position = uProj * vec4(v + vec3(aCorner * ext, 0.0), 1.0);
  vUv = aCorner; vR0 = R / ext; vAA = (uPass < 0.5 ? pix * 0.75 : soft) / ext; vFocus = focusF; vRad = R; vC = v;
  float e = min(C.a, uEcap);
  float warm = clamp((e - 1.0) * 0.35, 0.0, 0.5) * (0.6 + uCentroid * 0.6);
  vCol = mix(C.rgb, uFlashC, warm); vE = e; vOp = op; vGlow = glow ? 1.0 : 0.0; vSeed = hf(uint(id) * 3u + 1u);
}`;
const P_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; in float vR0, vAA, vFocus, vRad, vE, vOp, vGlow, vSeed; in vec3 vCol, vC;
uniform vec3 uL; uniform float uTime, uHue, uHot, uFogD, uFogS, uPass; uniform vec4 uLp[4]; uniform vec3 uLc[4]; uniform vec3 uFogC;
out vec4 o;
${HUE}
vec3 foil(float t){ return 0.55 + 0.45 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + t)); }
float dither(){ vec2 p = gl_FragCoord.xy; return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d = length(vUv);
  if (d > 1.0) discard;
  vec3 base = hueRot(vCol, uHue); float e = vE;
  float fg = 1.0 - exp(-max(-vC.z - uFogS, 0.0) * uFogD);
  if (vGlow > 0.5) {
    float edge = 1.0 - smoothstep(vR0 - vAA, 1.0, d);
    float a = edge * mix(0.08, 1.0, vFocus * vFocus);
    float hot = exp(-d * d / (vR0 * vR0 + 1e-4) * 2.5) * vFocus * (0.4 + 0.6 * uHot);
    vec3 c = base * (0.2 + 0.55 * e) * (a + hot * 0.8);
    o = vec4(c * (1.0 - fg * 0.9) + uFogC * (a + hot) * fg * 0.25, 0.0);
    return;
  }
  if (uPass > 0.5) {
    // out of focus: a soft flat disc of light, added
    float edge = 1.0 - smoothstep(vR0 - vAA, 1.0, d);
    float a = edge * mix(0.26, 1.0, vFocus) * (1.0 - vOp);
    vec3 flatC = base * (0.05 + 0.28 * e + 0.35 * e * e);
    o = vec4(mix(flatC, uFogC * (0.25 + 0.5 * e), fg) * a * (1.0 - fg * 0.55), 0.0);
    return;
  }
  // in focus: a lit pearl, written to depth; partial focus fades through a dither so it can still be opaque
  if (d > vR0 || dither() > vOp) discard;
  vec2 pl = vUv / max(vR0, 1e-4);
  float nd = min(length(pl), 1.0);
  vec3 n = normalize(vec3(pl, sqrt(max(0.0, 1.0 - nd * nd)) + 1e-4));
  float z = n.z, fres = pow(1.0 - z, 2.2);
  float diff = max(dot(n, uL), 0.0);
  float spec = pow(max(dot(n, normalize(uL + vec3(0.0, 0.0, 1.0))), 0.0), 70.0);
  vec3 sheen = foil(fres * 0.7 + vSeed * 0.4 + uTime * 0.02);
  vec3 rimC = mix(base, base * sheen * 1.9, 0.4);
  vec3 col = base * (0.014 + 0.05 * diff) + rimC * fres * (0.3 + 1.2 * e)
           + base * e * e * (0.08 + 0.9 * z * z) * 0.8 * (0.45 + 0.55 * uHot) + vec3(1.0, 0.97, 0.94) * spec * (0.4 + 0.8 * e) * uHot;
  vec3 P = vC + n * vRad, lit = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    vec3 Lv = uLp[k].xyz - P; float d2 = dot(Lv, Lv) + 0.03;
    vec3 l = Lv * inversesqrt(d2);
    float att = uLp[k].w / (1.0 + d2 * 1.8), nl = dot(n, l);
    float wrapd = max((nl + 0.45) / 1.45, 0.0);
    float sp = pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 56.0);
    float trans = pow(max(-nl, 0.0), 1.5) * (0.35 + fres);
    lit += uLc[k] * att * (base * wrapd * 0.55 + sp * 0.9 * uHot + base * trans * 0.9);
  }
  col += lit;
  col = mix(col, uFogC * (0.25 + 0.5 * e), fg);
  o = vec4(col, 1.0);
}`;
const pPart = program(P_VERT, P_FRAG);
const quadVao = (() => {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null); return vao;
})();

/* ---- filaments: soft capsules, from CPU strands or computed on the GPU ---- */
const CAPSULE = `
uniform mat4 uProj, uMV; uniform float uPx, uFocus, uAp, uSc, uWeight;
out vec2 vQ; out float vHalf, vCap, vW, vI, vD; out vec3 vCol;
void capsule(vec2 corner, vec3 Aw, vec3 Bw, float iwA, float iwB, vec4 cA, vec4 cB){
  if (cA.a + cB.a <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 A = (uMV * vec4(Aw, 1.0)).xyz, B = (uMV * vec4(Bw, 1.0)).xyz;
  float t = corner.x, s = t * 2.0 - 1.0;
  vec3 P = mix(A, B, t);
  float dA = max(-A.z, 0.05), dB = max(-B.z, 0.05), depth = mix(dA, dB, t);
  float w = mix(iwA, iwB, t) * uSc, pix = uPx * depth; vD = depth;
  float core = max(w, pix * 0.55), coc = min(uAp * abs(depth - uFocus), 0.05 * depth);
  float wc = core + coc, ext = wc * 3.2 + pix, cap = wc * 1.8;
  vec2 d2 = B.xy / dB - A.xy / dA; float L = length(d2);
  vec2 dir = L > 1e-6 ? d2 / L : vec2(1.0, 0.0);
  P.xy += vec2(-dir.y, dir.x) * corner.y * ext + dir * s * cap;
  gl_Position = uProj * vec4(P, 1.0);
  float Lv = L * 0.5 * (dA + dB);
  vQ = vec2(s * (Lv * 0.5 + cap) / wc, corner.y * ext / wc);
  vHalf = Lv * 0.5 / wc; vCap = cap / wc; vW = ext / wc;
  vec4 c = mix(cA, cB, t);
  vCol = c.rgb; vI = c.a * uWeight * (core / wc) * min(1.0, w / (pix * 0.55) * 0.6 + 0.4);
  if (-A.z < 0.15 || -B.z < 0.15) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const F_VERT = `#version 300 es
${LIB}
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iA; layout(location=2) in vec4 iB; layout(location=3) in vec4 iCA; layout(location=4) in vec4 iCB;
${CAPSULE}
void main(){ capsule(aCorner, iA.xyz, iB.xyz, iA.w, iB.w, iCA, iCB); }`;
const F_FRAG = `#version 300 es
precision highp float;
in vec2 vQ; in float vHalf, vCap, vW, vI, vD; in vec3 vCol;
uniform float uHue, uHot, uFogD, uFogS; uniform vec3 uFogC;
out vec4 o;
${HUE}
void main(){
  float along = abs(vQ.x) - vHalf;
  float wa = clamp(0.5 - along / (2.0 * vCap), 0.0, 1.0);
  float d = abs(vQ.y);
  float core = exp(-d * d * 1.8);
  float halo = exp(-d * 1.2) * 0.2 * (1.0 - smoothstep(vW * 0.55, vW, d));
  float a = (core + halo) * vI * wa;
  if (a < 0.0004) discard;
  float fg = 1.0 - exp(-max(vD - uFogS, 0.0) * uFogD);
  vec3 c = hueRot(vCol, uHue) * a + vec3(1.0, 0.95, 0.9) * core * core * vI * vI * wa * 0.16 * uHot;
  o = vec4(c * (1.0 - fg * 0.9) + uFogC * a * fg * 0.2, 0.0);
}`;
const pFil = program(F_VERT, F_FRAG);
const MAXSEG = 40000, FSTRIDE = 16;
const FV = (() => {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, MAXSEG * FSTRIDE * 4, gl.DYNAMIC_DRAW);
  for (let a = 1; a <= 4; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 4, gl.FLOAT, false, FSTRIDE * 4, (a - 1) * 16); gl.vertexAttribDivisor(a, 1); }
  gl.bindVertexArray(null);
  return { vao, ib };
})();
const lineVao = (() => {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null); return vao;
})();
const finst = new Float32Array(MAXSEG * FSTRIDE);
let fcount = 0, gpuSegs = 0;
function pushSeg(ax, ay, az, aw, bx, by, bz, bw, r1, g1, b1, i1, r2, g2, b2, i2) {
  if (fcount >= MAXSEG) return;
  const q = fcount * FSTRIDE;
  finst[q] = ax; finst[q + 1] = ay; finst[q + 2] = az; finst[q + 3] = aw; finst[q + 4] = bx; finst[q + 5] = by; finst[q + 6] = bz; finst[q + 7] = bw;
  finst[q + 8] = r1; finst[q + 9] = g1; finst[q + 10] = b1; finst[q + 11] = i1; finst[q + 12] = r2; finst[q + 13] = g2; finst[q + 14] = b2; finst[q + 15] = i2;
  fcount++;
}
function gatherFil(F, weight, grow) {
  if (weight <= 0.004 || F.ns === 0) return;
  if (F.grow !== undefined) grow = Math.min(grow, F.grow);
  const lim = grow * (F.sMax + 0.8);
  for (let k = 0; k < F.ns; k++) {
    const a = F.seg[k * 2], b = F.seg[k * 2 + 1];
    const ga = grow >= 1 ? 1 : clamp((lim - F.s[a]) / 0.8, 0, 1), gb = grow >= 1 ? 1 : clamp((lim - F.s[b]) / 0.8, 0, 1);
    const ia = F.I[a] * weight * ga, ib = F.I[b] * weight * gb;
    if (ia + ib < 0.006) continue;
    const qa = a * 3, qb = b * 3;
    pushSeg(F.c[qa], F.c[qa + 1], F.c[qa + 2], F.w[a], F.c[qb], F.c[qb + 1], F.c[qb + 2], F.w[b],
      F.col[qa], F.col[qa + 1], F.col[qa + 2], ia, F.col[qb], F.col[qb + 1], F.col[qb + 2], ib);
  }
}
// A line field: a GPU program that computes each segment's ends from its instance id
function lineProgram(name, src) {
  const vs = `#version 300 es
${LIB}
layout(location=0) in vec2 aCorner;
${AUDIO_U}
${paramU(name)}
${CAPSULE}
${src}
void main(){
  vec3 A, B; float wA, wB; vec4 cA, cB;
  seg(gl_InstanceID, A, B, wA, wB, cA, cB);
  capsule(aCorner, rotP(A, uRot.x, uRot.y), rotP(B, uRot.x, uRot.y), wA, wB, cA, cB);
}`;
  return program(vs, F_FRAG);
}
