import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const CFG = window.OFFICE_CONFIG;
const STATUS = {
  coding:    { label: "CODING",      c: "#4f8cff" },
  browsing:  { label: "BROWSING",    c: "#2dd4bf" },
  terminal:  { label: "IN TERMINAL", c: "#b5e550" },
  thinking:  { label: "THINKING",    c: "#a78bfa" },
  needs_you: { label: "NEEDS YOU",   c: "#fb923c" },
  error:     { label: "ERROR",       c: "#f43f5e" },
  done:      { label: "DONE",        c: "#22c55e" },
  idle:      { label: "IDLE",        c: "#8b8d94" },
};
const WORKING = ["coding", "browsing", "terminal", "thinking"];
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const pad = (n) => String(n).padStart(2, "0");
const hms = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function fitText(g, t, w) { if (g.measureText(t).width <= w) return t; while (t && g.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; }

/* ───────────── avatar SVGs (shared by panel + logo style) ───────────── */
function avatarSVG(bot) {
  const shapes = {
    round: `<circle cx="32" cy="33" r="27"/>`,
    square: `<rect x="7" y="8" width="50" height="50" rx="15" transform="rotate(-8 32 33)"/>`,
    drop: `<path d="M12 50C6 36 14 12 34 7c14-3 24 9 23 24-1 18-14 28-28 27-8 0-14-3-17-8z"/>`,
  };
  return `<svg viewBox="0 0 64 64"><g fill="${bot.color}">${shapes[bot.shape] || shapes.round}</g>
  <rect x="22" y="22" width="5.5" height="13" rx="2.75" fill="#0b0b0f" transform="rotate(-10 25 28)"/>
  <rect x="35" y="22" width="5.5" height="13" rx="2.75" fill="#0b0b0f" transform="rotate(-10 38 28)"/></svg>`;
}

/* ───────────── state ───────────── */
const state = { bots: {}, activity: [], focus: CFG.focus || CFG.crew[0].id, idx: 0, loopStart: 0 };
function resetBots() {
  for (const b of CFG.crew) {
    const t = (CFG.tasks && CFG.tasks[b.id]) || { title: b.note, step: 1, steps: 1 };
    state.bots[b.id] = { ...b, task: { ...t }, log: [], ask: null, updated: Date.now() };
  }
}
resetBots();

/* ───────────── renderer / scene ───────────── */
const canvas = $("#gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#050507");

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
const target = new THREE.Vector3(0.2, 1.4, -0.8);
camera.position.copy(target).add(new THREE.Vector3(1, 0.92, 1.08).normalize().multiplyScalar(60));
camera.zoom = 1.08;
const controls = new OrbitControls(camera, canvas);
controls.target.copy(target);
controls.enablePan = false;
controls.enableDamping = true;
controls.minZoom = 0.7; controls.maxZoom = 2.6;
controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.15;
controls.minAzimuthAngle = Math.PI / 4 - 0.6; controls.maxAzimuthAngle = Math.PI / 4 + 0.6;
controls.update();

const hemi = new THREE.HemisphereLight("#9fb2ff", "#0c0c12", 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffffff", 1.4);
sun.position.set(10, 22, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.PointLight("#7aa2ff", 30, 30, 1.6);
fill.position.set(-5, 4.2, -6);
scene.add(fill);

/* ───────────── room ───────────── */
const RX = 8, RZ = 11, WH = 4.6;
const M = {
  floor: new THREE.MeshStandardMaterial({ color: "#16171c", roughness: 0.55, metalness: 0.2 }),
  slab: new THREE.MeshStandardMaterial({ color: "#0d0e12", roughness: 0.8 }),
  wall: new THREE.MeshStandardMaterial({ color: "#121318", roughness: 0.9 }),
  desk: new THREE.MeshStandardMaterial({ color: "#d8dade", roughness: 0.35, metalness: 0.1 }),
  deskDark: new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.6 }),
  monitor: new THREE.MeshStandardMaterial({ color: "#0b0b0e", roughness: 0.4, metalness: 0.5 }),
  chair: new THREE.MeshStandardMaterial({ color: "#1d1f25", roughness: 0.7 }),
  neon: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(1.25), toneMapped: false }),
  pot: new THREE.MeshStandardMaterial({ color: "#2b2d33", roughness: 0.8 }),
  leaf: new THREE.MeshStandardMaterial({ color: "#2f6b34", roughness: 0.8, flatShading: true }),
};
const box = (w, h, d, mat, x, y, z, shadow = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m;
};
box(RX * 2 + 0.6, 0.6, RZ * 2 + 0.6, M.slab, 0, -0.3, 0, false);
const floor = box(RX * 2, 0.04, RZ * 2, M.floor, 0, 0.02, 0, false);
box(0.3, WH, RZ * 2 + 0.3, M.wall, -RX - 0.15, WH / 2, -0.15, false);   // left wall
box(RX * 2, WH, 0.3, M.wall, 0, WH / 2, -RZ - 0.15, false);             // back wall
// neon frame
const NT = 0.05;
box(NT, NT, RZ * 2 + 0.3, M.neon, -RX, WH, -0.15, false);
box(RX * 2 + 0.3, NT, NT, M.neon, -0.15, WH, -RZ, false);
box(NT, WH, NT, M.neon, -RX, WH / 2, -RZ, false);
box(NT, WH, NT, M.neon, -RX, WH / 2, RZ, false);
box(NT, WH, NT, M.neon, RX, WH / 2, -RZ, false);
box(RX * 2 + 0.6, NT, NT, M.neon, 0, 0.01, RZ + 0.3, false);
box(NT, NT, RZ * 2 + 0.6, M.neon, RX + 0.3, 0.01, 0, false);
// floor grid lines
const grid = new THREE.GridHelper(RZ * 2, 22, "#2a2d36", "#1b1d24");
grid.scale.set(RX / RZ, 1, 1); grid.position.y = 0.045; scene.add(grid);

