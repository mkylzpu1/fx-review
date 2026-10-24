import { useEffect, useId, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

interface TypedConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** 入力してもらう言葉（例: 退会、削除） */
  keyword: string;
  confirmLabel: string;
  /** 確認ダイアログ内に並べる補助リンクなど */
  footerNote?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 危険な操作の前に、決まった言葉を入力してもらう確認ダイアログ */
export function TypedConfirmDialog({
  open,
  title,
  description,
  keyword,
  confirmLabel,
  footerNote,
  onConfirm,
  onCancel,
}: TypedConfirmDialogProps) {
  const [value, setValue] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={
        <div className="space-y-3">
          <div>{description}</div>
          <label htmlFor={inputId} className="block text-xs text-ink-mute">
            確認のため「{keyword}」と入力
          </label>
          <input
            id={inputId}
            className="input w-full"
            value={value}
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
          />
          {footerNote}
        </div>
      }
      confirmLabel={confirmLabel}
      danger
      confirmDisabled={value !== keyword}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
