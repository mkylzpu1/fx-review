import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";
import { ROUTES } from "@/constants/routes";
import type { FieldControl } from "../components/CandleField";
import "../landing.css";

const FEATURES = [
  {
    title: "取り込む",
    body: "MT5の約定履歴CSVから、トレードをまとめて登録します。",
  },
  {
    title: "見返す",
    body: "ローソク足のチャートで、エントリーから決済までをあとから振り返ります。",
  },
  {
    title: "確かめる",
    body: "自分で決めたルールを発注前チェックにして、守れたかを残します。",
  },
  {
    title: "週で見る",
    body: "統計と週次レビューで、勝ち負けの偏りを見つけます。",
  },
  {
    title: "AIに聞く",
    body: "記録をまとめて出力し、AIに「どう改善すべきか」を分析してもらいます。",
  },
] as const;

function Split({ text, offset = 0 }: { text: string; offset?: number }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          className="lp-char"
          style={{ ["--i" as string]: i + offset }}
          aria-hidden="true"
        >
          {ch}
        </span>
      ))}
    </>
  );
}

/** スクロールで一度だけ現れる */
function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-in={inView} className={`lp-reveal ${className}`}>
      {children}
    </div>
  );
}

/** FXレビューの紹介ページ（ログイン不要） */
export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const control = useRef<FieldControl>({ progress: 0, focus: -1 });
  const [active, setActive] = useState(-1);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    control.current.focus = active;
  }, [active]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    import("../components/CandleField")
      .then(({ createCandleField }) => {
        if (cancelled) return;
        try {
          dispose = createCandleField(canvas, control.current, reduce);
        } catch {
          setWebgl(false);
        }
      })
      .catch(() => setWebgl(false));
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "FXレビュー｜トレードを見返して、次に活かす";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg text-ink">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-0 h-full w-full"
      />
      {!webgl && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_70%_60%,rgba(110,231,200,0.16),transparent_60%)]"
        />
      )}
      {/* 文字を読みやすくする、上下のぼかし */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(to_bottom,rgba(14,17,22,0.75),rgba(14,17,22,0)_28%,rgba(14,17,22,0)_70%,rgba(14,17,22,0.7))]"
      />

      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <a href="#top" className="flex items-center gap-2.5">
          <BrandMark size={24} />
          <span className="text-base font-bold tracking-wide">FXレビュー</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-4">
          <a
            href="#features"
            className="hidden min-h-touch items-center px-3 text-sm text-ink-sub hover:text-ink sm:inline-flex"
          >
            できること
          </a>
          <Link
            to={ROUTES.GUIDE}
            className="hidden min-h-touch items-center px-3 text-sm text-ink-sub hover:text-ink sm:inline-flex"
          >
            ご利用ガイド
          </Link>
          <Link to={ROUTES.LOGIN} className="btn bg-bg/60 backdrop-blur">
            ログイン
          </Link>
        </nav>
      </header>

      <main id="top" className="relative z-10">
        {/* ヒーロー */}
        <section className="flex min-h-[100svh] flex-col justify-end px-5 pb-[12svh] sm:px-10">
          <h1 className="max-w-[14ch] text-[clamp(3rem,10.5vw,9.5rem)] font-bold leading-[1.02] tracking-tight [perspective:800px]">
            <span className="sr-only">トレードを、見返す。</span>
            <span className="block">
              <Split text="トレードを、" />
            </span>
            <span className="block text-profit">
              <Split text="見返す。" offset={6} />
            </span>
          </h1>
          <div
            className="lp-fade mt-8 flex max-w-xl flex-col gap-6"
            style={{ ["--d" as string]: "1.5s" }}
          >
            <p className="text-base leading-relaxed text-ink-sub sm:text-lg">
              記録して、チャートで振り返り、決めたルールを守れたかを確かめる。FXトレードの振り返りに絞ったアプリです。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={ROUTES.LOGIN} className="btn-primary px-6 text-base">
                ログインして始める
              </Link>
              <Link
                to={ROUTES.GUIDE}
                className="btn px-6 text-base bg-bg/50 backdrop-blur"
              >
                ご利用ガイドを見る
              </Link>
            </div>
          </div>
          <p
            className="lp-fade absolute bottom-6 right-5 hidden text-xs text-ink-mute sm:block sm:right-10"
            style={{ ["--d" as string]: "2.2s" }}
          >
            カーソルを動かすと、ローソク足が反応します
          </p>
        </section>

        {/* ステートメント */}
        <section className="flex min-h-[90svh] items-center px-5 sm:px-10">
          <Reveal className="max-w-4xl">
            <p className="text-[clamp(1.75rem,4.6vw,4rem)] font-bold leading-[1.3]">
              ばらばらだった記録が、
              <br />
              見返すうちに、ひとつの形に整っていく。
            </p>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-sub">
              下へスクロールすると、背景のローソク足も同じように整っていきます。
            </p>
          </Reveal>
        </section>

        {/* できること */}
        <section id="features" className="px-5 py-[12svh] sm:px-10">
          <Reveal>
            <h2 className="mb-10 text-sm font-bold text-ink-sub">できること</h2>
          </Reveal>
          <ul
            className="lp-list"
            data-has-active={active >= 0}
            onPointerLeave={() => setActive(-1)}
          >
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className="lp-row"
                data-active={active === i}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(-1)}
              >
                <div
                  tabIndex={0}
                  className="grid gap-2 py-7 outline-offset-[-2px] sm:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] sm:items-end sm:gap-10 sm:py-10"
                >
                  <h3 className="text-[clamp(2.25rem,7vw,6rem)] font-bold leading-none tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-sub sm:text-base">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 動かし方 */}
        <section className="px-5 py-[8svh] sm:px-10">
          <Reveal className="max-w-2xl">
            <h2 className="text-[clamp(1.75rem,4vw,3.25rem)] font-bold leading-tight">
              自分のパソコンの中で動かします。
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-sub">
              トレードの記録は、自分のパソコンの中のデータベースに入ります。MT5とつなぐ最初の準備だけ、ご利用ガイドの手順どおりに進めてください。
            </p>
          </Reveal>
        </section>

        {/* 終わりのCTA */}
        <section className="flex min-h-[80svh] flex-col items-start justify-center gap-8 px-5 sm:px-10">
          <Reveal>
            <p className="max-w-[16ch] text-[clamp(2.5rem,8vw,7rem)] font-bold leading-[1.05] tracking-tight">
              次のトレードの前に、見返そう。
            </p>
          </Reveal>
          <Reveal>
            <Link to={ROUTES.LOGIN} className="btn-primary px-8 text-base">
              ログインして始める
            </Link>
          </Reveal>
        </section>

        <footer className="flex items-center justify-between px-5 pb-8 pt-6 text-xs text-ink-mute sm:px-10">
          <span className="flex items-center gap-2">
            <BrandMark size={16} />
            FXレビュー
          </span>
          <a href="#top" className="hover:text-ink">
            ページの先頭へ
          </a>
        </footer>
      </main>
    </div>
  );
}