// canvas textures
function canvasTex(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { c, g: c.getContext("2d"), t };
}
// video wall (left)
const VW = canvasTex(2048, 400);
const stars = Array.from({ length: 260 }, () => [Math.random() * 2048, Math.random() * 300, Math.random() * 1.6 + 0.3, Math.random()]);
function drawVideoWall(now) {
  const { g, c } = VW;
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, "#03040a"); grd.addColorStop(0.65, "#0a1330"); grd.addColorStop(1, "#1a2a5c");
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  for (const [x, y, r, p] of stars) { g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 900 + p * 9)); g.fillStyle = "#fff"; g.fillRect(x, y, r, r); }
  g.globalAlpha = 1;
  // horizon glow + launch tower
  const hz = g.createRadialGradient(1540, 400, 10, 1540, 400, 520); hz.addColorStop(0, "#6f8cff88"); hz.addColorStop(1, "#0000");
  g.fillStyle = hz; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#c9d3ff"; g.fillRect(1528, 130, 22, 240); g.beginPath(); g.moveTo(1528, 130); g.lineTo(1539, 92); g.lineTo(1550, 130); g.fill();
  g.strokeStyle = "#5a6386"; g.lineWidth = 3; for (let y = 140; y < 370; y += 22) { g.beginPath(); g.moveTo(1570, y); g.lineTo(1600, y + 22); g.stroke(); }
  g.fillStyle = "#5a6386"; g.fillRect(1598, 120, 8, 250);
  // wall text
  g.save(); g.font = "italic 900 170px Orbitron, sans-serif"; g.textBaseline = "middle";
  g.shadowColor = "#9db4ff"; g.shadowBlur = 40; g.fillStyle = "#ffffff"; g.fillText(CFG.wallText || "GROK", 300, 175); g.restore();
  // left info panel
  g.fillStyle = "#ffffffcc"; g.font = "700 30px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.fillText("FLIGHT " + pad(CFG.crew.length) + " · " + CFG.brand, 40, 60);
  g.fillStyle = "#9aa4c7"; g.font = "22px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.fillText(new Date().toDateString().toUpperCase(), 40, 94);
  // ticker
  g.fillStyle = "#000a"; g.fillRect(0, 330, c.width, 70);
  const counts = countStatuses();
  const tick = `ACTIVE ${counts.working}  ·  NEEDS YOU ${counts.needs_you}  ·  DONE ${counts.done}  ·  IDLE ${counts.idle}  ·  NEXT EVENT ${nextEventIn()}  ·  ${hms()}  ·  `;
  g.fillStyle = "#e9ecff"; g.font = "600 30px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";
  const w = g.measureText(tick).width, off = (now / 12) % w;
  for (let x = -off; x < c.width; x += w) g.fillText(tick, x, 375);
  VW.t.needsUpdate = true;
}
{
  const m = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 3.03), new THREE.MeshBasicMaterial({ map: VW.t, toneMapped: false }));
  m.position.set(-RX + 0.06, 2.55, -1.6); m.rotation.y = Math.PI / 2; scene.add(m);
  box(0.06, 3.25, 15.8, M.monitor, -RX + 0.01, 2.55, -1.6, false);
}
// mission board (back wall)
const BD = canvasTex(512, 640);
function drawBoard() {
  const { g, c } = BD;
  g.fillStyle = "#07080b"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#fff"; g.font = "700 30px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.fillText("TODAY'S RUNS", 28, 52);
  g.fillStyle = "#6b6f7a"; g.font = "20px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.fillText(hms(), 360, 52);
  CFG.crew.forEach((b, i) => {
    const s = state.bots[b.id], y = 100 + i * 70;
    g.fillStyle = STATUS[s.status].c; g.fillRect(28, y + 6, 14, 14);
    g.fillStyle = "#e8e9ee"; g.font = "700 22px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.fillText(b.name, 56, y + 20);
    g.fillStyle = "#8b8f9a"; g.font = "18px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.fillText(fitText(g, s.note || "", 430), 56, y + 46);
  });
  BD.t.needsUpdate = true;
}
{
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.25), new THREE.MeshBasicMaterial({ map: BD.t, toneMapped: false, color: "#bbbbbb" }));
  m.position.set(3.4, 2.45, -RZ + 0.06); scene.add(m);
  box(2.8, 3.45, 0.06, M.monitor, 3.4, 2.45, -RZ + 0.01, false);
}
// glowing clocks
const clocks = [];
function makeClock(pos, rotY, w = 3.2) {
  const ct = canvasTex(640, 150);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 150 / 640), new THREE.MeshBasicMaterial({ map: ct.t, transparent: true, toneMapped: false }));
  m.position.copy(pos); m.rotation.y = rotY; scene.add(m); clocks.push(ct);
}
makeClock(new THREE.Vector3(-3.6, 3.75, -RZ + 0.03), 0, 3.4);
makeClock(new THREE.Vector3(-RX + 0.03, 3.9, 7.6), Math.PI / 2, 3.0);
function drawClocks() {
  const txt = "T-" + nextEventIn();
  for (const { g, c, t } of clocks) {
    g.clearRect(0, 0, c.width, c.height);
    g.font = "600 92px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.textBaseline = "middle";
    g.shadowColor = "#cfe0ff"; g.shadowBlur = 24; g.fillStyle = "#ffffff"; g.fillText(txt, 20, 70);
    g.shadowBlur = 0; g.fillStyle = "#9aa3bd"; g.font = "22px 'Geist Mono', monospace, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"; g.fillText("NEXT CHECK-IN", 24, 132);
    t.needsUpdate = true;
  }
}
// ceiling light bars
// plants
function plant(x, z, s = 1) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.28 * s, 0.6 * s, 16), M.pot);
  p.position.set(x, 0.3 * s, z); p.castShadow = true; scene.add(p);
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry((0.38 + Math.random() * 0.2) * s, 0), M.leaf);
    l.position.set(x + (Math.random() - 0.5) * 0.5 * s, (0.85 + Math.random() * 0.9) * s, z + (Math.random() - 0.5) * 0.5 * s);
    l.rotation.set(Math.random() * 3, Math.random() * 3, 0); l.castShadow = true; scene.add(l);
  }
}
plant(-7.1, -10.1, 1.2); plant(7.1, -10.1, 1); plant(-7.1, 10.1, 1); plant(-1.2, -10.2, 0.8);

