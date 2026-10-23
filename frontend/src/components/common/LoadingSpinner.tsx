/** fullScreen=false でセクション内用の小さい表示になる */
export function LoadingSpinner({
  fullScreen = true,
}: {
  fullScreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className={`flex items-center justify-center ${fullScreen ? "min-h-screen bg-bg" : "py-12"}`}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
    </div>
  );
}
