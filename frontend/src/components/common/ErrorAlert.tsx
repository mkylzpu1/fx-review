interface ErrorAlertProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message = "エラーが発生しました", onRetry }: ErrorAlertProps) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-sm text-red-600 underline hover:no-underline"
        >
          再試行
        </button>
      )}
    </div>
  );
}