/* ───────────── desks, seats, bots ───────────── */
const ROWS = [-4.4, -0.4, 3.6], COLS = [-6.3, -1.3, 3.7];
const codeTex = (() => {
  const ct = canvasTex(256, 160); const g = ct.g;
  g.fillStyle = "#0a0b10"; g.fillRect(0, 0, 256, 160);
  for (let y = 12; y < 150; y += 11) { g.fillStyle = "#ffffff"; g.globalAlpha = 0.35 + Math.random() * 0.5; g.fillRect(10 + Math.random() * 30, y, 40 + Math.random() * 160, 5); }
  ct.t.needsUpdate = true; return ct.t;
})();
const seats = [];
for (let r = 0; r < 3; r++) {
  const dx = ROWS[r];
  box(1.15, 0.08, 14.6, M.desk, dx, 0.78, COLS[1], true);
  box(0.06, 0.7, 14.6, M.deskDark, dx - 0.5, 0.39, COLS[1], true);
  for (let c = 0; c < 3; c++) {
    const z = COLS[c], seat = { i: r * 3 + c, pos: new THREE.Vector3(dx + 1.25, 0, z), screens: [] };
    for (const dz of [-0.62, 0.62]) {
      const mon = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.95), M.monitor); frame.castShadow = true; mon.add(frame);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.48), new THREE.MeshBasicMaterial({ map: codeTex, color: "#334", toneMapped: false }));
      scr.rotation.y = Math.PI / 2; scr.position.x = 0.035; mon.add(scr); seat.screens.push(scr);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), M.monitor); stand.position.y = -0.38; mon.add(stand);
      mon.position.set(dx - 0.3, 1.32, z + dz); mon.rotation.y = dz < 0 ? 0.12 : -0.12; scene.add(mon);
    }
    // keyboard
    box(0.3, 0.02, 0.8, M.deskDark, dx + 0.25, 0.83, z, false);
    // chair
    const ch = new THREE.Group();
    const seatM = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), M.chair); seatM.position.y = 0.5; ch.add(seatM);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), M.chair); post.position.y = 0.25; ch.add(post);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.7), M.chair); back.position.set(0.42, 0.85, 0); ch.add(back);
    ch.traverse((o) => { o.castShadow = true; }); ch.position.copy(seat.pos); scene.add(ch);
    // floor ring + glow
    const ringMat = new THREE.MeshBasicMaterial({ color: "#888", toneMapped: false, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.84, 48), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.copy(seat.pos).setY(0.06); scene.add(ring);
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#888", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), glowMat);
    glow.rotation.x = -Math.PI / 2; glow.position.copy(seat.pos).setY(0.055); scene.add(glow);
    Object.assign(seat, { ring, glow });
    seats.push(seat);
  }
}
function glowTexture() {
  if (glowTexture.t) return glowTexture.t;
  const ct = canvasTex(128, 128), g = ct.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "#ffffff88"); gr.addColorStop(0.45, "#ffffff33"); gr.addColorStop(1, "#ffffff00");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); ct.t.colorSpace = THREE.NoColorSpace; ct.t.needsUpdate = true;
  return (glowTexture.t = ct.t);
}

