export interface SyncArgs {
  from: Date;
  to: Date;
  provider: "mt5" | "dukascopy" | "mock";
  /** provider=mt5 のとき: MT5 が CSV を書き出すフォルダ */
  dir: string;
  /** provider=mt5 のとき: MT5 のサーバー時刻の扱い（"ny-close" か UTC オフセット時間） */
  serverTime: "ny-close" | number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(label: string, value: string | undefined): Date {
  if (!value || !DATE_RE.test(value))
    throw new Error(`${label} は YYYY-MM-DD で指定してください`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} の日付が不正です`);
  return d;
}

function parseServerTime(value: string): "ny-close" | number {
  if (value === "ny-close") return "ny-close";
  const n = Number(value);
  if (!Number.isFinite(n) || n < -12 || n > 14)
    throw new Error("--server-time は ny-close か UTC オフセット（時間）です");
  return n;
}

/** --from 2026-10-01 --to 2026-10-23 [--provider mt5|mock|dukascopy] [--dir ...] [--server-time ny-close]。to の日の終わり（翌日0時 UTC）までを範囲にする */
export function parseSyncArgs(argv: string[]): SyncArgs {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const from = parseDate("--from", get("from"));
  const toDay = parseDate("--to", get("to"));
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
      get("server-time") ?? process.env.MT5_SERVER_TIME ?? "ny-close",
    ),
  };
}
