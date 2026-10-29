import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";
import { ROUTES } from "@/constants/routes";
import { GuidePage } from "@/features/guide/pages/GuidePage";

/** 公開サイト用のご利用ガイド（アプリのナビなし。LPへ戻れる簡単なヘッダーだけ） */
export function GuideSitePage() {
  useEffect(() => {
    const prev = document.title;
    document.title = "ご利用ガイド｜とれみる";
    window.scrollTo(0, 0);
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div
          aria-hidden="true"
          className="h-[3px] bg-gradient-to-r from-profit via-profit/20 to-loss"
        />
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
          <Link
            to={ROUTES.LP}
            className="flex items-center gap-2 text-base font-bold"
          >
            <BrandMark />
            とれみる
          </Link>
          <Link to={ROUTES.LP} className="text-sm text-ink-sub hover:text-ink">
            紹介ページへ戻る
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-screen-xl px-4 py-8">
        <GuidePage />
      </main>
    </div>
  );
}
