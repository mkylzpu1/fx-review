import { useState } from "react";
import type { AccountSettings, Timeframe } from "@/features/settings/types";
import { TIMEFRAMES } from "@/features/settings/types";
import { downloadText } from "@/features/export/utils/download";
import { apiClient } from "@/services/apiClient";
import { toast } from "@/stores/toastStore";
import { formatJst } from "@/utils/format";
import type { CandlesResponse, Trade } from "../types";
import { chartRange } from "../utils/chartRange";
import { buildShareHtml, type ShareFrame } from "../utils/shareHtml";
import { toQueryString } from "../hooks/useTradesApi";

const BARS_BEFORE = 150;
const BARS_AFTER = 100;
const FALLBACK_EMAS = [
  { period: 20, visible: true },
  { period: 50, visible: true },
];

/** 評価をお願いする相手に渡す、閲覧専用の単体HTMLファイルを書き出す */
export function ShareHtmlButton({
  trade,
  pipSize,
  settings,
}: {
  trade: Trade;
  pipSize: number;
  settings: AccountSettings | null;
}) {
  const [includeReasons, setIncludeReasons] = useState(true);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const emas = settings?.emaSettings ?? FALLBACK_EMAS;
      const periods = emas.map((e) => e.period);
      const results = await Promise.all(
        TIMEFRAMES.map(async (tf): Promise<ShareFrame | null> => {
          const range = chartRange({
            entryAt: trade.entryAt,
            exitAt: trade.exitAt,
            tf,
            barsBefore: BARS_BEFORE,
            barsAfter: BARS_AFTER,
            emaPeriods: periods,
          });
          try {
            const res = await apiClient.get<CandlesResponse>(
              `/candles${toQueryString({ tf, ...range })}`,
            );
            return res.candles.length === 0
              ? null
              : { tf, warmupCount: res.warmupCount, candles: res.candles };
          } catch {
            return null;
          }
        }),
      );
      const frames = results.filter((f): f is ShareFrame => f !== null);
      if (frames.length === 0) {
        toast.error(
          "ローソク足がまだ保存されていないため、書き出せません。先に足の更新をしてください。",
        );
        return;
      }
      // 描画ライブラリ（約200KB）は、書き出すときだけ読み込む。
      // package exports に standalone 版が無いので、ファイルを直接文字列として読む
      const { default: librarySource } =
        await import("../../../../node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js?raw");
      const html = buildShareHtml({
        trade,
        pipSize,
        frames,
        emas,
        includeReasons,
        defaultTf: (settings?.chartDefaultTf ?? "5m") as Timeframe,
        librarySource,
      });
      const stamp = formatJst(trade.entryAt).replace(/[/: ]/g, "");
      downloadText(html, `trade-${trade.pair}-${stamp}.html`, "text/html");
      toast.success(
        frames.length < TIMEFRAMES.length
          ? "書き出しました（足が無い時間足は含まれていません）"
          : "評価用のHTMLファイルを書き出しました",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        className="btn min-h-touch"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "書き出し中…" : "評価用ファイルを書き出す"}
      </button>
      <label className="flex min-h-touch items-center gap-2 text-sm text-ink-sub">
        <input
          type="checkbox"
          checked={includeReasons}
          onChange={(e) => setIncludeReasons(e.target.checked)}
        />
        根拠のタグ・メモ・SL/TPの理由を含める
      </label>
      <p className="w-full text-xs text-ink-mute">
        HTMLファイルを相手に送ると、相手はブラウザで開くだけで、時間足とEMAを自由に切り替えて見られます。損益額・口座・感情タグ・振り返りの記述は含まれません。
      </p>
    </div>
  );
}
