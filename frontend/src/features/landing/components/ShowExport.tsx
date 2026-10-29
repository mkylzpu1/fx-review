import { useState } from "react";
import { AppWindow } from "./AppWindow";

const INCLUDES = [
  [
    "result",
    "トレード結果",
    "決済価格・pips・R・損益・保有時間・MFE/MAE",
    "- 結果: +12.7 pips / +1.81R / 保有26分 / MFE +15.5 / MAE −2.9",
  ],
  [
    "planDiff",
    "計画と実際の差",
    "SL・TP・計画RR・想定リスク・理由",
    "- 計画: SL 7.0 / TP 16.0 / RR 1:2.3 / 想定リスク ¥7,000",
  ],
  [
    "rationale",
    "エントリー根拠とタグ",
    "根拠タグ・根拠メモ",
    "- 根拠: 押し目（EMA20タッチ）",
  ],
  [
    "ruleChecks",
    "ルール遵守チェック",
    "ルール逸脱の有無",
    "- ルール: 逸脱あり（指標の前は見送る）",
  ],
  [
    "reflection",
    "振り返りメモ・感情タグ",
    "感情・確信度・気づき・次回のルール",
    "- 振り返り: 焦り / 確信度3 / TP直前で手動決済した",
  ],
  ["market", "市場状況", "曜日・セッション", "- 市場: 水曜 / ロンドン"],
] as const;

const FORMATS = ["Markdown", "CSV", "JSON"];

/** 実アプリのエクスポート。含める項目を切り替えると、出力のイメージも変わる */
export function ShowExport() {
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(INCLUDES.map(([k]) => [k, true])),
  );
  const [copied, setCopied] = useState(false);

  return (
    <AppWindow
      active="エクスポート"
      label="エクスポートの画面（AIに貼り付けて分析する出力）"
    >
      <div>
        <h4 className="text-base font-bold">エクスポート</h4>
        <p className="mt-1 text-xs text-ink-sub">
          記録をまとめて出力します。AIに貼り付けて「どう改善すべきか」を分析してもらえます。
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-bold">含める項目</legend>
        {INCLUDES.map(([k, label, desc]) => (
          <label
            key={k}
            className="flex cursor-pointer items-start gap-3 rounded-card border border-line px-3 py-2"
          >
            <input
              type="checkbox"
              checked={on[k]}
              onChange={() => {
                setOn({ ...on, [k]: !on[k] });
                setCopied(false);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-bold">{label}</span>
              <span className="block text-xs text-ink-sub">{desc}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div
        className="flex flex-wrap items-center gap-2 text-xs"
        aria-hidden="true"
      >
        <span className="mr-1 text-ink-sub">形式</span>
        {FORMATS.map((f) => (
          <span
            key={f}
            className={`rounded-btn border px-3 py-1 ${
              f === "Markdown"
                ? "border-accent bg-accent/10 text-accent-link"
                : "border-field text-ink-sub"
            }`}
          >
            {f}
          </span>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs text-ink-mute">出力のイメージ（1件分）</p>
        <pre className="num overflow-x-auto whitespace-pre-wrap rounded-card border border-line bg-card p-3 text-xs leading-relaxed text-ink-sub">
          {[
            "## 10/21 USDJPY 買い",
            ...INCLUDES.filter(([k]) => on[k]).map((i) => i[3]),
          ].join("\n")}
        </pre>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={() => setCopied(true)}
      >
        {copied ? "コピーしました" : "コピーする"}
      </button>
      {copied && (
        <p role="status" className="text-xs text-ink-sub">
          AIの入力欄に貼り付けてください。
        </p>
      )}
    </AppWindow>
  );
}
