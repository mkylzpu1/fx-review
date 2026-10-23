import type { Rule } from "@/features/rules/types";
import type { RuleResult } from "../types";

const LABEL: Record<RuleResult, string> = {
  ok: "OK",
  ng: "NG",
  na: "未チェック",
};
const SHOW: RuleResult[] = ["ok", "ng", "na"];

interface RuleCheckPanelProps {
  rules: Rule[];
  /** 手動ルールのチェック */
  checks: Record<string, RuleResult>;
  /** 自動判定ルールの見込み */
  autoResults: Record<string, RuleResult>;
  onChange: (ruleId: string, result: RuleResult) => void;
}

/** 発注前チェック: 手動ルールはその場でOK/NG、自動ルールは入力から判定した見込みを表示 */
export function RuleCheckPanel({
  rules,
  checks,
  autoResults,
  onChange,
}: RuleCheckPanelProps) {
  const active = rules.filter((r) => r.isActive);
  if (active.length === 0) {
    return (
      <p className="text-sm text-ink-mute">
        有効なルールはありません。「ルール」画面で追加できます。
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {active.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <span className="text-sm">{r.title}</span>
          {r.autoKey ? (
            <span className="text-sm text-ink-sub">
              自動判定: <strong>{LABEL[autoResults[r.id] ?? "na"]}</strong>
            </span>
          ) : (
            <div
              role="group"
              aria-label={`${r.title}のチェック`}
              className="flex gap-1"
            >
              {SHOW.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={(checks[r.id] ?? "na") === v}
                  onClick={() => onChange(r.id, v)}
                  className={`min-h-touch rounded-btn border px-3 text-sm ${
                    (checks[r.id] ?? "na") === v
                      ? "border-accent bg-accent/10 text-accent-link"
                      : "border-field text-ink-sub hover:bg-surface"
                  }`}
                >
                  {LABEL[v]}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
