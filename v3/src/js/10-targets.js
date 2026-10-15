/* ================================================================== */
/* Render targets                                                      */
/* ================================================================== */
let W = 1, H = 1, scene, trails = [], mips = [], trailIdx = 0, rscale = 1;
let SCENE_HDR = HALF_RT;
function makeTarget(w, h, withDepth) {
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, SCENE_HDR ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, SCENE_HDR ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  let rb = null;
  if (withDepth) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fb, w, h, ok, rb };
}
function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); if (t.rb) gl.deleteRenderbuffer(t.rb); } }
function buildTargets() {
  freeTarget(scene); trails.forEach(freeTarget); mips.forEach(freeTarget);
  scene = makeTarget(W, H, true);
  if (!scene.ok && SCENE_HDR) { SCENE_HDR = false; freeTarget(scene); scene = makeTarget(W, H, true); }
  trails = [makeTarget(W, H), makeTarget(W, H)];
  mips = []; let w = W, h = H;
  for (let i = 0; i < 7; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); mips.push(makeTarget(w, h)); if (w < 12 || h < 12) break; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75) * Math.min(S.quality, rscale);
  const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
  if (w === W && h === H) return;
  W = w; H = h; canvas.width = W; canvas.height = H; buildTargets();
}
const camTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, camTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
