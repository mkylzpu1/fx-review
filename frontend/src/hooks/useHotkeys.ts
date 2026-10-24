import { useEffect, useRef } from "react";

export type HotkeyHandler = (e: KeyboardEvent) => void;

/** キー名（`e.key`。英字は小文字）→ 処理 */
export type HotkeyMap = Record<string, HotkeyHandler>;

/** 文字入力中のキーは奪わない */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** ダイアログが開いている間は、背面の画面のショートカットを効かせない */
function dialogOpen(): boolean {
  return (
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  );
}

/**
 * 画面のキーボードショートカット。
 * 入力欄の中・IME変換中・Ctrl/⌘/Alt つきのキー・ダイアログ表示中は何もしない。
 * 処理を返したキーは、ブラウザ既定の動き（スクロールなど）を止める
 */
export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || dialogOpen()) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const handler = ref.current[key];
      if (!handler) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
