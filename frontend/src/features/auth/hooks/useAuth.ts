import { useState, useEffect } from "react";
import { getCurrentUser, signOut as amplifySignOut } from "aws-amplify/auth";
import { Amplify } from "aws-amplify";
import type { AuthUser } from "../types";
import { apiClient } from "@/services/apiClient";
import { IS_LOCAL_AUTH, LOCAL_USER } from "../localAuth";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? "",
      loginWith: {
        oauth: {
          domain:
            import.meta.env.VITE_COGNITO_DOMAIN?.replace("https://", "") ?? "",
          scopes: ["email", "openid", "profile"],
          redirectSignIn: [import.meta.env.VITE_COGNITO_REDIRECT_URI ?? ""],
          redirectSignOut: [
            import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT_URI ?? "",
          ],
          responseType: "code",
        },
      },
    },
  },
});

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      if (IS_LOCAL_AUTH) {
        // Cognito を使わず固定ユーザーで通す。DBにユーザー行を作るため /auth/me は呼ぶ
        const me = await apiClient
          .get<AuthUser>("/auth/me")
          .catch(() => LOCAL_USER);
        setUser(me);
        return;
      }
      await getCurrentUser();
      const me = await apiClient.get<AuthUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    if (IS_LOCAL_AUTH) return;
    await amplifySignOut();
    setUser(null);
  }

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    signOut,
  };
}
