import * as THREE from "three";

/** スクロール進行(0〜1)と、ホバー中の項目(0〜4。なければ -1)を外から渡す */
export interface FieldControl {
  progress: number;
  focus: number;
}

const GREEN = new THREE.Color("#6EE7C8");
const RED = new THREE.Color("#FF7A8A");
const WHITE = new THREE.Color("#ffffff");

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * ローソク足を敷き詰めた3Dフィールド。
 * 上から順に「ばらばらな記録」→「見返して整った上昇」へ、スクロールで変わる。
 */
export function createCandleField(
  canvas: HTMLCanvasElement,
  control: FieldControl,
  reduceMotion: boolean,
) {
  const small = window.innerWidth < 768;
  const COLS = small ? 46 : 84;
  const ROWS = small ? 12 : 18;
  const COUNT = COLS * ROWS;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !small,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.setClearColor("#0E1116");

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#0E1116", 14, 46);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);

  const body = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.5, 1, 0.5),
    new THREE.MeshBasicMaterial({ fog: true }),
    COUNT,
  );
  const wick = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 1, 0.05),
    new THREE.MeshBasicMaterial({ fog: true }),
    COUNT,
  );
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wick.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(body, wick);

  // 浮かぶ粒
  const dustN = small ? 120 : 320;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (hash(i + 1) - 0.5) * 60;
    dustPos[i * 3 + 1] = hash(i + 91) * 14 + 0.5;
    dustPos[i * 3 + 2] = (hash(i + 311) - 0.5) * 40;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      size: 0.06,
      color: "#8FF0D8",
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  scene.add(dust);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();

  const mouse = new THREE.Vector2(0, 0);
  const mouseSmooth = new THREE.Vector2(0, 0);
  const target = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  let pSmooth = 0;
  let focusSmooth = 0;
  let raf = 0;
  let running = true;
  const clock = new THREE.Clock();

  const onMove = (e: PointerEvent) => {
    mouse.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  /** 価格の線。chaos が高いほどばらばら、低いほど整った上昇 */
  const price = (x: number, r: number, t: number, chaos: number) => {
    const wild =
      Math.sin(x * 0.55 + r * 2.1 + t * 0.6) * 1.1 +
      Math.sin(x * 1.37 + r * 5.3 - t * 0.9) * 0.8 +
      (hash(Math.floor(x * 2) + r * 57) - 0.5) * 2.6;
    const trend = x * 0.06 + Math.sin(x * 0.22 + r * 0.4) * 0.5;
    return wild * chaos + trend * (1 - chaos * 0.5) + 1.5;
  };

  const frame = () => {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = reduceMotion ? 2 : clock.elapsedTime;

    pSmooth += (control.progress - pSmooth) * Math.min(1, dt * 3);
    focusSmooth += (control.focus - focusSmooth) * Math.min(1, dt * 5);
    mouseSmooth.lerp(mouse, Math.min(1, dt * 4));

    const p = pSmooth;
    // 0→0.55 はばらばらから整う。以降は整ったまま
    const chaos = THREE.MathUtils.clamp(1 - p * 1.8, 0.08, 1);

    // カメラ：高い位置から、低く這うように進む
    const camY = THREE.MathUtils.lerp(11, 3.2, Math.min(1, p * 1.4));
    const camZ = THREE.MathUtils.lerp(16, 9, p);
    const camX = THREE.MathUtils.lerp(-8, 6, p) + mouseSmooth.x * 1.2;
    camera.position.set(camX, camY + mouseSmooth.y * 0.6, camZ);
    target.set(THREE.MathUtils.lerp(-2, 10, p), 1.2, -2);
    camera.lookAt(target);

    // マウス位置を地面へ投影
    ray.setFromCamera(mouseSmooth, camera);
    const has = ray.ray.intersectPlane(plane, hit);

    const spacingX = 0.72;
    const spacingZ = 1.5;
    const x0 = -(COLS * spacingX) / 2 + 8;

    for (let r = 0; r < ROWS; r++) {
      const z = -r * spacingZ + 3;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const wx = x0 + c * spacingX;
        const a = price(c * 0.5, r, t * 0.5, chaos);
        const b = price((c + 1) * 0.5, r, t * 0.5, chaos);
        let open = a;
        let close = b;

        // ホバー項目に応じた形：0=取り込み(流れ) 1=見返し(カーソル強) 2=ルール(格子) 3=週次(波) 4=AI(上昇)
        let lift = 0;
        if (focusSmooth > -0.5) {
          const f = focusSmooth;
          const wave = Math.sin(c * 0.5 - t * 2 + r * 0.3);
          if (f < 0.5) lift = Math.max(0, wave) * 1.2;
          else if (f < 1.5) lift = 0;
          else if (f < 2.5) lift = (c + r) % 4 === 0 ? 1.6 : -0.3;
          else if (f < 3.5) lift = Math.sin(r * 0.9 + t * 1.5) * 1.4;
          else lift = c * 0.04 + 0.4;
          lift *= 0.7;
        }
        open += lift * 0.5;
        close += lift;

        let glow = 0;
        if (has) {
          const dx = wx - hit.x;
          const dz = z - hit.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          const radius = focusSmooth > 0.5 && focusSmooth < 1.5 ? 6 : 3.4;
          glow = Math.max(0, 1 - d / radius);
          const swell = glow * glow * 2.2;
          close += swell;
          open -= swell * 0.3;
        }

        const up = close >= open;
        const hi = Math.max(open, close) + 0.25 + hash(i) * 0.9 * (0.4 + chaos);
        const lo =
          Math.min(open, close) - 0.25 - hash(i + 7) * 0.9 * (0.4 + chaos);
        const bodyH = Math.max(0.08, Math.abs(close - open));
        const bodyY = (Math.min(open, close) + Math.max(open, close)) / 2;

        pos.set(wx, bodyY * 0.8, z);
        scl.set(1, bodyH * 0.8, 1);
        m.compose(pos, q, scl);
        body.setMatrixAt(i, m);

        pos.set(wx, ((hi + lo) / 2) * 0.8, z);
        scl.set(1, (hi - lo) * 0.8, 1);
        m.compose(pos, q, scl);
        wick.setMatrixAt(i, m);

        // 色：整うほど緑が増える（chaos が高いと赤が混ざる）
        const redBias = chaos * 0.35;
        const isUp = up && hash(i + 13) > redBias * (up ? 0.6 : 0);
        col.copy(isUp ? GREEN : RED);
        const depth = 0.28 + 0.5 * (1 - r / ROWS);
        col.multiplyScalar(depth + glow * 0.9);
        if (glow > 0.6) col.lerp(WHITE, (glow - 0.6) * 0.8);
        body.setColorAt(i, col);
        col.multiplyScalar(0.8);
        wick.setColorAt(i, col);
      }
    }
    body.instanceMatrix.needsUpdate = true;
    wick.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (wick.instanceColor) wick.instanceColor.needsUpdate = true;

    dust.rotation.y = t * 0.01;
    dust.position.y = Math.sin(t * 0.2) * 0.3;

    renderer.render(scene, camera);
    if (!reduceMotion) raf = requestAnimationFrame(frame);
  };

  const onVis = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!reduceMotion) {
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVis);
  raf = requestAnimationFrame(frame);

  // reduce-motion のときは、スクロール・リサイズ時だけ描き直す
  const redraw = () => {
    if (reduceMotion) requestAnimationFrame(frame);
  };
  window.addEventListener("scroll", redraw, { passive: true });
  window.addEventListener("resize", redraw);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", resize);
    window.removeEventListener("resize", redraw);
    window.removeEventListener("scroll", redraw);
    document.removeEventListener("visibilitychange", onVis);
    body.geometry.dispose();
    wick.geometry.dispose();
    (body.material as THREE.Material).dispose();
    (wick.material as THREE.Material).dispose();
    dustGeo.dispose();
    (dust.material as THREE.Material).dispose();
    body.dispose();
    wick.dispose();
    renderer.dispose();
  };
}
