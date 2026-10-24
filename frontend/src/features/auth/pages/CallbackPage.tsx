import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { peekReturnPath } from "@/features/session/draftStore";

// TODO: ログイン後のリダイレクト先を設定する
const POST_LOGIN_ROUTE = "/";

export function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Amplifyがcodeを処理するのを待ってからリダイレクト
    const timer = setTimeout(() => {
      // ログイン切れから戻ってきたときは、元の画面へ（入力は画面側で戻す）
      navigate(peekReturnPath() ?? POST_LOGIN_ROUTE, { replace: true });
    }, 1000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return <LoadingSpinner />;
}
