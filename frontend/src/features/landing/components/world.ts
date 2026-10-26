import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export interface WorldControl {
  /** スクロール進行 0〜1 */
  progress: number;
}
export interface WorldHooks {
  onFrame: (smoothProgress: number) => void;
}
export interface WorldHandle {
  dispose: () => void;
  /** ローダーが終わったら呼ぶ。入場のカメラワークが始まる */
  start: () => void;
}

const BG = "#05070A";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hdr = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

/** カメラが通る道（位置）と、見つめる先 */
const PATH = [
  [-40, 62, 70],
  [20, 44, 42],
  [70, 26, 16],
  [115, 9, 0],
  [170, 7, 1],
  [225, 24, -3],
  [285, 11, 5],
  [340, 6, 0],
  [395, 30, 8],
  [450, 52, 24],
  [510, 78, 46],
  [560, 100, 70],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const LOOK = [
  [60, 30, 0],
  [90, 25, 0],
  [130, 14, 0],
  [165, 10, -2],
  [225, 18, 2],
  [275, 14, 2],
  [335, 10, 0],
  [390, 18, -2],
  [450, 36, 0],
  [500, 48, 0],
  [540, 55, 0],
  [580, 60, 0],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

const RGB_SHIFT = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.0015 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c);
      vec2 off = c * d * uAmount * 6.0;
      float r = texture2D(tDiffuse, vUv + off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - off).b;
      float vig = smoothstep(0.9, 0.2, d);
      gl_FragColor = vec4(vec3(r, g, b) * mix(0.5, 1.0, vig), 1.0);
    }
  `,
};

interface Inst {
  m: THREE.Matrix4;
  c?: THREE.Color;
}

export function createWorld(
  canvas: HTMLCanvasElement,
  control: WorldControl,
  hooks: WorldHooks,
  reduceMotion: boolean,
): WorldHandle {
  const small = window.innerWidth < 768;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  const pr = Math.min(window.devicePixelRatio, small ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.setClearColor(BG);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, small ? 0.0085 : 0.0068);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
  scene.add(camera);

  // --- 光 ---
  scene.add(new THREE.AmbientLight("#8aa3a0", 0.55));
  const keyA = new THREE.DirectionalLight("#bff5e6", 2.6);
  keyA.position.set(-60, 100, 40);
  scene.add(keyA);
  const keyB = new THREE.DirectionalLight("#ff9aa8", 1.5);
  keyB.position.set(80, 40, -60);
  scene.add(keyB);
  const camLight = new THREE.PointLight("#6EE7C8", 650, 80, 2);
  camera.add(camLight);

  // --- ローソク足の街 ---
  const N = small ? 110 : 150;
  const SP = 4;
  const X0 = -24;
  const rowsZ = small ? [-9, 9, -20, 20] : [-9, 9, -20, 20, -31, 31];

  const up: Inst[] = [];
  const dn: Inst[] = [];
  const upMir: Inst[] = [];
  const dnMir: Inst[] = [];
  const caps: Inst[] = [];
  const capsMir: Inst[] = [];
  const wicks: Inst[] = [];
  const emaPts: Record<number, THREE.Vector3[]> = {};

  const q = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const mat = (
    px: number,
    py: number,
    pz: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    P.set(px, py, pz);
    S.set(sx, sy, sz);
    return new THREE.Matrix4().compose(P, q, S);
  };
  const GREEN = "#6EE7C8";
  const RED = "#FF7A8A";

  rowsZ.forEach((rz, ri) => {
    const rnd = mulberry32(1000 + ri * 77);
    let price = 26 + (ri % 3) * 7;
    let ema = price;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const o = price;
      const c = Math.max(8, o + (rnd() - 0.46) * 15 + 0.5);
      const hi = Math.max(o, c) + 1 + rnd() * 5;
      const lo = Math.min(o, c) - 1 - rnd() * 5;
      price = c;
      ema += (c - ema) * 0.14;
      const x = X0 + i * SP + (rnd() - 0.5) * 0.4;
      const z = rz + (rnd() - 0.5) * 3;
      const w = 2.2 + rnd() * 0.6;
      const bh = Math.max(1.2, Math.abs(c - o));
      const by = (o + c) / 2;
      const top = Math.max(o, c);
      const isUp = c >= o;
      const col = hdr(isUp ? GREEN : RED, isUp ? 2.4 : 2.2);
      const body = { m: mat(x, by, z, w, bh, w) };
      const bodyMir = { m: mat(x, -by, z, w, -bh, w) };
      (isUp ? up : dn).push(body);
      (isUp ? upMir : dnMir).push(bodyMir);
      caps.push({ m: mat(x, top + 0.08, z, w + 0.1, 0.18, w + 0.1), c: col });
      capsMir.push({
        m: mat(x, -top - 0.08, z, w + 0.1, -0.18, w + 0.1),
        c: col.clone().multiplyScalar(0.3),
      });
      wicks.push({
        m: mat(x, (hi + lo) / 2, z, 0.16, hi - lo, 0.16),
        c: hdr(isUp ? GREEN : RED, 1.1),
      });
      pts.push(new THREE.Vector3(x, ema, rz));
    }
    emaPts[ri] = pts;
  });

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const mk = (
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    items: Inst[],
  ) => {
    const im = new THREE.InstancedMesh(geo, material, items.length);
    items.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      if (it.c) im.setColorAt(i, it.c);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    scene.add(im);
    return im;
  };

  const upMat = new THREE.MeshStandardMaterial({
    color: "#1c4a3d",
    emissive: "#2fbf9d",
    emissiveIntensity: 0.28,
    roughness: 0.38,
    metalness: 0.55,
  });
  const dnMat = new THREE.MeshStandardMaterial({
    color: "#4d1f29",
    emissive: "#cc4457",
    emissiveIntensity: 0.26,
    roughness: 0.38,
    metalness: 0.55,
  });
  const mirUp = new THREE.MeshBasicMaterial({
    color: "#0d2a24",
    side: THREE.DoubleSide,
  });
  const mirDn = new THREE.MeshBasicMaterial({
    color: "#2a1117",
    side: THREE.DoubleSide,
  });
  const capMat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    toneMapped: false,
  });
  const capMirMat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const wickMat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    toneMapped: false,
  });

  mk(unit, upMat, up);
  mk(unit, dnMat, dn);
  mk(unit, mirUp, upMir);
  mk(unit, mirDn, dnMir);
  mk(unit, capMat, caps);
  mk(unit, capMirMat, capsMir);
  mk(unit, wickMat, wicks);

  // --- 床と格子 ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 700),
    new THREE.MeshStandardMaterial({
      color: "#080b0e",
      roughness: 0.3,
      metalness: 0.85,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(300, 0, 0);
  floor.renderOrder = 1;
  scene.add(floor);
  const grid = new THREE.GridHelper(1500, 150, "#6EE7C8", "#6EE7C8");
  (grid.material as THREE.LineBasicMaterial).transparent = true;
  (grid.material as THREE.LineBasicMaterial).opacity = 0.11;
  (grid.material as THREE.LineBasicMaterial).depthWrite = false;
  grid.position.set(300, 0.03, 0);
  grid.renderOrder = 2;
  scene.add(grid);

  // --- 移動平均線（光る帯） ---
  const tubeMat = new THREE.MeshBasicMaterial({
    color: hdr("#F5B94A", 1.7),
    toneMapped: false,
  });
  const tubes: THREE.Mesh[] = [];
  [0, 1].forEach((ri) => {
    const curve = new THREE.CatmullRomCurve3(emaPts[ri]);
    const geo = new THREE.TubeGeometry(curve, N * 2, 0.3, 6, false);
    const t = new THREE.Mesh(geo, tubeMat);
    scene.add(t);
    tubes.push(t);
  });

  // --- 光の柱（エントリーと決済） ---
  const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, 260, 8, 1, true);
  const beams: THREE.Mesh[] = [];
  [
    [95, GREEN, 3],
    [190, RED, -3],
    [298, GREEN, 3],
    [412, GREEN, -3],
    [505, RED, 3],
  ].forEach(([x, c, z]) => {
    const m = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: hdr(c as string, 1.8),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    m.position.set(x as number, 120, z as number);
    scene.add(m);
    beams.push(m);
  });

  // --- くぐり抜けるゲート ---
  const gateGeo = new THREE.BufferGeometry().setFromPoints(
    [
      [0, 0, -12],
      [0, 46, -12],
      [0, 46, 12],
      [0, 0, 12],
      [0, 0, -12],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const gates: THREE.Line[] = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Line(
      gateGeo,
      new THREE.LineBasicMaterial({
        color: hdr(i % 3 === 1 ? RED : GREEN, 1.6),
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    g.position.set(75 + i * 42, 0, 0);
    scene.add(g);
    gates.push(g);
  }

  // --- ちり ---
  const dustN = small ? 700 : 1800;
  const dp = new Float32Array(dustN * 3);
  const rd = mulberry32(5);
  for (let i = 0; i < dustN; i++) {
    dp[i * 3] = -40 + rd() * 640;
    dp[i * 3 + 1] = 1 + rd() * 120;
    dp[i * 3 + 2] = -40 + rd() * 80;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: "#8FF0D8",
      size: 0.35,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dust);

  // --- ポスト処理 ---
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    small ? 0.7 : 0.95,
    0.65,
    0.5,
  );
  composer.addPass(bloom);
  const shift = new ShaderPass(RGB_SHIFT);
  composer.addPass(shift);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const mouse = new THREE.Vector2();
  const mouseS = new THREE.Vector2();
  const onMove = (e: PointerEvent) => {
    mouse.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1,
    );
  };
  if (!reduceMotion)
    window.addEventListener("pointermove", onMove, { passive: true });

  const path = new THREE.CatmullRomCurve3(PATH, false, "centripetal");
  const look = new THREE.CatmullRomCurve3(LOOK, false, "centripetal");
  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const tan0 = new THREE.Vector3();
  const tan1 = new THREE.Vector3();

  let started = reduceMotion;
  let startAt = -99;
  let pS = control.progress;
  let vel = 0;
  let raf = 0;
  let alive = true;
  const clock = new THREE.Clock();

  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = reduceMotion ? 0 : clock.elapsedTime;
    if (started && startAt === -99) startAt = time;

    const d = control.progress - pS;
    pS += reduceMotion ? d : d * Math.min(1, dt * 3);
    vel += (Math.min(1, Math.abs(d) * 45) - vel) * Math.min(1, dt * 4);
    mouseS.lerp(mouse, Math.min(1, dt * 3));

    const u = Math.min(0.9999, Math.max(0.0001, pS));
    path.getPointAt(u, pos);
    look.getPointAt(u, tgt);
    path.getTangentAt(u, tan0);
    path.getTangentAt(Math.min(0.9999, u + 0.02), tan1);

    // 入場：少し広角から締まる
    const it = started ? Math.min(1, (time - startAt) / 2.6) : 0;
    const ease = 1 - Math.pow(1 - it, 3);
    renderer.toneMappingExposure = 1.05 * (0.15 + 0.85 * ease);

    const bank = THREE.MathUtils.clamp((tan1.z - tan0.z) * -7, -0.35, 0.35);
    camera.position.copy(pos);
    camera.up.set(0, Math.cos(bank), Math.sin(bank));
    camera.lookAt(tgt);
    camera.translateX(mouseS.x * 1.6);
    camera.translateY(-mouseS.y * 0.9);
    camera.fov = 58 + vel * 14 + (1 - ease) * 34;
    camera.updateProjectionMatrix();

    shift.uniforms.uAmount.value = 0.0012 + vel * 0.012 + (1 - ease) * 0.01;
    dust.position.y = Math.sin(time * 0.3) * 0.6;
    beams.forEach((b, i) => {
      (b.material as THREE.MeshBasicMaterial).opacity =
        0.42 + Math.sin(time * 1.6 + i) * 0.14;
    });

    hooks.onFrame(pS);
    composer.render();
  };
  raf = requestAnimationFrame(frame);

  return {
    start: () => {
      started = true;
    },
    dispose: () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      unit.dispose();
      beamGeo.dispose();
      gateGeo.dispose();
      dustGeo.dispose();
      tubes.forEach((t) => t.geometry.dispose());
      [upMat, dnMat, mirUp, mirDn, capMat, capMirMat, wickMat, tubeMat].forEach(
        (m) => m.dispose(),
      );
      beams.forEach((b) => (b.material as THREE.Material).dispose());
      gates.forEach((g) => (g.material as THREE.Material).dispose());
      (dust.material as THREE.Material).dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
