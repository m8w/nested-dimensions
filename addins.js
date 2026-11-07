/* Nested Dimensions add-ins (v0.5)
   ---------------------------------------------------------------------------------------------
   Complex time and four new pictures for any plane:

   - Time compass. Every equation's clock runs along t·e^(iθ). `time` is the real part of that
     complex time and `tim` the imaginary part, so θ = 0 runs forward, 180° runs every scene
     backward, and at 90° real time stops while imaginary time flows.
   - Julibrot (src 1). The 4D object z → z² + c with z₀ and c both complex. A slice angle turns
     the view from the Mandelbrot set (0°) to a Julia set (90°) through the 4D slices in between,
     and an automatic deep dive zooms toward the boundary. The dive uses perturbation with two
     reference orbits and rebasing (one orbit from the view centre, one from the critical point 0),
     computed at 384-bit precision, so it can go about 100 octaves (10^-30) deep in a float32 shader.
     Colouring is smooth (n + 1 − log2 log|z|). Imaginary time twists the slice through 4D.
   - Lorenz in complex time (src 2). Each pixel is a complex time t. The Lorenz system is solved
     from a point on its real attractor along the straight path from 0 to t; where the path runs
     into a singularity the solution blows up, so the picture shows the singularities and the cuts
     they cast, which cluster into the self-similar natural boundary that marks chaos.
   - Flow field (src 3). dz/dt = f(z) walked along the time compass: centres become sinks and
     sources as time rotates.
   - Oscilloscope (src 4, and 5-8 for w, x, y, z alone). Four complex variables, each drawn in its
     own complex plane: Hénon–Heiles in complex time, the complex Lorenz equations, or a ring of
     four coupled oscillators. Their values are also equation inputs (owr, owi … ozr, ozi).
   --------------------------------------------------------------------------------------------- */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const C_PRESETS = [
  ['Spiral', -0.8, 0.156], ['Rabbit', -0.123, 0.745], ['Dendrite', 0, 1], ['Siegel disk', -0.391, -0.587],
  ['Swirl', 0.285, 0.01], ['San Marco', -0.75, 0.0],
];
export const SYSTEMS = ['Hénon–Heiles', 'Complex Lorenz', 'Oscillator ring'];
export const FLOWS = ['iz', 'z² + 1', 'z³ − 1', 'sin z'];

/* ------------------------------------------------------------------ fixed-point complex numbers
   The dive centre is kept as 384-bit fixed-point BigInts, enough for ~100 octaves plus margin. */
const FBN = 384, FB = BigInt(FBN);
function toFix(x) {
  if (!x || !Number.isFinite(x)) return 0n;
  const e = Math.floor(Math.log2(Math.abs(x))) - 52;
  const m = Math.round(x / Math.pow(2, e));
  const sh = FBN + e;
  return sh >= 0 ? BigInt(m) << BigInt(sh) : BigInt(m) >> BigInt(-sh);
}
const TWO64 = Math.pow(2, 64);
function fromFix(a) { return Number(a >> (FB - 64n)) / TWO64; }

// Reference orbits. out[2n], out[2n+1] = Z_n. Returns how many entries are valid (the last one may
// already be past the bailout); index count-1 is the last one the perturbation may use.
const REF_BAIL = 1e4;
function orbitBig(zr, zi, cr, ci, max, out) {
  let n = 0;
  for (; n < max; n++) {
    const fr = fromFix(zr), fi = fromFix(zi);
    out[2 * n] = fr; out[2 * n + 1] = fi;
    if (fr * fr + fi * fi > REF_BAIL) return n + 1;
    const r2 = (zr * zr) >> FB, i2 = (zi * zi) >> FB, ri = (zr * zi) >> (FB - 1n);
    zr = r2 - i2 + cr; zi = ri + ci;
  }
  return n;
}
function orbitF64(zr, zi, cr, ci, max, out) {
  let n = 0;
  for (; n < max; n++) {
    out[2 * n] = zr; out[2 * n + 1] = zi;
    if (zr * zr + zi * zi > REF_BAIL) return n + 1;
    const t = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = t;
  }
  return n;
}

/* ------------------------------------------------------------------ shaders */
const PALETTE = `
vec3 palette(float t, vec3 d) { return 0.5 + 0.5 * cos(6.28318 * (t + d)); }`;

