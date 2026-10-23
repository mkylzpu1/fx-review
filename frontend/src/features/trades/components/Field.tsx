import type { ReactNode } from "react";
import { FieldError } from "@/components/common/FieldError";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    className: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
}

/** ラベル・入力・項目直下のエラーをまとめる */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-xs text-ink-sub">
        {label}
        {hint && <span className="ml-1 text-ink-mute">{hint}</span>}
      </label>
      <div className="mt-1">
        {children({
          id,
          className: `input ${error ? "input-error" : ""}`,
          "aria-describedby": error ? errorId : undefined,
          "aria-invalid": error ? true : undefined,
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
