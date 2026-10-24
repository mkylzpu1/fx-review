import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { useAuthContext } from "@/features/auth/components/AuthProvider";
import { IS_LOCAL_AUTH } from "@/features/auth/localAuth";
import { TypedConfirmDialog } from "@/components/common/TypedConfirmDialog";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/stores/toastStore";
import { useWithdraw } from "../hooks/useWithdraw";

const WITHDRAW_KEYWORD = "退会";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-mute">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

/** アカウント（名前・メール・アイコンは読み取り専用）、ログアウト、退会 */
export function AccountPage() {
  const { user, signOut } = useAuthContext();
  const navigate = useNavigate();
  const withdraw = useWithdraw();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch {
      toast.error(
        "ログアウトできませんでした。通信を確認して、もう一度試してください。",
      );
    } finally {
      setSigningOut(false);
    }
  };

  const onWithdraw = () => {
    setConfirmOpen(false);
    withdraw.mutate(undefined, {
      onSuccess: async () => {
        try {
          await signOut();
        } finally {
          toast.success("退会しました。ご利用ありがとうございました。");
          navigate(ROUTES.LOGIN, { replace: true });
        }
      },
      onError: () =>
        toast.error(
          "退会できませんでした。通信を確認して、もう一度試してください。データは変わっていません。",
        ),
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">アカウント</h1>

      <section className="card" aria-labelledby="account-profile">
        <h2 id="account-profile" className="sr-only">
          プロフィール
        </h2>
        <div className="flex items-center gap-4">
          {user?.picture ? (
            <img src={user.picture} alt="" className="h-14 w-14 rounded-full" />
          ) : (
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full border border-line"
            >
              <User size={24} />
            </span>
          )}
          <dl className="grid flex-1 gap-3 sm:grid-cols-2">
            <Field label="名前" value={user?.name ?? "—"} />
            <Field label="メールアドレス" value={user?.email ?? "—"} />
          </dl>
        </div>
        <p className="mt-3 text-xs text-ink-mute">
          名前・メール・アイコンはGoogleアカウントの情報です。変更はGoogle側で行ってください。
        </p>
      </section>

      <section className="card" aria-labelledby="account-logout">
        <h2 id="account-logout" className="text-base font-bold">
          ログアウト
        </h2>
        <p className="mt-1 text-xs text-ink-mute">
          {IS_LOCAL_AUTH
            ? "ローカル開発では固定ユーザーで動いているため、ログアウトはできません。"
            : "この端末からログアウトします。"}
        </p>
        <button
          className="btn mt-3"
          disabled={IS_LOCAL_AUTH || signingOut}
          onClick={() => void onSignOut()}
        >
          ログアウト
        </button>
      </section>

      <section className="card border-loss" aria-labelledby="account-withdraw">
        <h2 id="account-withdraw" className="text-base font-bold text-loss">
          退会
        </h2>
        <p className="mt-1 text-xs text-ink-mute">
          記録・ルール・学習メモがすべて削除され、元に戻せません。先にエクスポートをおすすめします。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={ROUTES.EXPORT} className="btn">
            先にエクスポート
          </Link>
          <button
            className="btn-danger"
            disabled={withdraw.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            退会する
          </button>
        </div>
      </section>

      <TypedConfirmDialog
        open={confirmOpen}
        title="退会しますか？"
        description="記録・ルール・学習メモ・設定がすべて削除され、元に戻せません。"
        keyword={WITHDRAW_KEYWORD}
        confirmLabel="退会する"
        onConfirm={onWithdraw}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
