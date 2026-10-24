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
import { RequireOnboarded } from "@/features/onboarding/components/RequireOnboarded";
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";
import { TradeFormPage } from "@/features/trades/pages/TradeFormPage";
import { TradesPage } from "@/features/trades/pages/TradesPage";
import { TradeQueuePage } from "@/features/trades/pages/TradeQueuePage";
import { TradeDetailPage } from "@/features/trades/pages/TradeDetailPage";
import { ImportPage } from "@/features/imports/pages/ImportPage";
import { StatsPage } from "@/features/stats/pages/StatsPage";
import { ExportPage } from "@/features/export/pages/ExportPage";
import { RulesPage } from "@/features/rules/pages/RulesPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ROUTES } from "@/constants/routes";

/** 後続フェーズで実装する画面（フェーズ完了時に実ページへ差し替える） */
const PLACEHOLDERS: { path: string; title: string }[] = [
  { path: ROUTES.STATS_WEEKLY, title: "週次レビュー" },
  { path: ROUTES.RULE_DETAIL, title: "ルール詳細" },
  { path: ROUTES.NOTES, title: "学習メモ" },
  { path: ROUTES.NOTE_DETAIL, title: "AI分析の結果" },
  { path: ROUTES.ACCOUNT, title: "アカウント" },
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
                <RequireOnboarded>
                  <Routes>
                    <Route
                      path={ROUTES.ONBOARDING}
                      element={<OnboardingPage />}
                    />
                    <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
                    <Route path={ROUTES.RULES} element={<RulesPage />} />
                    <Route path={ROUTES.TRADES} element={<TradesPage />} />
                    <Route
                      path={ROUTES.TRADE_DETAIL}
                      element={<TradeDetailPage />}
                    />
                    <Route path={ROUTES.STATS} element={<StatsPage />} />
                    <Route path={ROUTES.EXPORT} element={<ExportPage />} />
                    <Route
                      path={ROUTES.TRADE_IMPORT}
                      element={<ImportPage />}
                    />
                    <Route
                      path={ROUTES.TRADE_QUEUE}
                      element={<TradeQueuePage />}
                    />
                    <Route
                      path={ROUTES.TRADE_NEW}
                      element={<TradeFormPage />}
                    />
                    <Route
                      path={ROUTES.TRADE_EDIT}
                      element={<TradeFormPage />}
                    />
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
                </RequireOnboarded>
              </AppLayout>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
