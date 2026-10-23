import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { RequireGuest } from "@/features/auth/components/RequireGuest";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { CallbackPage } from "@/features/auth/pages/CallbackPage";
import { ROUTES } from "@/constants/routes";

// TODO: 機能ページをここに追加する
// import { SomePage } from "@/features/some/pages/SomePage";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ゲスト専用ルート */}
        <Route
          path={ROUTES.LOGIN}
          element={
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          }
        />
        <Route path={ROUTES.CALLBACK} element={<CallbackPage />} />

        {/* 認証必須ルート */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppLayout>
                <Routes>
                  {/* TODO: 機能ページのルートをここに追加する */}
                  {/* <Route path={ROUTES.SOME_PAGE} element={<SomePage />} /> */}
                  <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
                </Routes>
              </AppLayout>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
