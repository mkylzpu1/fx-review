import * as ToastPrimitive from "@radix-ui/react-toast";
import { useToastStore, type ToastKind } from "@/stores/toastStore";

/** 成功・情報は5秒で消える。エラーは閉じるまで残す（Infinity） */
const DURATION: Record<ToastKind, number> = {
  success: 5000,
  info: 5000,
  error: Infinity,
};
const BORDER: Record<ToastKind, string> = {
  success: "border-profit",
  info: "border-accent",
  error: "border-loss",
};

export function Toaster() {
  const { items, dismiss } = useToastStore();
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {items.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          duration={DURATION[t.kind]}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={`flex items-center gap-3 rounded-card border bg-card px-4 py-3 text-sm shadow-lg ${BORDER[t.kind]}`}
        >
          <ToastPrimitive.Description className="flex-1 text-ink">
            {t.message}
          </ToastPrimitive.Description>
          {t.action && (
            <ToastPrimitive.Action altText={t.action.label} asChild>
              <button
                className="min-h-touch px-2 text-accent-link underline"
                onClick={t.action.onClick}
              >
                {t.action.label}
              </button>
            </ToastPrimitive.Action>
          )}
          <ToastPrimitive.Close
            aria-label="閉じる"
            className="min-h-touch px-2 text-ink-mute"
          >
            ×
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-20 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2 lg:bottom-4" />
    </ToastPrimitive.Provider>
  );
}
