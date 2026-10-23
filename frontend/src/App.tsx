import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { RequireGuest } from "@/features/auth/components/RequireGuest";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/common/Toast";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { CallbackPage } from "@/features/auth/pages/CallbackPage";
import { ROUTES } from "@/constants/routes";

/** 後続フェーズで実装する画面（フェーズ完了時に実ページへ差し替える） */
const PLACEHOLDERS: { path: string; title: string }[] = [
  { path: ROUTES.STATS, title: "統計" },
  { path: ROUTES.STATS_WEEKLY, title: "週次レビュー" },
  { path: ROUTES.TRADES, title: "トレード" },
  { path: ROUTES.TRADE_NEW, title: "トレード記録" },
  { path: ROUTES.TRADE_QUEUE, title: "未入力キュー" },
  { path: ROUTES.TRADE_IMPORT, title: "CSV取り込み" },
  { path: ROUTES.TRADE_DETAIL, title: "トレード詳細" },
  { path: ROUTES.TRADE_EDIT, title: "トレード編集" },
  { path: ROUTES.RULES, title: "ルール" },
  { path: ROUTES.RULE_DETAIL, title: "ルール詳細" },
  { path: ROUTES.NOTES, title: "学習メモ" },
  { path: ROUTES.NOTE_DETAIL, title: "AI分析の結果" },
  { path: ROUTES.EXPORT, title: "エクスポート" },
  { path: ROUTES.SETTINGS, title: "設定" },
  { path: ROUTES.ACCOUNT, title: "アカウント" },
  { path: ROUTES.ONBOARDING, title: "はじめに設定しましょう" },
];

export function App() {
  return (
    <AuthProvider>
      <Toaster />
      <Routes>
        <Route
          path={ROUTES.LOGIN}
          element={
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          }
        />
        <Route path={ROUTES.CALLBACK} element={<CallbackPage />} />

        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppLayout>
                <Routes>
                  <Route
                    path="/"
                    element={<Navigate to={ROUTES.STATS} replace />}
                  />
                  {PLACEHOLDERS.map((p) => (
                    <Route
                      key={p.path}
                      path={p.path}
                      element={<PlaceholderPage title={p.title} />}
                    />
                  ))}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppLayout>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
