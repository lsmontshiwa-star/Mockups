// Mamepeng: a morning 3D farm. Bees fly around the viewer as the camera
// walks through Sefudi Farms; in the shop and the fridge test the swarm carries
// their real jar up to you. Driven by the page's scroll (window.FARM api below).
import * as THREE from './three.module.min.js';
import { EffectComposer } from './EffectComposer.js';
import { RenderPass } from './RenderPass.js';
import { UnrealBloomPass } from './UnrealBloomPass.js';
import { OutputPass } from './OutputPass.js';

const canvas = document.getElementById('farm');
const small = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer:coarse)').matches;
const SNAP = /shot=1/.test(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
} catch (e) { document.documentElement.classList.add('no-webgl'); throw e; }
let dpr = Math.min(devicePixelRatio, small ? 1.3 : 1.5);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#e4edf0');
scene.fog = new THREE.Fog(HORIZON, 70, 420);
const camera = new THREE.PerspectiveCamera(small ? 55 : 42, innerWidth / innerHeight, 0.05, 1200);

/* ---------- light & sky ---------- */
const sunDir = new THREE.Vector3(-0.5, 0.42, -0.76).normalize();
scene.add(new THREE.HemisphereLight('#e3f0ff', '#5d7a48', 1.55));
const sun = new THREE.DirectionalLight('#fff3e2', 2.6);
sun.position.copy(sunDir).multiplyScalar(100);
scene.add(sun);
const fill = new THREE.DirectionalLight('#9fb4ff', 0.35);
fill.position.set(60, 40, 80);
scene.add(fill);

const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: sunDir } },
  vertexShader: `varying vec3 vW; void main(){ vW = normalize((modelMatrix*vec4(position,1.)).xyz); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 sunDir; varying vec3 vW;
    void main(){
      float h = clamp(vW.y, -0.2, 1.0);
      vec3 top = vec3(0.42,0.63,0.84), mid = vec3(0.72,0.83,0.92), hor = vec3(0.95,0.95,0.94);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
      c = mix(c, top, smoothstep(0.15, 0.75, h));
      float s = max(dot(vW, sunDir), 0.0);
      c += vec3(1.0,0.86,0.88)*pow(s, 6.0)*0.25 + vec3(1.0,0.98,0.92)*pow(s, 800.0)*2.5;
      gl_FragColor = vec4(c, 1.0);
    }`
}));
scene.add(sky);

/* ---------- terrain ---------- */
const S = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function H(x, z) {
  const d = Math.hypot(x + 2, z);
  const h = 3.2 * Math.sin(x * 0.028) * Math.cos(z * 0.022) + 1.6 * Math.sin(x * 0.061 + z * 0.047) + 0.8 * Math.sin(z * 0.11 + 1.3) + 0.012 * Math.max(0, x - 15) * 3.0;
  return h * S(16, 48, d) + (d < 30 ? 0 : 0);
}
{
  const g = new THREE.PlaneGeometry(700, 700, small ? 120 : 220, small ? 120 : 220);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [];
  const c1 = new THREE.Color('#5f8f45'), c2 = new THREE.Color('#9cc06a'), c3 = new THREE.Color('#c9c58e'), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = H(x, z);
    p.setY(i, y);
    const n = 0.5 + 0.5 * Math.sin(x * 0.17) * Math.cos(z * 0.13);
    tmp.copy(c1).lerp(c2, S(-1, 4, y) * 0.7 + n * 0.3).lerp(c3, Math.max(0, n - 0.75));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
}

const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const dummy = new THREE.Object3D();

