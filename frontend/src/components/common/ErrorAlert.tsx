interface ErrorAlertProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorAlert({
  message = "通信を確認して、もう一度試してください。入力内容は残っています。",
  onRetry,
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="rounded-card border border-loss bg-loss/10 p-4"
    >
      <p className="text-sm text-loss">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn mt-2">
          再読み込み
        </button>
      )}
    </div>
  );
}
