import { useState } from "react";
import { Link } from "react-router-dom";
import { FieldError } from "@/components/common/FieldError";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { toast } from "@/stores/toastStore";
import { ApiError } from "@/services/apiClient";
import { ROUTES } from "@/constants/routes";
import { useCreateTag, useDeleteTag, useTags } from "../hooks/useSettingsApi";
import type { TagKind } from "../types";

const GROUPS: { kind: TagKind; title: string; placeholder: string }[] = [
  { kind: "rationale", title: "根拠タグ", placeholder: "新しい根拠タグ" },
  { kind: "emotion", title: "感情タグ", placeholder: "新しい感情タグ" },
];

function TagGroup({ kind, title, placeholder }: (typeof GROUPS)[number]) {
  const { data: tags } = useTags();
  const create = useCreateTag();
  const remove = useDeleteTag();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("タグ名を入力してください");
    setError(undefined);
    create.mutate(
      { kind, name: trimmed },
      {
        onSuccess: () => setName(""),
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
    <div className="mt-4">
      <p className="text-xs text-ink-sub">{title}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {(tags ?? [])
          .filter((t) => t.kind === kind)
          .map((t) => (
            <li
              key={t.id}
              className="flex items-center rounded-chip border border-line bg-tag pl-3 text-sm"
            >
              {t.name}
              <button
                aria-label={`${t.name}を削除`}
                className="min-h-touch px-3 text-ink-mute"
                onClick={() =>
                  remove.mutate(t.id, {
                    onError: () =>
                      toast.error(
                        "削除できませんでした。通信を確認して、もう一度試してください。",
                      ),
                  })
                }
              >
                ×
              </button>
            </li>
          ))}
      </ul>
      <div className="mt-2 flex max-w-md gap-2">
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          className="input font-sans"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn" onClick={add} disabled={create.isPending}>
          追加
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function TagsSection() {
  const { isLoading, isError, refetch } = useTags();
  return (
    <section id="tags" className="card">
      <h2 className="text-base font-bold">根拠・感情タグ</h2>
      <p className="mt-1 text-xs text-ink-mute">
        記録画面で選ぶタグです。削除しても、過去のトレードに付いたタグは残ります。
      </p>
      {isLoading && <LoadingSpinner fullScreen={false} />}
      {isError && <ErrorAlert onRetry={() => void refetch()} />}
      {!isLoading &&
        !isError &&
        GROUPS.map((g) => <TagGroup key={g.kind} {...g} />)}
      <p className="mt-4 text-xs text-ink-mute">
        発注前チェックの項目は{" "}
        <Link to={ROUTES.RULES} className="text-accent-link underline">
          ルール画面
        </Link>{" "}
        で管理します。
      </p>
    </section>
  );
}
