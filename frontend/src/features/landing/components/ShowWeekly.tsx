import { AppWindow } from "./AppWindow";

const DAYS = [
  ["10/19(月)", 0.8, 2],
  ["10/20(火)", -1.0, 1],
  ["10/21(水)", 2.1, 3],
  ["10/22(木)", 0.9, 1],
  ["10/23(金)", -0.6, 2],
] as const;

const fmt = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}R`;

/** 実アプリの週次レビュー。日別のRと「計画どおりに持っていたら」の比較 */
export function ShowWeekly() {
  const max = Math.max(...DAYS.map((d) => Math.abs(d[1])));

  return (
    <AppWindow active="統計" label="週次レビューの画面">
      <div className="flex items-center gap-3">
        <h4 className="text-base font-bold">週次レビュー</h4>
        <span className="num ml-auto text-xs text-ink-sub">
          10/19(月) 〜 10/25(日)
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["トレード数", "9件"],
          ["勝率", "67%"],
          ["合計R", "+2.20R"],
          ["合計pips", "+48.5"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border border-line p-3">
            <dt className="text-xs text-ink-mute">{k}</dt>
            <dd className="num text-lg font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-mute">
        ルール遵守: 守った7件 / 破った2件（判定のある9件中 78%）
      </p>

      <section className="card space-y-2 p-4">
        <h4 className="text-base font-bold">日別のR</h4>
        <ul className="space-y-1" aria-label="日別のR">
          {DAYS.map(([label, r, n]) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-ink-sub">{label}</span>
              <span className="h-3 flex-1 rounded bg-surface">
                <span
                  className={`block h-3 rounded ${r < 0 ? "bg-loss" : "bg-profit"}`}
                  style={{ width: `${(Math.abs(r) / max) * 100}%` }}
                />
              </span>
              <span className="num w-20 shrink-0 text-right">{fmt(r)}</span>
              <span className="num w-10 shrink-0 text-right text-xs text-ink-mute">
                {n}件
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2 p-4">
        <h4 className="text-base font-bold">計画どおりに持っていたら</h4>
        <p className="text-sm">
          TPまで保持しなかった手動決済3件を計画どおり決済していたら、この週の合計Rは
          <span className="num font-bold"> +3.90R </span>
          でした（実際との差 <span className="num">+1.70R</span>）。
        </p>
        <p className="text-sm text-ink-sub">
          そのときの感情: 焦り（2件）、不安（1件）
        </p>
      </section>
    </AppWindow>
  );
}