/* ---------- grass that sways ---------- */
const windU = { value: 0 };
{
  const n = small ? 9000 : 26000;
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0, 1, 0], 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute([0.22, 0.38, 0.16, 0.22, 0.38, 0.16, 0.78, 0.95, 0.55], 3));
  blade.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 ip = vec3(instanceMatrix[3][0], 0., instanceMatrix[3][2]);
       float w = sin(uTime*1.7 + ip.x*0.35 + ip.z*0.21) + 0.5*sin(uTime*3.1 + ip.x*0.9);
       transformed.x += w * position.y * position.y * 0.22;
       transformed.z += w * position.y * position.y * 0.08;`);
  };
  const grass = new THREE.InstancedMesh(blade, m, n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = 3 + Math.pow(rnd(), 0.6) * 75;
    const x = Math.cos(a) * r - 2, z = Math.sin(a) * r;
    if (Math.hypot(x + 14, z + 10) < 5.2) { i--; continue; }
    dummy.position.set(x, H(x, z), z);
    dummy.rotation.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
    const s = 0.5 + rnd() * 0.9; dummy.scale.set(s, s * (0.8 + rnd() * 0.9), s);
    dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, c.setHSL(0.22 + rnd() * 0.07, 0.5, 0.5 + rnd() * 0.2));
  }
  scene.add(grass);
}

/* ---------- camera: every chapter moves in its own plane ---------- */
// chapters: arrive, shop, founder, first hives, growth, forage, harvest, fridge, gallery, together, visit
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp3 = (a, b, k) => a.clone().lerp(b, k);
const orbit = (c, r, a, h) => V(c.x + Math.sin(a) * r, h, c.z + Math.cos(a) * r);
const E = (t) => t * t * (3 - 2 * t);
const SHOTS = [
  (t) => ({ p: orbit(V(5, 0, 0), 27 - t * 4, 0.72 + t * 0.4, 5.6 - t * 1.6), l: V(5, 2.4, 0) }),
  small ? (t) => ({ p: lerp3(V(5.4, 4.2, 15.5), V(6.0, 3.2, 12.6), E(t)), l: V(6.2, 1.35, 6) })
        : (t) => ({ p: lerp3(V(2.6, 4.4, 14.5), V(4.6, 3.0, 11.4), E(t)), l: V(9.4, 2.75, 5.6) }),
  (t) => ({ p: orbit(V(-14, 0, -10), 12.5, 0.55 - E(t) * 0.95, 3.1 + t * 0.6), l: V(-14, 3.2, -10) }),
  (t) => ({ p: V(3.5 + E(t) * 14, 2.0, 10.8), l: V(5.5 + E(t) * 10, 1.3, 4.2) }),
  (t) => ({ p: lerp3(V(15, 3.5, 15), V(4, 30, 60), E(t)), l: lerp3(V(10, 1.2, 4), V(52, 0, -2), E(t)) }),
  (t) => ({ p: orbit(V(-2, 0, 0), 70, 0.1 + t * 0.85, 138), l: V(-2, 0, 0) }),
  (t) => ({ p: V(16.5 - E(t) * 4, 1.6, 10.5), l: V(11 - E(t) * 2, 1.2, 2.5) }),
  small ? (t) => ({ p: V(6.6 - t * 0.6, 3.0, 11.8 - t * 0.4), l: V(6.2, 1.4, 6) })
        : (t) => ({ p: V(5.0 - t * 0.3, 2.95, 10.4 - t * 0.5), l: V(8.7, 2.65, 5.8) }),
  (t) => ({ p: lerp3(V(22, 20, 24), V(31, 8, 31), E(t)), l: V(0, 3, -4) }),
  (t) => ({ p: V(34, 12 + t * 3, 40), l: lerp3(V(0, 3, -4), V(-48, 9, -62), E(t)) }),
  (t) => ({ p: lerp3(V(30, 16, 48), V(-6, 34, 104), E(t)), l: V(-10, 2, -20) }),
];
const N = SHOTS.length;
// P = chapter + phase: 0..0.75 while the chapter is pinned, 0.75..1 while the next one scrolls in
function shotAt(P) {
  const k = Math.min(N - 1, Math.floor(P)), ph = P - k;
  if (ph < 0.75 || k === N - 1) return SHOTS[k](Math.min(1, ph / 0.75));
  const a = SHOTS[k](1), b = SHOTS[k + 1](0), w = E((ph - 0.75) / 0.25);
  return { p: a.p.lerp(b.p, w), l: a.l.lerp(b.l, w) };
}
function weightOf(P, list) { // how much the current position belongs to chapters in the list
  const k = Math.min(N - 1, Math.floor(P)), ph = P - k, in0 = list.includes(k) ? 1 : 0;
  if (ph < 0.75 || k === N - 1) return in0;
  const in1 = list.includes(k + 1) ? 1 : 0; return in0 + (in1 - in0) * E((ph - 0.75) / 0.25);
}
const pathPts = []; for (let k = 0; k <= N * 30; k++) pathPts.push(shotAt(k / 30).p);
const nearPath = (x, z, r) => pathPts.some((p) => Math.hypot(p.x - x, p.z - z) < r);

/* ---------- acacias ---------- */
{
  const n = 34;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.3, 3.4, 7), new THREE.MeshStandardMaterial({ color: '#6b5444', roughness: 1 }), n);
  const crownGeo = new THREE.SphereGeometry(1, 14, 8); crownGeo.scale(1, 0.32, 1);
  const crown = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#4f8a44', roughness: 1, flatShading: true }), n);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, r = 26 + rnd() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r - 20;
    if (nearPath(x, z, 14) || Math.hypot(x + 14, z + 10) < 12) { i--; continue; }
    const y = H(x, z), s = 0.8 + rnd() * 0.9;
    dummy.position.set(x, y + 1.7 * s, z); dummy.rotation.set(0, 0, (rnd() - 0.5) * 0.25); dummy.scale.set(s, s, s); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + 3.5 * s, z); dummy.rotation.set(0, rnd() * 3, 0); dummy.scale.set(3.6 * s, 2 * s, 3.2 * s); dummy.updateMatrix(); crown.setMatrixAt(i, dummy.matrix);
  }
  scene.add(trunk, crown);
}

/* ---------- aloes (winter forage, they glow at golden hour) ---------- */
{
  const n = small ? 90 : 180;
  const spikeG = new THREE.ConeGeometry(0.16, 1.1, 7);
  const spikes = new THREE.InstancedMesh(spikeG, new THREE.MeshStandardMaterial({ color: '#ff6f61', emissive: '#ff4f5e', emissiveIntensity: 0.25, roughness: 0.6 }), n * 3);
  const rosette = new THREE.InstancedMesh(new THREE.ConeGeometry(0.7, 0.7, 8), new THREE.MeshStandardMaterial({ color: '#5c7a4a', roughness: 0.8, flatShading: true }), n);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, r = 7 + Math.pow(rnd(), 0.7) * 60, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x + 14, z + 10) < 6 || (x > 4 && x < 18 && z > 1 && z < 7)) { i--; continue; }
    const y = H(x, z);
    dummy.position.set(x, y + 0.3, z); dummy.rotation.set(Math.PI, rnd() * 3, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); rosette.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 3; k++) {
      dummy.position.set(x + (rnd() - 0.5) * 0.5, y + 1.3 + rnd() * 0.5, z + (rnd() - 0.5) * 0.5);
      dummy.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3); dummy.scale.setScalar(0.8 + rnd() * 0.5); dummy.updateMatrix(); spikes.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  }
  scene.add(spikes, rosette);
}

/* ---------- forage flowers (recoloured by the flora chips) ---------- */
const flowerCount = small ? 900 : 2200;
const petal = new THREE.Shape();
for (let k = 0; k <= 60; k++) { const a = (k / 60) * Math.PI * 2, r = 0.13 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5))); const x = Math.cos(a) * r, y = Math.sin(a) * r; k ? petal.lineTo(x, y) : petal.moveTo(x, y); }
const flowerGeo = new THREE.ShapeGeometry(petal); flowerGeo.rotateX(-Math.PI / 2 + 0.5);
const mouseU = { value: new THREE.Vector2(9, 9) };
const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.12 });
flowerMat.onBeforeCompile = (sh) => {
  sh.uniforms.uMouse = mouseU;
  sh.vertexShader = 'uniform vec2 uMouse;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
     vec3 wp0 = (modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
     float dc = distance(wp0, cameraPosition);
     float bloom = mix(1.9, 0.25, smoothstep(3.0, 46.0, dc));
     transformed *= bloom;`).replace('#include <project_vertex>',
    `#include <project_vertex>
     vec2 ndc = gl_Position.xy / gl_Position.w;
     vGlow = 1.0 - smoothstep(0.0, 0.28, distance(ndc, uMouse));`);
  sh.fragmentShader = 'varying float vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
     totalEmissiveRadiance = diffuseColor.rgb * (0.12 + vGlow * 1.6);`);
};
const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
const flowerKind = new Uint8Array(flowerCount);
for (let i = 0; i < flowerCount; i++) {
  const a = rnd() * 6.283, r = 4 + Math.sqrt(rnd()) * 72, x = Math.cos(a) * r - 2, z = Math.sin(a) * r;
  dummy.position.set(x, H(x, z) + 0.3 + rnd() * 0.45, z); dummy.rotation.set(0, rnd() * 6.28, 0); dummy.scale.setScalar(0.8 + rnd() * 0.9); dummy.updateMatrix();
  flowers.setMatrixAt(i, dummy.matrix); flowerKind[i] = Math.floor(rnd() * 5);
}
scene.add(flowers);
const PALETTES = {
  multi: ['#f2c94c', '#ffffff', '#c7b3ff', '#ff9e7a', '#8fc3ff'],
  orange: ['#ffffff', '#fff6dc', '#ffe6a8', '#ffffff', '#ffd9a8'],
  wild: ['#b0262a', '#7a2a6b', '#d9522a', '#5b2a1a', '#ff8a3d'],
  acacia: ['#ffe14a', '#ffd21f', '#fff2a8', '#f6c36a', '#ffe14a'],
};
function paintFlowers(mode) {
  const p = PALETTES[mode] || PALETTES.multi, c = new THREE.Color();
  for (let i = 0; i < flowerCount; i++) flowers.setColorAt(i, c.set(p[flowerKind[i]]));
  flowers.instanceColor.needsUpdate = true;
}
paintFlowers('multi');

/* ---------- pollen and dust caught in the low sun ---------- */
const NP = small ? 500 : 1400;
const pollenGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(NP * 3), pSeed = new Float32Array(NP);
for (let i = 0; i < NP; i++) { pPos[i * 3] = (rnd() - 0.5) * 40; pPos[i * 3 + 1] = rnd() * 14; pPos[i * 3 + 2] = (rnd() - 0.5) * 40; pSeed[i] = rnd(); }
pollenGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pollenGeo.setAttribute('seed', new THREE.BufferAttribute(pSeed, 1));
const pollenU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uPx: { value: renderer.getPixelRatio() } };
const pollen = new THREE.Points(pollenGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: pollenU,
  vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uPx; attribute float seed; varying float vA;
    void main(){
      vec3 p = position;
      p.x += sin(uTime*0.3 + seed*30.0)*1.5; p.y += sin(uTime*0.45 + seed*20.0)*0.8; p.z += cos(uTime*0.25 + seed*40.0)*1.5;
      p = uCam + mod(p - uCam + 20.0, 40.0) - 20.0; p.y = uCam.y - 4.0 + mod(position.y + uTime*0.15*seed, 14.0);
      vec4 mv = viewMatrix * vec4(p,1.0);
      gl_PointSize = (2.0 + seed*4.0) * uPx * (12.0 / -mv.z);
      vA = 0.35 + 0.65*sin(uTime*2.0 + seed*50.0)*0.5+0.5;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(1.0,0.97,0.9, a*0.6*vA); }`,
}));
pollen.frustumCulled = false;
scene.add(pollen);

