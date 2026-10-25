import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const KEY = "fx-review-guide-done";

function load(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function save(done: Set<string>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    // 保存できなくても、画面上のチェックは使える
  }
}

interface Progress {
  done: Set<string>;
  toggle: (id: string) => void;
  reset: () => void;
}

const Ctx = createContext<Progress | null>(null);

/** 手順の「できた」チェックを、このブラウザに覚えておく */
export function GuideProgressProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState<Set<string>>(load);
  const toggle = useCallback((id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    const next = new Set<string>();
    save(next);
    setDone(next);
  }, []);
  const value = useMemo(() => ({ done, toggle, reset }), [done, toggle, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGuideProgress(): Progress {
  const v = useContext(Ctx);
  if (!v) throw new Error("GuideProgressProvider の中で使ってください");
  return v;
}
