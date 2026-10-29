import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "@/features/landing/pages/LandingPage";
import { ROUTES } from "@/constants/routes";
import { Toaster } from "@/components/common/Toast";
import { GuideSitePage } from "./GuideSitePage";
import "../index.css";

/**
 * GitHub Pages で公開する、LP とご利用ガイドだけのサイト。
 * ログインが必要なアプリ本体は含めない（vite.site.config.ts でビルド）。
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Toaster />
      <Routes>
        <Route path={ROUTES.LP} element={<LandingPage />} />
        <Route path={ROUTES.GUIDE} element={<GuideSitePage />} />
        <Route path="*" element={<Navigate to={ROUTES.LP} replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
