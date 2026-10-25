import type { ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "@/stores/toastStore";
import { useGuideProgress } from "../hooks/useGuideProgress";

/** 目次の飛び先になる大きなセクション。進み具合（できた数）を見出しの横に出す */
export function GuideSection({
  id,
  eyebrow,
  title,
  lead,
  stepIds,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** 指定すると「3/5 完了」を表示する */
  stepIds?: string[];
  children: ReactNode;
}) {
  const { done } = useGuideProgress();
  const count = stepIds ? stepIds.filter((s) => done.has(s)).length : 0;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 space-y-6"
    >
      <header className="space-y-2 border-b border-line pb-4">
        <p className="text-sm font-bold text-accent-link">{eyebrow}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 id={`${id}-title`} className="text-2xl font-bold">
            {title}
          </h2>
          {stepIds && (
            <span
              className={`rounded-full border px-3 py-0.5 text-sm ${
                count === stepIds.length
                  ? "border-profit text-profit"
                  : "border-line text-ink-sub"
              }`}
              aria-label={`${stepIds.length}つ中${count}つ完了`}
            >
              {count} / {stepIds.length} 完了
            </span>
          )}
        </div>
        <p className="text-base leading-relaxed text-ink-sub">{lead}</p>
      </header>
      {children}
    </section>
  );
}

/** 1つの手順。番号・見出し・本文と、「できた」ボタン */
export function Step({
  id,
  no,
  title,
  children,
}: {
  id: string;
  no: number;
  title: string;
  children: ReactNode;
}) {
  const { done, toggle } = useGuideProgress();
  const isDone = done.has(id);
  return (
    <li
      className={`card flex gap-4 p-5 transition-colors sm:gap-5 ${
        isDone ? "opacity-70" : ""
      }`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${
          isDone ? "bg-profit text-bg" : "bg-accent text-bg"
        }`}
      >
        {isDone ? <Check size={20} /> : no}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <h3 className="text-lg font-bold leading-snug">{title}</h3>
        <div className="space-y-3 text-base leading-relaxed">{children}</div>
        <button
          type="button"
          aria-pressed={isDone}
          onClick={() => toggle(id)}
          className={`btn ${isDone ? "border-profit text-profit" : ""}`}
        >
          {isDone ? "✓ できた（押すと戻す）" : "できた"}
        </button>
      </div>
    </li>
  );
}

export function StepList({ children }: { children: ReactNode }) {
  return <ol className="space-y-4">{children}</ol>;
}

/** 文章の中の、ファイル名・ボタン名・コマンド */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-btn bg-surface px-1.5 py-0.5 font-mono text-sm">
      {children}
    </code>
  );
}

/** そのまま打つ文字列。右上のボタンで1回でコピーできる */
export function CodeBlock({ children }: { children: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      toast.success("コピーしました");
    } catch {
      toast.error("コピーできませんでした。選択して手でコピーしてください。");
    }
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-btn border border-line bg-surface py-3 pl-4 pr-28 font-mono text-sm leading-relaxed">
        {children}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="btn absolute right-2 top-2 min-h-0 gap-1 px-3 py-1.5 text-xs"
      >
        <Copy size={14} aria-hidden />
        コピー
      </button>
    </div>
  );
}

/** 補足・注意の囲み。caution は、見落とすと困ること */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "caution";
  title: string;
  children: ReactNode;
}) {
  const color =
    tone === "caution"
      ? "border-caution text-caution"
      : "border-accent text-accent-link";
  return (
    <div
      role="note"
      className={`rounded-card border-2 bg-surface p-5 ${color}`}
    >
      <p className="text-base font-bold">{title}</p>
      <div className="mt-2 space-y-2 text-base leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}

/** 困ったときの、折りたたみ。見出しを押すと開く */
export function Trouble({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-card border border-line bg-card">
      <summary className="flex min-h-touch cursor-pointer items-center px-5 py-3 text-base font-bold marker:content-none">
        <span className="mr-2 text-ink-sub group-open:rotate-90">▶</span>
        {question}
      </summary>
      <div className="space-y-2 border-t border-line px-5 py-4 text-base leading-relaxed">
        {children}
      </div>
    </details>
  );
}
