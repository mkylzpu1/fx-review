import type {
  CandidateTrade,
  ExitHint,
  LinkResult,
  LinkUpdate,
  OrderPlan,
  OrderRow,
  UnfilledOrder,
} from "../../types/orderImport";
import {
  MANUAL_MATCH_PRICE_YEN,
  MANUAL_MATCH_TIME_MINUTES,
} from "../../constants/import";

const UNITS_PER_LOT = 10_000;
const EPS = 1e-6;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

export interface OrderGroups {
  plans: OrderPlan[];
  unfilled: UnfilledOrder[];
  /** リジェクト（約定前に拒否された注文）の件数。取り消しとは別に数える */
  rejected: number;
}

const isFilled = (r: OrderRow) => r.state === "約定済";

/** 同じ種類の決済注文が複数あるときは、約定したもの → 注文No.が新しいもの の順に採用する */
function pick(children: OrderRow[], exec: "limit" | "stop"): OrderRow | null {
  const xs = children.filter((c) => c.exec === exec && c.orderRate !== null);
  if (xs.length === 0) return null;
  return xs.find(isFilled) ?? xs[xs.length - 1];
}

/**
 * 注文を「新規注文 ＋ その後ろに付いた決済注文（SL・TP）」の束にする。
 * 注文No.の昇順に並べ、決済注文は直前の新規注文の束に入れる。
 * 約定済みの新規注文の束では、建約定レートが新規の約定レートと違う決済注文は
 * 別の建玉の注文なので入れない。
 */
