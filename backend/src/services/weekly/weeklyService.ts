import { ValidationError } from "../../lib/errors";
import { ruleStore } from "../../stores/ruleStore";
import {
  weeklyReviewStore,
  type WeeklyReview,
} from "../../stores/weeklyReviewStore";
import { tradeService } from "../trade/tradeService";
import {
  buildWeekly,
  mondayOf,
  todayJst,
  weekRange,
  type WeeklyStats,
} from "./weeklyCalc";

export interface WeeklyResult extends WeeklyStats {
  review: WeeklyReview | null;
  /** 「来週守るルール」の候補（有効なルール） */
  rules: { id: string; title: string }[];
}

/** 指定がなければ今週。月曜でない日付は、その日を含む週の月曜にそろえる */
export function resolveWeekStart(input?: string): string {
  return mondayOf(input ?? todayJst());
}

export interface WeeklySave {
  memo: string;
  nextRuleId: string | null;
  nextRuleText: string | null;
}

export const weeklyService = {
  async get(userId: string, weekStartInput?: string): Promise<WeeklyResult> {
    const weekStart = resolveWeekStart(weekStartInput);
    const { from, to } = weekRange(weekStart);
    const [views, review, rules] = await Promise.all([
      tradeService.listAll(userId, { from, to }),
      weeklyReviewStore.find(userId, weekStart),
      ruleStore.list(userId),
    ]);
    // to は含まない範囲なので、ちょうど翌週月曜0時のトレードは除く
    const inWeek = views.filter((v) => Date.parse(v.entryAt) < Date.parse(to));
    return {
      ...buildWeekly(inWeek, weekStart),
      review,
      rules: rules
        .filter((r) => r.isActive)
        .map((r) => ({ id: r.id, title: r.title })),
    };
  },

  async save(
    userId: string,
    weekStartInput: string,
    v: WeeklySave,
  ): Promise<WeeklyReview> {
    if (v.nextRuleId && !(await ruleStore.findById(userId, v.nextRuleId))) {
      throw new ValidationError("選択したルールが見つかりません");
    }
    return weeklyReviewStore.upsert(
      userId,
      resolveWeekStart(weekStartInput),
      v,
    );
  },
};
