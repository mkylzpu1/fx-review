import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FieldError } from "@/components/common/FieldError";
import { toast } from "@/stores/toastStore";
import { ROUTES } from "@/constants/routes";
import { useSaveSettings } from "@/features/settings/hooks/useSettingsApi";
import { formatYen } from "@/utils/format";

const DEFAULT_BALANCE = 1_000_000;
const RULE_CANDIDATES = [
  "1回の損失は残高の1%以内",
  "損切りは必ず入れる",
  "根拠なしでは入らない",
];

function StepHeader({
  n,
  title,
  desc,
  done,
}: {
  n: number;
  title: string;
  desc: string;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${done ? "bg-profit text-bg" : "bg-surface"}`}
      >
        {done ? "✓" : n}
      </span>
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-xs text-ink-mute">{desc}</p>
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const save = useSaveSettings();
  const [step, setStep] = useState(1);
  const [balance, setBalance] = useState(String(DEFAULT_BALANCE));
  const [rules, setRules] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  const balanceNum = Number(balance);
  const balanceError =
    Number.isInteger(balanceNum) && balanceNum > 0
      ? undefined
      : "口座残高は1円以上の整数で入力してください";

  const toggleRule = (r: string) =>
    setRules((cur) =>
      cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r],
    );

  /** 設定を作成して完了する（最初のCSVは「あとで取り込む」） */
  const finish = () =>
    save.mutate(
      { balanceJpy: balanceNum },
      {
        onSuccess: () => navigate(ROUTES.STATS, { replace: true }),
        onError: () =>
          toast.error(
            "保存できませんでした。通信を確認して、もう一度試してください。入力内容は残っています。",
          ),
      },
    );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">はじめに設定しましょう</h1>
      <p className="mt-1 text-sm text-ink-sub">
        3ステップ。あとから設定画面で変更できます。
      </p>

      <div className="mt-6 space-y-4">
        <section className="card">
          <StepHeader
            n={1}
            title="口座残高"
            desc="リスク（R）の基準になります。"
            done={step > 1}
          />
          {step === 1 ? (
            <div className="mt-4 max-w-xs">
              <label htmlFor="ob-balance" className="text-xs text-ink-sub">
                口座残高（円）
              </label>
              <input
                id="ob-balance"
                type="number"
                inputMode="numeric"
                className={`input mt-1 ${balanceError ? "input-error" : ""}`}
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
              <FieldError message={balanceError} />
              <button
                className="btn-primary mt-3"
                disabled={!!balanceError}
                onClick={() => setStep(2)}
              >
                次へ
              </button>
            </div>
          ) : (
            <p className="num mt-3 pl-10 text-sm">
              {formatYen(balanceNum)}{" "}
              <button
                className="ml-2 text-accent-link underline"
                onClick={() => setStep(1)}
              >
                変更
              </button>
            </p>
          )}
        </section>

        <section className={`card ${step < 2 ? "opacity-60" : ""}`}>
          <StepHeader
            n={2}
            title="最初のルール"
            desc="守りたいルールを1つ選ぶか、自分で書く。"
            done={step > 2}
          />
          {step === 2 && (
            <div className="mt-4 space-y-2">
              {RULE_CANDIDATES.map((r) => (
                <label
                  key={r}
                  className="flex min-h-touch items-center gap-3 rounded-btn border border-line px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={rules.includes(r)}
                    onChange={() => toggleRule(r)}
                  />
                  {r}
                </label>
              ))}
              <input
                aria-label="自分のルール"
                placeholder="自分のルール"
                className="input font-sans"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <button className="btn-primary" onClick={() => setStep(3)}>
                ルールを追加して次へ
              </button>
            </div>
          )}
        </section>

        <section className={`card ${step < 3 ? "opacity-60" : ""}`}>
          <StepHeader
            n={3}
            title="最初のCSVを取り込む"
            desc="楽天FX証券のCSVを複数ファイルまとめて取り込めます。"
            done={false}
          />
          {step === 3 && (
            <div className="mt-4 space-y-3">
              <div className="rounded-card border border-dashed border-field p-8 text-center text-sm text-ink-mute">
                CSVをここにドロップ（取り込み機能は準備中です）
              </div>
              <button
                className="btn-primary"
                onClick={finish}
                disabled={save.isPending}
              >
                あとで取り込む
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
