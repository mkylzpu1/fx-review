import { useState } from "react";
import { FieldError } from "@/components/common/FieldError";
import type { AutoKey } from "@/features/trades/types";
import { AUTO_KEY_LABEL, type Rule, type RuleInput } from "../types";

interface RuleEditorProps {
  initial?: Rule;
  saving: boolean;
  onSubmit: (input: RuleInput) => void;
  onCancel: () => void;
}

/** ルールの追加・編集フォーム */
export function RuleEditor({
  initial,
  saving,
  onSubmit,
  onCancel,
}: RuleEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [autoKey, setAutoKey] = useState<AutoKey | "">(initial?.autoKey ?? "");
  const [error, setError] = useState<string>();

  const submit = () => {
    const t = title.trim();
    if (!t) return setError("ルール名を入力してください");
    if (t.length > 100) return setError("ルール名は100文字までです");
    setError(undefined);
    onSubmit({
      title: t,
      description: description.trim(),
      autoKey: autoKey || null,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="rule-title" className="text-xs text-ink-sub">
          ルール名
        </label>
        <input
          id="rule-title"
          className={`input mt-1 font-sans ${error ? "input-error" : ""}`}
          value={title}
          aria-describedby={error ? "rule-title-error" : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        <FieldError id="rule-title-error" message={error} />
      </div>
      <div>
        <label htmlFor="rule-desc" className="text-xs text-ink-sub">
          説明（任意）
        </label>
        <input
          id="rule-desc"
          className="input mt-1 font-sans"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="rule-auto" className="text-xs text-ink-sub">
          判定の方法
        </label>
        <select
          id="rule-auto"
          className="input mt-1 font-sans"
          value={autoKey}
          onChange={(e) => setAutoKey(e.target.value as AutoKey | "")}
        >
          <option value="">手動でチェックする</option>
          {(Object.keys(AUTO_KEY_LABEL) as AutoKey[]).map((k) => (
            <option key={k} value={k}>
              {AUTO_KEY_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          保存
        </button>
      </div>
    </div>
  );
}
