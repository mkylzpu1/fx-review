import { useState } from "react";
import type { GroupPnlStat } from "../types";
import { GroupPnlChart } from "./GroupPnlChart";

interface Props {
  bySession: GroupPnlStat[];
  byHour: GroupPnlStat[];
}

type Mode = "session" | "hour";

const MODES: { value: Mode; label: string }[] = [
  { value: "session", label: "セッション単位" },
  { value: "hour", label: "時間単位" },
];

/** トレードしている時間帯ごとの損益・勝率。東京/ロンドン/NYのセッション単位と、時間（0〜23時）単位を切り替えられる */
export function TimeBandPnlChart({ bySession, byHour }: Props) {
  const [mode, setMode] = useState<Mode>("session");
  const groups = mode === "session" ? bySession : byHour;

  return (
    <div className="space-y-2">
      <div role="group" aria-label="時間帯の区切り方" className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={mode === m.value}
            onClick={() => setMode(m.value)}
            className={`btn !px-3 !py-1 text-xs ${
              mode === m.value ? "border-accent bg-accent/10 text-accent-link" : ""
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-ink-mute">集計できるトレードがまだありません。</p>
      ) : (
        <GroupPnlChart groups={groups} />
      )}
    </div>
  );
}
