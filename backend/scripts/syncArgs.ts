export interface SyncArgs {
  from: Date;
  to: Date;
  provider: "dukascopy" | "mock";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(label: string, value: string | undefined): Date {
  if (!value || !DATE_RE.test(value))
    throw new Error(`${label} は YYYY-MM-DD で指定してください`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} の日付が不正です`);
  return d;
}

/** --from 2026-10-01 --to 2026-10-23 [--provider mock]。to の日の終わり（翌日0時 UTC）までを範囲にする */
export function parseSyncArgs(argv: string[]): SyncArgs {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const from = parseDate("--from", get("from"));
  const toDay = parseDate("--to", get("to"));
  if (toDay < from) throw new Error("--to は --from 以降にしてください");
  const provider = get("provider") ?? "dukascopy";
  if (provider !== "dukascopy" && provider !== "mock")
    throw new Error("--provider は dukascopy か mock です");
  return { from, to: new Date(toDay.getTime() + 86_400_000), provider };
}