function dropGeometry() {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = t * Math.PI;
    const r = Math.sin(a) * (0.5 - 0.18 * t) * (1 + 0.15 * Math.sin(a));
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), -Math.cos(a) * 0.5 + 0.05 * t));
  }
  const g = new THREE.LatheGeometry(pts, 40); g.computeVertexNormals(); return g;
}
const eyeGeo = new THREE.CapsuleGeometry(0.055, 0.15, 6, 12);
const eyeMat = new THREE.MeshStandardMaterial({ color: "#09090c", roughness: 0.2 });
const bots3d = {};
for (const b of CFG.crew) {
  const seat = seats[b.seat]; if (!seat) continue;
  const root = new THREE.Group(); root.position.copy(seat.pos); root.scale.setScalar(1.3); scene.add(root);
  const body = new THREE.Group(); body.position.y = 0.85; root.add(body);
  const mat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.32, metalness: 0.05, emissive: b.color, emissiveIntensity: 0.06 });
  let geo, front = 0.47;
  if (b.shape === "square") { geo = new RoundedBoxGeometry(0.88, 0.82, 0.88, 5, 0.26); front = 0.45; }
  else if (b.shape === "drop") { geo = dropGeometry(); front = 0.43; }
  else geo = new THREE.SphereGeometry(0.5, 40, 28);
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; body.add(mesh);
  if (b.shape === "round") mesh.scale.set(1, 0.92, 1);
  if (b.shape === "drop") mesh.rotation.z = -0.25;
  for (const ex of [-0.13, 0.13]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(ex, 0.08, front); e.rotation.z = -0.15; body.add(e);
  }
  bots3d[b.id] = { root, body, seat, yaw: -Math.PI / 2, phase: Math.random() * 6 };
}

