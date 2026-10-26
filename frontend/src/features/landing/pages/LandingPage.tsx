import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";
import { ROUTES } from "@/constants/routes";
import { SECTIONS } from "../sections";
import type { SceneControl, SceneHandle } from "../components/TunnelScene";
import "../landing.css";

/** FXレビューの紹介ページ（ログイン不要）。スクロールで螺旋のトンネルを飛び抜ける */
export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const control = useRef<SceneControl>({ progress: 0 });
  const handle = useRef<SceneHandle | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderNum = useRef<HTMLSpanElement>(null);
  const loaderBar = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(true);
  const ready = useRef(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "FXレビュー｜トレードを見返して、次に活かす";
    return () => {
      document.title = prev;
    };
  }, []);

  // スクロール進行
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      control.current.progress = max > 0 ? window.scrollY / max : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // シーン + ローダー
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let lastLabel = -2;

    import("../components/TunnelScene")
      .then(({ createTunnelScene }) =>
        createTunnelScene(
          canvas,
          control.current,
          {
            onFrame: (p, idx) => {
              if (pctRef.current)
                pctRef.current.textContent = String(
                  Math.round(p * 100),
                ).padStart(3, "0");
              if (idx !== lastLabel) {
                lastLabel = idx;
                if (labelRef.current)
                  labelRef.current.textContent =
                    idx >= 0 ? SECTIONS[idx].label : "";
              }
              ctaRef.current?.setAttribute("data-show", String(p > 0.9));
            },
          },
          reduce,
        ),
      )
      .then((h) => {
        if (cancelled) {
          h.dispose();
          return;
        }
        handle.current = h;
        ready.current = true;
      })
      .catch(() => {
        if (!cancelled) setWebgl(false);
      });

    // 0→100 のカウント。シーンの準備ができるまでは99で待つ
    const t0 = performance.now();
    let raf = 0;
    let finished = false;
    const tick = () => {
      const t = (performance.now() - t0) / (reduce ? 200 : 1500);
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

  // カーソル
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (dotRef.current)
        dotRef.current.style.transform = `translate(${x}px,${y}px)`;
      const hot = !!(e.target as HTMLElement).closest("a,button");
      cursorRef.current?.setAttribute("data-hot", String(hot));
    };
    const loop = () => {
      cx += (x - cx) * 0.16;
      cy += (y - cy) * 0.16;
      if (cursorRef.current)
        cursorRef.current.style.transform = `translate(${cx}px,${cy}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp-root relative text-ink">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-0 h-full w-full"
      />

      {/* スクロール量を作る余白。文字は3D空間の中に出る */}
      <div aria-hidden="true" className="h-[850svh]" />

      {/* 読み上げ用・WebGLが使えないときの表示 */}
      <div
        className={
          webgl
            ? "sr-only"
            : "fixed inset-0 z-10 overflow-y-auto px-6 pb-40 pt-28 [background:radial-gradient(ellipse_at_70%_20%,rgba(110,231,200,0.14),transparent_60%)]"
        }
      >
        <h1 className="text-4xl font-bold">トレードを、見返す。</h1>
        <p className="mt-3 text-ink-sub">FXトレードの振り返りアプリ</p>
        <ul className="mt-8 space-y-6">
          {SECTIONS.filter((s) => s.caption && s.id !== "hero").map((s) => (
            <li key={s.id}>
              <h2 className="text-2xl font-bold">{s.lines[0].text}</h2>
              <p className="mt-1 text-ink-sub">{s.caption}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xl font-bold">次のトレードの前に、見返そう。</p>
      </div>

      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <a href="/lp" className="flex items-center gap-2.5">
          <BrandMark size={24} />
          <span className="text-base font-bold tracking-wide">FXレビュー</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            to={ROUTES.GUIDE}
            className="hidden min-h-touch items-center px-3 text-sm text-ink-sub hover:text-ink sm:inline-flex"
          >
            ご利用ガイド
          </Link>
          <Link to={ROUTES.LOGIN} className="btn bg-black/40 backdrop-blur">
            ログイン
          </Link>
        </nav>
      </header>

      <div className="lp-hud pointer-events-none fixed bottom-5 left-5 z-20 flex items-end gap-4 sm:bottom-8 sm:left-10">
        <span className="lp-scrollhint" aria-hidden="true" />
        <span ref={labelRef} className="pb-0.5" />
      </div>
      <div className="lp-hud pointer-events-none fixed bottom-5 right-5 z-20 sm:bottom-8 sm:right-10">
        <span ref={pctRef}>000</span>
        <span className="text-ink-mute"> / 100</span>
      </div>

      <div ref={ctaRef} className="lp-cta" data-show="false">
        <Link to={ROUTES.LOGIN} className="btn-primary px-8 text-base">
          ログインして始める
        </Link>
        <Link
          to={ROUTES.GUIDE}
          className="btn bg-black/40 px-8 text-base backdrop-blur"
        >
          ご利用ガイドを見る
        </Link>
      </div>

      <div ref={loaderRef} className="lp-loader" data-done="false">
        <div ref={loaderBar} className="lp-loader-bar" />
        <span className="lp-hud">FXレビュー</span>
        <span ref={loaderNum} className="lp-loader-num">
          000
        </span>
      </div>

      <div
        ref={cursorRef}
        className="lp-cursor"
        data-hot="false"
        aria-hidden="true"
      />
      <div ref={dotRef} className="lp-cursor-dot" aria-hidden="true" />
    </div>
  );
}
