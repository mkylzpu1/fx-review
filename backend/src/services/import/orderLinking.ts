import type {
  CandidateTrade,
  ExitHint,
  LinkResult,
  LinkUpdate,
  OrderPlan,
  OrderRow,
  UnfilledOrder,
} from "../../types/orderImport";

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
 * 約定済みの注文を、取り込み済みのトレードに1対1で結びつけてSL・TP・決済の仕方を決める（純粋関数）。
 *
 * 結びつけ: 売買・数量・約定レートが同じで、トレードのエントリー日時が注文日時以降のもの
 * （約定日時は分単位で切り捨てなので同じ分も可）のうち、いちばん早いもの。
 * 決済済みのトレードは、約定した決済注文の約定レートが決済価格と合うことも条件にする。
 *
 * 更新: 入力済みのSL・TPは上書きしない。決済の仕方は、まだ初期値の manual のときだけ
 * TP・SLに直す。利益側の逆指値はSLにしない（SLの入力ルールと合わなくなるため）。
 */
export function linkPlansToTrades(
  plans: OrderPlan[],
  trades: CandidateTrade[],
): LinkResult {
  const used = new Set<string>();
  const sorted = [...trades].sort((a, b) =>
    a.entryAt < b.entryAt ? -1 : a.entryAt > b.entryAt ? 1 : 0,
  );
  const updates: LinkUpdate[] = [];
  const unmatched: OrderPlan[] = [];
  let matched = 0;
  let slOnProfitSide = 0;

  for (const p of [...plans].sort((a, b) => a.entryOrderNo - b.entryOrderNo)) {
    const orderedMinute = p.orderedAt.slice(0, 16); // 分まで
    const t = sorted.find(
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
    if (!t) {
      unmatched.push(p);
      continue;
    }
    used.add(t.id);
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