export function groupOrders(allRows: OrderRow[]): OrderGroups {
  const seen = new Set<string>();
  const rows = allRows
    .filter((r) => {
      const k = `${r.pair}|${r.no}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.no - b.no);

  const bundles: { entry: OrderRow; children: OrderRow[] }[] = [];
  for (const r of rows) {
    if (r.kind === "open") bundles.push({ entry: r, children: [] });
    else if (bundles.length > 0) {
      const b = bundles[bundles.length - 1];
      if (b.entry.pair !== r.pair) continue;
      if (
        isFilled(b.entry) &&
        b.entry.fillRate !== null &&
        r.openRate !== null &&
        !same(r.openRate, b.entry.fillRate)
      )
        continue;
      b.children.push(r);
    }
  }

  const plans: OrderPlan[] = [];
  const unfilled: UnfilledOrder[] = [];
  let rejected = 0;
  for (const { entry: e, children } of bundles) {
    const sl = pick(children, "stop");
    const tp = pick(children, "limit");
    if (!isFilled(e) || e.fillRate === null) {
      if (e.state === "リジェクト") {
        rejected++;
        continue;
      }
      unfilled.push({
        entryOrderNo: e.no,
        pair: e.pair,
        side: e.side,
        lots: e.quantity / UNITS_PER_LOT,
        orderedAt: e.orderedAt,
        state: e.state,
        orderRate: e.orderRate,
        slPrice: sl?.orderRate ?? null,
        tpPrice: tp?.orderRate ?? null,
      });
      continue;
    }
    // 約定した決済注文（全決済・マーケットも含む）から決済の仕方を読む
    const closer = children.find((c) => isFilled(c) && c.fillRate !== null);
    const exitHint: ExitHint | null = !closer
      ? null
      : closer.exec === "limit"
        ? "tp"
        : closer.exec === "stop"
          ? "sl"
          : "manual";
    plans.push({
      entryOrderNo: e.no,
      pair: e.pair,
      side: e.side,
      lots: e.quantity / UNITS_PER_LOT,
      orderedAt: e.orderedAt,
      entryRate: e.fillRate,
      slPrice: sl?.orderRate ?? null,
      tpPrice: tp?.orderRate ?? null,
      exitHint,
      exitRate: closer?.fillRate ?? null,
    });
  }
  return { plans, unfilled, rejected };
}

/** SLが建値より利益側にあるか（買いなら建値より上、売りなら下） */
const onProfitSide = (side: "buy" | "sell", entry: number, sl: number) =>
  side === "buy" ? sl > entry : sl < entry;

/**
 * 手入力のトレードと「同じ取引」とみなす許容幅（constants/import.ts。手入力の照合と同じ基準）。
 * 手入力は約定とぴったり同じ価格・時刻とは限らないため、CSV由来のトレードと違い幅を持たせる
 */
const MANUAL_PRICE_TOLERANCE = MANUAL_MATCH_PRICE_YEN + EPS;
const MANUAL_TIME_TOLERANCE_MS = MANUAL_MATCH_TIME_MINUTES * 60_000;

const byEntryAt = (a: CandidateTrade, b: CandidateTrade) =>
  a.entryAt < b.entryAt ? -1 : a.entryAt > b.entryAt ? 1 : 0;

/**
 * 約定済みの注文を、取り込み済みのトレードと手入力のトレードに1対1で結びつけてSL・TP・決済の仕方を決める（純粋関数）。
 *
 * 結びつけ（CSV由来）: 売買・数量・約定レートが同じで、トレードのエントリー日時が注文日時以降のもの
 * （約定日時は分単位で切り捨てなので同じ分も可）のうち、いちばん早いもの。
 * 決済済みのトレードは、約定した決済注文の約定レートが決済価格と合うことも条件にする。
 *
 * 結びつけ（手入力）: CSV由来のトレードに結びつかなかった注文だけを対象にする。
 * 売買・数量が同じで、エントリー価格の差が基準内、エントリー日時が「注文日時 − 基準」以降のもの。
 * 決済済みなら、決済価格の差も基準内であること。候補が複数あるときは、
 * 価格が近いもの → 時刻が近いもの の順に、注文全体で1対1になるように結びつける。
 *
 * 更新: 入力済みのSL・TPは上書きしない（手入力のSL・TPも同じ）。決済の仕方は、まだ初期値の
 * manual のときだけTP・SLに直す。利益側の逆指値はSLにしない（SLの入力ルールと合わなくなるため）。
 */
export function linkPlansToTrades(
  plans: OrderPlan[],
  trades: CandidateTrade[],
): LinkResult {
  const sortedPlans = [...plans].sort(
    (a, b) => a.entryOrderNo - b.entryOrderNo,
  );
  const csvTrades = trades
    .filter((t) => t.source === "rakuten_csv")
    .sort(byEntryAt);
  const manualTrades = trades.filter((t) => t.source === "manual");
  const used = new Set<string>();
  const linked = new Map<number, CandidateTrade>();

  // 1. CSV由来のトレード（価格は約定と一致するので、完全一致で結びつける）
  for (const p of sortedPlans) {
    const orderedMinute = p.orderedAt.slice(0, 16); // 分まで
    const t = csvTrades.find(
      (c) =>
        !used.has(c.id) &&
        c.side === p.side &&
        same(c.lots, p.lots) &&
        same(c.entryPrice, p.entryRate) &&
        c.entryAt.slice(0, 16) >= orderedMinute &&
        (c.exitPrice === null ||
          p.exitRate === null ||
          same(c.exitPrice, p.exitRate)),
    );
    if (!t) continue;
    used.add(t.id);
    linked.set(p.entryOrderNo, t);
  }

  // 2. 手入力のトレード（結びつかなかった注文だけ。許容幅の中で、近いものから1対1に）
  const pairs: {
    plan: OrderPlan;
    trade: CandidateTrade;
    priceGap: number;
    timeGap: number;
  }[] = [];
  for (const p of sortedPlans) {
    if (linked.has(p.entryOrderNo)) continue;
    const orderedMs = Date.parse(p.orderedAt);
    for (const c of manualTrades) {
      if (c.side !== p.side || !same(c.lots, p.lots)) continue;
      const priceGap = Math.abs(c.entryPrice - p.entryRate);
      if (priceGap > MANUAL_PRICE_TOLERANCE) continue;
      const entryMs = Date.parse(c.entryAt);
      if (entryMs < orderedMs - MANUAL_TIME_TOLERANCE_MS) continue;
      if (
        c.exitPrice !== null &&
        p.exitRate !== null &&
        Math.abs(c.exitPrice - p.exitRate) > MANUAL_PRICE_TOLERANCE
      )
        continue;
      pairs.push({
        plan: p,
        trade: c,
        priceGap: Math.round(priceGap * 1e5),
        timeGap: Math.abs(entryMs - orderedMs),
      });
    }
  }
  pairs.sort(
    (a, b) =>
      a.priceGap - b.priceGap ||
      a.timeGap - b.timeGap ||
      a.plan.entryOrderNo - b.plan.entryOrderNo,
  );
  for (const { plan, trade } of pairs) {
    if (linked.has(plan.entryOrderNo) || used.has(trade.id)) continue;
    used.add(trade.id);
    linked.set(plan.entryOrderNo, trade);
  }

  const updates: LinkUpdate[] = [];
  const unmatched: OrderPlan[] = [];
  let matched = 0;
  let slOnProfitSide = 0;

  for (const p of sortedPlans) {
    const t = linked.get(p.entryOrderNo);
    if (!t) {
      unmatched.push(p);
      continue;
    }
    matched++;

    let slPrice: number | null = null;
    if (t.slPrice === null && p.slPrice !== null) {
      if (onProfitSide(p.side, t.entryPrice, p.slPrice)) slOnProfitSide++;
      else slPrice = p.slPrice;
    }
    const tpPrice = t.tpPrice === null ? p.tpPrice : null;
    const exitMethod =
      t.exitMethod === "manual" &&
      t.exitPrice !== null &&
      (p.exitHint === "tp" || p.exitHint === "sl")
        ? p.exitHint
        : null;
    if (slPrice !== null || tpPrice !== null || exitMethod !== null)
      updates.push({
        tradeId: t.id,
        entryOrderNo: p.entryOrderNo,
        slPrice,
        tpPrice,
        exitMethod,
      });
  }
  return { updates, matched, unmatched, slOnProfitSide };
}
