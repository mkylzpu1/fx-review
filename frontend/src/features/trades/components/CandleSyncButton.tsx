import { toast } from "@/stores/toastStore";
import {
  CANDLE_SYNC_URL,
  SyncServerUnreachable,
  useCandleSync,
} from "@/features/settings/hooks/useCandleSync";

/**
 * MT5のローソク足の更新ボタン。MT5のEAが書き出したCSVから、登録済みトレードの時間帯
 * （1日足で見せる範囲）の1分足をDBへ取り込む。取り込み済みの足は重複しない。
 */
export function CandleSyncButton() {
  const sync = useCandleSync();

  const onClick = () =>
    sync.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          r.fetched > 0
            ? `ローソク足を更新しました（${r.fetched}本を確認）`
            : "取り込める足がありませんでした。先にMT5のチャートの「CSV書き出し」ボタンを押したか確認してください",
        ),
      onError: (e) =>
        toast.error(
          e instanceof SyncServerUnreachable
            ? "同期サーバーに接続できません。make dev で起動しているか確認してください。"
            : `ローソク足を更新できませんでした。${e instanceof Error ? e.message : ""}`,
        ),
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn"
        disabled={!CANDLE_SYNC_URL || sync.isPending}
        onClick={onClick}
      >
        {sync.isPending ? "更新中…" : "ローソク足を更新"}
      </button>
      <p className="max-w-xs text-right text-xs text-ink-mute">
        {CANDLE_SYNC_URL
          ? "MT5のチャートで「CSV書き出し」を押してから、このボタンを押してください。押さないと、MT5の新しい足は反映されません。"
          : "この環境では使えません（手元で make dev から起動したときだけ使えます）。"}
      </p>
    </div>
  );
}
