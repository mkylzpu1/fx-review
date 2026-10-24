import type { EntryRange } from "../types";

/** ローソク足の同期コマンド（--from / --to は UTC の日付） */
export function buildSyncCommand(range: EntryRange | null): string | null {
  if (!range) return null;
  const from = range.from.slice(0, 10);
  const to = range.to.slice(0, 10);
  return `npm run candles:sync -- --from ${from} --to ${to}`;
}
