import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import {
  usePairs,
  useSettings,
} from "@/features/settings/hooks/useSettingsApi";
import { useHotkeys } from "@/hooks/useHotkeys";
import { ApiError } from "@/services/apiClient";
import { toast } from "@/stores/toastStore";
import { ChartPanel } from "../components/ChartPanel";
import { TradeDetailBody } from "../components/TradeDetailBody";
import { TradeDetailHeader } from "../components/TradeDetailHeader";
import { useChartUiStore } from "../chartUiStore";
import {
  useAdjacentTrades,
  useDeleteTrade,
  useRestoreTrade,
  useTrade,
} from "../hooks/useTradesApi";

export function TradeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: trade, isLoading, error, refetch } = useTrade(id);
  const pairs = usePairs();
  const settings = useSettings();
  const del = useDeleteTrade();
  const restore = useRestoreTrade();
  const [confirming, setConfirming] = useState(false);
  const { prev, next } = useAdjacentTrades(trade);
  const detailPath = (tid: string) => ROUTES.TRADE_DETAIL.replace(":id", tid);

  // 前後のトレードへ移っても全画面のまま見返せる。詳細画面を離れるときだけ全画面を解除する
  useEffect(() => () => useChartUiStore.getState().setFullscreen(false), []);

  // ←: 前（古い） / →: 次（新しい） / E: 編集
  useHotkeys(
    {
      ArrowLeft: () => prev && navigate(detailPath(prev.id)),
      ArrowRight: () => next && navigate(detailPath(next.id)),
      e: () => trade && navigate(ROUTES.TRADE_EDIT.replace(":id", trade.id)),
    },
    !!trade,
  );

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <EmptyState
        title="このトレードは見つかりません"
        description="削除されたか、URLが正しくない可能性があります。"
        action={
          <Link className="btn" to={ROUTES.TRADES}>
            トレード一覧へ
          </Link>
        }
      />
    );
  }
  if (error || !trade) return <ErrorAlert onRetry={() => void refetch()} />;

  const pipSize =
    pairs.data?.find((p) => p.symbol === trade.pair)?.pipSize ?? 0.01;

  const onDelete = () => {
    del.mutate(trade.id, {
      onSuccess: () => {
        setConfirming(false);
        navigate(ROUTES.TRADES);
        toast.success("トレードを削除しました", {
          label: "取り消す",
          onClick: () =>
            restore.mutate(trade.id, {
              onSuccess: () => toast.success("削除を取り消しました"),
              onError: () =>
                toast.error("取り消せませんでした。もう一度試してください。"),
            }),
        });
      },
      onError: () => {
        setConfirming(false);
        toast.error(
          "削除できませんでした。通信を確認して、もう一度試してください。",
        );
      },
    });
  };

  return (
    <div className="space-y-3">
      <TradeDetailHeader
        trade={trade}
        prev={prev}
        next={next}
        detailPath={detailPath}
        onDelete={() => setConfirming(true)}
      />

      {/* minmax(0,1fr): 中身（チャート）の幅に引っ張られて列が広がったままにならないようにする */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {settings.isLoading ? (
            <div className="card grid min-h-[24rem] place-items-center">
              <LoadingSpinner fullScreen={false} />
            </div>
          ) : (
            // 時間足・EMA・凡例などの表示設定は、別のトレードに移っても引き継ぐ
            <ChartPanel
              trade={trade}
              pipSize={pipSize}
              settings={settings.data ?? null}
            />
          )}
        </div>
        <TradeDetailBody trade={trade} pipSize={pipSize} />
      </div>

      <ConfirmDialog
        open={confirming}
        title="このトレードを削除しますか？"
        description="削除した直後なら、通知の「取り消す」で元に戻せます。"
        confirmLabel="削除する"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
