import { useState } from "react";
import { EMA_COLORS } from "@/constants/chartTheme";
import type { EmaSetting } from "@/features/settings/types";

export const MAX_EMA = 8;
export const MAX_EMA_PERIOD = 1000;

interface Props {
  emas: EmaSetting[];
  onChange: (next: EmaSetting[]) => void;
}

/** EMAのON/OFF（チップ）と、任意の期間の追加・削除 */
export function EmaControls({ emas, onChange }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const period = Number(value);
    if (!Number.isInteger(period) || period < 1 || period > MAX_EMA_PERIOD) {
      setError(`期間は1〜${MAX_EMA_PERIOD}の整数で入力してください`);
      return;
    }
    if (emas.some((e) => e.period === period)) {
      setError(`EMA${period}はすでにあります`);
      return;
    }
    if (emas.length >= MAX_EMA) {
      setError(`EMAは${MAX_EMA}本までです`);
      return;
    }
    setError(null);
    setValue("");
    onChange([...emas, { period, visible: true }]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {emas.map((e, i) => (
        <span
          key={e.period}
          className="inline-flex items-center rounded-chip border border-line bg-tag"
        >
          <button
            type="button"
            aria-pressed={e.visible}
            onClick={() =>
              onChange(
                emas.map((x) =>
                  x.period === e.period ? { ...x, visible: !x.visible } : x,
                ),
              )
            }
            className={`num min-h-touch rounded-chip px-3 text-sm ${
              e.visible ? "text-ink" : "text-ink-mute line-through"
            }`}
          >
            <span
              aria-hidden
              className="mr-1.5 inline-block h-2 w-2 rounded-full"
              style={{ background: EMA_COLORS[i % EMA_COLORS.length] }}
            />
            EMA{e.period}
          </button>
          <button
            type="button"
            aria-label={`EMA${e.period}を削除`}
            onClick={() => onChange(emas.filter((x) => x.period !== e.period))}
            className="min-h-touch pr-3 text-ink-mute hover:text-ink"
          >
            ×
          </button>
        </span>
      ))}
      <label className="flex items-center gap-1 text-sm text-ink-sub">
        <span className="sr-only">追加するEMAの期間</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="期間"
          value={value}
          aria-invalid={error !== null}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={`input w-20 ${error ? "input-error" : ""}`}
        />
      </label>
      <button type="button" className="btn" onClick={add}>
        EMAを追加
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}
