import {
  MANUAL_MATCH_PRICE_YEN,
  MANUAL_MATCH_TIME_MINUTES,
} from "../../constants/import";
import type { ImportTrade, ManualTrade } from "../../types/import";

const EPS = 1e-6;
const TIME_TOLERANCE_MS = MANUAL_MATCH_TIME_MINUTES * 60_000;

/**
 * CSVから作ったトレードのうち、手入力済みのトレードと同じ取引のものを見つける（純粋関数）。
 *
 * 同じ取引の条件: 通貨ペア・売買・ロットが同じで、エントリー時刻と価格が基準内
 * （constants/import.ts）。双方に決済時刻があれば、それも基準内であること。
 * 1件の手入力が対応づけられるCSVのトレードは1件だけ（同じロットの取引を続けて
 * 持っていたときに、2件とも手入力と重複とみなさないため）。
 * 候補が複数あるときは、エントリー時刻が近いもの → 価格が近いもの の順に対応づける。
 *
 * 戻り値: CSVのトレードの sourceKey → 対応づけた手入力トレードの id
 */
export function matchManualTrades(
  trades: ImportTrade[],
  manual: ManualTrade[],
): Map<string, string> {
  const manualByKind = new Map<string, ManualTrade[]>();
  for (const m of manual) {
    const k = `${m.pair}|${m.side}`;
    const list = manualByKind.get(k);
    if (list) list.push(m);
    else manualByKind.set(k, [m]);
  }

  const candidates: {
    sourceKey: string;
    manualId: string;
    timeGap: number;
    priceGap: number;
  }[] = [];
  for (const t of trades) {
    const entryMs = Date.parse(t.entryAt);
    const exitMs = t.exitAt ? Date.parse(t.exitAt) : null;
    for (const m of manualByKind.get(`${t.pair}|${t.side}`) ?? []) {
      if (Math.abs(m.lots - t.lots) > EPS) continue;
      const timeGap = Math.abs(Date.parse(m.entryAt) - entryMs);
      if (timeGap > TIME_TOLERANCE_MS) continue;
      const priceGap = Math.abs(m.entryPrice - t.entryPrice);
      if (priceGap > MANUAL_MATCH_PRICE_YEN + EPS) continue;
      if (
        exitMs !== null &&
        m.exitAt !== null &&
        Math.abs(Date.parse(m.exitAt) - exitMs) > TIME_TOLERANCE_MS
      )
        continue;
      candidates.push({
        sourceKey: t.sourceKey,
        manualId: m.id,
        timeGap,
        priceGap,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      a.timeGap - b.timeGap ||
      a.priceGap - b.priceGap ||
      (a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0),
  );
  const usedManual = new Set<string>();
  const matched = new Map<string, string>();
  for (const c of candidates) {
    if (matched.has(c.sourceKey) || usedManual.has(c.manualId)) continue;
    matched.set(c.sourceKey, c.manualId);
    usedManual.add(c.manualId);
  }
  return matched;
}
