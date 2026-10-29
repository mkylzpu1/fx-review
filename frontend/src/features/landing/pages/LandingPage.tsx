import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";
import { ROUTES } from "@/constants/routes";
import {
  AiVisual,
  ImportVisual,
  ReviewVisual,
  RulesVisual,
  WeeklyVisual,
} from "../components/Visuals";
import type { WorldHandle } from "../components/world";
import "../landing.css";

interface Chapter {
  id: string;
  label: string;
  title?: string;
  body?: string;
  side: "left" | "right" | "center";
  /** 現れ始め・はっきり・薄れ始め・消える（スクロール進行 0〜1） */
  band: [number, number, number, number];
  visual?: ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    id: "hero",
    label: "はじめに",
    side: "center",
    band: [-1, -0.5, 0.07, 0.11],
  },
  {
    id: "statement",
    label: "整っていく",
    side: "center",
    band: [0.11, 0.14, 0.17, 0.21],
  },
  {
    id: "import",
    label: "取り込む",
    title: "取り込む",
    body: "MT5の約定履歴CSVから、トレードをまとめて登録します。",
    side: "left",
    band: [0.22, 0.26, 0.3, 0.34],
    visual: <ImportVisual />,
  },
  {
    id: "review",
    label: "見返す",
    title: "見返す",
    body: "ローソク足のチャートで、エントリーから決済までをあとから振り返ります。",
    side: "right",
    band: [0.35, 0.39, 0.43, 0.47],
    visual: <ReviewVisual />,
  },
  {
    id: "rules",
    label: "確かめる",
    title: "確かめる",
    body: "自分で決めたルールを発注前チェックにして、守れたかを残します。",
    side: "left",
    band: [0.48, 0.52, 0.56, 0.6],
    visual: <RulesVisual />,
  },
  {
    id: "weekly",
    label: "週で見る",
    title: "週で見る",
    body: "統計と週次レビューで、勝ち負けの偏りを見つけます。",
    side: "right",
    band: [0.61, 0.65, 0.69, 0.73],
    visual: <WeeklyVisual />,
  },
  {
    id: "ai",
    label: "AIに聞く",
    title: "AIに聞く",
    body: "記録をまとめて出力し、「どう改善すべきか」を分析してもらいます。",
    side: "left",
    band: [0.74, 0.78, 0.82, 0.86],
    visual: <AiVisual />,
  },
  {
    id: "closing",
    label: "はじめる",
    side: "center",
    band: [0.88, 0.92, 2, 3],
  },
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bandAt = (p: number, [a, b, c, d]: Chapter["band"]) =>
  smooth(a, b, p) * (1 - smooth(c, d, p));

function Actions() {
  return (
    <div className="lp-actions">
      <Link to={ROUTES.GUIDE} className="lp-btn">
        ご利用ガイドを見る
      </Link>
    </div>
  );
}

