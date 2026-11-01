import { useState } from "react";

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}

/** 開いているページの前後に出すページ番号の数 */
const SIBLINGS = 2;

/** 表示するページ番号（開いているページの前後2ページ。1〜最終ページの範囲内） */
export function pageWindow(page: number, last: number): number[] {
  const from = Math.max(1, page - SIBLINGS);
  const to = Math.min(last, page + SIBLINGS);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function Pagination({ page, limit, total, onChange }: PaginationProps) {
  const last = Math.max(1, Math.ceil(total / limit));
  const [input, setInput] = useState("");
  if (last <= 1) return null;

  // 入力したページへ移動。範囲外は1〜最終ページに丸め、数字でなければ何もしない
  const jump = () => {
    const n = Number(input.trim());
    if (!Number.isInteger(n) || input.trim() === "") return;
    onChange(Math.min(last, Math.max(1, n)));
    setInput("");
  };

  return (
    <nav
      aria-label="ページ移動"
      className="flex flex-wrap items-center justify-center gap-3"
    >
      <button
        className="btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        前へ
      </button>
      <ul className="flex items-center gap-1">
        {pageWindow(page, last).map((n) => (
          <li key={n}>
            <button
              type="button"
              aria-label={`${n}ページ目`}
              aria-current={n === page ? "page" : undefined}
              disabled={n === page}
              onClick={() => onChange(n)}
              className={`num inline-flex h-9 min-w-9 items-center justify-center rounded-chip border px-2 text-sm ${
                n === page
                  ? "border-accent bg-accent/[.22] font-medium text-accent-link"
                  : "border-field text-ink-sub hover:bg-surface"
              }`}
            >
              {n}
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn"
        disabled={page >= last}
        onClick={() => onChange(page + 1)}
      >
        次へ
      </button>
      <span className="num text-sm text-ink-mute">全{last}ページ</span>
      <form
        noValidate
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          jump();
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={last}
          aria-label="移動するページ番号"
          placeholder="ページ"
          className="num h-9 w-20 rounded-chip border border-field bg-bg px-2.5 text-sm text-ink placeholder:text-ink-mute"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn h-9 min-h-0 px-3 text-[13px]">
          移動
        </button>
      </form>
    </nav>
  );
}