/* ───────────── labels ───────────── */
const labelsEl = $("#labels");
const tags = {}, bubbles = {};
for (const b of CFG.crew) {
  const el = document.createElement("div"); el.className = "tag";
  el.onclick = () => setFocus(b.id); labelsEl.appendChild(el); tags[b.id] = el;
}
const freeTags = seats.filter((s) => !CFG.crew.some((b) => b.seat === s.i)).map((s) => {
  const el = document.createElement("div"); el.className = "tag free"; el.textContent = "+ FREE SEAT"; labelsEl.appendChild(el);
  s.ring.material.color.set("#2a2c33"); s.glow.visible = false; return { el, s };
});
function say(id, text) {
  if (!tags[id]) return;
  bubbles[id]?.el.remove();
  const el = document.createElement("div"); el.className = "bubble"; el.textContent = text; labelsEl.appendChild(el);
  bubbles[id] = { el, until: performance.now() + 4200 };
}
const v3 = new THREE.Vector3();
function project(p, out) {
  v3.copy(p).project(camera);
  const r = canvas.getBoundingClientRect();
  out.x = (v3.x * 0.5 + 0.5) * r.width; out.y = (-v3.y * 0.5 + 0.5) * r.height; return out;
}
const scr = { x: 0, y: 0 };
function placeLabels(now) {
  for (const b of CFG.crew) {
    const B = bots3d[b.id]; if (!B) continue;
    const s = state.bots[b.id];
    project(v3.copy(B.root.position).setY(2.35), scr);
    const t = tags[b.id];
    t.style.left = scr.x + "px"; t.style.top = scr.y + "px";
    const html = `<i class="dot" style="background:${STATUS[s.status].c}"></i>${esc(b.name)}`;
    if (t._h !== html) { t.innerHTML = html; t._h = html; }
    const bb = bubbles[b.id];
    if (bb) {
      if (now > bb.until) { bb.el.remove(); delete bubbles[b.id]; }
      else { bb.el.style.left = scr.x + "px"; bb.el.style.top = scr.y - 30 + "px"; }
    }
  }
  for (const { el, s } of freeTags) {
    project(v3.copy(s.pos).setY(1.4), scr); el.style.left = scr.x + "px"; el.style.top = scr.y + "px";
  }
}

