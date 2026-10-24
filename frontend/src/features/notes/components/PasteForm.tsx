import { useState } from "react";
import { AI_NAMES, type AiName } from "../types";

const RANGES = ["すべて", "直近30日", "今月", "その他"] as const;
export const MAX_RAW_CHARS = 100_000;

interface Props {
  busy: boolean;
  error: string | null;
  onSubmit: (v: {
    aiName: AiName;
    dataRangeLabel: string;
    rawResponse: string;
  }) => void;
}

/** AIの回答を貼り付けて、改善案を1行ずつ取り出して保存する */
export function PasteForm({ busy, error, onSubmit }: Props) {
  const [aiName, setAiName] = useState<AiName>("Claude");
  const [range, setRange] = useState<string>("直近30日");
  const [raw, setRaw] = useState("");
  const tooLong = raw.length > MAX_RAW_CHARS;
  const empty = raw.trim() === "";

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty && !tooLong)
          onSubmit({ aiName, dataRangeLabel: range, rawResponse: raw });
      }}
    >
      <h2 className="text-base font-bold">AIの回答を貼り付ける</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          使ったAI
          <select
            className="input mt-1"
            value={aiName}
            onChange={(e) => setAiName(e.target.value as AiName)}
          >
            {AI_NAMES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          渡したデータの範囲
          <select
            className="input mt-1"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {RANGES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        AIの回答
        <textarea
          className="input mt-1 min-h-40 py-2 font-sans"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="回答をここに貼り付けます。番号付きの行や箇条書きを、改善案として取り出します。"
          aria-invalid={tooLong}
        />
      </label>
      {tooLong && (
        <p role="alert" className="text-sm text-loss">
          回答が長すぎます（{MAX_RAW_CHARS.toLocaleString("ja-JP")}
          文字まで）。要点だけを貼り付けてください。
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy || empty || tooLong}>
          {busy ? "保存中…" : "改善案を取り出して保存"}
        </button>
      </div>
    </form>
  );
}
