/** 「1. 勝ちと負けを分けている条件」のような見出しの先頭の番号を取り出す */
const NUMBERED = /^\s*([0-9０-９]{1,2})\s*[.、．)）]\s*(.+)$/;

/**
 * 学習メモの各セクション見出し。先頭が「1.」のような番号なら、
 * 丸バッジ＋本文に分けて見た目のメリハリを出す。番号が無ければそのまま表示する。
 */
export function SectionHeading({ text }: { text: string }) {
  const m = NUMBERED.exec(text);
  return (
    <h2 className="mb-3 flex items-center gap-2.5 border-b border-line pb-3 text-base font-bold text-ink">
      {m && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-bg">
          {m[1]}
        </span>
      )}
      <span>{m ? m[2] : text}</span>
    </h2>
  );
}