/* ---------- the rondavel from Boitumelo's photo ---------- */
const RONDAVEL = new THREE.Vector3(-14, H(-14, -10), -10);
{
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.95, side: THREE.DoubleSide }));
  wall.position.y = 1.5;
  const roofGeo = new THREE.ConeGeometry(5.1, 3.6, 40, 6);
  const rp = roofGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) { const n = (Math.sin(rp.getX(i) * 9) + Math.sin(rp.getZ(i) * 11)) * 0.035; rp.setX(i, rp.getX(i) * (1 + n)); rp.setZ(i, rp.getZ(i) * (1 + n)); }
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#a88a5a', roughness: 1, flatShading: true }));
  roof.position.y = 3 + 1.75;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.2), new THREE.MeshStandardMaterial({ color: '#3b2a1c' }));
  door.position.set(1.4, 1, 3.75); door.rotation.y = 0.35;
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: '#9cc3e0', roughness: 0.2, metalness: 0.3 }));
  win.position.set(3.2, 1.7, 2.35); win.rotation.y = 0.95;
  g.add(wall, roof, door, win);
  g.position.copy(RONDAVEL);
  scene.add(g);
}

/* ---------- hives: six in 2021, close to 200 today ---------- */
const MAX_HIVES = 200;
const hivePos = [];
for (let i = 0; i < 6; i++) hivePos.push(new THREE.Vector3(6 + i * 1.9, 0, 4 + (i % 2) * 0.4));
{
  const grid = [];
  for (let x = 20; x < 120; x += 3.4) for (let z = -46; z < 40; z += 3.1) grid.push(new THREE.Vector3(x + (rnd() - 0.5) * 0.8, 0, z + (rnd() - 0.5) * 0.8));
  grid.sort((a, b) => a.distanceTo(new THREE.Vector3(14, 0, 2)) - b.distanceTo(new THREE.Vector3(14, 0, 2)));
  for (let i = 0; hivePos.length < MAX_HIVES; i++) hivePos.push(grid[i]);
}
hivePos.forEach((p) => (p.y = H(p.x, p.z)));
const hiveBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.05, 0.75), new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAX_HIVES);
const hiveLid = new THREE.InstancedMesh(new THREE.BoxGeometry(1.14, 0.14, 0.9), new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.5, metalness: 0.4 }), MAX_HIVES);
const hiveDoor = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: '#1a0f06' }), MAX_HIVES);
const hiveStand = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.16, 0.9), new THREE.MeshStandardMaterial({ color: '#5a4026', roughness: 1 }), MAX_HIVES);
const hiveCols = ['#f7f3ea', '#cfe0c4', '#ecd9a6', '#d9e6f2', '#f3ead2'];
const hiveScale = new Float32Array(MAX_HIVES).fill(0);
for (let i = 0; i < MAX_HIVES; i++) hiveBody.setColorAt(i, new THREE.Color(hiveCols[i % 5]));
function placeHives() {
  for (let i = 0; i < MAX_HIVES; i++) {
    const p = hivePos[i], s = hiveScale[i];
    dummy.position.set(p.x, p.y + 0.62 * s + 0.15, p.z); dummy.rotation.set(0, 0.25 + (i % 3) * 0.05, 0); dummy.scale.setScalar(Math.max(0.0001, s)); dummy.updateMatrix(); hiveBody.setMatrixAt(i, dummy.matrix);
    dummy.position.y = p.y + 1.22 * s + 0.15; dummy.updateMatrix(); hiveLid.setMatrixAt(i, dummy.matrix);
    dummy.position.y = p.y + 0.08 * s; dummy.updateMatrix(); hiveStand.setMatrixAt(i, dummy.matrix);
    dummy.position.y = p.y + 0.3 * s; dummy.translateZ(0.385 * s); dummy.updateMatrix(); hiveDoor.setMatrixAt(i, dummy.matrix);
  }
  hiveBody.instanceMatrix.needsUpdate = hiveLid.instanceMatrix.needsUpdate = hiveDoor.instanceMatrix.needsUpdate = hiveStand.instanceMatrix.needsUpdate = true;
}
for (let i = 0; i < 6; i++) hiveScale[i] = 1;
placeHives();
scene.add(hiveBody, hiveLid, hiveDoor, hiveStand);

