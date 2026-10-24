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
      width="18"
      height="18"
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
    <div
      className="flex w-full flex-col gap-3 rounded-btn border border-line bg-bg p-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="ローソク足の更新"
    >
      <ol className="space-y-1 text-sm text-ink-sub">
        <li className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-xs font-bold text-accent-link">
            1
          </span>
          MT5のチャートで「CSV書き出し」を押す
        </li>
        <li className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-xs font-bold text-accent-link">
            2
          </span>
          右のボタンで取り込む（押し忘れると古い足のままです）
        </li>
      </ol>
      <button
        type="button"
        className="btn-primary flex min-h-touch w-full shrink-0 items-center justify-center gap-2 sm:w-auto"
        disabled={sync.isPending}
        onClick={onClick}
      >
        <RefreshIcon spinning={sync.isPending} />
        {sync.isPending ? "更新中…" : label}
      </button>
    </div>
  );
}
