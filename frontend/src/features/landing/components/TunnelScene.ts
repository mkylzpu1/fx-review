import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SECTIONS, TRAVEL_TOTAL, type LpSection } from "../sections";

export interface SceneControl {
  /** スクロール進行 0〜1 */
  progress: number;
}
export interface SceneHooks {
  onFrame: (smoothProgress: number, sectionIndex: number) => void;
}
export interface SceneHandle {
  dispose: () => void;
  /** ローダーが終わったら呼ぶ。入場のワープが始まる */
  start: () => void;
}

const L = 150; // トンネルの見える長さ

const VERT = /* glsl */ `
uniform float uTravel, uFlow, uRoll, uTime, uVel, uPx, uL, uMouseK;
uniform vec3 uMouse;
attribute vec4 aA;
attribute vec2 aB;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float kind = aA.x;
  float d = mod(aA.y - (uTravel + uFlow), uL);
  float s = uTravel + uFlow + d;
  float twist = 0.17 + 0.05 * sin(s * 0.04) + uVel * 0.5;
  float ang;
  float r;
  vec3 col;
  float size;
  if (kind < 2.5) {
    float base = kind * 2.0943951;
    ang = s * twist + base + uRoll + (aA.z - 0.5) * 0.6;
    r = 3.4 + 1.5 * sin(s * 0.07 + kind * 2.0) + (aA.w - 0.5) * 1.0 + (aB.x - 0.5) * 0.5;
    col = kind < 0.5 ? vec3(0.43, 0.91, 0.78) : (kind < 1.5 ? vec3(1.0, 0.48, 0.54) : vec3(0.85, 1.0, 0.95));
    size = 0.07;
  } else {
    ang = aA.z * 6.2831853 + s * 0.02 + uRoll * 0.5;
    r = 1.2 + aA.w * aA.w * 18.0;
    col = vec3(0.30, 0.50, 0.58);
    size = 0.05;
  }
  vec3 p = vec3(cos(ang) * r, sin(ang) * r, -(uTravel + d));
  p.x += sin(uTime * 0.8 + aB.x * 40.0) * 0.08;
  p.y += cos(uTime * 0.9 + aB.y * 40.0) * 0.08;

  vec3 dm = p - uMouse;
  float dist = length(dm);
  float f = smoothstep(5.5, 0.0, dist) * uMouseK;
  vec3 tang = normalize(vec3(-dm.y, dm.x, 0.0) + 0.0001);
  p += normalize(dm + 0.0001) * f * 2.2 + tang * f * 1.6;

  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * (0.6 + aB.y) * uPx / max(-mv.z, 0.1), 1.0, 14.0);
  vColor = col * (0.75 + f * 2.5 + uVel * 1.8);
  float fade = smoothstep(0.0, 4.0, d) * (1.0 - smoothstep(uL * 0.5, uL, d));
  vAlpha = fade * (kind < 2.5 ? 1.0 : 0.55);
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, r);
  a *= a;
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

const RGB_SHIFT = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.002 } },
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
      float vig = smoothstep(0.95, 0.25, d);
      gl_FragColor = vec4(vec3(r, g, b) * mix(0.55, 1.0, vig), 1.0);
    }
  `,
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      out.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) out.push(line);
  return out;
}

