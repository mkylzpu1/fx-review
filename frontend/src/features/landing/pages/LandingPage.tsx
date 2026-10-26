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

/** スクロール量に合わせて、[data-scene] の --p (0〜1) を更新する */
function useScrollScenes() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scene]"),
    );
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const span = r.height - vh;
        const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
        el.style.setProperty("--p", p.toFixed(4));
      }
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
}

/** 画面に入ったら data-in="true" にする */
function InView({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
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
    <InView className={`lp-card ${className}`}>
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
        <section className="lp-hero" data-scene>
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
