import type { Rule } from "@/features/rules/types";
import type { CurrencyPair, Tag } from "@/features/settings/types";
import { SIDE_LABEL } from "@/utils/format";
import type { PlanPreview } from "../utils/planPreview";
import type { FormErrors, TradeFormState } from "../utils/tradeForm";
import { ExitSection } from "./ExitSection";
import { Field } from "./Field";
import { PlanSummary } from "./PlanSummary";
import { RuleCheckPanel } from "./RuleCheckPanel";
import { TagPicker } from "./TagPicker";

interface Props {
  form: TradeFormState;
  errors: FormErrors;
  preview: PlanPreview;
  pairs: CurrencyPair[];
  tags: Tag[];
  rules: Rule[];
  exitOpen: boolean;
  onChange: (patch: Partial<TradeFormState>) => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

const textarea = "input min-h-[5rem] py-2 font-sans";

/** トレード記録・編集のフォーム本体（状態は親が持つ） */
export function TradeFormBody({
  form,
  errors,
  preview,
  pairs,
  tags,
  rules,
  exitOpen,
  onChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Section title="エントリー">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pair" label="通貨ペア" error={errors.pair}>
            {(p) => (
              <select
                {...p}
                value={form.pair}
                onChange={(e) => onChange({ pair: e.target.value })}
              >
                {pairs.map((x) => (
                  <option key={x.symbol} value={x.symbol}>
                    {x.symbol}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <fieldset>
            <legend className="text-xs text-ink-sub">売買</legend>
            <div className="mt-1 flex gap-2">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={form.side === s}
                  onClick={() => onChange({ side: s })}
                  className={`btn flex-1 ${
                    form.side === s
                      ? "border-accent bg-accent/10 text-accent-link"
                      : ""
                  }`}
                >
                  {SIDE_LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>
          <Field id="entry-at" label="エントリー日時" error={errors.entryAt}>
            {(p) => (
              <input
                {...p}
                type="datetime-local"
                value={form.entryAt}
                onChange={(e) => onChange({ entryAt: e.target.value })}
              />
            )}
          </Field>
          <Field id="lots" label="ロット" error={errors.lots}>
            {(p) => (
              <input
                {...p}
                inputMode="decimal"
                value={form.lots}
                onChange={(e) => onChange({ lots: e.target.value })}
              />
            )}
          </Field>
          <Field
            id="entry-price"
            label="エントリー価格"
            error={errors.entryPrice}
          >
            {(p) => (
              <input
                {...p}
                inputMode="decimal"
                value={form.entryPrice}
                onChange={(e) => onChange({ entryPrice: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="損切り・利確（任意）">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sl-price" label="損切り価格（SL）" error={errors.slPrice}>
            {(p) => (
              <input
                {...p}
                inputMode="decimal"
                value={form.slPrice}
                onChange={(e) => onChange({ slPrice: e.target.value })}
              />
            )}
          </Field>
          <Field id="tp-price" label="利確価格（TP）" error={errors.tpPrice}>
            {(p) => (
              <input
                {...p}
                inputMode="decimal"
                value={form.tpPrice}
                onChange={(e) => onChange({ tpPrice: e.target.value })}
              />
            )}
          </Field>
          <Field id="sl-reason" label="SLの理由">
            {(p) => (
              <input
                {...p}
                className="input font-sans"
                value={form.slReason}
                onChange={(e) => onChange({ slReason: e.target.value })}
              />
            )}
          </Field>
          <Field id="tp-reason" label="TPの理由">
            {(p) => (
              <input
                {...p}
                className="input font-sans"
                value={form.tpReason}
                onChange={(e) => onChange({ tpReason: e.target.value })}
              />
            )}
          </Field>
        </div>
        <PlanSummary preview={preview} />
      </Section>

      <Section title="エントリー根拠（任意）">
        <TagPicker
          label="根拠"
          tags={tags.filter((t) => t.kind === "rationale")}
          selected={form.tagIds}
          onChange={(ids) =>
            onChange({
              tagIds: [
                ...form.tagIds.filter(
                  (id) =>
                    !tags.some((t) => t.id === id && t.kind === "rationale"),
                ),
                ...ids.filter((id) =>
                  tags.some((t) => t.id === id && t.kind === "rationale"),
                ),
              ],
            })
          }
        />
        <Field id="memo" label="根拠メモ">
          {(p) => (
            <textarea
              {...p}
              className={textarea}
              value={form.rationaleMemo}
              onChange={(e) => onChange({ rationaleMemo: e.target.value })}
            />
          )}
        </Field>
        <fieldset>
          <legend className="text-xs text-ink-sub">確信度</legend>
          <div className="mt-1 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={form.confidence === n}
                onClick={() =>
                  onChange({ confidence: form.confidence === n ? null : n })
                }
                className={`btn w-12 px-0 ${
                  form.confidence === n
                    ? "border-accent bg-accent/10 text-accent-link"
                    : ""
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="発注前チェック">
        <RuleCheckPanel
          rules={rules}
          checks={form.ruleChecks}
          autoResults={preview.autoResults}
          onChange={(ruleId, result) =>
            onChange({ ruleChecks: { ...form.ruleChecks, [ruleId]: result } })
          }
        />
      </Section>

      <details className="card" open={exitOpen}>
        <summary className="cursor-pointer text-base font-bold">
          決済を入力（後からでもOK）
        </summary>
        <div className="mt-4">
          <ExitSection
            form={form}
            errors={errors}
            preview={preview}
            onChange={onChange}
          />
        </div>
      </details>

      <Section title="振り返り（任意）">
        <TagPicker
          label="感情"
          tags={tags.filter((t) => t.kind === "emotion")}
          selected={form.tagIds}
          onChange={(ids) =>
            onChange({
              tagIds: [
                ...form.tagIds.filter(
                  (id) =>
                    !tags.some((t) => t.id === id && t.kind === "emotion"),
                ),
                ...ids.filter((id) =>
                  tags.some((t) => t.id === id && t.kind === "emotion"),
                ),
              ],
            })
          }
        />
        <Field id="insight" label="気づき">
          {(p) => (
            <textarea
              {...p}
              className={textarea}
              value={form.insight}
              onChange={(e) => onChange({ insight: e.target.value })}
            />
          )}
        </Field>
        <Field id="next-rule" label="次のルール">
          {(p) => (
            <input
              {...p}
              className="input font-sans"
              value={form.nextRule}
              onChange={(e) => onChange({ nextRule: e.target.value })}
            />
          )}
        </Field>
      </Section>
    </div>
  );
}
