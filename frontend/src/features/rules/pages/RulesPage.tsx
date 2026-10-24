import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/stores/toastStore";
import { RuleEditor } from "../components/RuleEditor";
import { useCreateRule, useRules, useUpdateRule } from "../hooks/useRulesApi";
import { AUTO_KEY_LABEL, type Rule, type RuleInput } from "../types";

const SAVE_ERROR =
  "保存できませんでした。通信を確認して、もう一度試してください。入力内容は残っています。";

export function RulesPage() {
  const { data: rules, isLoading, isError, refetch } = useRules();
  const create = useCreateRule();
  const update = useUpdateRule();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [disabling, setDisabling] = useState<Rule>();

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !rules) return <ErrorAlert onRetry={() => void refetch()} />;

  const addRule = (input: RuleInput) =>
    create.mutate(input, {
      onSuccess: () => {
        setAdding(false);
        toast.success("ルールを追加しました");
      },
      onError: () => toast.error(SAVE_ERROR),
    });

  const editRule = (id: string, input: RuleInput) =>
    update.mutate(
      { id, ...input },
      {
        onSuccess: () => {
          setEditingId(undefined);
          toast.success("ルールを保存しました");
        },
        onError: () => toast.error(SAVE_ERROR),
      },
    );

  const setActive = (rule: Rule, isActive: boolean) =>
    update.mutate(
      { id: rule.id, isActive },
      {
        onSuccess: () => {
          setDisabling(undefined);
          toast.success(
            isActive ? "ルールを有効にしました" : "ルールを無効にしました",
          );
        },
        onError: () => toast.error(SAVE_ERROR),
      },
    );

  /** 隣のルールと並び順を入れ替える */
  const move = (index: number, delta: -1 | 1) => {
    const a = rules[index];
    const b = rules[index + delta];
    if (!a || !b) return;
    update.mutate({ id: a.id, sortOrder: b.sortOrder });
    update.mutate({ id: b.id, sortOrder: a.sortOrder });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">ルール</h1>
          <p className="mt-1 text-sm text-ink-sub">
            有効なルールは、トレード記録の「発注前チェック」の項目になります。
          </p>
        </div>
        {!adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            ルールを追加
          </button>
        )}
      </div>

      {adding && (
        <div className="card">
          <RuleEditor
            saving={create.isPending}
            onSubmit={addRule}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {rules.length === 0 && !adding ? (
        <EmptyState
          title="ルールはまだありません"
          description="守りたいルールを決めておくと、記録のたびにチェックでき、守った時と破った時の成績を比べられます。"
          action={
            <button className="btn-primary" onClick={() => setAdding(true)}>
              最初のルールを追加
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {rules.map((rule, i) => (
            <li
              key={rule.id}
              className={`card ${rule.isActive ? "" : "opacity-70"}`}
            >
              {editingId === rule.id ? (
                <RuleEditor
                  initial={rule}
                  saving={update.isPending}
                  onSubmit={(input) => editRule(rule.id, input)}
                  onCancel={() => setEditingId(undefined)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={ROUTES.RULE_DETAIL.replace(":id", rule.id)}
                      className="font-medium text-accent-link underline"
                    >
                      {rule.title}
                    </Link>
                    {rule.description && (
                      <p className="mt-1 text-sm text-ink-sub">
                        {rule.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-mute">
                      {rule.autoKey
                        ? AUTO_KEY_LABEL[rule.autoKey]
                        : "手動でチェック"}
                      {!rule.isActive && " ・ 無効"}
                      {rule.validationStartedAt && " ・ 検証中"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn px-3"
                      aria-label={`${rule.title}を上へ`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="btn px-3"
                      aria-label={`${rule.title}を下へ`}
                      disabled={i === rules.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      className="btn"
                      onClick={() => setEditingId(rule.id)}
                    >
                      編集
                    </button>
                    <button
                      className="btn"
                      aria-pressed={rule.isActive}
                      onClick={() =>
                        rule.isActive
                          ? setDisabling(rule)
                          : setActive(rule, true)
                      }
                    >
                      {rule.isActive ? "有効" : "無効"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!disabling}
        title="このルールを無効にしますか？"
        description="過去のトレードの判定は残ります。新しい記録のチェック項目には出なくなります。"
        confirmLabel="無効にする"
        onConfirm={() => disabling && setActive(disabling, false)}
        onCancel={() => setDisabling(undefined)}
      />
    </div>
  );
}
