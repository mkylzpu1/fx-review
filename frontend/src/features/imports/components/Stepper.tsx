const STEPS = ["システムとファイルを選ぶ", "内容を確認する", "取り込む"];

/** 3ステップの現在地（1始まり） */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="取り込みの手順">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex min-h-touch items-center gap-2 rounded-chip border px-4 text-sm ${
              active
                ? "border-accent bg-surface text-ink"
                : "border-line text-ink-mute"
            }`}
          >
            <span className="num">{n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
