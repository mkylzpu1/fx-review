import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";
import { ROUTES } from "@/constants/routes";
import {
  AiVisual,
  AppWindow,
  ImportVisual,
  ReviewVisual,
  RulesVisual,
  WeeklyVisual,
} from "../components/Visuals";
import "../landing.css";

const STATEMENT = [
  "ばらばらだった",
  "記録が、",
  "見返すうちに、",
  "ひとつの",
  "形に",
  "整っていく。",
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** ヒーローのカメラ位置。[進行, 上下の傾き, 左右の回り込み, 回転, 下げ幅(vh), 拡大, 分解度] */
const CAMERA: number[][] = [
  [0.0, 34, -16, 0, 34, 0.82, 0],
  [0.16, 22, 10, 0, 20, 0.92, 0],
  [0.3, 4, 0, 0, 3, 1.0, 0],
  [0.46, 8, -6, 0, 0, 1.0, 0],
  [0.58, 58, -30, 4, 0, 0.78, 1],
  [0.74, 24, 38, -5, 0, 0.9, 1],
  [0.88, 6, 10, 0, 0, 1.0, 0.3],
  [1.0, 0, 0, 0, 0, 1.1, 0],
];

function cameraAt(p: number): number[] {
  for (let i = 1; i < CAMERA.length; i++) {
    if (p <= CAMERA[i][0]) {
      const a = CAMERA[i - 1];
      const b = CAMERA[i];
      const t = smooth(a[0], b[0], p);
      return a.map((v, k) => v + (b[k] - v) * t);
    }
  }
  return CAMERA[CAMERA.length - 1];
}

/** 前後で薄く出入りするキャプション用 */
const band = (p: number, a: number, b: number, c: number, d: number) =>
  smooth(a, b, p) * (1 - smooth(c, d, p));

/** スクロール量に合わせて、[data-scene] の --p (0〜1) を更新する。ヒーローはカメラも動かす */
function useScrollScenes() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scene]"),
    );
    const hero = document.querySelector<HTMLElement>("[data-camera]");
    const device = hero?.querySelector<HTMLElement>(".lp-hero-device");
    let raf = 0;
    let camP = 0;
    let target = 0;
    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };

    const raw = () => {
      const vh = window.innerHeight;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const span = r.height - vh;
        const p = span > 0 ? clamp01(-r.top / span) : 0;
        el.style.setProperty("--p", p.toFixed(4));
        if (el === hero) target = p;
      }
    };

    const applyCamera = () => {
      if (!hero || !device) return;
      const [, rx, ry, rz, ty, sc0, ex] = cameraAt(camP);
      const vw = window.innerWidth;
      const sc =
        Math.min(sc0, vw < 700 ? sc0 * 0.98 : 9) * Math.min(1, vw / 900 + 0.25);
      device.style.setProperty("--rx", (rx + mouse.sy * -4).toFixed(2));
      device.style.setProperty("--ry", (ry + mouse.sx * 5).toFixed(2));
      device.style.setProperty("--rz", rz.toFixed(2));
      device.style.setProperty("--ty", ty.toFixed(2));
      device.style.setProperty("--sc", sc.toFixed(3));
      device.style.setProperty("--ex", ex.toFixed(3));
      hero.style.setProperty("--hd", (1 - smooth(0.05, 0.17, camP)).toFixed(3));
      hero.style.setProperty(
        "--o-a",
        band(camP, 0.3, 0.37, 0.47, 0.54).toFixed(3),
      );
      hero.style.setProperty(
        "--o-b",
        band(camP, 0.6, 0.67, 0.78, 0.84).toFixed(3),
      );
      hero.style.setProperty(
        "--o-c",
        band(camP, 0.88, 0.93, 1.01, 1.02).toFixed(3),
      );
    };

    // 慣性をつけて、カメラをなめらかに追従させる
    const loop = () => {
      camP += (target - camP) * 0.085;
      mouse.sx += (mouse.x - mouse.sx) * 0.06;
      mouse.sy += (mouse.y - mouse.sy) * 0.06;
      applyCamera();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    raw();
    if (reduce) camP = target;
    applyCamera();
    window.addEventListener("scroll", raw, { passive: true });
    window.addEventListener("resize", raw);
    if (!reduce) {
      window.addEventListener("pointermove", onMove, { passive: true });
      raf = requestAnimationFrame(loop);
    } else {
      const sync = () => {
        camP = target;
        applyCamera();
      };
      window.addEventListener("scroll", sync, { passive: true });
    }
    return () => {
      window.removeEventListener("scroll", raw);
      window.removeEventListener("resize", raw);
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}

function onTilt(e: React.PointerEvent<HTMLDivElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--ty", `${((x - 0.5) * 7).toFixed(2)}deg`);
  el.style.setProperty("--tx", `${((0.5 - y) * 7).toFixed(2)}deg`);
  el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
  el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
  el.setAttribute("data-hover", "true");
}
function onTiltEnd(e: React.PointerEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  el.style.setProperty("--ty", "0deg");
  el.style.setProperty("--tx", "0deg");
  el.removeAttribute("data-hover");
}

/** 画面に入ったら data-in="true" にする */
function InView({
  children,
  className,
  delay = 0,
  tilt = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      data-in={on}
      className={className}
      style={{ transitionDelay: `${delay}ms` }}
      onPointerMove={tilt ? onTilt : undefined}
      onPointerLeave={tilt ? onTiltEnd : undefined}
    >
      {children}
    </div>
  );
}

function Card({
  className,
  title,
  body,
  children,
}: {
  className: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <InView className={`lp-card ${className}`} tilt>
      <div className="lp-card-text">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      {children}
    </InView>
  );
}

/** FXレビューの紹介ページ（ログイン不要） */
export function LandingPage() {
  useScrollScenes();

  useEffect(() => {
    const prev = document.title;
    document.title = "FXレビュー｜トレードを見返して、次に活かす";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-nav-in">
          <a href="/lp" className="lp-brand">
            <BrandMark size={20} />
            FXレビュー
          </a>
          <div className="lp-nav-links">
            <a href="#features">できること</a>
            <Link to={ROUTES.GUIDE}>ご利用ガイド</Link>
            <Link to={ROUTES.LOGIN} className="lp-pill-sm">
              ログイン
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ヒーロー：画面の見本が、手前に起き上がってくる */}
        <section className="lp-hero" data-scene data-camera>
          <div className="lp-hero-stick">
            <div className="lp-hero-head">
              <h1>
                トレードを、
                <br />
                <span className="lp-grad">見返す。</span>
              </h1>
              <p>
                記録して、チャートで振り返り、決めたルールを守れたかを確かめる。
                <br className="lp-br" />
                FXトレードの振り返りに絞ったアプリです。
              </p>
              <div className="lp-actions">
                <Link to={ROUTES.LOGIN} className="lp-btn">
                  ログインして始める
                </Link>
                <Link to={ROUTES.GUIDE} className="lp-link">
                  ご利用ガイドを見る
                </Link>
              </div>
            </div>
            <div className="lp-hero-device">
              <AppWindow />
            </div>
            <p
              className="lp-cap"
              style={{ ["--o" as string]: "var(--o-a, 0)" }}
            >
              取引を、チャートで見返す。
              <small>エントリーから決済までを、あとから確かめられます。</small>
            </p>
            <p
              className="lp-cap"
              style={{ ["--o" as string]: "var(--o-b, 0)" }}
            >
              ルールを守れたかも、残す。
              <small>
                記録・チャート・チェックが、ひとつの画面にまとまっています。
              </small>
            </p>
            <p
              className="lp-cap"
              style={{ ["--o" as string]: "var(--o-c, 0)" }}
            >
              数字で、偏りを見つける。
              <small>勝率や損益を、あとから落ち着いて見直せます。</small>
            </p>
          </div>
        </section>

        {/* ステートメント：スクロールで文字が順に明るくなる */}
        <section
          className="lp-statement"
          data-scene
          style={{ ["--n" as string]: STATEMENT.length }}
        >
          <div className="lp-statement-stick">
            <p>
              {STATEMENT.map((w, i) => (
                <span
                  key={w}
                  className="lp-word"
                  style={{ ["--i" as string]: i }}
                >
                  {w}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* できること */}
        <section id="features" className="lp-features">
          <InView className="lp-sec-head">
            <h2>
              記録から、
              <br />
              改善まで。
            </h2>
            <p>トレードのあとにやることを、ひとつの流れにまとめました。</p>
          </InView>

          <div className="lp-bento">
            <Card
              className="lp-c-review"
              title="見返す"
              body="ローソク足のチャートで、エントリーから決済までをあとから振り返ります。"
            >
              <ReviewVisual />
            </Card>
            <Card
              className="lp-c-rules"
              title="確かめる"
              body="自分で決めたルールを発注前チェックにして、守れたかを残します。"
            >
              <RulesVisual />
            </Card>
            <Card
              className="lp-c-import"
              title="取り込む"
              body="MT5の約定履歴CSVから、まとめて登録します。"
            >
              <ImportVisual />
            </Card>
            <Card
              className="lp-c-weekly"
              title="週で見る"
              body="統計と週次レビューで、勝ち負けの偏りを見つけます。"
            >
              <WeeklyVisual />
            </Card>
            <Card
              className="lp-c-ai"
              title="AIに聞く"
              body="記録をまとめて出力し、「どう改善すべきか」を分析してもらいます。"
            >
              <AiVisual />
            </Card>
          </div>
        </section>

        <section className="lp-local">
          <InView className="lp-local-in">
            <h2>自分のパソコンの中で動かします。</h2>
            <p>
              トレードの記録は、自分のパソコンの中のデータベースに入ります。MT5とつなぐ最初の準備だけ、ご利用ガイドの手順どおりに進めてください。
            </p>
          </InView>
        </section>

        <section className="lp-closing">
          <InView className="lp-closing-in">
            <h2>
              次のトレードの前に、
              <br />
              <span className="lp-grad">見返そう。</span>
            </h2>
            <div className="lp-actions">
              <Link to={ROUTES.LOGIN} className="lp-btn">
                ログインして始める
              </Link>
              <Link to={ROUTES.GUIDE} className="lp-link">
                ご利用ガイドを見る
              </Link>
            </div>
          </InView>
        </section>
      </main>

      <footer className="lp-footer">
        <span>
          <BrandMark size={16} />
          FXレビュー
        </span>
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          ページの先頭へ
        </a>
      </footer>
    </div>
  );
}
