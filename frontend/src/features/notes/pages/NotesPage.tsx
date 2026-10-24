import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { Pagination } from "@/features/trades/components/Pagination";
import { formatJst } from "@/utils/format";
import { PasteForm } from "../components/PasteForm";
import { ValidationPanel } from "../components/ValidationPanel";
import {
  useCreateAiNote,
  useNotes,
  useValidations,
} from "../hooks/useNotesApi";
import type { NoteFilter } from "../types";

const LIMIT = 10;
const FILTERS: { value: NoteFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "ai", label: "AIの分析" },
  { value: "self", label: "自分の気づき" },
  { value: "validating", label: "検証中" },
];
const noteHref = (id: string) => ROUTES.NOTE_DETAIL.replace(":id", id);

/** 学習メモ: AIの回答の貼り付け、メモ一覧、検証中の改善ルール */
export function NotesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [page, setPage] = useState(1);
  const notes = useNotes(filter, page, LIMIT);
  const validations = useValidations();
  const create = useCreateAiNote();

  const change = (f: NoteFilter) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">学習メモ</h1>
        <p className="mt-1 text-sm text-ink-sub">
          AIの分析結果や自分の気づきをためて、改善ルールにつなげます。
        </p>
      </div>

      <PasteForm
        busy={create.isPending}
        error={
          create.isError
            ? "保存できませんでした。通信を確認して、もう一度試してください。貼り付けた内容は残っています。"
            : null
        }
        onSubmit={(v) =>
          create.mutate(v, { onSuccess: (n) => navigate(noteHref(n.id)) })
        }
      />

      {validations.data && <ValidationPanel items={validations.data} />}

      <div
        role="group"
        aria-label="メモの絞り込み"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            aria-pressed={filter === f.value}
            onClick={() => change(f.value)}
            className={`btn ${filter === f.value ? "border-accent bg-accent/10 text-accent-link" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {notes.isLoading ? (
        <LoadingSpinner fullScreen={false} />
      ) : notes.isError || !notes.data ? (
        <ErrorAlert onRetry={() => void notes.refetch()} />
      ) : notes.data.items.length === 0 ? (
        <EmptyState
          title={
            filter === "all"
              ? "学習メモはまだありません"
              : "該当するメモはありません"
          }
          description={
            filter === "all"
              ? "エクスポートしたデータをAIに分析してもらい、その回答をここに貼り付けてみましょう。"
              : "絞り込みを変えると、ほかのメモが見つかるかもしれません。"
          }
          action={
            filter === "all" ? (
              <Link className="btn-primary" to={ROUTES.EXPORT}>
                エクスポートへ
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="space-y-2" aria-label="メモ一覧">
            {notes.data.items.map((n) => (
              <li key={n.id} className="card space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-chip bg-tag px-2 py-1 text-xs">
                    {n.kind === "ai" ? "AIの分析" : "自分の気づき"}
                  </span>
                  {n.ruledCount > 0 && (
                    <span className="rounded-chip bg-tag px-2 py-1 text-xs">
                      検証中 {n.ruledCount}件
                    </span>
                  )}
                  <span className="num text-xs text-ink-mute">
                    {formatJst(n.createdAt)}
                  </span>
                </div>
                <Link
                  to={noteHref(n.id)}
                  className="block text-sm font-bold text-accent-link underline"
                >
                  {n.title}
                </Link>
                {n.body && (
                  <p className="line-clamp-2 text-sm text-ink-sub">{n.body}</p>
                )}
                {n.kind === "ai" && (
                  <p className="text-xs text-ink-mute">
                    改善案 <span className="num">{n.improvementCount}</span>件
                    {n.dataRangeLabel
                      ? ` ・ 渡したデータ: ${n.dataRangeLabel}`
                      : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            limit={LIMIT}
            total={notes.data.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
