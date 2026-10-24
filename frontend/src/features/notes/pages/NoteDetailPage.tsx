import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/services/apiClient";
import { toast } from "@/stores/toastStore";
import { formatJst } from "@/utils/format";
import { ImprovementList } from "../components/ImprovementList";
import { useDeleteNote, useNote, useToRule } from "../hooks/useNotesApi";

/** AI分析の結果ビュー（自分の気づきも同じ画面で見る）。パースできない回答は原文を出す */
export function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useNote(id);
  const del = useDeleteNote();
  const toRule = useToRule(id ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;

  const addRule = (improvementId: string) => {
    setBusyId(improvementId);
    toRule.mutate(improvementId, {
      onSuccess: () =>
        toast.success("ルールに追加しました。これから10件で効果を検証します"),
      onError: (e) =>
        toast.error(
          e instanceof ApiError && e.status === 409
            ? "この改善案は、すでにルールにしています。"
            : "追加できませんでした。通信を確認して、もう一度試してください。",
        ),
      onSettled: () => setBusyId(null),
    });
  };

  const hasStructure = data.sections.length > 0 || data.improvements.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={ROUTES.NOTES}
            className="text-sm text-accent-link underline"
          >
            ← 学習メモ
          </Link>
          <h1 className="mt-1 text-xl font-bold">{data.title}</h1>
          <p className="text-xs text-ink-mute">
            {data.kind === "ai" ? "AIの分析" : "自分の気づき"}
            {data.aiName ? ` ・ ${data.aiName}` : ""}
            {data.dataRangeLabel
              ? ` ・ 渡したデータ: ${data.dataRangeLabel}`
              : ""}
            {" ・ "}
            <span className="num">{formatJst(data.createdAt)}</span>
          </p>
        </div>
        <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
          削除
        </button>
      </div>

      {data.kind === "self" ? (
        <section className="card space-y-2">
          {data.body && (
            <p className="whitespace-pre-wrap text-sm">{data.body}</p>
          )}
          {data.nextRule && (
            <p className="text-sm">
              <span className="text-xs text-ink-mute">次回のルール</span>
              <br />
              {data.nextRule}
            </p>
          )}
          {data.emotionTags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="感情タグ">
              {data.emotionTags.map((t) => (
                <li key={t} className="rounded-chip bg-tag px-2 py-1 text-xs">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {data.body && (
            <section className="card space-y-1">
              <h2 className="text-base font-bold">回答の要約</h2>
              <p className="text-sm text-ink-sub">{data.body}</p>
            </section>
          )}

          {!hasStructure && (
            <section className="card space-y-1">
              <h2 className="text-base font-bold">回答（原文）</h2>
              <p className="text-xs text-ink-mute">
                改善案を自動で取り出せなかったため、原文をそのまま表示しています。
              </p>
              <pre className="whitespace-pre-wrap text-sm">
                {data.rawResponse}
              </pre>
            </section>
          )}

          {data.sections
            .filter((s) => s.heading && s.lines.length > 0)
            .map((s) => (
              <section key={s.heading} className="card space-y-1">
                <h2 className="text-base font-bold">{s.heading}</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-sub">
                  {s.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </section>
            ))}

          <ImprovementList
            items={data.improvements}
            busyId={busyId}
            onToRule={addRule}
          />

          {hasStructure && data.rawResponse && (
            <details className="card">
              <summary className="min-h-touch cursor-pointer text-sm font-bold">
                原文を見る
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-ink-sub">
                {data.rawResponse}
              </pre>
            </details>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="このメモを削除しますか？"
        description="改善案も一緒に消えます。ルールにした改善案のルールは残ります。"
        confirmLabel="削除する"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          del.mutate(data.id, {
            onSuccess: () => {
              toast.success("メモを削除しました");
              navigate(ROUTES.NOTES);
            },
            onError: () =>
              toast.error(
                "削除できませんでした。通信を確認して、もう一度試してください。",
              ),
            onSettled: () => setConfirmDelete(false),
          })
        }
      />
    </div>
  );
}
