interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onChange }: PaginationProps) {
  const last = Math.max(1, Math.ceil(total / limit));
  if (last <= 1) return null;
  return (
    <nav
      aria-label="ページ移動"
      className="flex items-center justify-center gap-3"
    >
      <button
        className="btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        前へ
      </button>
      <span className="num text-sm text-ink-sub">
        {page} / {last}
      </span>
      <button
        className="btn"
        disabled={page >= last}
        onClick={() => onChange(page + 1)}
      >
        次へ
      </button>
    </nav>
  );
}
