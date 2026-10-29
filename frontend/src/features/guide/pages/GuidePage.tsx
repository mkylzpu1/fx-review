import { CandleSection } from "../components/CandleSection";
import { SetupSection } from "../components/SetupSection";
import { UsageSection } from "../components/UsageSection";
import {
  GuideProgressProvider,
  useGuideProgress,
} from "../hooks/useGuideProgress";

const TOC = [
  { href: "#setup", label: "1. セットアップ" },
  { href: "#usage", label: "2. 使い方" },
  { href: "#candles", label: "3. ローソク足の更新" },
];

const FLOW = [
  {
    href: "#setup",
    title: "準備する",
    body: "パソコンで起動し、MT5とつなぐ（最初の1回だけ）",
  },
  {
    href: "#usage",
    title: "記録して見返す",
    body: "CSVを取り込み、チャートで振り返る",
  },
  {
    href: "#candles",
    title: "足を更新する",
    body: "MT5で書き出し → アプリで取り込む（毎回）",
  },
];

function ResetButton() {
  const { done, reset } = useGuideProgress();
  if (done.size === 0) return null;
  return (
    <button type="button" onClick={reset} className="btn text-sm">
      チェックを全部はずす
    </button>
  );
}

/** ご利用ガイド: セットアップ・使い方・ローソク足の更新が必要なこと */
export function GuidePage() {
  return (
    <GuideProgressProvider>
      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <nav
            aria-label="ガイドの目次"
            className="sticky top-20 space-y-1 text-sm"
          >
            <p className="mb-2 text-xs font-bold text-ink-sub">目次</p>
            {TOC.map((t) => (
              <a
                key={t.href}
                href={t.href}
                className="flex min-h-touch items-center rounded-btn px-3 hover:bg-surface"
              >
                {t.label}
              </a>
            ))}
            <div className="pt-3">
              <ResetButton />
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          <header className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-xl font-bold leading-tight">ご利用ガイド</h1>
              <p className="text-sm leading-relaxed text-ink-sub">
                FXレビューを使い始めるための、3つのステップです。このアプリは、自分のパソコンの中だけで動かします。
              </p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-3">
              {FLOW.map((f, i) => (
                <li key={f.href}>
                  <a
                    href={f.href}
                    className="card block h-full space-y-1 p-4 hover:bg-surface"
                  >
                    <span className="text-xs font-bold text-accent-link">
                      STEP {i + 1}
                    </span>
                    <span className="block text-base font-bold">{f.title}</span>
                    <span className="block text-sm leading-relaxed text-ink-sub">
                      {f.body}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            <nav
              aria-label="ガイドの目次（スマホ）"
              className="flex flex-wrap items-center gap-2 lg:hidden"
            >
              {TOC.map((t) => (
                <a key={t.href} href={t.href} className="btn">
                  {t.label}
                </a>
              ))}
              <ResetButton />
            </nav>
          </header>

          <SetupSection />
          <UsageSection />
          <CandleSection />
        </div>
      </div>
    </GuideProgressProvider>
  );
}
