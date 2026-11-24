import type { PeriodKey } from "../types";

/** 直近・使う頻度が高い順。カスタムの「期間を指定」は一番最後 */
export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "thisWeek", label: "今週" },
  { value: "lastWeek", label: "先週" },
  { value: "month", label: "今月" },
  { value: "lastMonth", label: "先月" },
  { value: "30d", label: "過去30日" },
  { value: "90d", label: "過去90日" },
  { value: "all", label: "すべて" },
  { value: "custom", label: "期間を指定" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JSTの壁時計での年月日・曜日（0=日,1=月,...） */
function jstParts(now: Date): { y: number; m: number; d: number; dow: number } {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return {
    y: jst.getUTCFullYear(),
    m: jst.getUTCMonth(),
    d: jst.getUTCDate(),
    dow: jst.getUTCDay(),
  };
}

/** JSTの年月日0時 → ISO（UTC）。月は0始まり、日は31を超えても/0以下でもDate.UTCが丸めてくれる */
function jstDateToIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d) - JST_OFFSET_MS).toISOString();
}

/** 月曜始まりの週の開始日（JSTの壁時計の日付） */
function mondayOffset(dow: number): number {
  return dow === 0 ? -6 : 1 - dow;
}

/** 期間 → API の from/to（ISO）。範囲の終わりが無い期間（今日・今週・今月・過去N日・すべて）はtoを付けない＝現在まで */
export function periodRange(
  key: PeriodKey,
  now: Date = new Date(),
): { from?: string; to?: string } {
  if (key === "all" || key === "custom") return {};
  const { y, m, d, dow } = jstParts(now);

  if (key === "today") return { from: jstDateToIso(y, m, d) };

  if (key === "thisWeek") {
    return { from: jstDateToIso(y, m, d + mondayOffset(dow)) };
  }
  if (key === "lastWeek") {
    const thisWeekStart = d + mondayOffset(dow);
    return {
      from: jstDateToIso(y, m, thisWeekStart - 7),
      to: jstDateToIso(y, m, thisWeekStart),
    };
  }

  if (key === "month") return { from: jstDateToIso(y, m, 1) };
  if (key === "lastMonth") {
    return { from: jstDateToIso(y, m - 1, 1), to: jstDateToIso(y, m, 1) };
  }

  const days = key === "90d" ? 90 : 30;
  return { from: new Date(now.getTime() - days * DAY_MS).toISOString() };
}

/** 期間 → API の from（ISO）。「すべて」「期間を指定」は指定なし */
export function periodFrom(
  key: PeriodKey,
  now: Date = new Date(),
): string | undefined {
  return periodRange(key, now).from;
}

/** ユーザーが選んだ開始日・終了日（"YYYY-MM-DD"、終了日を含む）→ API の from/to */
export function customRange(
  fromDate: string,
  toDate: string,
): { from: string; to: string } {
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  return {
    from: jstDateToIso(fy, fm - 1, fd),
    // 終了日の「翌日0時」を上限にすることで、終了日の最後まで含める
    to: jstDateToIso(ty, tm - 1, td + 1),
  };
}

/**
 * 比べる相手（直前の同じ長さの期間）。
 * 「すべて」「期間を指定」は比べられないのでnull。
 * 「先週」は先々週、「先月」は先々月と比較する。
 */
export function previousPeriod(
  key: PeriodKey,
  now: Date = new Date(),
): { from: string; to: string } | null {
  if (key === "all" || key === "custom") {
    return null;
  }
  if (key === "thisWeek") {
    const r = periodRange("lastWeek", now);
    return r.from && r.to ? { from: r.from, to: r.to } : null;
  }
  if (key === "lastWeek") {
    const { y, m, d, dow } = jstParts(now);
    const thisWeekStart = d + mondayOffset(dow);
    return {
      from: jstDateToIso(y, m, thisWeekStart - 14),
      to: jstDateToIso(y, m, thisWeekStart - 7),
    };
  }
  if (key === "month") {
    const r = periodRange("lastMonth", now);
    return r.from && r.to ? { from: r.from, to: r.to } : null;
  }
  if (key === "lastMonth") {
    const { y, m } = jstParts(now);
    return {
      from: jstDateToIso(y, m - 2, 1),
      to: jstDateToIso(y, m - 1, 1),
    };
  }

  const from = periodFrom(key, now);
  if (!from) return null;
  const fromDate = new Date(from);
  if (key === "today") {
    return {
      from: new Date(fromDate.getTime() - DAY_MS).toISOString(),
      to: fromDate.toISOString(),
    };
  }
  const days = key === "90d" ? 90 : 30;
  return {
    from: new Date(fromDate.getTime() - days * DAY_MS).toISOString(),
    to: fromDate.toISOString(),
  };
}

/** 今日（JST）の0時 */
export function todayStartJst(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const start =
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) -
    JST_OFFSET_MS;
  return new Date(start).toISOString();
}
