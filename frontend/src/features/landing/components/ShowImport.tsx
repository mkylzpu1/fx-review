import { useState } from "react";
import { AppWindow } from "./AppWindow";

const STEPS = ["選ぶ", "確認", "取り込む"] as const;

const ROWS = [
  ["10/21 09:42", "USDJPY", "買い", "1.0", "+12.7", true],
  ["10/21 14:05", "EURUSD", "売り", "0.5", "−8.1", false],
  ["10/22 21:30", "GBPJPY", "買い", "0.5", "+21.7", true],
  ["10/23 03:12", "USDJPY", "売り", "1.0", "+5.3", true],
] as const;

/** 実アプリのCSV取り込み（①選ぶ → ②確認 → ③取り込む）。ボタンを押すと進む */
export function ShowImport() {
  const [step, setStep] = useState(0);

  return (
    <AppWindow active="トレード" label="CSV取り込みの画面">
      <div>
        <h4 className="text-base font-bold">CSV取り込み</h4>
        <p className="mt-1 text-xs leading-relaxed text-ink-sub">
          約定履歴からトレードをまとめて登録します。注文履歴のCSVを選ぶと、取り込み済みのトレードにSL・TPを反映します。
        </p>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="進み具合">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`flex items-center gap-2 rounded-chip border px-3 py-1 text-xs ${
              i === step
                ? "border-accent bg-accent/10 text-accent-link"
                : i < step
                  ? "border-line text-ink-sub"
                  : "border-line text-ink-mute"
            }`}
          >
            <span className="num">{i < step ? "✓" : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-chip border border-accent bg-accent/10 px-3 py-1 text-accent-link">
              楽天FX証券
            </span>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-card border border-line px-3 py-2">
              <span>約定履歴.csv</span>
              <span className="text-xs text-ink-sub">トレードを登録</span>
            </li>
            <li className="flex items-center justify-between rounded-card border border-dashed border-line px-3 py-2 text-ink-sub">
              <span>注文履歴.csv</span>
              <span className="text-xs">SL・TPを反映（あとから）</span>
            </li>
          </ul>
          <p className="text-xs text-ink-mute">
            約定履歴を先に取り込んでから、注文履歴を取り込みます。
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setStep(1)}
          >
            内容を確認する
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <caption className="sr-only">取り込む内容の確認</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-mute">
                  <th className="py-2 font-normal">日時</th>
                  <th className="font-normal">通貨ペア</th>
                  <th className="font-normal">売買</th>
                  <th className="text-right font-normal">ロット</th>
                  <th className="text-right font-normal">pips</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([at, pair, side, lots, pips, win]) => (
                  <tr key={at} className="border-b border-line">
                    <td className="num py-2 text-xs text-ink-sub">{at}</td>
                    <td>{pair}</td>
                    <td>{side}</td>
                    <td className="num text-right">{lots}</td>
                    <td
                      className={`num text-right ${win ? "text-profit" : "text-loss"}`}
                    >
                      {pips}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-mute">
            ほか20件。取り込み済みの約定は重複しません。
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setStep(2)}
          >
            この内容で取り込む
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p
            role="status"
            className="rounded-card border border-accent/40 bg-accent/10 px-3 py-3 text-sm"
          >
            <span className="font-bold text-accent-link">
              24件を取り込みました。
            </span>
            続けて注文履歴を選ぶと、SL・TPが入り、RRと想定リスクも計算されます。
          </p>
          <button type="button" className="btn" onClick={() => setStep(0)}>
            最初からもう一度見る
          </button>
        </div>
      )}
    </AppWindow>
  );
}
