import { ReactNode, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { useAuthContext } from "@/features/auth/components/AuthProvider";

// TODO: NAV_ITEMSにアプリのナビゲーション項目を追加する
// import { Home } from "lucide-react";
// import { ROUTES } from "@/constants/routes";
const NAV_ITEMS: { to: string; label: string; icon: React.ElementType; end: boolean }[] = [
  // { to: ROUTES.DASHBOARD, label: "ダッシュボード", icon: Home, end: true },
];

interface AppLayoutProps {
  children: ReactNode;
  noPadding?: boolean;
}

export function AppLayout({ children, noPadding = false }: AppLayoutProps) {
  const { user, signOut } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ヘッダー（モバイル） */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-blue-600 text-white h-14 flex items-center px-4 justify-between">
        <span className="font-bold text-lg">
          {/* TODO: アプリ名を変更する */}
          App
        </span>
        <button onClick={() => setMenuOpen((v) => !v)} className="p-2">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* モバイルメニューオーバーレイ */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-blue-600 text-white z-20 flex flex-col transition-transform duration-200
          ${menuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="h-14 lg:h-16 flex items-center px-6 font-bold text-lg shrink-0">
          {/* TODO: アプリ名を変更する */}
          App
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? "bg-white/20 font-semibold"
                    : "hover:bg-white/10"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* ユーザー情報 */}
        {user && (
          <div className="border-t border-white/20 p-4 shrink-0">
            <div className="flex items-center gap-3 mb-3">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-white/70 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </div>
        )}
      </aside>

      {/* メインコンテンツ */}
      <main className={`lg:ml-64 pt-14 lg:pt-0 min-h-screen ${noPadding ? "" : "p-4 lg:p-6"}`}>
        {children}
      </main>
    </div>
  );
}