// Perturbation with two references and rebasing, for any slice of the 4D Julia-Mandelbrot object.
// Pixel offset d (complex) goes to dz0 = sin(phi) d and dc = cos(phi) d.
const JULIBROT_FS = `
uniform sampler2D tRef1;
uniform sampler2D tRef2;
uniform int uLast1;
uniform int uLast2;
uniform int uMaxIt;
uniform float uScale;
uniform vec2 uPan;
uniform vec2 uSC;
uniform float uAspect;
uniform float uTime;
uniform float uDepth;
uniform float uBright;
uniform int uDebug;
uniform float uNOff;
varying vec2 vUv;
${PALETTE}
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 ref1(int n) { return texelFetch(tRef1, ivec2(n & 1023, n >> 10), 0).xy; }
vec2 ref2(int n) { return texelFetch(tRef2, ivec2(n & 1023, n >> 10), 0).xy; }
void main() {
  vec2 p = (vUv - 0.5) * vec2(2.0 * uAspect, 2.0);
  vec2 d = (p + uPan) * uScale;
  vec2 dz = uSC.x * d;
  vec2 dc = uSC.y * d;
  int m = 0;
  int last = uLast1;
  bool second = false;
  vec2 Z = ref1(0);
  vec2 z = Z + dz;
  float r2 = dot(z, z);
  int n = 0;
  bool esc = false;
  for (int k = 0; k < 4096; k++) {
    if (k >= uMaxIt) break;
    if (r2 > 1e4) { esc = true; n = k; break; }
    dz = cmul(2.0 * Z + dz, dz) + dc;
    m++;
    Z = second ? ref2(m) : ref1(m);
    z = Z + dz;
    r2 = dot(z, z);
    if (r2 < dot(dz, dz) || m >= last) { dz = z; m = 0; second = true; last = uLast2; Z = vec2(0.0); }
  }
  if (uDebug == 1) {
    float nn = esc ? float(n) : 4095.0;
    gl_FragColor = vec4(mod(nn, 256.0) / 255.0, floor(nn / 256.0) / 255.0, esc ? 1.0 : 0.0, 1.0);
    return;
  }
  vec3 col;
  if (esc) {
    // colour from the lowest count in view, so a deep frame has the same range of colour as a shallow one
    float nu = float(n) + 1.0 - log2(max(0.5 * log2(r2), 1e-6)) - uNOff;
    float s = sqrt(max(nu, 0.0));
    col = palette(s * 0.16 + uTime * 0.015 + uDepth * 0.004, vec3(0.0, 0.15, 0.3));
    col *= 0.25 + 0.75 * smoothstep(0.0, 1.0, s * 0.18);
    col += vec3(0.9, 0.3, 0.1) * 0.25 * exp(-abs(fract(s * 0.5) - 0.5) * 9.0);
  } else {
    float a = atan(z.y, z.x);
    col = vec3(0.02, 0.012, 0.04) + 0.03 * palette(a / 6.28318 + uTime * 0.02, vec3(0.6, 0.4, 0.8));
  }
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

// The Lorenz system continued into complex time along straight paths from t = 0.
const LORENZ_FS = `
uniform vec3 uX0;
uniform vec2 uDir;
uniform float uSpan;
uniform float uAspect;
uniform int uSteps;
uniform float uTime;
uniform float uBright;
varying vec2 vUv;
${PALETTE}
vec2 cm(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void lor(vec2 x, vec2 y, vec2 z, out vec2 dx, out vec2 dy, out vec2 dz) {
  dx = 10.0 * (y - x);
  dy = cm(x, vec2(28.0, 0.0) - z) - y;
  dz = cm(x, y) - (8.0 / 3.0) * z;
}
void main() {
  float W = uSpan * uAspect;
  vec2 tl = vec2(vUv.x * W, (vUv.y - 0.5) * uSpan);
  vec2 t = cm(uDir, tl);
  vec2 h = t / float(uSteps);
  vec2 hh = 0.5 * h;
  vec2 x = vec2(uX0.x, 0.0), y = vec2(uX0.y, 0.0), z = vec2(uX0.z, 0.0);
  int esc = -1;
  for (int k = 0; k < 128; k++) {
    if (k >= uSteps) break;
    vec2 ax, ay, az, bx, by, bz, cx, cy, cz, ex, ey, ez;
    lor(x, y, z, ax, ay, az);
    lor(x + cm(hh, ax), y + cm(hh, ay), z + cm(hh, az), bx, by, bz);
    lor(x + cm(hh, bx), y + cm(hh, by), z + cm(hh, bz), cx, cy, cz);
    lor(x + cm(h, cx), y + cm(h, cy), z + cm(h, cz), ex, ey, ez);
    vec2 h6 = h / 6.0;
    x += cm(h6, ax + 2.0 * bx + 2.0 * cx + ex);
    y += cm(h6, ay + 2.0 * by + 2.0 * cy + ey);
    z += cm(h6, az + 2.0 * bz + 2.0 * cz + ez);
    if (dot(x, x) + dot(y, y) + dot(z, z) > 1e5) { esc = k; break; }
  }
  vec3 col;
  if (esc >= 0) {
    float f = float(esc) / float(uSteps);
    // past a singularity: gold, brightest where the path met it soonest
    col = mix(vec3(1.0, 0.74, 0.34), vec3(0.42, 0.2, 0.08), sqrt(f)) * (0.5 + 0.5 * (1.0 - f));
  } else {
    float hue = atan(x.y, x.x) / 6.28318;
    float r = length(x);
    float rings = fract(log2(r + 1e-6));
    col = palette(hue + uTime * 0.01, vec3(0.0, 0.33, 0.67));
    col *= (0.25 + 0.75 * (1.0 - exp(-r / 14.0))) * (0.62 + 0.38 * rings);
  }
  // the real time line, where the ordinary Lorenz trajectory lives
  float px = uSpan / 240.0;
  col = mix(col, vec3(1.0, 0.7, 0.28), (1.0 - smoothstep(px, 2.0 * px, abs(tl.y))) * 0.65);
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

/* ------------------------------------------------------------------ install */
export function install(ctx) {
  const { THREE, renderer, coarse, $, toast, NS } = ctx;
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
  const num = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

  /* ---------------------------------------------------------------- settings */
  const PREF_KEY = 'nd.dims.v1' + NS;
  const DEF = { theta: 0, src: [0, 0, 0, 0], phi: 90, dive: 0.25, twist: 0.6, c: 'Spiral', span: 1.1, fsel: 1, osys: 0, orate: 1 };
  let ui = { ...DEF };
  try { ui = { ...DEF, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}) }; } catch (e) { ui = { ...DEF }; }
  if (!Array.isArray(ui.src) || ui.src.length !== 4) ui.src = [0, 0, 0, 0];
  const save = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(ui)); } catch (e) { /* storage off */ } };
  const cPreset = (name) => C_PRESETS.find((p) => p[0] === name) || C_PRESETS[0];

  // what the camera block last asked for (its outputs default to the sheet's settings)
  const live = { theta: ui.theta * DEG, jphi: ui.phi * DEG, jcr: cPreset(ui.c)[1], jci: cPreset(ui.c)[2], jdive: ui.dive, jtwist: ui.twist, jmax: 100, lspan: ui.span, lflow: 0.15, fsel: ui.fsel, osys: ui.osys, orate: ui.orate };
  let tim = 0, timeNow = 0;

  /* ---------------------------------------------------------------- render plumbing */
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(ctx.FULL_GEO, new THREE.MeshBasicMaterial());
  quad.frustumCulled = false;
  quadScene.add(quad);
  const makeRT = (w, h) => new THREE.WebGLRenderTarget(w, h, {
    depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const shader = (fs, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: ctx.FULL_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  function pass(mat, rt) { quad.material = mat; renderer.setRenderTarget(rt); renderer.render(quadScene, ctx.blitCam); }

  /* ---------------------------------------------------------------- 1 · Julibrot deep dive */
  const JW = coarse ? 384 : 640, JH = Math.round(JW * 9 / 16);
  const REF_MAX = 4096;
  const MAXIT_CAP = coarse ? 1000 : 2600;
  const refTex = () => {
    const t = new THREE.DataTexture(new Float32Array(1024 * 4 * 2), 1024, 4, THREE.RGFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  };
  const jb = {
    rt: makeRT(JW, JH),
    mat: shader(JULIBROT_FS, {
      tRef1: { value: refTex() }, tRef2: { value: refTex() }, uLast1: { value: 0 }, uLast2: { value: 0 }, uMaxIt: { value: 200 },
      uScale: { value: 1.6 }, uPan: { value: new THREE.Vector2() }, uSC: { value: new THREE.Vector2(1, 0) },
      uAspect: { value: JW / JH }, uTime: { value: 0 }, uDepth: { value: 0 }, uBright: { value: 1 }, uDebug: { value: 0 }, uNOff: { value: 0 },
    }),
    // the 4D centre P = (z0, c) in fixed point, the pan offset from it (in the slice plane), depth in octaves
    P: { zr: 0n, zi: 0n, cr: toFix(live.jcr), ci: toFix(live.jci) },
    Pc: [live.jcr, live.jci],
    off: [0, 0], target: null, depth: 0, mode: 'dive', lastPick: -9, phi: live.jphi,
    ref1: new Float64Array(REF_MAX * 2), ref2: new Float64Array(REF_MAX * 2), len1: 1, len2: 1, maxIt: 200,
    nMin: 0, nOff: 0, refDirty: true, ref2Dirty: true, lastC: [live.jcr, live.jci], pendingC: null, sinceFold: 0, rendered: false,
  };
  const jbScale = () => 1.6 * Math.pow(2, -jb.depth);
  function jbMaxIt() { return Math.round(clamp(200 + jb.depth * 24, 200, MAXIT_CAP)); }
  function jbRefs() {
    const deep = jb.depth > 30;   // past ~10^-9, doubles are no longer enough for the reference orbits
    const it = jb.maxIt;
    if (jb.ref2Dirty) {
      jb.len2 = deep ? orbitBig(0n, 0n, jb.P.cr, jb.P.ci, it + 1, jb.ref2) : orbitF64(0, 0, fromFix(jb.P.cr), fromFix(jb.P.ci), it + 1, jb.ref2);
      upload(jb.mat.uniforms.tRef2.value, jb.ref2, jb.len2);
      jb.ref2Dirty = false;
    }
    if (jb.refDirty) {
      jb.len1 = deep ? orbitBig(jb.P.zr, jb.P.zi, jb.P.cr, jb.P.ci, it + 1, jb.ref1)
        : orbitF64(fromFix(jb.P.zr), fromFix(jb.P.zi), fromFix(jb.P.cr), fromFix(jb.P.ci), it + 1, jb.ref1);
      upload(jb.mat.uniforms.tRef1.value, jb.ref1, jb.len1);
      jb.refDirty = false;
    }
    jb.refIt = it;
  }
  function upload(tex, src, len) {
    const d = tex.image.data;
    d.fill(0);
    for (let k = 0; k < len * 2; k++) d[k] = src[k];
    tex.needsUpdate = true;
  }
  // the same iteration as the shader, in doubles, for choosing where to dive
  function jbIterate(dzr, dzi, dcr, dci, maxIt) {
    const R1 = jb.ref1, R2 = jb.ref2;
    let R = R1, last = jb.len1 - 1, m = 0;
    let Zr = R[0], Zi = R[1], zr = Zr + dzr, zi = Zi + dzi, r2 = zr * zr + zi * zi;
    for (let k = 0; k < maxIt; k++) {
      if (r2 > 1e4) return k;
      const ar = 2 * Zr + dzr, ai = 2 * Zi + dzi;
      const nr = ar * dzr - ai * dzi + dcr, ni = ar * dzi + ai * dzr + dci;
      dzr = nr; dzi = ni;
      m++;
      Zr = R[2 * m]; Zi = R[2 * m + 1];
      zr = Zr + dzr; zi = Zi + dzi;
      r2 = zr * zr + zi * zi;
      if (r2 < dzr * dzr + dzi * dzi || m >= last) { dzr = zr; dzi = zi; m = 0; R = R2; last = jb.len2 - 1; Zr = 0; Zi = 0; }
    }
    return -1;
  }
  function jbPick() {
    const h = jbScale(), sp = Math.sin(jb.phi), cp = Math.cos(jb.phi), A = JW / JH;
    const GX = 26, GY = 15;
    let best = null, anyEsc = false, nMin = Infinity;
    for (let gy = 0; gy < GY; gy++) {
      for (let gx = 0; gx < GX; gx++) {
        const px = ((gx + 0.5) / GX * 2 - 1) * 0.6 * A, py = ((gy + 0.5) / GY * 2 - 1) * 0.6;
        const dr = px * h + jb.off[0], di = py * h + jb.off[1];
        const n = jbIterate(sp * dr, sp * di, cp * dr, cp * di, jb.maxIt);
        if (n < 0) continue;
        anyEsc = true;
        if (n < nMin) nMin = n;
        const score = n - 6 * (px * px + py * py);
        if (!best || score > best.score) best = { score, n, dr, di };
      }
    }
    if (!anyEsc) { jb.mode = 'rise'; jb.target = null; return; }
    jb.target = [best.dr, best.di];
    jb.nMin = Math.max(0, nMin - 4);
  }
  function jbFold() {
    // move the fixed-point centre to the current view centre, then start the offset again from zero
    const sp = Math.sin(jb.phi), cp = Math.cos(jb.phi);
    const [or, oi] = jb.off;
    if (!or && !oi) return;
    jb.P.zr += toFix(sp * or); jb.P.zi += toFix(sp * oi);
    if (cp * or || cp * oi) { jb.P.cr += toFix(cp * or); jb.P.ci += toFix(cp * oi); jb.ref2Dirty = true; }
    if (jb.target) jb.target = [jb.target[0] - or, jb.target[1] - oi];
    jb.off = [0, 0];
    jb.refDirty = true;
  }
  function newDive(keepC) {
    const c = keepC ? jb.Pc : [live.jcr, live.jci];
    jb.P = { zr: 0n, zi: 0n, cr: toFix(c[0]), ci: toFix(c[1]) };
    jb.Pc = [c[0], c[1]]; jb.lastC = [c[0], c[1]]; jb.pendingC = null;
    jb.off = [0, 0]; jb.target = null; jb.depth = 0; jb.mode = 'dive'; jb.lastPick = -9; jb.nMin = 0;
    jb.refDirty = jb.ref2Dirty = true;
  }
  function jbStep(dt, dir) {
    // c follows the camera block while shallow; deeper, a new c waits for the next dive
    const cr = live.jcr, ci = live.jci;
    if (Math.abs(cr - jb.lastC[0]) + Math.abs(ci - jb.lastC[1]) > 1e-12) {
      jb.lastC = [cr, ci];
      if (jb.depth < 6) {
        jb.P.cr = toFix(cr); jb.P.ci = toFix(ci); jb.Pc = [cr, ci];
        jb.refDirty = jb.ref2Dirty = true;
      } else jb.pendingC = [cr, ci];
    }
    jb.phi = live.jphi + live.jtwist * tim;
    if (!jb.visible) return;   // off screen, the dive waits where it is
    const maxD = clamp(live.jmax, 0, 104);
    if (jb.mode === 'rise') {
      jb.depth = Math.max(0, jb.depth - dt * 8);
      if (jb.depth <= 0) { if (jb.pendingC) { live.jcr = jb.pendingC[0]; live.jci = jb.pendingC[1]; } newDive(!jb.pendingC); }
    } else {
      jb.depth = clamp(jb.depth + live.jdive * dt * dir, 0, maxD);
      if (jb.depth >= maxD && live.jdive > 0 && dir > 0) jb.mode = 'rise';
    }
    const it = jbMaxIt();
    // when a reference runs out the iteration rebases onto the other one, so they only need refreshing now and then
    if (Math.abs(it - jb.maxIt) > 40) { jb.maxIt = it; jb.refDirty = jb.ref2Dirty = true; }
    if (jb.refDirty || jb.ref2Dirty) jbRefs();
    // choose a new point on the boundary every octave and a half, and drift toward it
    if (jb.mode === 'dive' && live.jdive > 0 && (jb.depth - jb.lastPick > 1.5 || jb.depth < jb.lastPick - 3)) { jb.lastPick = jb.depth; jbPick(); }
    if (jb.target) {
      const k = Math.min(1, dt * 1.2);
      jb.off[0] += (jb.target[0] - jb.off[0]) * k;
      jb.off[1] += (jb.target[1] - jb.off[1]) * k;
    }
    jb.nOff += (Math.min(jb.nMin, jb.depth * 30) - jb.nOff) * Math.min(1, Math.abs(dt) * 0.6);
    const h = jbScale();
    jb.sinceFold += dt;
    if ((Math.abs(jb.off[0]) + Math.abs(jb.off[1]) > 0.35 * h && jb.sinceFold > 0.25) || (jb.depth > 40 && jb.sinceFold > 4)) {
      jbFold(); jbRefs(); jb.sinceFold = 0;
    }
  }
  function jbRender(time, bright) {
    const u = jb.mat.uniforms, h = jbScale();
    u.uLast1.value = jb.len1 - 1; u.uLast2.value = jb.len2 - 1; u.uMaxIt.value = jb.maxIt;
    u.uScale.value = h; u.uPan.value.set(jb.off[0] / h, jb.off[1] / h);
    u.uSC.value.set(Math.sin(jb.phi), Math.cos(jb.phi));
    u.uTime.value = time; u.uDepth.value = jb.depth; u.uBright.value = bright; u.uNOff.value = jb.nOff;
    pass(jb.mat, jb.rt);
  }

  /* ---------------------------------------------------------------- 2 · Lorenz in complex time */
  const LW = coarse ? 320 : 512, LH = Math.round(LW * 9 / 16);
  const lz = {
    rt: makeRT(LW, LH),
    mat: shader(LORENZ_FS, {
      uX0: { value: new THREE.Vector3(1, 1, 20) }, uDir: { value: new THREE.Vector2(1, 0) }, uSpan: { value: 1 },
      uAspect: { value: LW / LH }, uSteps: { value: coarse ? 28 : 56 }, uTime: { value: 0 }, uBright: { value: 1 },
    }),
    s: [1, 1, 20],
  };
  const lorenzF = (s) => [10 * (s[1] - s[0]), s[0] * (28 - s[2]) - s[1], s[0] * s[1] - (8 / 3) * s[2]];
  function lzStep(dt) {
    let h = dt * live.lflow;
    const n = Math.max(1, Math.ceil(Math.abs(h) / 0.004));
    h /= n;
    for (let k = 0; k < n; k++) {
      const s = lz.s, a = lorenzF(s), b = lorenzF(s.map((v, j) => v + h / 2 * a[j])), c = lorenzF(s.map((v, j) => v + h / 2 * b[j])),
        d = lorenzF(s.map((v, j) => v + h * c[j]));
      lz.s = s.map((v, j) => v + h / 6 * (a[j] + 2 * b[j] + 2 * c[j] + d[j]));
    }
    if (!lz.s.every(Number.isFinite) || Math.abs(lz.s[2]) > 200) lz.s = [1, 1, 20];
  }
  for (let k = 0; k < 400; k++) lzStep(1 / 0.15 * 0.004 * 4);   // settle onto the attractor
  function lzRender(time, bright) {
    const u = lz.mat.uniforms;
    u.uX0.value.set(lz.s[0], lz.s[1], lz.s[2]);
    u.uDir.value.set(Math.cos(live.theta), Math.sin(live.theta));
    u.uSpan.value = clamp(live.lspan, 0.1, 6);
    u.uTime.value = time; u.uBright.value = bright;
    pass(lz.mat, lz.rt);
  }

  /* ---------------------------------------------------------------- 3 · flow field */
  const FW = coarse ? 448 : 640, FH = Math.round(FW * 9 / 16);
  const fl = { canvas: document.createElement('canvas'), parts: [], sel: -1 };
  fl.canvas.width = FW; fl.canvas.height = FH;
  fl.g = fl.canvas.getContext('2d');
  fl.tex = new THREE.CanvasTexture(fl.canvas);
  fl.tex.minFilter = THREE.LinearFilter; fl.tex.generateMipmaps = false;
  const FS = FH / 5, FX = FW / 2 / FS, FY = FH / 2 / FS;
  const FF = [
    (x, y) => [-y, x],
    (x, y) => [x * x - y * y + 1, 2 * x * y],
    (x, y) => [x * x * x - 3 * x * y * y - 1, 3 * x * x * y - y * y * y],
    (x, y) => [Math.sin(x) * Math.cosh(y), Math.cos(x) * Math.sinh(y)],
  ];
  const FD = [
    () => [0, 1], (x, y) => [2 * x, 2 * y], (x, y) => [3 * (x * x - y * y), 6 * x * y], (x, y) => [Math.cos(x) * Math.cosh(y), -Math.sin(x) * Math.sinh(y)],
  ];
  const FE = [[[0, 0]], [[0, 1], [0, -1]], [[1, 0], [-0.5, 0.8660254], [-0.5, -0.8660254]], [[-Math.PI, 0], [0, 0], [Math.PI, 0]]];
  const FCOL = ['#b9a6ff', '#ffb347', '#7fe3c4', '#ff8fb1'];
  const spawn = (p) => { p.x = (Math.random() * 2 - 1) * FX; p.y = (Math.random() * 2 - 1) * FY; p.age = 0; p.life = 60 + Math.random() * 160; p.px = p.x; p.py = p.y; };
  for (let k = 0; k < (coarse ? 420 : 700); k++) { const p = {}; spawn(p); p.age = Math.random() * p.life; fl.parts.push(p); }
  function flowKind(fi, e) {
    const d = FD[fi](e[0], e[1]), c = Math.cos(live.theta), s = Math.sin(live.theta);
    const re = c * d[0] - s * d[1], im = s * d[0] + c * d[1], m = Math.hypot(re, im);
    if (m < 1e-9) return 0;
    if (Math.abs(re) < 0.04 * m) return 0;    // centre
    return re < 0 ? -1 : 1;                     // sink, source
  }
  function flRender(dt) {
    const g = fl.g, fi = clamp(Math.round(num(live.fsel, 1)), 0, 3);
    if (fi !== fl.sel) { fl.sel = fi; g.fillStyle = '#000'; g.fillRect(0, 0, FW, FH); fl.parts.forEach(spawn); }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(0,0,0,${clamp(1 - Math.exp(-dt * 8), 0.02, 0.6).toFixed(4)})`;
    g.fillRect(0, 0, FW, FH);
    const c = Math.cos(live.theta), s = Math.sin(live.theta), f = FF[fi], k60 = clamp(dt * 60, 0, 3);
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = FCOL[fi]; g.globalAlpha = 0.55; g.lineWidth = coarse ? 1 : 1.3;
    g.beginPath();
    const X = (x) => FW / 2 + x * FS, Y = (y) => FH / 2 - y * FS;
    for (const p of fl.parts) {
      const v = f(p.x, p.y), wx = c * v[0] - s * v[1], wy = s * v[0] + c * v[1], m = Math.hypot(wx, wy);
      const step = 0.03 * k60 / Math.sqrt(1 + 0.2 * m * m);
      p.px = p.x; p.py = p.y;
      p.x += wx * step; p.y += wy * step; p.age += k60;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > FX + 0.3 || Math.abs(p.y) > FY + 0.3 || p.age > p.life) { spawn(p); continue; }
      g.moveTo(X(p.px), Y(p.py)); g.lineTo(X(p.x), Y(p.y));
    }
    g.stroke();
    g.globalAlpha = 1;
    for (const e of FE[fi]) {
      const kd = flowKind(fi, e);
      g.fillStyle = kd === 0 ? '#ffd27a' : kd < 0 ? '#7fe3c4' : '#ff8a6a';
      g.beginPath(); g.arc(X(e[0]), Y(e[1]), coarse ? 3 : 4.5, 0, TAU); g.fill();
    }
    fl.tex.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- 4 · oscilloscope: w, x, y, z */
  const SZ = coarse ? 320 : 512;
  const sc = { canvases: [], gs: [], texs: [], trail: [[], [], [], []], st: new Float64Array(8), sys: -1, blow: 0, resets: 0, out: new Float64Array(8) };
  for (let k = 0; k < 4; k++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
    const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, SZ, SZ);
    const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    sc.canvases.push(cv); sc.gs.push(g); sc.texs.push(tex);
  }
  const grid = document.createElement('canvas'); grid.width = grid.height = SZ * 2;
  const gridG = grid.getContext('2d');
  const gridTex = new THREE.CanvasTexture(grid); gridTex.minFilter = THREE.LinearFilter; gridTex.generateMipmaps = false;
  const SCOL = ['#ffb347', '#7fe3c4', '#b9a6ff', '#ff8fb1'];
  const NAMES = ['w', 'x', 'y', 'z'];
  const RING_W = [1.0, 1.27, 1.61, 2.13];
  // per-system: a step size, a blow-up limit, and how hard to squeeze each value into its panel
  const SYS = [
    { h: 0.02, rate: 1.6, lim: 40, s: [0.3, 0.3, 0.3, 0.3] },
    { h: 0.004, rate: 0.35, lim: 400, s: [14, 14, 14, 160] },
    { h: 0.01, rate: 1.0, lim: 6, s: [0.6, 0.6, 0.6, 0.6] },
  ];
  function scStart(sys) {
    const st = sc.st, rnd = (a) => (Math.random() * 2 - 1) * a;
    if (sys === 0) {
      // Hénon–Heiles: a real start on an energy shell below the escape energy, nudged into the complex
      let q1, q2, p2, rest;
      do { q1 = rnd(0.4); q2 = rnd(0.5) + 0.05; p2 = rnd(0.45); rest = 0.12 - (0.5 * (q1 * q1 + q2 * q2) + q1 * q1 * q2 - q2 * q2 * q2 / 3) - 0.5 * p2 * p2; } while (rest <= 0);
      const p1 = Math.sqrt(2 * rest) * (Math.random() < 0.5 ? -1 : 1);
      st.set([q1, rnd(0.07), q2, rnd(0.07), p1, rnd(0.07), p2, rnd(0.07)]);
    } else if (sys === 1) st.set([1 + rnd(2), rnd(2), 1 + rnd(2), rnd(2), 20 + rnd(5), 0, 0, 0]);
    else st.set([0.5, rnd(0.2), rnd(0.2), 0.3, -0.4, rnd(0.2), 0.2, 0.1]);
    for (const t of sc.trail) t.length = 0;
  }
  function scF(sys, s, out, er, ei) {
    // the right-hand side, turned by e^(i theta) = er + i ei
    let d0r, d0i, d1r, d1i, d2r, d2i, d3r, d3i;
    if (sys === 0) {
      const [q1r, q1i, q2r, q2i, p1r, p1i, p2r, p2i] = s;
      d0r = p1r; d0i = p1i; d1r = p2r; d1i = p2i;
      // p1' = -q1 - 2 q1 q2 ; p2' = -q2 - q1^2 + q2^2
      d2r = -q1r - 2 * (q1r * q2r - q1i * q2i); d2i = -q1i - 2 * (q1r * q2i + q1i * q2r);
      d3r = -q2r - (q1r * q1r - q1i * q1i) + (q2r * q2r - q2i * q2i); d3i = -q2i - 2 * q1r * q1i + 2 * q2r * q2i;
    } else if (sys === 1) {
      // complex Lorenz (Fowler, Gibbon, McGuinness): x, y complex, z real; r = 28 + 0.4i, a = 1 - 0.2i
      const [xr, xi, yr, yi, z] = s;
      d0r = 10 * (yr - xr); d0i = 10 * (yi - xi);
      const rr = 28 - z, ri = 0.4;
      d1r = rr * xr - ri * xi - (yr + 0.2 * yi); d1i = rr * xi + ri * xr - (yi - 0.2 * yr);
      const dz = -(8 / 3) * z + (xr * yr + xi * yi);
      out[0] = er * d0r - ei * d0i; out[1] = er * d0i + ei * d0r;
      out[2] = er * d1r - ei * d1i; out[3] = er * d1i + ei * d1r;
      out[4] = er * dz; out[5] = 0; out[6] = 0; out[7] = 0;   // z is real, so it only runs forward or backward
      return;
    } else {
      // a ring of four Stuart–Landau oscillators (coupled lasers): w' = (1 + i w_k) w - (1 + 1.8i)|w|^2 w + 0.42 (neighbours - 2w)
      const r = new Array(8);
      for (let k = 0; k < 4; k++) {
        const ar = s[2 * k], ai = s[2 * k + 1], m2 = ar * ar + ai * ai;
        const lr = s[(2 * k + 2) % 8] + s[(2 * k + 6) % 8] - 2 * ar, li = s[(2 * k + 3) % 8] + s[(2 * k + 7) % 8] - 2 * ai;
        r[2 * k] = ar - RING_W[k] * ai - m2 * (ar - 1.8 * ai) + 0.42 * lr;
        r[2 * k + 1] = ai + RING_W[k] * ar - m2 * (ai + 1.8 * ar) + 0.42 * li;
      }
      [d0r, d0i, d1r, d1i, d2r, d2i, d3r, d3i] = r;
    }
    out[0] = er * d0r - ei * d0i; out[1] = er * d0i + ei * d0r;
    out[2] = er * d1r - ei * d1i; out[3] = er * d1i + ei * d1r;
    out[4] = er * d2r - ei * d2i; out[5] = er * d2i + ei * d2r;
    out[6] = er * d3r - ei * d3i; out[7] = er * d3i + ei * d3r;
  }
  const K = [new Float64Array(8), new Float64Array(8), new Float64Array(8), new Float64Array(8)], TMP = new Float64Array(8);
  function scPanels(sys, s, out) {
    // what each of the four panels shows
    if (sys === 1) {
      const [xr, xi, yr, yi, z] = s;
      out.set([xr, xi, yr, yi, z - 23.5, (xr * yi - xi * yr) / 4, xr * yr + xi * yi, xr * yi - xi * yr]);
    } else out.set(s);
    const sq = SYS[sys].s;
    for (let k = 0; k < 4; k++) {
      const a = out[2 * k], b = out[2 * k + 1], m = Math.hypot(a, b), f = 1 / (sq[k] + m);
      out[2 * k] = a * f; out[2 * k + 1] = b * f;
    }
  }
  function scStep(dt) {
    const sys = clamp(Math.round(num(live.osys, 0)), 0, 2);
    if (sys !== sc.sys) { sc.sys = sys; scStart(sys); }
    const P = SYS[sys], er = Math.cos(live.theta), ei = Math.sin(live.theta);
    let T = dt * P.rate * clamp(num(live.orate, 1), -4, 4);
    const n = Math.min(64, Math.max(1, Math.ceil(Math.abs(T) / P.h)));
    const h = T / n, st = sc.st;
    for (let j = 0; j < n; j++) {
      scF(sys, st, K[0], er, ei);
      for (let k = 0; k < 8; k++) TMP[k] = st[k] + h / 2 * K[0][k];
      scF(sys, TMP, K[1], er, ei);
      for (let k = 0; k < 8; k++) TMP[k] = st[k] + h / 2 * K[1][k];
      scF(sys, TMP, K[2], er, ei);
      for (let k = 0; k < 8; k++) TMP[k] = st[k] + h * K[2][k];
      scF(sys, TMP, K[3], er, ei);
      let big = 0;
      for (let k = 0; k < 8; k++) { st[k] += h / 6 * (K[0][k] + 2 * K[1][k] + 2 * K[2][k] + K[3][k]); big = Math.max(big, Math.abs(st[k])); }
      if (!(big < P.lim)) { scStart(sys); sc.blow = 1; sc.resets++; }
      scPanels(sys, st, sc.out);
      for (let k = 0; k < 4; k++) { const t = sc.trail[k]; t.push(sc.out[2 * k], sc.out[2 * k + 1]); if (t.length > 1600) t.splice(0, t.length - 1600); }
    }
    sc.blow *= Math.exp(-dt * 2.5);
  }
  function scRender(which, dt) {
    const fade = clamp(1 - Math.exp(-Math.abs(dt) * 1.3), 0.008, 0.2);   // trails last about a second, at any frame rate
    for (let k = 0; k < 4; k++) {
      if (!which[k]) continue;
      const g = sc.gs[k], t = sc.trail[k], R = SZ * 0.46, X = (v) => SZ / 2 + v * R, Y = (v) => SZ / 2 - v * R;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(0,0,0,${fade.toFixed(4)})`; g.fillRect(0, 0, SZ, SZ);
      g.strokeStyle = 'rgba(226,212,255,0.08)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, SZ / 2); g.lineTo(SZ, SZ / 2); g.moveTo(SZ / 2, 0); g.lineTo(SZ / 2, SZ); g.stroke();
      g.beginPath(); g.arc(SZ / 2, SZ / 2, R, 0, TAU); g.stroke();
      if (t.length >= 4) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = SCOL[k]; g.lineWidth = coarse ? 1.4 : 2; g.globalAlpha = 0.8;
        g.beginPath(); g.moveTo(X(t[0]), Y(t[1]));
        for (let j = 2; j < t.length; j += 2) g.lineTo(X(t[j]), Y(t[j + 1]));
        g.stroke(); g.globalAlpha = 1;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(X(t[t.length - 2]), Y(t[t.length - 1]), coarse ? 2 : 3, 0, TAU); g.fill();
        t.splice(0, t.length - 2);
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = SCOL[k]; g.font = `${Math.round(SZ / 16)}px ui-monospace, Menlo, monospace`; g.fillText(NAMES[k], SZ * 0.04, SZ * 0.09);
      sc.texs[k].needsUpdate = true;
    }
    if (which[4]) {
      for (let k = 0; k < 4; k++) gridG.drawImage(sc.canvases[k], (k % 2) * SZ, Math.floor(k / 2) * SZ);
      gridTex.needsUpdate = true;
    }
  }

  /* ---------------------------------------------------------------- sources */
  const SOURCES = [
    { id: 1, name: '4D fractal dive', tex: () => jb.rt.texture, aspect: JW / JH },
    { id: 2, name: 'Lorenz in complex time', tex: () => lz.rt.texture, aspect: LW / LH },
    { id: 3, name: 'Flow field', tex: () => fl.tex, aspect: FW / FH },
    { id: 4, name: 'Oscilloscope w x y z', tex: () => gridTex, aspect: 1 },
    { id: 5, name: 'Oscilloscope w', tex: () => sc.texs[0], aspect: 1 },
    { id: 6, name: 'Oscilloscope x', tex: () => sc.texs[1], aspect: 1 },
    { id: 7, name: 'Oscilloscope y', tex: () => sc.texs[2], aspect: 1 },
    { id: 8, name: 'Oscilloscope z', tex: () => sc.texs[3], aspect: 1 },
  ];
  const allSources = () => [{ id: 0, name: 'Its own picture' }, ...SOURCES, ...(ctx.BUILTIN || [])];
  function source(id) {
    const s = SOURCES.find((x) => x.id === id);
    return s ? { tex: s.tex(), aspect: s.aspect } : null;
  }

  /* ---------------------------------------------------------------- per-frame API */
  let lastDt = 0;
  function step(simDt, clock) {
    // simDt: seconds of complex time this frame (speed included); clock: { re, im }
    lastDt = simDt;
    tim = clock.im; timeNow = clock.re;
    jbStep(simDt, Math.cos(live.theta));   // forward time dives in, backward time zooms out
    lzStep(simDt);
    scStep(simDt);
  }
  function fillInputs(inp) {
    inp.tim = tim;
    inp.jdepth = jb.depth;
    inp.oblow = sc.blow;
    const o = sc.out;
    inp.owr = o[0]; inp.owi = o[1]; inp.oxr = o[2]; inp.oxi = o[3]; inp.oyr = o[4]; inp.oyi = o[5]; inp.ozr = o[6]; inp.ozi = o[7];
  }
  function camDefaults() {
    const c = cPreset(ui.c);
    return {
      theta: ui.theta * DEG, jphi: ui.phi * DEG, jcr: c[1], jci: c[2], jdive: ui.dive, jtwist: ui.twist, jmax: 100,
      lspan: ui.span, lflow: 0.15, fsel: ui.fsel, osys: ui.osys, orate: ui.orate,
    };
  }
  function fromCamera(cv) {
    const d = camDefaults();
    for (const k in d) live[k] = num(cv[k], d[k]);
  }
  const planeSrc = (i) => ui.src[i] || 0;
  function render(used, time) {
    const bright = 1;
    jb.visible = used.has(1);
    if (jb.visible) { if (jb.refDirty || jb.ref2Dirty) jbRefs(); jbRender(time, bright); }
    if (used.has(2)) lzRender(time, bright);
    if (used.has(3)) flRender(Math.abs(lastDt) || 1 / 60);
    const which = [used.has(5), used.has(6), used.has(7), used.has(8), used.has(4)];
    if (used.has(4)) for (let k = 0; k < 4; k++) which[k] = true;
    if (which.some(Boolean)) scRender(which, Math.abs(lastDt) || 1 / 60);
    else for (const t of sc.trail) if (t.length > 2) t.splice(0, t.length - 2);
    renderer.setRenderTarget(null);
    if (sheetOpen()) refreshClock();
  }

  /* ---------------------------------------------------------------- the Dimensions sheet */
  const sheet = $('dimSheet');
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const sheetOpen = () => sheet && !sheet.hidden;
  const refs = {};
  function seg(id, options, onPick, label) {
    const box = el('div', { className: 'seg', id });
    box.setAttribute('role', 'radiogroup');
    if (label) box.setAttribute('aria-label', label);
    options.forEach(([value, text]) => {
      const b = el('button', { type: 'button', textContent: text });
      b.setAttribute('role', 'radio'); b.dataset.value = String(value);
      b.addEventListener('click', () => onPick(value));
      box.append(b);
    });
    return box;
  }
  const mark = (box, value) => { for (const b of box.children) b.setAttribute('aria-checked', String(b.dataset.value === String(value))); };
  function row(id, label, min, max, step, value, fmt, onInput) {
    const input = el('input', { type: 'range', id, min, max, step, value: String(value) });
    const out = el('output', { textContent: fmt(value) });
    out.setAttribute('for', id);
    input.addEventListener('input', () => { const v = parseFloat(input.value) || 0; out.textContent = fmt(v); onInput(v); });
    const wrap = el('label', { className: 'row', htmlFor: id }, el('span', { textContent: label }), input, out);
    return { wrap, input, out, fmt };
  }
  const hint = (text) => el('p', { className: 'hint', textContent: text });
  const sec = (title, ...kids) => el('div', { className: 'sec' }, el('h3', { textContent: title }), ...kids);
  const setRow = (r, v) => { if (document.activeElement !== r.input) { r.input.value = String(v); r.out.textContent = r.fmt(v); } };

  function set(k, v) {
    if (k === 'theta') ui.theta = clamp(+v || 0, -180, 180);
    else if (k === 'phi') ui.phi = clamp(+v || 0, 0, 90);
    else if (k === 'dive') ui.dive = clamp(+v || 0, 0, 2);
    else if (k === 'twist') ui.twist = clamp(+v || 0, 0, 2);
    else if (k === 'span') ui.span = clamp(+v || 1, 0.2, 4);
    else if (k === 'c') { if (C_PRESETS.some((p) => p[0] === v)) { ui.c = v; const c = cPreset(v); live.jcr = c[1]; live.jci = c[2]; newDive(false); } }
    else if (k === 'newDive') newDive(false);
    else if (k === 'fsel') ui.fsel = clamp(Math.round(+v) || 0, 0, 3);
    else if (k === 'osys') ui.osys = clamp(Math.round(+v) || 0, 0, 2);
    else if (k === 'orate') ui.orate = clamp(+v || 0, 0, 3);
    else if (k === 'kick') { scStart(sc.sys < 0 ? 0 : sc.sys); sc.blow = 1; }
    else if (k === 'src' && Array.isArray(v)) { const i = clamp(v[0] | 0, 0, 3); ui.src[i] = allSources().some((s) => s.id === +v[1]) ? +v[1] : 0; }
    else return false;
    save();
    syncUI();
    return true;
  }

  if (sheet) {
    refs.theta = row('dmTheta', 'angle θ', -180, 180, 1, ui.theta, (v) => `${Math.round(v)}°`, (v) => set('theta', v));
    refs.thetaSeg = seg('dmThetaSeg', [[0, 'Forward 0°'], [90, 'Imaginary 90°'], [180, 'Backward 180°'], [-90, '−90°']], (v) => set('theta', v), 'Time direction');
    refs.clock = el('div', { className: 'status', id: 'dmClock' });
    refs.clock.setAttribute('role', 'status');

    refs.srcSel = ctx.PLANES.map((p, i) => {
      const s = el('select', { id: 'dmSrc' + i });
      s.setAttribute('aria-label', `${p.label} plane source`);
      s.addEventListener('change', () => set('src', [i, +s.value]));
      return { p, s };
    });

    refs.phi = row('dmPhi', 'slice', 0, 90, 0.5, ui.phi, (v) => `${(Math.round(v * 2) / 2)}°`, (v) => set('phi', v));
    refs.dive = row('dmDive', 'dive', 0, 2, 0.05, ui.dive, (v) => (v ? `${v.toFixed(2)}` : 'hold'), (v) => set('dive', v));
    refs.twist = row('dmTwist', 'twist', 0, 2, 0.05, ui.twist, (v) => v.toFixed(2), (v) => set('twist', v));
    refs.cSeg = seg('dmC', C_PRESETS.map((p) => [p[0], p[0]]), (v) => set('c', v), 'Julia parameter c');
    refs.jbStatus = el('div', { className: 'status', id: 'dmJb' });
    const newDiveBtn = el('button', { className: 'key', type: 'button', textContent: 'New dive' });
    newDiveBtn.addEventListener('click', () => set('newDive'));

    refs.span = row('dmSpan', 'window', 0.2, 4, 0.05, ui.span, (v) => v.toFixed(2), (v) => set('span', v));
    refs.fSeg = seg('dmFlow', FLOWS.map((f, i) => [i, `dz/dt = ${f}`]), (v) => set('fsel', v), 'Flow field equation');
    refs.oSeg = seg('dmOsys', SYSTEMS.map((s, i) => [i, s]), (v) => set('osys', v), 'Oscilloscope system');
    refs.orate = row('dmOrate', 'rate', 0, 3, 0.05, ui.orate, (v) => v.toFixed(2), (v) => set('orate', v));
    const kickBtn = el('button', { className: 'key', type: 'button', textContent: 'New start' });
    kickBtn.addEventListener('click', () => set('kick'));

    sheet.append(
      sec('Time compass',
        el('div', { className: 'rows' }, refs.theta.wrap), refs.thetaSeg,
        hint('Every equation’s clock runs along t·e^(iθ). time is the real part and tim the imaginary part: 0° runs forward, 180° runs the scene backward, and at 90° real time stops while imaginary time flows. The camera block can steer it with theta, in radians.'),
        refs.clock),
      sec('Plane sources',
        ...refs.srcSel.map(({ p, s }) => el('div', { className: 'field' }, el('label', { htmlFor: s.id, textContent: p.label }), s, el('span'))),
        hint('Any picture on any plane. A plane block can choose too, with src = 0 … 12; that wins over the menu.')),
      sec('4D fractal dive',
        el('div', { className: 'rows' }, refs.phi.wrap, refs.dive.wrap, refs.twist.wrap), refs.cSeg,
        el('div', { className: 'actions' }, newDiveBtn), refs.jbStatus,
        hint('z → z² + c with both z₀ and c complex is one 4D object. Slice 0° is the Mandelbrot set through z₀, 90° is the Julia set of c, and the angles between are the 4D slices in between. Dive is octaves per second: it zooms toward the boundary, about 100 octaves deep, then rises and starts again. Backward time zooms out. Twist turns the slice as imaginary time passes.')),
      sec('Lorenz in complex time',
        el('div', { className: 'rows' }, refs.span.wrap),
        hint('Each point is a complex time t, along the time compass from 0 (left) to the right edge. Colour is the phase of x(t). Where the path from 0 meets a singularity the solution blows up, so the gold cuts show the singularities, which crowd together where the motion is chaotic. The bright line is ordinary real time.')),
      sec('Flow field', refs.fSeg,
        hint('dz/dt = f(z) walked along the time compass. Gold dots are centres, green are sinks, red are sources: turn θ and they trade places.')),
      sec('Oscilloscope', refs.oSeg, el('div', { className: 'rows' }, refs.orate.wrap), el('div', { className: 'actions' }, kickBtn),
        hint('Four complex variables w, x, y, z, each in its own complex plane, all following the time compass. Hénon–Heiles is a true complex-time flow; when it meets a singularity it starts again and oblow pulses. Equations read owr, owi … ozr, ozi (−1 to 1).')),
    );
  }

  function syncUI() {
    if (!sheet) return;
    setRow(refs.theta, ui.theta); mark(refs.thetaSeg, ui.theta);
    const list = allSources();
    refs.srcSel.forEach(({ s }, i) => {
      if (s.options.length !== list.length) s.replaceChildren(...list.map((x) => el('option', { value: String(x.id), textContent: x.name })));
      if (document.activeElement !== s) s.value = String(ui.src[i] || 0);
    });
    setRow(refs.phi, ui.phi); setRow(refs.dive, ui.dive); setRow(refs.twist, ui.twist); setRow(refs.span, ui.span); setRow(refs.orate, ui.orate);
    mark(refs.cSeg, ui.c); mark(refs.fSeg, ui.fsel); mark(refs.oSeg, ui.osys);
    refreshClock();
  }
  let clockTick = 0;
  function refreshClock() {
    if (!sheet || ++clockTick % 15) return;
    const deg = Math.round(((live.theta / DEG) % 360 + 540) % 360 - 180);
    const steer = Math.abs(live.theta - ui.theta * DEG) > 1e-6 ? ` · the camera block is steering it to ${deg}°` : '';
    refs.clock.textContent = `time ${timeNow.toFixed(1)} · tim ${tim.toFixed(2)}${steer}`;
    const z = jb.depth, e10 = z * Math.log10(2);
    const where = jb.mode === 'rise' ? 'rising back out' : live.jdive > 0 ? 'diving' : 'holding';
    refs.jbStatus.textContent = `${where} · zoom 2^${z.toFixed(1)} (about 10^${e10.toFixed(1)}) · ${jb.maxIt} iterations · slice ${((jb.phi / DEG) % 360).toFixed(1)}°`;
  }
  syncUI();

  function status() {
    return {
      theta: ui.theta, phi: ui.phi, dive: ui.dive, twist: ui.twist, c: ui.c, osys: ui.osys, fsel: ui.fsel, src: [...ui.src],
      depth: Math.round(jb.depth * 10) / 10, steering: Math.abs(live.theta - ui.theta * DEG) > 1e-6,
      sources: allSources().map((s) => [s.id, s.name]), cs: C_PRESETS.map((p) => p[0]), systems: SYSTEMS, flows: FLOWS,
    };
  }

  return {
    get theta() { return live.theta; },
    step, fillInputs, camDefaults, fromCamera, planeSrc, source, render, set, status, syncUI,
    debug: { jb, live, sc, lz, jbIterate, jbRender, jbRefs, toFix, fromFix, newDive },
  };
}
