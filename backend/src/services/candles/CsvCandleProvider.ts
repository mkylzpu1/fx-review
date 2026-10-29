import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CANDLE_SOURCE, ROLLOVER_TIME_ZONE } from "../../constants/candles";
import type { Candle, CandleProvider } from "./CandleProvider";

/**
 * MT5 のサーバー時刻 → UTC の変換方法。
 * - "eet": 欧州の夏時間（EU式）に連動。冬 UTC+2 / 夏 UTC+3。切り替えは3月・10月の最終日曜
 * - "ny-close": 米国の夏時間（US式）に連動。サーバー時刻 = ニューヨーク現地時刻 + 7時間。
 *   冬 UTC+2 / 夏 UTC+3。切り替えは3月第2日曜・11月第1日曜
 * - 数値: 固定の UTC オフセット（時間）。例: 0 なら UTC そのもの
 *
 * "eet" と "ny-close" は、欧州と米国で夏時間の切り替え日が違う期間（3月の2〜3週間と、
 * 10月末〜11月初めの1週間）だけ1時間食い違う。口座がどちらか分からないときは、
 * その期間の足の時刻を、MT5の画面と見比べて確かめる。
 */
export type ServerTime = "eet" | "ny-close" | number;

/** 既定のサーバー時刻の扱い。口座に合わせて MT5_SERVER_TIME か --server-time で変える */
export const DEFAULT_SERVER_TIME: ServerTime = "eet";

/** "eet" の現地時刻に使うタイムゾーン（UTC+2 / 夏 UTC+3、EU式の夏時間） */
const EET_TIME_ZONE = "Europe/Athens";

const NY_PART_KEYS = ["year", "month", "day", "hour", "minute", "second"];

/** UTC の秒から、指定タイムゾーンの現地時刻の「時計の読み」と UTC との差（秒）を求める */
function zoneOffsetSeconds(utcSec: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcSec * 1000));
  const v = Object.fromEntries(
    parts
      .filter((p) => NY_PART_KEYS.includes(p.type))
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc =
    Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) / 1000;
  return asUtc - utcSec;
}

const newYorkOffsetSeconds = (utcSec: number) =>
  zoneOffsetSeconds(utcSec, ROLLOVER_TIME_ZONE);

/**
 * 現地時刻の「時計の読み」（epoch 秒の見た目）を、そのタイムゾーンの UTC の epoch 秒に直す。
 * 夏時間の切り替え付近で1時間ずれないよう、2回で収束させる
 */
function zoneLocalToUtc(localSec: number, timeZone: string): number {
  let utc = localSec - zoneOffsetSeconds(localSec, timeZone);
  utc = localSec - zoneOffsetSeconds(utc, timeZone);
  return utc;
}

/** MT5 のサーバー時刻（epoch 秒の見た目）を UTC の epoch 秒に直す */
export function serverToUtc(serverSec: number, mode: ServerTime): number {
  if (mode === "eet") return zoneLocalToUtc(serverSec, EET_TIME_ZONE);
  if (mode !== "ny-close") return serverSec - mode * 3600;
  // サーバー時刻 = NY現地 + 7h
  let utc = serverSec - 7 * 3600 - newYorkOffsetSeconds(serverSec - 7 * 3600);
  utc = serverSec - 7 * 3600 - newYorkOffsetSeconds(utc);
  return utc;
}

/** CSV の1行 "serverEpoch,open,high,low,close" を Candle にする。読めない行は null */
export function parseCsvLine(line: string, mode: ServerTime): Candle | null {
  const cols = line.trim().split(",");
  if (cols.length < 5) return null;
  const [t, o, h, l, c] = cols.map(Number);
  if (![t, o, h, l, c].every(Number.isFinite)) return null;
  return {
    time: serverToUtc(t, mode),
    open: o,
    high: h,
    low: l,
    close: c,
  };
}

/**
 * MT5 が書き出した1分足 CSV（EA: mt5/FxReviewExport.mq5）を読む。
 * 指定フォルダ内の *.csv をすべて読み、[from, to) の足だけ返す。
 * 取得元に問い合わせないので、規約や認証の問題がない。
 */
export class CsvCandleProvider implements CandleProvider {
  readonly source = CANDLE_SOURCE.mt5;

  constructor(
    private readonly dir: string,
    private readonly serverTime: ServerTime = DEFAULT_SERVER_TIME,
  ) {}

  /** 同じ同期の中で何度も全行を読み直さないよう、最初に1回だけ読んで持つ */
  private loaded: Candle[] | null = null;

  private async loadAll(): Promise<Candle[]> {
    if (this.loaded) return this.loaded;
    let files: string[];
    try {
      files = (await readdir(this.dir)).filter((f) => f.endsWith(".csv"));
    } catch {
      throw new Error(
        `CSVフォルダを読めませんでした: ${this.dir}（--dir か CANDLE_CSV_DIR で、MT5の書き出し先を指定してください）`,
      );
    }
    if (files.length === 0)
      throw new Error(
        `${this.dir} に .csv がありません。MT5のEAが動いているか確認してください`,
      );
    const byTime = new Map<number, Candle>();
    for (const f of files) {
      const text = await readFile(path.join(this.dir, f), "utf8");
      for (const line of text.split("\n")) {
        const c = parseCsvLine(line, this.serverTime);
        if (c) byTime.set(c.time, c);
      }
    }
    this.loaded = [...byTime.values()].sort((a, b) => a.time - b.time);
    return this.loaded;
  }

  async fetch1m(_pair: "USDJPY", from: Date, to: Date): Promise<Candle[]> {
    const lo = Math.floor(from.getTime() / 1000);
    const hi = Math.floor(to.getTime() / 1000);
    return (await this.loadAll()).filter((c) => c.time >= lo && c.time < hi);
  }
}
