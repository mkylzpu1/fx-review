import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";

const NAV = ["統計", "トレード", "ルール", "学習メモ", "エクスポート"] as const;
export type NavLabel = (typeof NAV)[number];

/**
 * 画面の見本は、PCで開いたときの幅（この幅）で作る。
 * 表示できる幅がこれより狭いときは、レイアウトは変えずに全体を縮小する
 */
const DESIGN_WIDTH = 1120;

/**
 * 実アプリの画面をPC版のレイアウトで再現する枠（上部ナビはアプリと同じ構成・配色）。
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
  const hostRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);
  const [winHeight, setWinHeight] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const win = winRef.current;
    if (!host || !win) return;
    const update = () => {
      setScale(Math.min(1, host.clientWidth / DESIGN_WIDTH));
      setWinHeight(win.offsetHeight);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(host);
    ro.observe(win);
    return () => ro.disconnect();
  }, []);

  const shrunk = scale < 1 && winHeight !== null;

  return (
    <div
      ref={hostRef}
      className="lp-win-host"
      style={shrunk ? { height: winHeight * scale } : undefined}
    >
      <figure
        ref={winRef}
        className="lp-win"
        aria-label={label}
        style={{
          width: DESIGN_WIDTH,
          transform: shrunk ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        <div className="h-[3px] bg-gradient-to-r from-profit via-profit/20 to-loss" />
        <div className="flex h-12 items-center gap-4 border-b border-line px-4">
          <span className="flex items-center gap-2 text-sm font-bold">
            <BrandMark size={18} />
            とれみる
          </span>
          <nav className="flex items-center gap-1" aria-hidden="true">
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
        <div className="space-y-3 p-5 text-left">{children}</div>
        <figcaption className="border-t border-line px-4 py-2 text-[11px] text-ink-mute">
          画面はサンプルデータです
        </figcaption>
      </figure>
    </div>
  );
}
