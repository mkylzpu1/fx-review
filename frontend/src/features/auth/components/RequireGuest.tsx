import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthContext } from "./AuthProvider";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

// TODO: ログイン後のデフォルトリダイレクト先を設定する
const DEFAULT_AUTHENTICATED_ROUTE = "/";

export function RequireGuest({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) return <LoadingSpinner />;
  if (isAuthenticated) return <Navigate to={DEFAULT_AUTHENTICATED_ROUTE} replace />;

  return <>{children}</>;
}
