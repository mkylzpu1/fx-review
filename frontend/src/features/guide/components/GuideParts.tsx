import type { ReactNode } from "react";

/** ガイドの1セクション（目次の飛び先になる id つき） */
export function GuideSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card space-y-4">
      <div>
        <h2 id={`${id}-title`} className="text-lg font-bold">
          {title}
        </h2>
        {lead && <p className="mt-1 text-sm text-ink-sub">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/** 番号つきの手順 */
export function GuideSteps({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm marker:font-bold marker:text-accent-link">
      {children}
    </ol>
  );
}

/** コマンドやパスなど、そのまま打つ・探す文字列 */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-btn bg-surface px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

/** 複数行のコマンド */
export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-btn border border-line bg-surface p-3 font-mono text-xs">
      {children}
    </pre>
  );
}

/** 補足・注意の囲み。caution は見落とすと困ること */
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
    <div role="note" className={`rounded-btn border bg-surface p-3 ${color}`}>
      <p className="text-sm font-bold">{title}</p>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  );
}
