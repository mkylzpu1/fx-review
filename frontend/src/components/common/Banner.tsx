import type { ReactNode } from "react";

type BannerTone = "info" | "caution" | "error";
const TONE: Record<BannerTone, string> = {
  info: "border-accent text-accent-link",
  caution: "border-caution text-caution",
  error: "border-loss text-loss",
};

/** ページ上部の常駐バナー（オフライン、チャート取得の進捗など） */
export function Banner({
  tone = "info",
  children,
}: {
  tone?: BannerTone;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`border-b bg-surface px-4 py-2 text-sm ${TONE[tone]}`}
    >
      {children}
    </div>
  );
}