/* ---------- the five-kilometre forage ring ---------- */
const ring = new THREE.Mesh(new THREE.TorusGeometry(72, 0.45, 8, 180), new THREE.MeshBasicMaterial({ color: '#d4ae5c', transparent: true, opacity: 0, fog: false }));
ring.rotation.x = Math.PI / 2; ring.position.set(-2, 9, 0);
scene.add(ring);

/* ---------- their real jar, carried in by the bees ---------- */
const crystalU = { value: 0 };
const jarTex = new THREE.TextureLoader().load('img/real-jar.webp');
jarTex.colorSpace = THREE.SRGBColorSpace; jarTex.anisotropy = 8;
const jarMat = new THREE.MeshBasicMaterial({ map: jarTex, transparent: true, toneMapped: false, fog: false, depthWrite: false });
jarMat.onBeforeCompile = (sh) => {
  sh.uniforms.uCrystal = crystalU;
  sh.fragmentShader = 'uniform float uCrystal;\n' + sh.fragmentShader.replace('#include <map_fragment>',
    `#include <map_fragment>
     vec3 c0 = diffuseColor.rgb;
     float mx = max(c0.r, max(c0.g, c0.b)), mn = min(c0.r, min(c0.g, c0.b));
     float sat = (mx - mn) / (mx + 0.001);
     float hon = smoothstep(0.42, 0.68, sat) * (1.0 - smoothstep(0.5, 0.64, c0.g / (c0.r + 0.001))) * smoothstep(0.04, 0.16, mx);
     float n = fract(sin(dot(floor(vMapUv * 260.0), vec2(12.9898, 78.233))) * 43758.5453);
     float l = dot(c0, vec3(0.3, 0.59, 0.11));
     vec3 set = vec3(0.97, 0.84, 0.55) * (0.62 + 0.7 * l) + (n - 0.5) * 0.07;
     diffuseColor.rgb = mix(c0, set, hon * uCrystal);`);
};
const JAR_H = 1.55;
const jar = new THREE.Mesh(new THREE.PlaneGeometry(JAR_H * 647 / 807, JAR_H), jarMat);
jar.renderOrder = 5;
jar.scale.setScalar(0.0001);
scene.add(jar);
const JAR_HOME = new THREE.Vector3(9.8, hivePos[2].y + 1.2, 4.4);
const JAR_SHOW = new THREE.Vector3(6.2, 2.62, 6);
let crystal = 0;

