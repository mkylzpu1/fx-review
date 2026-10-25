import { useState } from "react";
import type { AccountSettings, Timeframe } from "@/features/settings/types";
import { TIMEFRAMES } from "@/features/settings/types";
import { CANDLE_SYNC_URL } from "@/features/settings/hooks/useCandleSync";
import { apiClient } from "@/services/apiClient";
import { toast } from "@/stores/toastStore";
import { formatJst } from "@/utils/format";
import type { CandlesResponse, Trade } from "../types";
import { chartRange } from "../utils/chartRange";
import { buildShareHtml, type ShareFrame } from "../utils/shareHtml";
import { toQueryString } from "../hooks/useTradesApi";
import {
  ShareServerUnreachable,
  publishShare,
  type PublishedShare,
} from "../hooks/usePublishShare";

const BARS_BEFORE = 150;
const BARS_AFTER = 100;
const FALLBACK_EMAS = [
  { period: 20, visible: true },
  { period: 50, visible: true },
];

/**
 * 評価をお願いする相手に見せる、操作できるチャートを公開して、URLを返す。
 * 公開したものは、24時間たつとCloudflare側が自動で消す。
 */
export function SharePublishButton({
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
  const [published, setPublished] = useState<PublishedShare | null>(null);

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
          "ローソク足がまだ保存されていないため、公開できません。先に足の更新をしてください。",
        );
        return;
      }
      // 描画ライブラリ（約200KB）は、公開するときだけ読み込む。
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
      const result = await publishShare(html);
      setPublished(result);
      toast.success(
        frames.length < TIMEFRAMES.length
          ? "公開しました（足が無い時間足は含まれていません）"
          : "公開しました。URLを相手に送ってください",
      );
    } catch (e) {
      toast.error(
        e instanceof ShareServerUnreachable
          ? "公開用のサーバーに届きません。make dev で起動しているか確認してください"
          : e instanceof Error
            ? e.message
            : "公開できませんでした",
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(published.url);
      toast.success("URLをコピーしました");
    } catch {
      toast.error(
        "コピーできませんでした。URLを選んで、手でコピーしてください",
      );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="btn-primary min-h-touch"
          disabled={busy || !CANDLE_SYNC_URL}
          title={
            CANDLE_SYNC_URL
              ? "評価をお願いする相手に見せるチャートを公開して、URLを作ります"
              : "公開は、手元で make dev から起動したときだけ使えます"
          }
          onClick={() => void run()}
        >
          {busy ? "公開中…" : "公開してURLを作る"}
        </button>
        <label className="flex min-h-touch items-center gap-2 text-sm text-ink-sub">
          <input
            type="checkbox"
            checked={includeReasons}
            onChange={(e) => setIncludeReasons(e.target.checked)}
          />
          根拠のタグ・メモ・SL/TPの理由を含める
        </label>
      </div>

      {published && (
        <div
          className="space-y-2 rounded-card border border-line p-3"
          role="status"
          aria-label="公開したURL"
        >
          <p className="text-sm">
            公開しました。このURLを相手に送ってください。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              aria-label="公開したURL"
              className="input num min-w-0 flex-1"
              value={published.url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="btn min-h-touch"
              onClick={() => void copy()}
            >
              コピー
            </button>
            <a
              className="btn min-h-touch"
              href={published.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              開く
            </a>
          </div>
          <p className="text-xs text-ink-sub">
            <span className="num">{formatJst(published.expiresAt)}</span>
            （24時間後）に自動で消えます。そのあとは、URLを開いても見られません。
          </p>
        </div>
      )}

      <p className="text-xs text-ink-mute">
        URLを知っている人は、誰でも24時間見られます（ログインはありません）。時間足・EMAは相手が自由に切り替えられます。損益額・口座・感情タグ・振り返りの記述は含まれません。
      </p>
    </div>
  );
}
