import { FieldError } from "@/components/common/FieldError";
import { formatYen } from "@/utils/format";
import type { AccountSettings } from "../types";
import { maxRiskYen, type SettingsErrors } from "../utils/settingsForm";

interface Props {
  value: AccountSettings;
  errors: SettingsErrors;
  onChange: (patch: Partial<AccountSettings>) => void;
}

const num = (v: string) => (v === "" ? NaN : Number(v));

export function AccountRiskSection({ value, errors, onChange }: Props) {
  const err = (k: keyof SettingsErrors) => (errors[k] ? "input-error" : "");
  return (
    <section id="account" className="card">
      <h2 className="text-base font-bold">口座とリスク</h2>
      <p className="mt-1 text-xs text-ink-mute">
        記録画面の「想定リスク」と、ルール「リスクは口座の1%以内」の判定に使います。
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="balance" className="text-xs text-ink-sub">
            口座残高（円）
          </label>
          <input
            id="balance"
            type="number"
            inputMode="numeric"
            className={`input mt-1 ${err("balanceJpy")}`}
            value={Number.isNaN(value.balanceJpy) ? "" : value.balanceJpy}
            onChange={(e) => onChange({ balanceJpy: num(e.target.value) })}
            aria-describedby="balance-err"
          />
          <FieldError id="balance-err" message={errors.balanceJpy} />
          <p className="mt-1 text-xs text-ink-mute">
            入金・出金のたびに更新します。
          </p>
        </div>
        <div>
          <label htmlFor="maxRisk" className="text-xs text-ink-sub">
            1トレードの最大リスク（%）
          </label>
          <input
            id="maxRisk"
            type="number"
            step="0.1"
            className={`input mt-1 ${err("maxRiskPct")}`}
            value={Number.isNaN(value.maxRiskPct) ? "" : value.maxRiskPct}
            onChange={(e) => onChange({ maxRiskPct: num(e.target.value) })}
            aria-describedby="maxRisk-err"
          />
          <FieldError id="maxRisk-err" message={errors.maxRiskPct} />
          {!errors.balanceJpy && !errors.maxRiskPct && (
            <p className="num mt-1 text-xs text-ink-mute">
              = {formatYen(maxRiskYen(value.balanceJpy, value.maxRiskPct))} まで
            </p>
          )}
        </div>
        <div>
          <label htmlFor="minRr" className="text-xs text-ink-sub">
            最低リスクリワード（1 : ?）
          </label>
          <input
            id="minRr"
            type="number"
            step="0.1"
            className={`input mt-1 ${err("minRr")}`}
            value={Number.isNaN(value.minRr) ? "" : value.minRr}
            onChange={(e) => onChange({ minRr: num(e.target.value) })}
            aria-describedby="minRr-err"
          />
          <FieldError id="minRr-err" message={errors.minRr} />
          <p className="mt-1 text-xs text-ink-mute">
            これ未満の計画は、記録画面で警告します。
          </p>
        </div>
      </div>
      <div className="mt-4 max-w-xs">
        <label htmlFor="tz" className="text-xs text-ink-sub">
          表示のタイムゾーン
        </label>
        <select
          id="tz"
          className="input mt-1 font-sans"
          value={value.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
        >
          <option value="Asia/Tokyo">日本標準時（JST, UTC+9）</option>
          <option value="UTC">UTC</option>
        </select>
        <p className="mt-1 text-xs text-ink-mute">
          東京・ロンドン・NYの区分もこの時刻で判定します。
        </p>
      </div>
    </section>
  );
}
