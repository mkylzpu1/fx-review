import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";

const NAV = ["統計", "トレード", "ルール", "学習メモ", "エクスポート"] as const;
export type NavLabel = (typeof NAV)[number];

/**
 * 実アプリの画面を再現する枠（上部ナビはアプリと同じ構成・配色）。
 * 中身は見本データ。操作できる部分は実アプリと同じ動きにしている
 */
export function AppWindow({
  active,
  label,
  children,
}: {
  active: NavLabel;
  /** スクリーンリーダー向けの説明 */
  label: string;
  children: ReactNode;
}) {
  return (
    <figure className="lp-win" aria-label={label}>
      <div className="h-[3px] bg-gradient-to-r from-profit via-profit/20 to-loss" />
      <div className="flex h-12 items-center gap-4 border-b border-line px-4">
        <span className="flex items-center gap-2 text-sm font-bold">
          <BrandMark size={18} />
          とれみる
        </span>
        <nav className="hidden items-center gap-1 sm:flex" aria-hidden="true">
          {NAV.map((n) => (
            <span
              key={n}
              className={`rounded-btn px-2.5 py-1 text-xs ${
                n === active ? "bg-surface text-ink" : "text-ink-mute"
              }`}
            >
              {n}
            </span>
          ))}
        </nav>
        <span className="ml-auto rounded-btn bg-accent px-2.5 py-1 text-xs font-medium text-bg">
          記録する
        </span>
      </div>
      <div className="space-y-3 p-4 text-left sm:p-5">{children}</div>
      <figcaption className="border-t border-line px-4 py-2 text-[11px] text-ink-mute">
        画面はサンプルデータです
      </figcaption>
    </figure>
  );
}