/* ───────────── HUD ───────────── */
$("#brand").textContent = CFG.brand; $("#title").textContent = CFG.title; $("#subtitle").textContent = CFG.subtitle;
document.title = `${CFG.brand} · ${CFG.title}`;
$("#crewcount").textContent = `${CFG.crew.length} BOTS`;
$("#legend").innerHTML = Object.values(STATUS).map((s) => `<span><i class="dot" style="background:${s.c}"></i>${s.label}</span>`).join("");
const pill = (st) => `<span class="pill" style="color:${STATUS[st].c};border-color:${STATUS[st].c}55;background:${STATUS[st].c}14">${STATUS[st].label}</span>`;
function countStatuses() {
  const n = { working: 0, needs_you: 0, done: 0, idle: 0, error: 0 };
  for (const s of Object.values(state.bots)) {
    if (WORKING.includes(s.status)) n.working++; else n[s.status] = (n[s.status] || 0) + 1;
  }
  return n;
}
const setHTML = (el, h) => { if (el._h !== h) { el.innerHTML = h; el._h = h; } };
function renderHUD() {
  const n = countStatuses(), free = seats.length - CFG.crew.length;
  const chips = [["working", n.working, STATUS.coding.c], ["needs you", n.needs_you, STATUS.needs_you.c], ["done", n.done, STATUS.done.c],
    ["idle", n.idle, STATUS.idle.c], ["free seats", free, "#cfd1d8"]];
  if (n.error) chips.splice(2, 0, ["error", n.error, STATUS.error.c]);
  setHTML($("#chips"), chips.map(([l, v, c]) => `<div class="chip"><i class="dot" style="background:${c}"></i><b>${v}</b>${l.toUpperCase()}</div>`).join(""));
  setHTML($("#crew"), CFG.crew.map((b) => {
    const s = state.bots[b.id];
    return `<li data-id="${b.id}" class="${b.id === state.focus ? "sel" : ""}"><div class="av">${avatarSVG(b)}</div>
      <div class="who"><div class="n">${esc(b.name)}<em>${esc(b.role)}</em></div><div class="s">${esc(s.note)}</div></div>${pill(s.status)}</li>`;
  }).join(""));
  const f = state.bots[state.focus];
  $("#fav").innerHTML = avatarSVG(f);
  $("#fname").textContent = f.name;
  const ago = Math.max(0, Math.round((Date.now() - f.updated) / 1000));
  $("#fsub").textContent = `${f.role} · updated ${ago < 60 ? ago + "s" : Math.round(ago / 60) + "m"} ago`;
  $("#fpill").outerHTML = pill(f.status).replace('class="pill"', 'class="pill" id="fpill"');
  $("#ftitle").textContent = f.task.title;
  $("#fbar").style.width = (100 * f.task.step / f.task.steps) + "%";
  $("#fbar").style.background = STATUS[f.status].c;
  $("#fstep").textContent = `step ${f.task.step} of ${f.task.steps}`;
  setHTML($("#flog"), f.log.slice(0, 4).map((l) => `<li><time>${l.t}</time><i class="dot" style="background:${STATUS[l.s].c}"></i>${esc(l.text)}</li>`).join(""));
  const gn = $(".gonogo");
  gn.classList.toggle("live", !!f.ask);
  gn.classList.toggle("posted", !f.ask && f.status === "done" && f.answered === "go");
  $("#go").textContent = !f.ask && f.answered === "go" && f.status === "done" ? "POSTED ✓" : "GO";
  setHTML($("#activity"), state.activity.slice(0, 12).map((a) => `<li><time>${a.t}</time><i class="dot" style="background:${STATUS[a.s].c}"></i><b>${esc(a.name)}</b>${esc(a.text)}</li>`).join(""));
}
$("#crew").addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) setFocus(li.dataset.id); });
function setFocus(id) { state.focus = id; renderHUD(); }
$("#go").onclick = () => answer("go");
$("#nogo").onclick = () => answer("nogo");
function answer(kind) {
  const f = state.bots[state.focus]; if (!f.ask) return;
  const patch = f.ask[kind]; f.ask = null; f.answered = kind;
  pushActivity(f, kind === "go" ? "You said GO" : "You said NO-GO", kind === "go" ? "done" : "needs_you");
  if (patch) applyEvent({ bot: f.id, ...patch }, true);
  renderHUD();
}

