interface Props {
  title: string;
  description: string;
  onRetry: () => void;
  onOtherTf: () => void;
  height: number;
}

/** チャートが出せないとき（取得失敗・データ無し）の表示。価格・根拠・結果は別に見られる */
export function ChartMessage({
  title,
  description,
  onRetry,
  onOtherTf,
  height,
}: Props) {
  return (
    <div
      role="alert"
      style={{ minHeight: height }}
      className="flex flex-col items-center justify-center gap-2 rounded-btn border border-dashed border-field p-4 text-center"
    >
      <b>{title}</b>
      <span className="text-sm text-ink-sub">{description}</span>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={onRetry}>
          再読み込み
        </button>
        <button type="button" className="btn" onClick={onOtherTf}>
          別の時間足を見る
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-sub">
        チャートがなくても、価格・根拠・結果は記録できます。
      </p>
    </div>
  );
}
