import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmDialog } from "./ConfirmDialog";

interface UnsavedChangesGuardProps {
  dirty: boolean;
  /** 指定すると「下書き保存」ボタンを出す。保存後に移動する */
  onSaveDraft?: () => Promise<void> | void;
}

/** 未保存のまま画面を離れるとき確認する（ルート遷移＋タブを閉じる） */
export function UnsavedChangesGuard({
  dirty,
  onSaveDraft,
}: UnsavedChangesGuardProps) {
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      title="未保存の変更があります"
      description="このまま移動すると、入力した内容は失われます。"
      confirmLabel="破棄して移動"
      cancelLabel="編集を続ける"
      danger
      extraAction={
        onSaveDraft
          ? {
              label: "下書き保存",
              onClick: async () => {
                await onSaveDraft();
                blocker.proceed?.();
              },
            }
          : undefined
      }
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );
}
