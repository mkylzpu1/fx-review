import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { ROUTES } from "@/constants/routes";
import { useSettings } from "@/features/settings/hooks/useSettingsApi";

/** 設定（account_settings）が未作成ならオンボーディングへ、作成済みなら /onboarding から /stats へ */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, refetch } = useSettings();
  const { pathname } = useLocation();

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorAlert onRetry={() => void refetch()} />;

  const onboarded = data !== null;
  if (!onboarded && pathname !== ROUTES.ONBOARDING)
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  if (onboarded && pathname === ROUTES.ONBOARDING)
    return <Navigate to={ROUTES.STATS} replace />;
  return <>{children}</>;
}
