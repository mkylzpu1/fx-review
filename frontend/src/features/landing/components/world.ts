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
const EXPOSURE = 1.4;

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
  /** 生え方の計算用（位置・大きさ・伸びる起点の高さ） */
  x: number;
  py: number;
  pz: number;
  sx: number;
  sy: number;
  sz: number;
  ay: number;
  g: number;
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
  let pr = Math.min(window.devicePixelRatio, small ? 1 : 1.25);
  renderer.setPixelRatio(pr);
  renderer.setClearColor(BG);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;

  const scene = new THREE.Scene();
  const fogBase = small ? 0.0085 : 0.0068;
  scene.fog = new THREE.FogExp2(BG, fogBase);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
  scene.add(camera);

  // --- 光 ---
  scene.add(new THREE.AmbientLight("#9db5b2", 1.0));
  const keyA = new THREE.DirectionalLight("#bff5e6", 3.4);
  keyA.position.set(-60, 100, 40);
  scene.add(keyA);
  const keyB = new THREE.DirectionalLight("#ff9aa8", 2.0);
  keyB.position.set(80, 40, -60);
  scene.add(keyB);

  // --- ローソク足の街 ---
  const N = small ? 110 : 150;
  const SP = 4;
  const X0 = -24;
  // チャートは1本だけ。複数並べると散らかって見え、描画も重くなる
  const rowsZ = [0];

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
      const z = rz;
      const w = 2.2 + rnd() * 0.6;
      const bh = Math.max(1.2, Math.abs(c - o));
      const by = (o + c) / 2;
      const top = Math.max(o, c);
      const isUp = c >= o;
      const col = hdr(isUp ? GREEN : RED, isUp ? 2.4 : 2.2);
      const I = (
        py: number,
        sx: number,
        sy: number,
        ay: number,
        c?: THREE.Color,
      ): Inst => ({
        m: mat(x, py, z, sx, sy, sx),
        c,
        x,
        py,
        pz: z,
        sx,
        sy,
        sz: sx,
        ay,
        g: 1,
      });
      (isUp ? up : dn).push(I(by, w, bh, by));
      (isUp ? upMir : dnMir).push(I(-by, w, -bh, -by));
      caps.push(I(top + 0.08, w + 0.1, 0.18, by, col));
      capsMir.push(
        I(-top - 0.08, w + 0.1, -0.18, -by, col.clone().multiplyScalar(0.3)),
      );
      wicks.push(
        I((hi + lo) / 2, 0.16, hi - lo, by, hdr(isUp ? GREEN : RED, 1.1)),
      );
      pts.push(new THREE.Vector3(x, ema, rz));
    }
    emaPts[ri] = pts;
  });

  const parts: { im: THREE.InstancedMesh; items: Inst[] }[] = [];
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
    parts.push({ im, items });
    return im;
  };

  const upMat = new THREE.MeshStandardMaterial({
    color: "#1c4a3d",
    emissive: "#2fbf9d",
    emissiveIntensity: 0.45,
    roughness: 0.38,
    metalness: 0.55,
  });
  const dnMat = new THREE.MeshStandardMaterial({
    color: "#4d1f29",
    emissive: "#cc4457",
    emissiveIntensity: 0.42,
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

  // --- 進むにつれてローソク足が育つ ---
  const GROW_W = 44;
  const END_X = X0 + (N - 1) * SP;
  const M4 = new THREE.Matrix4();
  const PV = new THREE.Vector3();
  const SV = new THREE.Vector3();
  let lastFront = -1;
  const setReveal = (front: number) => {
    parts.forEach(({ im, items }) => {
      let dirty = false;
      items.forEach((it, i) => {
        const t = THREE.MathUtils.clamp((front - it.x) / GROW_W, 0, 1);
        // まだ育っていないものは、潰れた線ではなく完全に隠す
        const g = t === 0 ? 0 : 1 - Math.pow(1 - t, 3);
        if (g === it.g) return;
        it.g = g;
        if (g === 0) {
          PV.set(it.x, it.py, it.pz);
          SV.set(1e-6, 1e-6, 1e-6);
        } else {
          PV.set(it.x, it.ay + (it.py - it.ay) * g, it.pz);
          SV.set(it.sx, it.sy * g, it.sz);
        }
        M4.compose(PV, q, SV);
        im.setMatrixAt(i, M4);
        dirty = true;
      });
      if (dirty) im.instanceMatrix.needsUpdate = true;
    });
  };
  setReveal(reduceMotion ? 1e9 : 60);

  // --- 床と格子 ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 700),
    new THREE.MeshBasicMaterial({
      color: "#0b1014",
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
  (grid.material as THREE.LineBasicMaterial).opacity = 0.16;
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
  const emaCurve = new THREE.CatmullRomCurve3(emaPts[0]);
  {
    const geo = new THREE.TubeGeometry(emaCurve, N * 2, 0.3, 6, false);
    const t = new THREE.Mesh(geo, tubeMat);
    scene.add(t);
    tubes.push(t);
  }

  // --- 移動平均線を流れる光（価格の流れ） ---
  const cometGeo = new THREE.SphereGeometry(0.9, 12, 12);
  const cometMat = new THREE.MeshBasicMaterial({
    color: hdr("#FFE3A3", 3),
    toneMapped: false,
  });
  const trailGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const trailMat = new THREE.MeshBasicMaterial({
    color: hdr("#F5B94A", 2),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const COMETS = 4;
  const TRAIL = 2;
  const comets: { head: THREE.Mesh; trail: THREE.Mesh[] }[] = [];
  for (let i = 0; i < COMETS; i++) {
    const head = new THREE.Mesh(cometGeo, cometMat);
    scene.add(head);
    const trail: THREE.Mesh[] = [];
    for (let k = 0; k < TRAIL; k++) {
      const t = new THREE.Mesh(trailGeo, trailMat);
      t.scale.setScalar(1 - k / (TRAIL + 1));
      scene.add(t);
      trail.push(t);
    }
    comets.push({ head, trail });
  }
  const cp = new THREE.Vector3();

  // --- ちり ---
  const dustN = small ? 300 : 800;
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

  // --- カメラワーク：チャートの高さに沿って、横・下・上・裏と見せ場を巡る ---
  const emaAt = (x: number) => {
    const f = Math.min(N - 1, Math.max(0, (x - X0) / SP));
    const i = Math.min(N - 2, Math.floor(f));
    return THREE.MathUtils.lerp(emaPts[0][i].y, emaPts[0][i + 1].y, f - i);
  };
  // [カメラx, 線からの高さ, カメラz, 注視x, 注視の高さ, 注視z]
  // 酔わないよう、距離をとって同じ側からゆっくり進む
  const KEYS = [
    [-60, 60, 130, 40, 5, 0], // 全景
    [80, 55, 140, 170, 5, 0],
    [210, 50, 140, 290, 8, 0],
    [340, 75, 140, 410, 0, 0],
    [410, 70, 200, 350, 5, 0], // 遠ざかりながら
    [300, 25, 330, 300, 5, 0], // 遠くから正面でチャート全体を捉える
  ];
  const path = new THREE.CatmullRomCurve3(
    KEYS.map(
      ([cx, dy, cz]) => new THREE.Vector3(cx, Math.max(4, emaAt(cx) + dy), cz),
    ),
    false,
    "centripetal",
  );
  const look = new THREE.CatmullRomCurve3(
    KEYS.map(
      ([, , , lx, ldy, lz]) => new THREE.Vector3(lx, emaAt(lx) + ldy, lz),
    ),
    false,
    "centripetal",
  );
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

  // 画面外・非表示タブでは描画を止める（無駄なGPU負荷を避ける）
  let frames = 0;
  let accDt = 0;
  let accN = 0;
  let visible = true;
  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
    },
    { threshold: 0 },
  );
  io.observe(canvas);

  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) {
      clock.getDelta();
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);

    // 端末が重いときは解像度を段階的に下げる（最初の読み込み直後は除く）
    if (++frames > 90) {
      accDt += dt;
      if (++accN >= 40) {
        if (accDt / accN > 0.024 && pr > 0.75) {
          pr = Math.max(0.75, pr - 0.25);
          renderer.setPixelRatio(pr);
          resize();
        }
        accDt = 0;
        accN = 0;
      }
    }
    const time = reduceMotion ? 0 : clock.elapsedTime;
    if (started && startAt === -99) startAt = time;

    const d = control.progress - pS;
    pS += reduceMotion ? d : d * Math.min(1, dt * 1.6);
    vel += (Math.min(1, Math.abs(d) * 45) - vel) * Math.min(1, dt * 4);
    mouseS.lerp(mouse, Math.min(1, dt * 3));

    const u = Math.min(0.9999, Math.max(0.0001, pS));
    const fogK = THREE.MathUtils.smoothstep(u, 0.7, 1);
    (scene.fog as THREE.FogExp2).density = fogBase * (1 - 0.8 * fogK);

    // 進行に合わせて、右（未来）へ向かってローソク足と移動平均線が伸びる
    const front = reduceMotion
      ? 1e9
      : THREE.MathUtils.lerp(
          60,
          END_X + GROW_W + 8,
          THREE.MathUtils.clamp(u / 0.85, 0, 1),
        );
    if (front !== lastFront) {
      lastFront = front;
      setReveal(front);
    }
    const frac = THREE.MathUtils.clamp((front - X0) / (END_X - X0), 0.02, 1);
    const emaGeo = tubes[0].geometry;
    if (emaGeo.index) {
      const per = emaGeo.index.count / (N * 2);
      emaGeo.setDrawRange(0, Math.floor(frac * N * 2) * per);
    }
    path.getPointAt(u, pos);
    look.getPointAt(u, tgt);
    path.getTangentAt(u, tan0);
    path.getTangentAt(Math.min(0.9999, u + 0.02), tan1);

    // 入場：少し広角から締まる
    const it = started ? Math.min(1, (time - startAt) / 2.6) : 0;
    const ease = 1 - Math.pow(1 - it, 3);
    renderer.toneMappingExposure = EXPOSURE * (0.15 + 0.85 * ease);

    const bank = THREE.MathUtils.clamp((tan1.z - tan0.z) * -7, -0.06, 0.06);
    camera.position.copy(pos);
    camera.up.set(0, Math.cos(bank), Math.sin(bank));
    camera.lookAt(tgt);
    camera.translateX(mouseS.x * 0.6);
    camera.translateY(-mouseS.y * 0.4);
    camera.fov = 50 + vel * 3 + (1 - ease) * 14;
    camera.updateProjectionMatrix();

    shift.uniforms.uAmount.value = 0.001 + vel * 0.003 + (1 - ease) * 0.004;
    dust.position.y = Math.sin(time * 0.3) * 0.6;
    comets.forEach((c, i) => {
      const base =
        (reduceMotion ? i / COMETS : (time * 0.045 + i / COMETS) % 1) * frac;
      emaCurve.getPointAt(base, cp);
      c.head.position.copy(cp).setY(cp.y + 0.8);
      c.trail.forEach((t, k) => {
        emaCurve.getPointAt(Math.max(0, base - (k + 1) * 0.012), cp);
        t.position.copy(cp).setY(cp.y + 0.8);
      });
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
      io.disconnect();
      unit.dispose();
      cometGeo.dispose();
      trailGeo.dispose();
      dustGeo.dispose();
      tubes.forEach((t) => t.geometry.dispose());
      [
        upMat,
        dnMat,
        mirUp,
        mirDn,
        capMat,
        capMirMat,
        wickMat,
        tubeMat,
        cometMat,
        trailMat,
      ].forEach((m) => m.dispose());
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