/* ---------- bees ---------- */
const NB = small ? 80 : 180;
const stripe = document.createElement('canvas'); stripe.width = 8; stripe.height = 64;
{ const x = stripe.getContext('2d'); x.fillStyle = '#f2b02c'; x.fillRect(0, 0, 8, 64); x.fillStyle = '#1d1208'; [[6, 8], [22, 8], [38, 8], [52, 12]].forEach(([y, h]) => x.fillRect(0, y, 8, h)); }
const beeTex = new THREE.CanvasTexture(stripe); beeTex.colorSpace = THREE.SRGBColorSpace;
const bodyGeo = new THREE.SphereGeometry(1, 14, 10); bodyGeo.rotateX(Math.PI / 2); bodyGeo.scale(0.075, 0.07, 0.12);
const bees = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ map: beeTex, roughness: 0.5 }), NB);
const wingGeo = new THREE.CircleGeometry(1, 16); wingGeo.scale(0.11, 0.055, 1); wingGeo.rotateX(-Math.PI / 2); wingGeo.translate(0.1, 0.04, -0.01);
const wings = new THREE.InstancedMesh(wingGeo, new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), NB * 2);
scene.add(bees, wings);
const B = [];
for (let i = 0; i < NB; i++) B.push({
  p: new THREE.Vector3((rnd() - 0.5) * 20 + 8, 2 + rnd() * 3, (rnd() - 0.5) * 20 + 6), v: new THREE.Vector3(),
  r: 0.8 + rnd() * 3.4, sp: 0.5 + rnd() * 1.1, ph: rnd() * 6.28, hy: (rnd() - 0.5) * 2.4, hive: Math.floor(rnd() * 6), job: rnd(),
});
const pointer = new THREE.Vector2(9, 9); let pointerOn = false;
const ray = new THREE.Raycaster();
let drag = null, yaw = 0, pitch = 0;
canvas.style.touchAction = 'pan-y';
addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0 && !e.target.closest('a,button,input,dialog,aside,.prod,label')) { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; document.documentElement.classList.add('dragging'); } });
addEventListener('pointermove', (e) => { if (drag) { yaw = drag.yaw - (e.clientX - drag.x) * 0.004; pitch = Math.max(-0.5, Math.min(0.5, drag.pitch + (e.clientY - drag.y) * 0.003)); } }, { passive: true });
addEventListener('pointerup', () => { drag = null; document.documentElement.classList.remove('dragging'); });
addEventListener('pointermove', (e) => { pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); pointerOn = true; }, { passive: true });
addEventListener('pointerleave', () => (pointerOn = false));

