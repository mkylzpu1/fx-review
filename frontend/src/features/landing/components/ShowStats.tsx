import { useMemo, useState } from "react";
import { AppWindow } from "./AppWindow";

const METRICS = [
  ["勝率", "61%", "n=84"],
  ["PF", "1.84", ""],
  ["平均R", "+0.41R", ""],
  ["最大連敗", "4連敗", ""],
  ["合計pips", "+312.6", ""],
  ["累積R", "+17.20R", ""],
] as const;

type Verdict = "強み" | "弱み" | "要検証";
type Row = [label: string, r: string, n: number, v: Verdict];

const GROUPS: { key: string; title: string; rows: Row[] }[] = [
  {
    key: "session",
    title: "セッション別",
    rows: [
      ["東京", "−0.35R", 18, "弱み"],
      ["ロンドン", "+0.78R", 34, "強み"],
      ["ニューヨーク", "+0.21R", 27, "強み"],
      ["重なりの時間", "+0.55R", 5, "要検証"],
    ],
  },
  {
    key: "rationale",
    title: "根拠タグ別",
    rows: [
      ["押し目", "+0.71R", 29, "強み"],
      ["ブレイクアウト", "−0.22R", 21, "弱み"],
      ["逆張り", "+0.90R", 4, "要検証"],
    ],
  },
  {
    key: "weekday",
    title: "曜日別",
    rows: [
      ["月", "+0.30R", 15, "強み"],
      ["火", "+0.55R", 17, "強み"],
      ["水", "+0.62R", 16, "強み"],
      ["木", "−0.41R", 16, "弱み"],
      ["金", "−0.72R", 12, "要検証"],
    ],
  },
  {
    key: "hour",
    title: "時間帯別",
    rows: [
      ["9〜11時", "+0.52R", 24, "強み"],
      ["16〜20時", "+0.18R", 9, "要検証"],
      ["21〜23時", "−0.60R", 19, "弱み"],
    ],
  },
  {
    key: "lots",
    title: "ロット別",
    rows: [
      ["0.5以下", "+0.48R", 38, "強み"],
      ["0.6〜1.0", "−0.15R", 24, "弱み"],
      ["1.0超", "−0.90R", 7, "要検証"],
    ],
  },
];

const PERIODS = ["今日", "過去90日", "過去30日", "今月", "すべて"];
const VCOL: Record<Verdict, string> = {
  強み: "text-profit",
  弱み: "text-loss",
  要検証: "text-caution",
};

/** 累積Rの見本（決まった乱数）。右肩上がりだが、途中で凹む */
function cumulative(): number[] {
  let s = 91;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  let v = 0;
  return Array.from({ length: 42 }, () => (v += (r() - 0.4) * 1.3));
}

/** 実アプリの統計。条件別の表は、タブを押して切り替えられる */
export function ShowStats() {
  const [tab, setTab] = useState("session");
  const g = GROUPS.find((x) => x.key === tab)!;

  const path = useMemo(() => {
    const v = cumulative();
    const lo = Math.min(...v, 0);
    const hi = Math.max(...v);
    const pts = v.map(
      (y, i) =>
        `${((i / (v.length - 1)) * 600).toFixed(1)},${(8 + ((hi - y) / (hi - lo)) * 84).toFixed(1)}`,
    );
    return { line: `M${pts.join(" L")}`, zero: 8 + (hi / (hi - lo)) * 84 };
  }, []);

  return (
    <AppWindow active="統計" label="統計の画面（条件別の成績と強み・弱み）">
      <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
        <h4 className="mr-2 text-base font-bold">統計</h4>
        {PERIODS.map((p) => (
          <span
            key={p}
            className={`rounded-btn border px-3 py-1 text-xs ${
              p === "過去90日"
                ? "border-accent bg-accent/10 text-accent-link"
                : "border-field text-ink-sub"
            }`}
          >
            {p}
          </span>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {METRICS.map(([k, v, note]) => (
          <div key={k} className="rounded-card border border-line p-3">
            <dt className="text-xs text-ink-mute">{k}</dt>
            <dd className="num text-lg font-bold">{v}</dd>
            {note && <dd className="text-xs text-ink-mute">{note}</dd>}
          </div>
        ))}
      </dl>

      <section className="card space-y-1 p-4">
        <h4 className="text-base font-bold">累積R</h4>
        <svg
          viewBox="0 0 600 100"
          className="block h-24 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="累積Rの推移（見本）"
        >
          <line
            x1="0"
            x2="600"
            y1={path.zero}
            y2={path.zero}
            stroke="#2A4A3C"
            strokeDasharray="4 4"
          />
          <path
            d={path.line}
            fill="none"
            stroke="#6EE7C8"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </section>

      <section className="card space-y-2 p-4">
        <div
          role="tablist"
          aria-label="条件"
          className="flex flex-wrap gap-1.5"
        >
          {GROUPS.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={`rounded-chip border px-3 py-1 text-xs ${
                tab === x.key
                  ? "border-accent bg-accent/10 text-accent-link"
                  : "border-line text-ink-sub"
              }`}
            >
              {x.title}
            </button>
          ))}
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">{g.title}の平均R</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-mute">
              <th className="py-2 font-normal">区分</th>
              <th className="text-right font-normal">平均R</th>
              <th className="text-right font-normal">n</th>
              <th className="pl-3 font-normal">判定</th>
            </tr>
          </thead>
          <tbody>
            {g.rows.map(([label, r, n, v]) => (
              <tr key={label} className="border-b border-line">
                <td className="py-2">{label}</td>
                <td
                  className={`num text-right ${r.startsWith("−") ? "text-loss" : "text-profit"}`}
                >
                  {r}
                </td>
                <td className="num text-right">n={n}</td>
                <td className={`pl-3 text-xs ${VCOL[v]}`}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-ink-mute">
          15件に満たない区分は「要検証」にして、強み・弱みを言い切りません。
        </p>
      </section>
    </AppWindow>
  );
}
