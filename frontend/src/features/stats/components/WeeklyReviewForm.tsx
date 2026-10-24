import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/stores/toastStore";
import { useCreateSelfNote } from "@/features/notes/hooks/useNotesApi";
import { useSaveWeekly } from "../hooks/useWeekly";
import type { WeeklyResult } from "../weeklyTypes";
import { weekLabel } from "../utils/week";

const TEXT_OPTION = "__text__";
const MAX_MEMO = 2000;
const MAX_RULE_TEXT = 200;

/** 来週守るルール（1つ）と、1週間のふりかえり。どちらも任意 */
export function WeeklyReviewForm({ data }: { data: WeeklyResult }) {
  const saved = data.review;
  const [memo, setMemo] = useState(saved?.memo ?? "");
  const [choice, setChoice] = useState(
    saved?.nextRuleId
      ? saved.nextRuleId
      : saved?.nextRuleText
        ? TEXT_OPTION
        : "",
  );
  const [ruleText, setRuleText] = useState(saved?.nextRuleText ?? "");
  const save = useSaveWeekly(data.weekStart);
  const createNote = useCreateSelfNote();

  const body = {
    memo,
    nextRuleId: choice && choice !== TEXT_OPTION ? choice : null,
    nextRuleText: choice === TEXT_OPTION ? ruleText.trim() || null : null,
  };
  const nextRuleLabel =
    data.rules.find((r) => r.id === body.nextRuleId)?.title ??
    body.nextRuleText;
  const tooLong = memo.length > MAX_MEMO || ruleText.length > MAX_RULE_TEXT;

  const onSave = async () => {
    try {
      await save.mutateAsync(body);
      toast.success("この週のふりかえりを保存しました");
    } catch {
      toast.error(
        "保存できませんでした。通信を確認して、もう一度試してください。入力内容は残っています。",
      );
    }
  };

  const onSaveToNotes = async () => {
    try {
      await save.mutateAsync(body);
      await createNote.mutateAsync({
        title: `週次レビュー ${weekLabel(data.weekStart, data.weekEnd)}`,
        body: memo,
        nextRule: nextRuleLabel ?? null,
      });
      toast.success("保存して、学習メモに残しました");
    } catch {
      toast.error(
        "学習メモに残せませんでした。通信を確認して、もう一度試してください。入力内容は残っています。",
      );
    }
  };

  const busy = save.isPending || createNote.isPending;

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-bold">来週に向けて</h2>

      <div className="space-y-2">
        <label htmlFor="next-rule" className="text-sm font-medium">
          来週守るルールを1つ選ぶ
        </label>
        <select
          id="next-rule"
          className="input"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">選ばない</option>
          {data.rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
          <option value={TEXT_OPTION}>自分で書く</option>
        </select>
        {choice === TEXT_OPTION && (
          <input
            aria-label="来週守るルール"
            className="input"
            maxLength={MAX_RULE_TEXT}
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
          />
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="weekly-memo" className="text-sm font-medium">
          1週間のふりかえり
        </label>
        <textarea
          id="weekly-memo"
          className="input min-h-32 py-2"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <p className="num text-right text-xs text-ink-mute">
          {memo.length} / {MAX_MEMO}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={busy || tooLong}
          onClick={() => void onSave()}
        >
          保存
        </button>
        <button
          className="btn"
          disabled={busy || tooLong}
          onClick={() => void onSaveToNotes()}
        >
          保存して学習メモに残す
        </button>
        <Link className="btn" to={ROUTES.EXPORT}>
          この週をAIに出力
        </Link>
      </div>
    </section>
  );
}