/** とれみるの紹介ページ（ログイン不要）。ローソク足の街の上を、カメラが飛ぶ */
export function LandingPage() {
  const worldRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const control = useRef({ progress: 0 });
  const handle = useRef<WorldHandle | null>(null);
  const ready = useRef(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderNum = useRef<HTMLSpanElement>(null);
  const loaderBar = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const prev = document.title;
    document.title = "とれみる｜トレードを見返して、次に活かす";
    return () => {
      document.title = prev;
    };
  }, []);

  // スクロール進行（ステージの中だけ 0〜1）
  useEffect(() => {
    const onScroll = () => {
      const el = worldRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      control.current.progress =
        span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // 3D と ローダー
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let cancelled = false;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const chapEls = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-chap]"),
    );
    const dotEls = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-dot]"),
    );
    const state = CHAPTERS.map(() => false);
    let lastPct = "";

    import("../components/world")
      .then(({ createWorld }) => {
        if (cancelled) return;
        const h = createWorld(
          canvas,
          control.current,
          {
            onFrame: (p) => {
              CHAPTERS.forEach((c, i) => {
                const o = bandAt(p, c.band);
                chapEls[i]?.style.setProperty("--o", o.toFixed(3));
                if (i === 0) stage.style.setProperty("--c0", o.toFixed(3));
                const on = o > 0.5;
                if (on !== state[i]) {
                  state[i] = on;
                  chapEls[i]?.setAttribute("data-in", String(on));
                  dotEls[i]?.setAttribute("data-on", String(on));
                }
                chapEls[i]?.setAttribute("data-near", String(o > 0.01));
              });
              const t = String(Math.round(p * 100)).padStart(3, "0");
              if (t !== lastPct && pctRef.current) {
                lastPct = t;
                pctRef.current.textContent = t;
              }
            },
          },
          reduce,
        );
        handle.current = h;
        ready.current = true;
      })
      .catch(() => {
        if (!cancelled) setWebgl(false);
      });

    const t0 = performance.now();
    let raf = 0;
    let finished = false;
    const tick = () => {
      const t = (performance.now() - t0) / (reduce ? 150 : 1400);
      let n = Math.min(1, t) * 100;
      if (!ready.current && !finished) n = Math.min(n, 99);
      if (loaderNum.current)
        loaderNum.current.textContent = String(Math.floor(n)).padStart(3, "0");
      if (loaderBar.current)
        loaderBar.current.style.transform = `scaleX(${n / 100})`;
      if (n >= 100 && ready.current) {
        finished = true;
        loaderRef.current?.setAttribute("data-done", "true");
        handle.current?.start();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  const jump = (i: number) => {
    const el = worldRef.current;
    if (!el) return;
    const [, b, c] = CHAPTERS[i].band;
    const p = Math.min(0.995, (Math.max(0, b) + c) / 2);
    const top =
      el.getBoundingClientRect().top +
      window.scrollY +
      p * (el.offsetHeight - window.innerHeight);
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-nav-in">
          <Link to={ROUTES.LP} className="lp-brand">
            <BrandMark size={20} />
            とれみる
          </Link>
          <div className="lp-nav-links">
            <Link to={ROUTES.GUIDE} className="lp-pill-sm">
              ご利用ガイド
            </Link>
          </div>
        </div>
      </nav>

      {webgl ? (
        <section
          ref={worldRef}
          className="lp-world"
          aria-label="とれみるの紹介"
        >
          <div ref={stageRef} className="lp-stage">
            <canvas ref={canvasRef} aria-hidden="true" />
            <div className="lp-scrim" aria-hidden="true" />

            {CHAPTERS.map((c) => (
              <div
                key={c.id}
                data-chap
                data-side={c.side}
                data-in="false"
                className="lp-chap"
              >
                <div className="lp-chap-text">
                  {c.id === "hero" && (
                    <>
                      <h1>
                        トレードを、
                        <br />
                        <span className="lp-grad">見返す。</span>
                      </h1>
                      <p className="lp-chap-sub">
                        記録して、チャートで振り返り、決めたルールを守れたかを確かめる。FXトレードの振り返りに絞ったアプリです。
                      </p>
                      <Actions />
                    </>
                  )}
                  {c.id === "statement" && (
                    <p className="lp-chap-statement">
                      ばらばらだった記録が、
                      <br />
                      見返すうちに、
                      <br />
                      <span className="lp-grad">ひとつの形に整っていく。</span>
                    </p>
                  )}
                  {c.title && (
                    <>
                      <h2>{c.title}</h2>
                      <p className="lp-chap-sub">{c.body}</p>
                    </>
                  )}
                  {c.id === "closing" && (
                    <>
                      <h2>
                        次のトレードの前に、
                        <br />
                        <span className="lp-grad">見返そう。</span>
                      </h2>
                      <Actions />
                    </>
                  )}
                </div>
                {c.visual && <div className="lp-glass">{c.visual}</div>}
              </div>
            ))}

            <div className="lp-hint" aria-hidden="true">
              <span className="lp-scrollhint" />
              スクロール
            </div>
            <div className="lp-hud" aria-hidden="true">
              <span ref={pctRef}>000</span> / 100
            </div>
            <div className="lp-dots">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.id}
                  data-dot
                  data-on="false"
                  onClick={() => jump(i)}
                  aria-label={c.label}
                >
                  <i />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="lp-fallback">
          <h1 className="text-5xl font-bold">トレードを、見返す。</h1>
          <p>
            記録して、チャートで振り返り、決めたルールを守れたかを確かめる。
          </p>
          <Actions />
          {CHAPTERS.filter((c) => c.title).map((c) => (
            <div key={c.id}>
              <h2 className="font-bold">{c.title}</h2>
              <p>{c.body}</p>
            </div>
          ))}
        </section>
      )}

      <section className="lp-local">
        <div className="lp-local-in" data-in="true">
          <h2>自分のパソコンの中で動かします。</h2>
          <p>
            トレードの記録は、自分のパソコンの中のデータベースに入ります。MT5とつなぐ最初の準備だけ、ご利用ガイドの手順どおりに進めてください。
          </p>
        </div>
      </section>

      <footer className="lp-footer">
        <span>
          <BrandMark size={16} />
          とれみる
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

      <div ref={loaderRef} className="lp-loader" data-done="false">
        <div ref={loaderBar} className="lp-loader-bar" />
        <b>
          <BrandMark size={22} />
          とれみる
        </b>
        <span ref={loaderNum} className="lp-loader-num">
          000
        </span>
      </div>
    </div>
  );
}
