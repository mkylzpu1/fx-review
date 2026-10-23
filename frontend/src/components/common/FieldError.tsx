/** 項目直下に出す入力エラー（赤・理由1行）。入力欄には aria-describedby={id} を付ける */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-loss">
      {message}
    </p>
  );
}