/* ───────────── script engine ───────────── */
function pushActivity(s, text, st) { state.activity.unshift({ t: hm(), name: s.name, text: " " + text, s: st || s.status }); state.activity.length = Math.min(state.activity.length, 40); }
function applyEvent(ev, live) {
  const s = state.bots[ev.bot]; if (!s) return;
  if (s.answered && ev.status && ev.at && s.answeredSkip?.includes(ev.at)) return;
  if (ev.status) s.status = ev.status;
  if (ev.note) s.note = ev.note;
  if (ev.title) s.task.title = ev.title;
  if (ev.steps) s.task.steps = ev.steps;
  if (ev.step) s.task.step = Math.min(ev.step, s.task.steps);
  if (ev.log) s.log.unshift({ t: hms(), text: ev.log, s: s.status });
  if (ev.ask) { s.ask = { go: ev.go, nogo: ev.nogo }; s.answered = null; }
  else if (ev.status && s.ask && ev.status !== "needs_you") s.ask = null; // script moved on without you
  const act = ev.activity || (ev.log && !ev.say ? null : null);
  if (act) pushActivity(s, act);
  if (ev.say && live) say(ev.bot, ev.say);
  s.updated = Date.now();
  if (ev.status && bots3d[ev.bot]) bots3d[ev.bot].hop = performance.now();
}
const SCRIPT = [...CFG.script].sort((a, b) => a.at - b.at);
const LOOP = CFG.loopSeconds || (SCRIPT.at(-1)?.at ?? 60) + 6;
let t0 = performance.now() / 1000 - (parseFloat(params.get("t")) || 0);
let lastT = -1;
// fast-forward (?t=SECONDS) without bubbles
(function fastForward() {
  const start = parseFloat(params.get("t")) || 0;
  while (state.idx < SCRIPT.length && SCRIPT[state.idx].at <= start) applyEvent(SCRIPT[state.idx++], false);
  lastT = start;
})();
// seed activity so the feed isn't empty on first load
if (!state.activity.length) {
  pushActivity(state.bots[CFG.crew[0].id], "Started the day's runs", "coding");
}
function tickScript() {
  const t = (performance.now() / 1000 - t0) % LOOP;
  if (t < lastT) { // loop wrapped
    resetBots(); state.idx = 0;
  }
  lastT = t;
  let changed = false;
  while (state.idx < SCRIPT.length && SCRIPT[state.idx].at <= t) { applyEvent(SCRIPT[state.idx++], true); changed = true; }
  return changed;
}
function nextEventIn() {
  const t = (performance.now() / 1000 - t0) % LOOP;
  const nx = state.idx < SCRIPT.length ? SCRIPT[state.idx].at : LOOP + (SCRIPT[0]?.at || 0);
  const d = Math.max(0, Math.ceil(nx - t));
  return `${pad(Math.floor(d / 3600))}:${pad(Math.floor(d / 60) % 60)}:${pad(d % 60)}`;
}

/* ───────────── time of day ───────────── */
const TOD = {
  night: { bg: "#050507", hemi: 0.45, sun: 1.1, sunC: "#cfd8ff", fill: 30, floor: "#16171c", wall: "#121318", exp: 1.0, bloom: 0.5 },
  dusk:  { bg: "#140c10", hemi: 0.75, sun: 1.8, sunC: "#ffb37a", fill: 18, floor: "#1d1a1c", wall: "#1d1719", exp: 1.05, bloom: 0.4 },
  day:   { bg: "#cfd3da", hemi: 1.3,  sun: 2.6, sunC: "#ffffff", fill: 4,  floor: "#5d616a", wall: "#8c9099", exp: 1.05, bloom: 0.2 },
};
function setTOD(mode) {
  document.querySelectorAll("#tod button").forEach((b) => b.classList.toggle("on", b.dataset.tod === mode));
  let k = mode;
  if (mode === "now") { const h = new Date().getHours(); k = h >= 7 && h < 17 ? "day" : h >= 17 && h < 19 ? "dusk" : "night"; }
  const p = TOD[k];
  scene.background.set(p.bg); hemi.intensity = p.hemi; sun.intensity = p.sun; sun.color.set(p.sunC); fill.intensity = p.fill;
  M.floor.color.set(p.floor); M.wall.color.set(p.wall); renderer.toneMappingExposure = p.exp; bloom.strength = p.bloom;
  document.body.className = k;
}
document.querySelectorAll("#tod button").forEach((b) => (b.onclick = () => setTOD(b.dataset.tod)));

