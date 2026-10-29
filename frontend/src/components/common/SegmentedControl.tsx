/** 枠つきの切り替え（セグメント）。トレード一覧の「チャートの時間足」と同じ見た目 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; tone?: "profit" | "loss" }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-[10px] border border-line bg-card p-[3px]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-8 items-center rounded-[7px] px-3 text-[13px] transition-colors ${
            value === o.value
              ? o.tone === "loss"
                ? "bg-loss/[.22] font-medium text-loss"
                : o.tone === "profit"
                  ? "bg-profit/[.22] font-medium text-profit"
                  : "bg-accent/[.22] font-medium text-accent-link"
              : o.tone === "loss"
                ? "text-loss/80 hover:bg-loss/10"
                : "text-ink-sub hover:bg-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
