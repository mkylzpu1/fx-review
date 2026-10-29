import { useState } from "react";
import { AppWindow } from "./AppWindow";

const RULES = [
  "損切り（SL）を入れる",
  "ロットは口座の1%以内",
  "指標の前は見送る",
];

const GROUPS = [
  ["守った", "+0.62R", "n=31", "強み", "text-profit"],
  ["破った", "−0.84R", "n=16", "弱み", "text-loss"],
] as const;

/** 実アプリの「発注前チェック」と「ルール遵守別」の統計。チェックを外すと警告が出る */
export function ShowRules() {
  const [checked, setChecked] = useState([true, true, false]);
  const broke = checked.some((c) => !c);

  return (
    <AppWindow
      active="ルール"
      label="ルールの発注前チェックと、守った時・破った時の成績の画面"
    >
      <section className="card space-y-2 p-4">
        <h4 className="text-base font-bold">ルールとの照合</h4>
        <ul className="divide-y divide-line">
          {RULES.map((r, i) => (
            <li key={r}>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  aria-label={`${r}のチェック`}
                  onChange={() =>
                    setChecked(checked.map((c, j) => (j === i ? !c : c)))
                  }
                  className="h-4 w-4"
                />
                {r}
              </label>
            </li>
          ))}
        </ul>
        <p
          role="status"
          className={`text-sm ${broke ? "text-caution" : "text-profit"}`}
        >
          {broke ? "⚠ 守れていないルールがあります" : "✓ すべて守れました"}
        </p>
      </section>

      <section className="card space-y-2 p-4">
        <h4 className="text-base font-bold">ルール遵守別</h4>
        <table className="w-full text-sm">
          <caption className="sr-only">守った時と破った時の平均R</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-mute">
              <th className="py-2 font-normal">区分</th>
              <th className="text-right font-normal">平均R</th>
              <th className="text-right font-normal">n</th>
              <th className="pl-3 font-normal">判定</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(([k, r, n, v, col]) => (
              <tr key={k} className="border-b border-line">
                <td className="py-2">{k}</td>
                <td className={`num text-right ${col}`}>{r}</td>
                <td className="num text-right">{n}</td>
                <td className="pl-3 text-xs text-ink-sub">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-ink-mute">
          決めたルールを守った時と破った時で、成績がどれだけ違うかが数字で出ます。
        </p>
      </section>
    </AppWindow>
  );
}
