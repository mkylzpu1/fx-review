import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 危険操作は赤にする */
  danger?: boolean;
  /** 確定ボタンを押せなくする（入力確認など） */
  confirmDisabled?: boolean;
  /** 3つ目の選択肢（例: 下書き保存） */
  extraAction?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}

/** Escで閉じる。キャンセルに初期フォーカス。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  danger = false,
  confirmDisabled = false,
  extraAction,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-card p-6"
        >
          <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-sm text-ink-sub">{description}</div>
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button ref={cancelRef} className="btn" onClick={onCancel}>
              {cancelLabel}
            </button>
            {extraAction && (
              <button className="btn" onClick={extraAction.onClick}>
                {extraAction.label}
              </button>
            )}
            <button
              className={danger ? "btn-danger" : "btn-primary"}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