function makeTextTexture(sec: LpSection, maxAniso: number) {
  const W = 2048;
  const H = 1024;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const FONT = '"Noto Sans JP", system-ui, sans-serif';

  const gap = 1.08;
  const total = sec.lines.reduce((a, l) => a + l.size * gap, 0);
  const captionH = sec.caption ? 150 : 0;
  let y = (H - total - captionH) / 2 + (sec.lines[0].size * gap) / 2;
  for (const l of sec.lines) {
    ctx.font = `700 ${l.size}px ${FONT}`;
    if (l.outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#6EE7C8";
      ctx.strokeText(l.text, W / 2 + 16, y + 16);
      ctx.fillStyle = "#F4F7FA";
      ctx.fillText(l.text, W / 2, y);
    } else {
      ctx.fillStyle = l.green ? "#6EE7C8" : "#F4F7FA";
      ctx.fillText(l.text, W / 2, y);
    }
    y += l.size * gap;
  }
  if (sec.caption) {
    ctx.font = `500 46px ${FONT}`;
    ctx.fillStyle = "rgba(210,220,230,0.85)";
    const rows = wrapText(ctx, sec.caption, 1300);
    y += 40;
    for (const r of rows) {
      ctx.fillText(r, W / 2, y);
      y += 66;
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso);
  return tex;
}

export async function createTunnelScene(
  canvas: HTMLCanvasElement,
  control: SceneControl,
  hooks: SceneHooks,
  reduceMotion: boolean,
): Promise<SceneHandle> {
  const small = window.innerWidth < 768;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  const pr = Math.min(window.devicePixelRatio, small ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.setClearColor("#05070A");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

  // フォント（日本語）を、文字テクスチャを作る前に読み込む
  try {
    const sample = SECTIONS.map(
      (s) => s.lines.map((l) => l.text).join("") + (s.caption ?? ""),
    ).join("");
    await Promise.race([
      document.fonts.load('700 100px "Noto Sans JP"', sample),
      new Promise((r) => setTimeout(r, 3500)),
    ]);
    await document.fonts.load('500 46px "Noto Sans JP"', sample);
  } catch {
    /* フォールバックのフォントで描く */
  }

  // --- パーティクル（螺旋の帯3本 + ちり） ---
  const perStrand = small ? 7000 : 16000;
  const dustN = small ? 6000 : 16000;
  const N = perStrand * 3 + dustN;
  const aA = new Float32Array(N * 4);
  const aB = new Float32Array(N * 2);
  const pos = new Float32Array(N * 3); // 使わないが必須
  for (let i = 0; i < N; i++) {
    const strand = i < perStrand * 3 ? Math.floor(i / perStrand) : 3;
    aA[i * 4] = strand;
    aA[i * 4 + 1] = Math.random() * L;
    aA[i * 4 + 2] = Math.random();
    aA[i * 4 + 3] = Math.random();
    aB[i * 2] = Math.random();
    aB[i * 2 + 1] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aA", new THREE.BufferAttribute(aA, 4));
  geo.setAttribute("aB", new THREE.BufferAttribute(aB, 2));
  const uniforms = {
    uTravel: { value: 0 },
    uFlow: { value: 0 },
    uRoll: { value: 0 },
    uTime: { value: 0 },
    uVel: { value: 0 },
    uPx: { value: 800 },
    uL: { value: L },
    uMouseK: { value: 0 },
    uMouse: { value: new THREE.Vector3(0, 0, -10) },
  };
  const pmat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, pmat);
  points.frustumCulled = false;
  scene.add(points);

  // --- 通り抜けるリング ---
  const ringPts: THREE.Vector3[] = [];
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a) * 7.2, Math.sin(a) * 7.2, 0));
  }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
  const rings: { line: THREE.LineLoop; s: number; dir: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.LineBasicMaterial({
      color: i % 3 === 1 ? "#FF7A8A" : "#6EE7C8",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.LineLoop(ringGeo, mat);
    scene.add(line);
    rings.push({ line, s: 6 + i * 8.2, dir: i % 2 ? 1 : -1 });
  }

  // --- 空間に浮かぶ文字 ---
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const planeGeo = new THREE.PlaneGeometry(16, 8);
  const planes = SECTIONS.map((sec) => {
    const tex = makeTextTexture(sec, maxAniso);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(planeGeo, mat);
    scene.add(mesh);
    return { sec, mesh, mat, tex };
  });

  // --- ポスト処理 ---
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    small ? 0.55 : 0.8,
    0.7,
    0.12,
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
    uniforms.uPx.value =
      (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  };
  resize();
  window.addEventListener("resize", resize);

  const mouse = new THREE.Vector2(0, 0);
  const mouseS = new THREE.Vector2(0, 0);
  let mouseSeen = false;
  const onMove = (e: PointerEvent) => {
    mouse.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    mouseSeen = true;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let started = reduceMotion;
  let startAt = reduceMotion ? -10 : 0;
  let pS = control.progress;
  let vel = 0;
  let raf = 0;
  let alive = true;
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = reduceMotion ? 0 : clock.elapsedTime;
    if (started && startAt === 0) startAt = time;

    const dp = control.progress - pS;
    pS += dp * Math.min(1, dt * 3.2);
    vel += (Math.min(1, Math.abs(dp) * 55) - vel) * Math.min(1, dt * 4);

    // 入場：奥から一気に飛び込む
    const it = started ? Math.min(1, (time - startAt) / 3.2) : 0;
    const ease = 1 - Math.pow(1 - it, 4);
    const intro = (1 - ease) * 70;
    const travelCam = pS * TRAVEL_TOTAL - intro;
    const introVel = (1 - ease) * (started ? 0.9 : 0);

    mouseS.lerp(mouse, Math.min(1, dt * 4));
    camera.position.set(mouseS.x * 0.7, mouseS.y * 0.45, -travelCam);
    camera.rotation.set(mouseS.y * 0.05, -mouseS.x * 0.07, -mouseS.x * 0.04);

    tmp
      .set(mouseS.x, mouseS.y, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    uniforms.uMouse.value.copy(camera.position).addScaledVector(tmp, 11);
    uniforms.uMouseK.value +=
      ((mouseSeen ? 1 : 0) - uniforms.uMouseK.value) * Math.min(1, dt * 2);

    uniforms.uTravel.value = travelCam;
    uniforms.uFlow.value = time * 2.2;
    uniforms.uRoll.value = pS * Math.PI * 2 * 1.7 + time * 0.12;
    uniforms.uTime.value = time;
    uniforms.uVel.value = Math.min(1.4, vel + introVel);
    shift.uniforms.uAmount.value =
      0.0016 + Math.min(1.4, vel + introVel) * 0.012;

    for (const r of rings) {
      const dist = r.s - travelCam;
      r.line.position.z = -r.s;
      r.line.rotation.z =
        r.dir * (time * 0.25 + r.s * 0.12) + uniforms.uRoll.value * 0.6;
      const op = smooth(1, 5, dist) * (1 - smooth(28, 55, dist));
      (r.line.material as THREE.LineBasicMaterial).opacity = op * 0.5;
      r.line.visible = op > 0.01;
    }

    const k = Math.min(1, camera.aspect * 0.6);
    let nearest = -1;
    let nearestD = 99;
    planes.forEach((p, i) => {
      const dist = p.sec.s - travelCam;
      const op = smooth(30, 17, dist) * smooth(2.5, 7, dist);
      p.mat.opacity = op;
      p.mesh.visible = op > 0.005;
      const grow = 1 + (1 - Math.min(1, Math.max(0, dist / 30))) * 0.18;
      p.mesh.scale.setScalar(k * grow);
      p.mesh.position.set(
        p.sec.x * k + mouseS.x * 0.35,
        Math.sin(time * 0.5 + i) * 0.12 + mouseS.y * 0.2,
        -p.sec.s,
      );
      p.mesh.rotation.set(0, p.sec.yaw + mouseS.x * 0.06, 0);
      const dd = Math.abs(dist - 10);
      if (dist > 2 && dist < 24 && dd < nearestD) {
        nearestD = dd;
        nearest = i;
      }
    });

    hooks.onFrame(pS, nearest);
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
      geo.dispose();
      pmat.dispose();
      ringGeo.dispose();
      rings.forEach((r) => (r.line.material as THREE.Material).dispose());
      planeGeo.dispose();
      planes.forEach((p) => {
        p.tex.dispose();
        p.mat.dispose();
      });
      composer.dispose();
      renderer.dispose();
    },
  };
}
