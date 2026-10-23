import { FieldError } from "@/components/common/FieldError";
import { TIMEFRAMES, type AccountSettings } from "../types";
import type { SettingsErrors } from "../utils/settingsForm";

interface Props {
  value: AccountSettings;
  errors: SettingsErrors;
  onChange: (patch: Partial<AccountSettings>) => void;
}

const MAX_EMA = 8;

export function ChartEmaSection({ value, errors, onChange }: Props) {
  const setEma = (
    i: number,
    patch: Partial<AccountSettings["emaSettings"][number]>,
  ) =>
    onChange({
      emaSettings: value.emaSettings.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      ),
    });

  return (
    <section id="chart" className="card">
      <h2 className="text-base font-bold">チャートとEMA</h2>
      <p className="mt-1 text-xs text-ink-mute">
        トレード詳細を開いたときの初期表示です。詳細画面ではその場で切り替えられます。
      </p>

      <p className="mt-4 text-xs text-ink-sub">最初に表示する時間足</p>
      <div
        role="radiogroup"
        aria-label="最初に表示する時間足"
        className="mt-1 inline-flex rounded-btn bg-bg p-1"
      >
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            role="radio"
            aria-checked={value.chartDefaultTf === tf}
            onClick={() => onChange({ chartDefaultTf: tf })}
            className={`num min-h-touch min-w-[3rem] rounded-btn px-3 text-sm ${
              value.chartDefaultTf === tf
                ? "bg-accent text-white"
                : "text-ink-sub"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-ink-sub">EMA</p>
      <ul className="mt-1 space-y-2">
        {value.emaSettings.map((ema, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-btn border border-line bg-bg px-3 py-2"
          >
            <label className="flex items-center gap-2 text-sm text-ink-sub">
              期間
              <input
                type="number"
                min={1}
                aria-label={`EMA${i + 1}の期間`}
                className="input w-20"
                value={Number.isNaN(ema.period) ? "" : ema.period}
                onChange={(e) =>
                  setEma(i, {
                    period:
                      e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="ml-auto flex min-h-touch items-center gap-2 text-xs text-ink-sub">
              初期表示
              <input
                type="checkbox"
                role="switch"
                checked={ema.visible}
                onChange={(e) => setEma(i, { visible: e.target.checked })}
                className="h-5 w-9 accent-accent"
              />
            </label>
            <button
              type="button"
              aria-label={`EMA${ema.period}を削除`}
              className="min-h-touch px-2 text-ink-mute"
              onClick={() =>
                onChange({
                  emaSettings: value.emaSettings.filter((_, idx) => idx !== i),
                })
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <FieldError message={errors.ema} />
      <button
        type="button"
        className="btn mt-2"
        disabled={value.emaSettings.length >= MAX_EMA}
        onClick={() =>
          onChange({
            emaSettings: [
              ...value.emaSettings,
              { period: 100, visible: false },
            ],
          })
        }
      >
        EMAを追加
      </button>

      <div className="mt-6 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <div>
          <label htmlFor="before" className="text-xs text-ink-sub">
            エントリーより前に表示する本数
          </label>
          <input
            id="before"
            type="number"
            className={`input mt-1 ${errors.chartBarsBefore ? "input-error" : ""}`}
            value={
              Number.isNaN(value.chartBarsBefore) ? "" : value.chartBarsBefore
            }
            onChange={(e) =>
              onChange({
                chartBarsBefore:
                  e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
          <FieldError message={errors.chartBarsBefore} />
        </div>
        <div>
          <label htmlFor="after" className="text-xs text-ink-sub">
            決済より後に表示する本数
          </label>
          <input
            id="after"
            type="number"
            className={`input mt-1 ${errors.chartBarsAfter ? "input-error" : ""}`}
            value={
              Number.isNaN(value.chartBarsAfter) ? "" : value.chartBarsAfter
            }
            onChange={(e) =>
              onChange({
                chartBarsAfter:
                  e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
          <FieldError message={errors.chartBarsAfter} />
          <p className="mt-1 text-xs text-ink-mute">
            「決済後の最大到達」の計算にも使います。
          </p>
        </div>
      </div>
    </section>
  );
}
