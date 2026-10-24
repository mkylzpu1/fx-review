import { useState } from "react";
import { useSettings } from "@/features/settings/hooks/useSettingsApi";
import { formatYenSigned } from "@/utils/format";
import { useTodayStats } from "../hooks/useStats";
import {
  loadDailyLossLimit,
  saveDailyLossLimit,
  todayWarnings,
} from "../utils/todayStatus";

/** 今日（JST）の状況。日次損失の上限と連敗を超えたら、文字つきで警告する */
export function TodayStatus() {
  const { data } = useTodayStats();
  const { data: settings } = useSettings();
  const [limit, setLimit] = useState<number | null>(loadDailyLossLimit);
  const [draft, setDraft] = useState(limit === null ? "" : String(limit));

  if (!data) return null;
  const s = data.summary;
  const warnings = todayWarnings(s, settings?.balanceJpy ?? 0, limit);

  const commit = () => {
    const v = Number(draft);
    const next = draft.trim() !== "" && Number.isFinite(v) && v > 0 ? v : null;
    setLimit(next);
    setDraft(next === null ? "" : String(next));
    saveDailyLossLimit(next);
  };

  return (
    <section className="card space-y-2" aria-label="今日の状況">
      <h2 className="text-base font-bold">今日の状況</h2>
      {warnings.map((w) => (
        <p
          key={w.kind}
          role="alert"
          className="rounded-card border border-caution px-3 py-2 text-sm text-caution"
        >
          {w.kind === "daily_loss"
            ? `⚠ 今日の損失が口座の${w.lossPct}%に達しました（上限 ${w.limitPct}%）。今日はここで止めることを検討してください。`
            : `⚠ 今日は${w.streak}連敗しています。次のエントリーの前に、ルールを確認しましょう。`}
        </p>
      ))}
      <p className="text-sm text-ink-sub">
        {s.n === 0 ? (
          "今日はまだ決済したトレードがありません。"
        ) : (
          <>
            今日 <span className="num">{s.n}</span>件 ・ 損益{" "}
            <span className="num">{formatYenSigned(s.totalPnlJpy)}</span>
          </>
        )}
      </p>
      <label className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
        日次損失の上限（口座に対する%）
        <input
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          className="input w-20"
          value={draft}
          placeholder="未設定"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
        <span>この端末に保存します</span>
      </label>
    </section>
  );
}
