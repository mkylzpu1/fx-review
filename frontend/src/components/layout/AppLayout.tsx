import { ReactNode, useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { User } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { useAuthContext } from "@/features/auth/components/AuthProvider";
import { Banner } from "@/components/common/Banner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ROUTES } from "@/constants/routes";
import {
  NAV_ITEMS,
  MOBILE_TABS,
  MOBILE_MORE_ITEMS,
  isCurrent,
} from "./navItems";

const TAB_BASE = "flex min-h-touch flex-1 items-center justify-center text-xs";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => setMoreOpen(false), [pathname]);

  const moreCurrent = MOBILE_MORE_ITEMS.some((i) => isCurrent(i, pathname));

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* 上部ナビ */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        {/* 上端の細い帯: 緑(上昇)から赤(下降)へ */}
        <div
          aria-hidden="true"
          className="h-[3px] bg-gradient-to-r from-profit via-profit/20 to-loss"
        />
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-6 px-4">
          <Link
            to={ROUTES.STATS}
            className="flex items-center gap-2 text-base font-bold"
          >
            <BrandMark />
            FXレビュー
          </Link>
          <nav
            aria-label="メイン"
            className="hidden flex-1 items-center gap-1 lg:flex"
          >
            {NAV_ITEMS.map((item) => {
              const current = isCurrent(item, pathname);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-touch items-center rounded-btn px-3 text-sm ${
                    current
                      ? "bg-surface text-ink"
                      : "text-ink-sub hover:bg-surface/60"
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <Link to={ROUTES.TRADE_NEW} className="btn-primary">
              トレードを記録
            </Link>
            <Link
              to={ROUTES.ACCOUNT}
              aria-label="アカウント"
              aria-current={
                pathname.startsWith(ROUTES.ACCOUNT) ? "page" : undefined
              }
              className="hidden h-11 w-11 items-center justify-center rounded-full border border-line hover:bg-surface lg:flex"
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <User size={18} aria-hidden />
              )}
            </Link>
          </div>
        </div>
      </header>

      {!online && (
        <Banner tone="caution">
          オフラインです。通信が戻るまで保存できません。入力した内容は画面に残ります。
        </Banner>
      )}

      <main className="mx-auto max-w-screen-xl px-4 pb-24 pt-6 lg:pb-8">
        {children}
      </main>

      {/* スマホ下タブ */}
      <nav
        aria-label="メイン（スマホ）"
        className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-line bg-bg lg:hidden"
      >
        {MOBILE_TABS.map((item) => {
          const current = isCurrent(item, pathname);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-current={current ? "page" : undefined}
              className={`${TAB_BASE} ${current ? "bg-surface text-ink" : "text-ink-sub"}`}
            >
              {item.label}
            </NavLink>
          );
        })}
        <button
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          className={`${TAB_BASE} ${moreCurrent || moreOpen ? "bg-surface text-ink" : "text-ink-sub"}`}
        >
          その他
        </button>
        {moreOpen && (
          <div className="absolute bottom-full right-2 mb-2 w-48 rounded-card border border-line bg-card p-1">
            {MOBILE_MORE_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isCurrent(item, pathname) ? "page" : undefined}
                className="flex min-h-touch items-center rounded-btn px-3 text-sm hover:bg-surface"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
