import { useEffect } from "react";
import { signInWithRedirect } from "aws-amplify/auth";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { setUnauthorizedHandler } from "@/services/apiClient";
import { IS_LOCAL_AUTH } from "@/features/auth/localAuth";
import { saveDraftsForLogin } from "./draftStore";
import { useSessionExpiredStore } from "./sessionExpiredStore";

/** APIが401を返したときに出す。ローカル固定ユーザーでは出さない */
export function SessionExpiredDialog() {
  const { open, notify, close } = useSessionExpiredStore();

  useEffect(() => {
    if (IS_LOCAL_AUTH) return;
    setUnauthorizedHandler(notify);
    return () => setUnauthorizedHandler(null);
  }, [notify]);

  const onLogin = () => {
    saveDraftsForLogin(window.location.pathname + window.location.search);
    close();
    void signInWithRedirect({ provider: { custom: "Google" } });
  };

  return (
    <ConfirmDialog
      open={open}
      title="ログインの有効期限が切れました"
      description="もう一度ログインしてください。入力中の内容は、ログイン後にそのまま戻ります。"
      confirmLabel="ログインする"
      hideCancel
      onConfirm={onLogin}
      onCancel={() => undefined}
    />
  );
}
