import { sql } from "../lib/db";

export interface WeeklyReview {
  weekStart: string;
  memo: string;
  nextRuleId: string | null;
  nextRuleText: string | null;
}

const COLUMNS = sql`
  to_char(week_start, 'YYYY-MM-DD') as "weekStart", memo,
  next_rule_id as "nextRuleId", next_rule_text as "nextRuleText"
`;

export const weeklyReviewStore = {
  async find(userId: string, weekStart: string): Promise<WeeklyReview | null> {
    const rows = await sql<WeeklyReview[]>`
      SELECT ${COLUMNS} FROM weekly_reviews
      WHERE user_id = ${userId} AND week_start = ${weekStart}::date
    `;
    return rows[0] ?? null;
  },

  async upsert(
    userId: string,
    weekStart: string,
    v: Omit<WeeklyReview, "weekStart">,
  ): Promise<WeeklyReview> {
    const rows = await sql<WeeklyReview[]>`
      INSERT INTO weekly_reviews (user_id, week_start, memo, next_rule_id, next_rule_text)
      VALUES (${userId}, ${weekStart}::date, ${v.memo}, ${v.nextRuleId}, ${v.nextRuleText})
      ON CONFLICT (user_id, week_start) DO UPDATE SET
        memo = EXCLUDED.memo,
        next_rule_id = EXCLUDED.next_rule_id,
        next_rule_text = EXCLUDED.next_rule_text,
        updated_at = NOW()
      RETURNING ${COLUMNS}
    `;
    return rows[0];
  },
};
