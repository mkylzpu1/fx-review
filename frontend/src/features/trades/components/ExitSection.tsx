import { formatPips, formatR } from "@/utils/format";
import type { PlanPreview } from "../utils/planPreview";
import type { FormErrors, TradeFormState } from "../utils/tradeForm";
import { Field } from "./Field";

const METHODS: {
  value: Exclude<TradeFormState["exitMethod"], "">;
  label: string;
}[] = [
  { value: "tp", label: "利確到達" },
  { value: "sl", label: "損切り到達" },
  { value: "manual", label: "手動決済" },
  { value: "breakeven", label: "建値決済" },
];

interface ExitSectionProps {
  form: TradeFormState;
  errors: FormErrors;
  preview: PlanPreview;
  onChange: (patch: Partial<TradeFormState>) => void;
}

/** 決済の入力（後から書き足してもよい） */
export function ExitSection({
  form,
  errors,
  preview,
  onChange,
}: ExitSectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="exit-at" label="決済日時" error={errors.exitAt}>
          {(p) => (
            <input
              {...p}
              type="datetime-local"
              value={form.exitAt}
              onChange={(e) => onChange({ exitAt: e.target.value })}
            />
          )}
        </Field>
        <Field id="exit-price" label="決済価格" error={errors.exitPrice}>
          {(p) => (
            <input
              {...p}
              inputMode="decimal"
              value={form.exitPrice}
              onChange={(e) => onChange({ exitPrice: e.target.value })}
            />
          )}
        </Field>
      </div>
      <fieldset>
        <legend className="text-xs text-ink-sub">決済の仕方</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={form.exitMethod === m.value}
              onClick={() =>
                onChange({
                  exitMethod: form.exitMethod === m.value ? "" : m.value,
                })
              }
              className={`min-h-touch rounded-btn border px-3 text-sm ${
                form.exitMethod === m.value
                  ? "border-accent bg-accent/10 text-accent-link"
                  : "border-field text-ink-sub hover:bg-surface"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-mute">
          選ばない場合は「手動決済」として保存します。
        </p>
      </fieldset>
      {preview.resultPips !== null && (
        <p className="text-sm">
          結果の見込み{" "}
          <span className="num font-medium">
            {formatPips(preview.resultPips)}
          </span>
          {preview.resultR !== null && (
            <>
              {"  "}R{" "}
              <span className="num font-medium">
                {formatR(preview.resultR)}
              </span>
            </>
          )}
          <span className="ml-2 text-xs text-ink-mute">
            {preview.resultR !== null
              ? "SL・エントリー価格から自動計算"
              : "SLを入れるとRも計算します"}
          </span>
        </p>
      )}
    </div>
  );
}
