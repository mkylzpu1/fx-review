import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { usePairs } from "@/features/settings/hooks/useSettingsApi";
import { ApiError } from "@/services/apiClient";
import { toast } from "@/stores/toastStore";
import { RecentTrades } from "../components/RecentTrades";
import { TradeDetailBody } from "../components/TradeDetailBody";
import {
  useDeleteTrade,
  useRestoreTrade,
  useTrade,
} from "../hooks/useTradesApi";

export function TradeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: trade, isLoading, error, refetch } = useTrade(id);
  const pairs = usePairs();
  const del = useDeleteTrade();
  const restore = useRestoreTrade();
  const [confirming, setConfirming] = useState(false);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link className="text-sm text-accent-link underline" to={ROUTES.TRADES}>
          一覧に戻る
        </Link>
        <div className="flex gap-2">
          <Link
            className="btn-primary"
            to={ROUTES.TRADE_EDIT.replace(":id", trade.id)}
          >
            編集・決済入力
          </Link>
          <button className="btn-danger" onClick={() => setConfirming(true)}>
            削除
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <RecentTrades currentId={trade.id} />
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
