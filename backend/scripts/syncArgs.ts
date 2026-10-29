import {
  DEFAULT_SERVER_TIME,
  type ServerTime,
} from "../src/services/candles/CsvCandleProvider";

export interface SyncArgs {
  from: Date;
  to: Date;
  provider: "mt5" | "dukascopy" | "mock";
  /** provider=mt5 のとき: MT5 が CSV を書き出すフォルダ */
  dir: string;
  /** provider=mt5 のとき: MT5 のサーバー時刻の扱い（"eet" / "ny-close" / UTC オフセット時間） */
  serverTime: ServerTime;
  /** true のとき、48時間より古い足も同じ取得元なら上書きする（サーバー時刻の設定を直したあとの再同期用） */
  overwrite: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(label: string, value: string | undefined): Date {
  if (!value || !DATE_RE.test(value))
    throw new Error(`${label} は YYYY-MM-DD で指定してください`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} の日付が不正です`);
  return d;
}

function parseServerTime(value: string): ServerTime {
  if (value === "eet" || value === "ny-close") return value;
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n) || n < -12 || n > 14)
    throw new Error(
      "--server-time は eet / ny-close / UTC オフセット（時間）のどれかです",
    );
  return n;
}

/** --from 2026-10-01 --to 2026-10-23（または --days 7）[--provider mt5|mock|dukascopy] [--dir ...] [--server-time eet|ny-close|2] [--overwrite]。to の日の終わり（翌日0時 UTC）までを範囲にする */
export function parseSyncArgs(
  argv: string[],
  opts: { now?: Date } = {},
): SyncArgs {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const days = get("days");
  let from: Date;
  let toDay: Date;
  if (days !== undefined) {
    // --days N: 今日（UTC）を含む直近 N 日
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 366)
      throw new Error("--days は 1〜366 の整数で指定してください");
    const today = new Date(
      `${(opts.now ?? new Date()).toISOString().slice(0, 10)}T00:00:00Z`,
    );
    toDay = today;
    from = new Date(today.getTime() - (n - 1) * 86_400_000);
  } else {
    from = parseDate("--from", get("from"));
    toDay = parseDate("--to", get("to"));
  }
  if (toDay < from) throw new Error("--to は --from 以降にしてください");
  const provider = get("provider") ?? "mt5";
  if (provider !== "mt5" && provider !== "dukascopy" && provider !== "mock")
    throw new Error("--provider は mt5 / dukascopy / mock のどれかです");
  return {
    from,
    to: new Date(toDay.getTime() + 86_400_000),
    provider,
    dir: get("dir") ?? process.env.CANDLE_CSV_DIR ?? "",
    serverTime: parseServerTime(
      get("server-time") ??
        process.env.MT5_SERVER_TIME ??
        String(DEFAULT_SERVER_TIME),
    ),
    overwrite: argv.includes("--overwrite"),
  };
}
