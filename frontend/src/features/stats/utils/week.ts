const DAY_MS = 24 * 60 * 60 * 1000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 週の月曜（YYYY-MM-DD）に日数を足す。JSTの暦日として扱う */
export function shiftWeek(weekStart: string, weeks: number): string {
  return ymd(
    new Date(Date.parse(`${weekStart}T00:00:00Z`) + weeks * 7 * DAY_MS),
  );
}

/** 「10/19（月）〜 10/25（日）」 */
export function weekLabel(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${Number(m)}/${Number(d)}`;
  };
  return `${fmt(weekStart)}（月）〜 ${fmt(weekEnd)}（日）`;
}

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

/** 「10/21(火)」 */
export function dayLabel(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}(${DOW[dow]})`;
}