/* ───────────── post + resize ───────────── */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.4, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); composer.setSize(r.width, r.height);
  const aspect = r.width / r.height, h = Math.max(22.5, (aspect < 0.8 ? 27 : 33) / aspect);
  Object.assign(camera, { left: -h * aspect / 2, right: h * aspect / 2, top: h / 2, bottom: -h / 2 });
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
setTOD(params.get("tod") || "night");

/* ───────────── loop ───────────── */
const camDir = new THREE.Vector3();
let lastSec = -1;
await document.fonts.ready.catch(() => {});
await Promise.all(["900 40px Orbitron", "600 20px 'Geist Mono'"].map((f) => document.fonts.load(f).catch(() => {})));
drawBoard(); drawClocks(); renderHUD();
function frame() {
  const now = performance.now();
  controls.update();
  if (tickScript()) { renderHUD(); drawBoard(); }
  const sec = Math.floor(now / 1000);
  if (sec !== lastSec) {
    lastSec = sec; drawClocks(); drawBoard();
    const n = new Date(), mid = new Date(n); mid.setHours(0, 0, 0, 0);
    const el = Math.floor((n - mid) / 1000);
    $("#tclock").textContent = `T+ ${pad(Math.floor(el / 3600))}:${pad(Math.floor(el / 60) % 60)}:${pad(el % 60)}`;
    if (sec % 5 === 0) renderHUD();
  }
  drawVideoWall(now);
  camera.getWorldDirection(camDir);
  const camYaw = Math.atan2(-camDir.x, -camDir.z);
  for (const b of CFG.crew) {
    const B = bots3d[b.id]; if (!B) continue;
    const s = state.bots[b.id], col = STATUS[s.status].c;
    const talking = !!bubbles[b.id] || s.status === "needs_you" || s.status === "done" || s.status === "idle";
    const want = talking ? camYaw : -Math.PI / 2 + Math.sin(now / 1300 + B.phase) * 0.12;
    let d = want - B.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); B.yaw += d * 0.06;
    // face is local +z; rotation.y = yaw points it
    B.root.rotation.y = B.yaw;
    const hopT = B.hop ? (now - B.hop) / 450 : 9;
    const hop = hopT < 1 ? Math.sin(hopT * Math.PI) * 0.35 : 0;
    const busy = WORKING.includes(s.status) ? 0.035 : 0.015;
    B.body.position.y = 0.85 + Math.sin(now / 380 + B.phase) * busy + hop;
    B.body.rotation.z = s.status === "thinking" ? Math.sin(now / 600 + B.phase) * 0.12 : s.status === "error" ? Math.sin(now / 60) * 0.06 : 0;
    const seat = B.seat, pulse = s.status === "needs_you" || s.status === "error" ? 0.6 + 0.4 * Math.sin(now / 220) : 1;
    seat.ring.material.color.set(col).multiplyScalar(1.6 * pulse);
    seat.glow.material.color.set(col).multiplyScalar(0.9 * pulse);
    for (const sc of seat.screens) sc.material.color.set(s.status === "idle" ? "#222" : col).multiplyScalar(0.55 + 0.1 * Math.sin(now / 90 + B.phase));
  }
  composer.render();
  placeLabels(now);
  requestAnimationFrame(frame);
}
frame();
window.__office = { state, setFocus, setTOD };
