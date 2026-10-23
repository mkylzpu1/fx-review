import { useState } from "react";
import { FieldError } from "@/components/common/FieldError";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { toast } from "@/stores/toastStore";
import { ApiError } from "@/services/apiClient";
import {
  useCreatePair,
  usePairs,
  useUpdatePair,
} from "../hooks/useSettingsApi";

export function CurrencyPairsSection() {
  const { data: pairs, isLoading, isError, refetch } = usePairs();
  const create = useCreatePair();
  const update = useUpdatePair();
  const [adding, setAdding] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [pipSize, setPipSize] = useState("0.01");
  const [pipValue, setPipValue] = useState("1000");
  const [error, setError] = useState<string>();

  const submit = () => {
    if (!/^[A-Z]{6}$/.test(symbol))
      return setError("USDJPY のように大文字6文字で入力してください");
    if (!(Number(pipSize) > 0) || !(Number(pipValue) > 0))
      return setError("0より大きい値を入力してください");
    setError(undefined);
    create.mutate(
      {
        symbol,
        pipSize: Number(pipSize),
        pipValueJpyPerLot: Number(pipValue),
        showInPicker: true,
      },
      {
        onSuccess: () => {
          toast.success(`${symbol} を追加しました`);
          setAdding(false);
          setSymbol("");
        },
        onError: (e) =>
          setError(
            e instanceof ApiError
              ? e.message
              : "通信を確認して、もう一度試してください。",
          ),
      },
    );
  };

  return (
    <section id="pairs" className="card">
      <h2 className="text-base font-bold">通貨ペア</h2>
      <p className="mt-1 text-xs text-ink-mute">
        pipsと円の損益を計算するための値です。
      </p>
      {isLoading && <LoadingSpinner fullScreen={false} />}
      {isError && <ErrorAlert onRetry={() => void refetch()} />}
      {pairs && (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-ink-mute">
            <tr>
              <th className="py-2 font-normal">通貨ペア</th>
              <th className="font-normal">1 pip の価格幅</th>
              <th className="font-normal">1 lot・1 pip あたり（円）</th>
              <th className="text-right font-normal">記録画面の候補</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-3 font-bold">{p.symbol}</td>
                <td className="num">{p.pipSize}</td>
                <td className="num">
                  {p.pipValueJpyPerLot.toLocaleString("ja-JP")}
                </td>
                <td className="text-right">
                  <button
                    className="btn min-h-touch"
                    aria-pressed={p.showInPicker}
                    onClick={() =>
                      update.mutate({ id: p.id, showInPicker: !p.showInPicker })
                    }
                  >
                    {p.showInPicker ? "表示" : "非表示"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {adding ? (
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-4">
          <div>
            <input
              aria-label="通貨ペア"
              placeholder="EURJPY"
              className="input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>
          <input
            aria-label="1 pip の価格幅"
            className="input"
            value={pipSize}
            onChange={(e) => setPipSize(e.target.value)}
          />
          <input
            aria-label="1 lot・1 pip あたり（円）"
            className="input"
            value={pipValue}
            onChange={(e) => setPipValue(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={submit}
              disabled={create.isPending}
            >
              追加
            </button>
            <button className="btn" onClick={() => setAdding(false)}>
              キャンセル
            </button>
          </div>
          <div className="sm:col-span-4">
            <FieldError message={error} />
          </div>
        </div>
      ) : (
        <button className="btn mt-3" onClick={() => setAdding(true)}>
          通貨ペアを追加
        </button>
      )}
    </section>
  );
}
