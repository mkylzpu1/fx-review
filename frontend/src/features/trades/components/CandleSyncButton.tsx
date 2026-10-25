import { toast } from "@/stores/toastStore";
import {
  CANDLE_SYNC_URL,
  SyncServerUnreachable,
  useCandleSync,
} from "@/features/settings/hooks/useCandleSync";

interface Props {
  /** 指定すると、そのトレードの時間帯だけ更新する（詳細画面）。省略すると全トレード分（一覧画面） */
  tradeId?: string;
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/**
 * MT5のローソク足の更新ボタン。MT5のEAが書き出したCSVから、トレードの時間帯
 * （1日足で見せる範囲）の1分足をDBへ取り込む。取り込み済みの足は重複しない。
 * 手順が2つあると一目でわかるよう、番号つきの手順とボタンを1つの枠にまとめて見せる。
 */
export function CandleSyncButton({ tradeId }: Props) {
  const sync = useCandleSync();
  const label = tradeId ? "このトレードの足を更新" : "全トレードの足を更新";

  const onClick = () =>
    sync.mutate(tradeId ? { tradeId } : undefined, {
      onSuccess: (r) =>
        toast.success(
          r.fetched > 0
            ? `ローソク足を更新しました（${r.fetched}本を確認）`
            : "取り込める足がありませんでした。MT5の「CSV書き出し」を先に押したか確認してください",
        ),
      onError: (e) =>
        toast.error(
          e instanceof SyncServerUnreachable
            ? "同期サーバーに接続できません。make dev で起動しているか確認してください。"
            : `ローソク足を更新できませんでした。${e instanceof Error ? e.message : ""}`,
        ),
    });

  if (!CANDLE_SYNC_URL)
    return (
      <p className="text-xs text-ink-mute">
        ローソク足の更新は、手元で make dev から起動したときだけ使えます。
      </p>
    );

  return (
    <div aria-label="ローソク足の更新" className="text-sm">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-ink-sub underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
        disabled={sync.isPending}
        onClick={onClick}
      >
        <RefreshIcon spinning={sync.isPending} />
        {sync.isPending ? "更新中…" : label}
      </button>
      <details className="mt-1 text-xs text-ink-mute">
        <summary className="cursor-pointer">手順</summary>
        <ol className="mt-1 list-inside list-decimal space-y-0.5">
          <li>MT5のチャートで「CSV書き出し」を押す</li>
          <li>上のリンクで取り込む（押し忘れると古い足のままです）</li>
        </ol>
      </details>
    </div>
  );
}