let targetP = 0, P = 0, mode = 'multi';

/* ---------- post: soft bloom for the sun, aloes and honey ---------- */
let composer = null;
if (!small) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.5, 0.93));
  composer.addPass(new OutputPass());
}

function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); if (composer) { composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight); }
}
addEventListener('resize', resize);

/* ---------- loop ---------- */
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3(), smLook = new THREE.Vector3(5, 2, 0), par = new THREE.Vector2();
const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), wm = new THREE.Matrix4(), flap = new THREE.Matrix4(), mir = new THREE.Matrix4().makeScale(-1, 1, 1);
let jarLift = 0, shown = false, introT = SNAP ? 1 : 0, focus = 0, focusTarget = 0, introDone = false, slow = 0, dtAvg = 1 / 60;
const INTRO_FROM = new THREE.Vector3(70, 48, 95);
const ZERO2 = new THREE.Vector2();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  windU.value = reduce ? 0 : t;
  pollenU.uTime.value = t; pollenU.uCam.value.copy(camera.position);
  mouseU.value.copy(pointerOn ? pointer : mouseU.value.set(9, 9));
  const k1 = (r) => 1 - Math.exp(-dt * r); // frame-rate independent easing
  focus += (focusTarget - focus) * k1(3.5);
  // the page tells us where the reader is; we glide there instead of jumping
  P = SNAP ? targetP : P + (targetP - P) * k1(4.2);
  const sh = shotAt(P);
  camPos.copy(sh.p); look.copy(sh.l);
  par.lerp(pointerOn ? pointer : ZERO2, k1(2.4));
  camPos.x += par.x * 0.5; camPos.y += par.y * 0.3;
  // a slow descent onto the farm when the page opens
  introT = Math.min(1, introT + dt / 4.2);
  const ie = 1 - Math.pow(1 - introT, 3);
  if (ie < 1) camPos.lerp(INTRO_FROM, 1 - ie);
  else if (!introDone) { introDone = true; document.documentElement.classList.add('intro-done'); }
  if (!reduce) { camPos.y += Math.sin(t * 0.4) * 0.1; camPos.x += Math.sin(t * 0.23) * 0.14; }
  camera.position.lerp(camPos, SNAP || ie < 1 ? 1 : k1(9));
  if (!drag) { yaw *= Math.exp(-dt * 3); pitch *= Math.exp(-dt * 3); }
  if (Math.abs(yaw) > 1e-4 || Math.abs(pitch) > 1e-4) { const d = look.clone().sub(camPos); d.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(); d.applyAxisAngle(right, pitch); look.copy(camPos).add(d); }
  smLook.lerp(look, SNAP ? 1 : k1(9)); camera.lookAt(smLook);

  // hives: six until the growth chapter, then they fill the hills
  const g = P < 4 ? 0 : P > 4.75 ? 1 : (P - 4) / 0.75;
  const lit = 6 + Math.round(g * g * (MAX_HIVES - 6));
  let changed = false;
  for (let i = 6; i < MAX_HIVES; i++) { const target = i < lit ? 1 : 0; const nv = SNAP ? target : hiveScale[i] + (target - hiveScale[i]) * k1(10); if (Math.abs(nv - hiveScale[i]) > 0.001) { hiveScale[i] = nv; changed = true; } }
  if (changed) placeHives();
  window.FARM.hives = lit;

  ring.material.opacity = weightOf(P, [5]) * 0.9;

  // the jar: rests by a hive, the swarm lifts it to you in the shop and the fridge test
  const want = weightOf(P, [1, 7]);
  jarLift = SNAP ? want : jarLift + (want - jarLift) * k1(2.6);
  tmpV.copy(JAR_HOME).lerp(JAR_SHOW, jarLift); tmpV.y += Math.sin(jarLift * Math.PI) * 1.2 + (reduce ? 0 : Math.sin(t * 1.3) * 0.05 * jarLift);
  jar.position.copy(tmpV);
  jar.scale.setScalar(Math.max(0.0001, Math.min(1, jarLift * 1.4)));
  jar.rotation.set(0, Math.atan2(camera.position.x - jar.position.x, camera.position.z - jar.position.z), reduce ? 0 : Math.sin(t * 0.9) * 0.025);
  crystalU.value += (crystal - crystalU.value) * k1(3);
  shown = jarLift > 0.35;

  // bees
  camera.getWorldDirection(fwd);
  const near = tmpV.copy(camera.position).addScaledVector(fwd, 6.5);
  let ptr = null;
  if (pointerOn) { ray.setFromCamera(pointer, camera); ptr = ray.ray.at(5.5, new THREE.Vector3()); }
  const present = shown;
  for (let i = 0; i < NB; i++) {
    const b = B[i], a = t * b.sp + b.ph;
    let cx, cy, cz, r = b.r;
    if (present && b.job < (small ? 0.32 : 0.55)) { cx = jar.position.x; cy = jar.position.y + 0.2; cz = jar.position.z; r = 0.6 + b.r * 0.16; }
    else if (b.job < 0.25) { const h = hivePos[b.hive]; cx = h.x; cy = h.y + 1.6; cz = h.z; r = 0.6 + b.r * 0.4; }
    else if (focus > 0.05 && b.job > 0.3) { cx = near.x; cy = near.y - 0.4; cz = near.z; r = 0.4 + b.r * 0.25 * (1 - focus * 0.6); }
    else { cx = near.x; cy = near.y; cz = near.z; }
    const tx = cx + Math.cos(a) * r + Math.sin(a * 2.3) * 0.4, ty = cy + b.hy * (r / 3) + Math.sin(a * 1.7) * 0.5, tz = cz + Math.sin(a) * r;
    tmpV.set(tx - b.p.x, ty - b.p.y, tz - b.p.z).multiplyScalar(2.2).sub(b.v).multiplyScalar(dt * 3.2);
    b.v.add(tmpV);
    if (ptr) { // the cursor shoos bees away, the nearer the stronger
      const ox = b.p.x - ray.ray.origin.x, oy = b.p.y - ray.ray.origin.y, oz = b.p.z - ray.ray.origin.z;
      const along = ox * ray.ray.direction.x + oy * ray.ray.direction.y + oz * ray.ray.direction.z;
      if (along > 0) { const qx = ox - ray.ray.direction.x * along, qy = oy - ray.ray.direction.y * along, qz = oz - ray.ray.direction.z * along; const d = Math.hypot(qx, qy, qz), rad = 0.18 * along + 0.4;
        if (d < rad) { const k = (1 - d / rad) * 40 * dt / Math.max(d, 0.05); b.v.x += qx * k; b.v.y += qy * k; b.v.z += qz * k; } }
    }
    b.v.clampLength(0, 9);
    b.p.addScaledVector(b.v, dt);
    dummy.position.copy(b.p); tmpV.copy(b.p).add(b.v); dummy.lookAt(tmpV); dummy.scale.setScalar(1.35); dummy.updateMatrix();
    bees.setMatrixAt(i, dummy.matrix);
    const ang = reduce ? 0.3 : Math.sin(t * 55 + i) * 0.7;
    flap.makeRotationZ(ang); wm.multiplyMatrices(dummy.matrix, flap); wings.setMatrixAt(i * 2, wm);
    flap.makeRotationZ(-ang); wm.multiplyMatrices(dummy.matrix, mir).multiply(flap); wings.setMatrixAt(i * 2 + 1, wm);
  }
  bees.instanceMatrix.needsUpdate = wings.instanceMatrix.needsUpdate = true;

  // keep it fluid: if frames run slow, render fewer pixels
  dtAvg += (dt - dtAvg) * 0.05;
  if (!SNAP && t > 6 && ++slow > 90) { slow = 0; if (dtAvg > 1 / 42 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); } else if (dtAvg > 1 / 30 && composer) { composer = null; } }
  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.FARM = {
  hives: 6,
  set(p) { targetP = Math.max(0, Math.min(N - 1, p)); if (SNAP) P = targetP; },
  flora(m) { mode = m; paintFlowers(m); },
  count: N,
  crystal(c) { crystal = c; },
  focus(on) { focusTarget = on ? 1 : 0; },
};
requestAnimationFrame(frame);
renderer.compile(scene, camera);
document.documentElement.classList.add('farm-ready');
