import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ROUTES } from "@/constants/routes";
import { downloadText } from "@/features/export/utils/download";
import { toast } from "@/stores/toastStore";
import {
  useDeleteAllData,
  useFetchBackup,
  useRestoreBackup,
} from "../hooks/useDataApi";
import {
  backupFilename,
  readBackupText,
  readFileText,
} from "../utils/backupFile";

const COMM_ERROR =
  "通信を確認して、もう一度試してください。いまのデータは変わっていません。";

function Row({
  title,
  desc,
  danger,
  children,
}: {
  title: string;
  desc: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className={`text-sm font-bold ${danger ? "text-loss" : ""}`}>
          {title}
        </p>
        <p className="text-xs text-ink-mute">{desc}</p>
      </div>
      {children}
    </li>
  );
}

/** バックアップ保存・復元・全削除。復元と削除は確認ダイアログを挟む */
export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fetchBackup = useFetchBackup();
  const restore = useRestoreBackup();
  const deleteAll = useDeleteAllData();

  const onSaveBackup = () =>
    fetchBackup.mutate(undefined, {
      onSuccess: (data) => {
        downloadText(
          JSON.stringify(data, null, 2),
          backupFilename(),
          "application/json",
        );
        toast.success("バックアップを保存しました");
      },
      onError: () =>
        toast.error(`バックアップを取得できませんでした。${COMM_ERROR}`),
    });

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      toast.error("ファイルを読み込めませんでした。もう一度選んでください。");
      return;
    }
    const result = readBackupText(text, file.size);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setPending(result.body);
  };

  const onConfirmRestore = () => {
    const body = pending;
    setPending(null);
    restore.mutate(body, {
      onSuccess: (r) =>
        toast.success(`バックアップから復元しました（トレード${r.trades}件）`),
      onError: (e) =>
        toast.error(
          e instanceof Error && e.message
            ? e.message
            : `復元できませんでした。${COMM_ERROR}`,
        ),
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const onConfirmDelete = () => {
    setConfirmDelete(false);
    deleteAll.mutate(undefined, {
      onSuccess: () => toast.success("すべてのデータを削除しました"),
      onError: () => toast.error(`削除できませんでした。${COMM_ERROR}`),
    });
  };

  return (
    <section id="data" className="card">
      <h2 className="text-base font-bold">データ</h2>
      <p className="mt-1 text-xs text-ink-mute">
        AIに渡すためのまとめ出力は{" "}
        <Link to={ROUTES.EXPORT} className="text-accent-link underline">
          エクスポート
        </Link>{" "}
        から行います。
      </p>
      <ul className="mt-3 divide-y divide-line">
        <Row
          title="楽天FX証券のCSVを取り込む"
          desc="約定履歴から、トレードをまとめて登録します。"
        >
          <Link className="btn shrink-0" to={ROUTES.TRADE_IMPORT}>
            取り込み画面へ
          </Link>
        </Row>
        <Row
          title="バックアップを保存"
          desc="トレード・ルール・メモ・設定をまとめてJSONで保存します。"
        >
          <button
            className="btn shrink-0"
            disabled={fetchBackup.isPending}
            onClick={onSaveBackup}
          >
            JSONを保存
          </button>
        </Row>
        <Row
          title="バックアップから復元"
          desc="保存したJSONを読み込みます。いまのデータは置き換わります。"
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="バックアップのJSONファイル"
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
          <button
            className="btn shrink-0"
            disabled={restore.isPending}
            onClick={() => fileRef.current?.click()}
          >
            ファイルを選ぶ
          </button>
        </Row>
        <Row title="MT5の履歴を取り込む" desc="準備中です。">
          <button className="btn shrink-0" disabled>
            準備中
          </button>
        </Row>
        <Row
          danger
          title="すべてのデータを削除"
          desc="トレードと、ルール・メモ・設定を消します。元に戻せません。"
        >
          <button
            className="btn-danger shrink-0"
            disabled={deleteAll.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            削除する
          </button>
        </Row>
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title="バックアップから復元しますか？"
        description="いまのトレード・ルール・メモ・設定は、バックアップの内容で置き換わります。元に戻せないので、必要なら先にバックアップを保存してください。"
        confirmLabel="復元する"
        danger
        onConfirm={onConfirmRestore}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="すべてのデータを削除しますか？"
        description="トレード・ルール・学習メモ・設定をすべて消します。元に戻せません。アカウントは残り、削除後は最初の設定からやり直せます。先にバックアップを保存することをおすすめします。"
        confirmLabel="すべて削除する"
        danger
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
