import { NotFoundError, ValidationError } from "../../lib/errors";
import { currencyPairStore } from "../../stores/currencyPairStore";
import { ruleStore } from "../../stores/ruleStore";
import { settingsStore } from "../../stores/settingsStore";
import { tradeListStore } from "../../stores/tradeListStore";
import {
  tradeStore,
  type TradeLinks,
  type TradeWrite,
} from "../../stores/tradeStore";
import { DEFAULT_PAIRS } from "../../constants/settingsDefaults";
import type { CurrencyPair } from "../../types/settings";
import type {
  Page,
  QueueFilter,
  TradeFilter,
  TradeInput,
  TradeRecord,
  TradeSort,
  TradeView,
} from "../../types/trade";
import { pnlFromPips, resultPips } from "./calc";
import { normalizeTradeInput } from "./tradeInput";
import { buildTradeView } from "./tradeView";
import { excursionService } from "./excursionService";

const DEFAULT_MAX_RISK_PCT = 1;

export interface ListQuery {
  result?: "win" | "loss";
  deviationOnly?: boolean;
  q?: string;
  pair?: string;
  from?: string;
  to?: string;
  pending?: boolean;
  sort: TradeSort;
  page: number;
  limit: number;
}

export interface QueueQuery {
  filter: QueueFilter;
  sort: TradeSort;
  page: number;
  limit: number;
}

export interface QueueResult extends Page<TradeView> {
  /** 入力のないトレードの件数 */
  pendingCount: number;
  totalCount: number;
  /** 入力あり（全件 − 入力のない） */
  filledCount: number;
}

/** 導出値の計算に必要な設定・通貨ペア・ルールを読み込み、レコード→TradeView の変換関数を返す */
async function loadViewer(userId: string) {
  const [settings, pairs, rules] = await Promise.all([
    settingsStore.get(userId),
    currencyPairStore.list(userId),
    ruleStore.list(userId),
  ]);
  const fallback: CurrencyPair = { id: "", ...DEFAULT_PAIRS[0] };
  const pairOf = (symbol: string) =>
    pairs.find((p) => p.symbol === symbol) ?? fallback;

  return {
    pairs,
    toView(r: TradeRecord): TradeView {
      const p = pairOf(r.pair);
      return buildTradeView(r, {
        pipSize: p.pipSize,
        pipValueJpyPerLot: p.pipValueJpyPerLot,
        balanceJpy: settings?.balanceJpy ?? 0,
        maxRiskPct: settings?.maxRiskPct ?? DEFAULT_MAX_RISK_PCT,
        rules,
      });
    },
  };
}

type Viewer = Awaited<ReturnType<typeof loadViewer>>;

function toLinks(input: TradeInput): TradeLinks {
  return {
    tagIds: [...new Set(input.tagIds)],
    ruleChecks: input.ruleChecks,
  };
}

/** タグ・ルールが本人のものか確認する（他人のIDは「見つからない」扱い） */
async function assertOwnedLinks(userId: string, links: TradeLinks) {
  const ruleIds = [...new Set(links.ruleChecks.map((c) => c.ruleId))];
  const [tags, rules] = await Promise.all([
    tradeStore.countOwnedTags(userId, links.tagIds),
    ruleStore.countOwned(userId, ruleIds),
  ]);
  if (tags !== links.tagIds.length)
    throw new ValidationError("選択したタグが見つかりません");
  if (rules !== ruleIds.length)
    throw new ValidationError("選択したルールが見つかりません");
}

/**
 * 保存する円損益。手入力は価格差から計算する（指示書 §9.1）。
 * CSV由来は取り込んだ値を残し、価格・ロット・方向を編集で変えたときだけ再計算する。
 */
function computePnl(
  input: TradeInput,
  pair: CurrencyPair,
  existing: TradeRecord | null,
): number | null {
  if (input.exitPrice === null) return null;
  const unchanged =
    existing !== null &&
    existing.source === "rakuten_csv" &&
    existing.pnlJpy !== null &&
    existing.entryPrice === input.entryPrice &&
    existing.exitPrice === input.exitPrice &&
    existing.lots === input.lots &&
    existing.side === input.side;
  if (unchanged) return existing.pnlJpy;
  const pips = resultPips(
    input.side,
    input.entryPrice,
    input.exitPrice,
    pair.pipSize,
  );
  return pnlFromPips(pips, pair.pipValueJpyPerLot, input.lots);
}

async function prepareWrite(
  userId: string,
  viewer: Viewer,
  input: TradeInput,
  existing: TradeRecord | null,
): Promise<{ write: TradeWrite; links: TradeLinks }> {
  const pair = viewer.pairs.find((p) => p.symbol === input.pair);
  if (!pair) throw new ValidationError("通貨ペアが設定にありません");

  const { status, exitMethod } = normalizeTradeInput(input);
  const links = toLinks(input);
  await assertOwnedLinks(userId, links);

  const write: TradeWrite = {
    pair: input.pair,
    side: input.side,
    lots: input.lots,
    entryAt: input.entryAt,
    entryPrice: input.entryPrice,
    slPrice: input.slPrice,
    tpPrice: input.tpPrice,
    slReason: input.slReason,
    tpReason: input.tpReason,
    rationaleMemo: input.rationaleMemo,
    confidence: input.confidence,
    exitAt: input.exitAt,
    exitPrice: input.exitPrice,
    exitMethod,
    pnlJpy: computePnl(input, pair, existing),
    insight: input.insight,
    nextRule: input.nextRule,
    status,
  };
  return { write, links };
}

const pageOffset = (page: number, limit: number) => (page - 1) * limit;

export const tradeService = {
  async create(userId: string, input: TradeInput): Promise<TradeView> {
    const viewer = await loadViewer(userId);
    const { write, links } = await prepareWrite(userId, viewer, input, null);
    const id = await tradeStore.create(userId, write, links, {
      source: "manual",
      sourceKey: null,
    });
    await excursionService.refreshTrade(userId, id);
    return this.get(userId, id);
  },

  async get(userId: string, id: string): Promise<TradeView> {
    const [record, viewer] = await Promise.all([
      tradeStore.findById(userId, id),
      loadViewer(userId),
    ]);
    if (!record) throw new NotFoundError("トレード");
    return viewer.toView(record);
  },

  async update(
    userId: string,
    id: string,
    input: TradeInput,
  ): Promise<TradeView> {
    const existing = await tradeStore.findById(userId, id);
    if (!existing) throw new NotFoundError("トレード");
    const viewer = await loadViewer(userId);
    const { write, links } = await prepareWrite(
      userId,
      viewer,
      input,
      existing,
    );
    const ok = await tradeStore.update(userId, id, write, links);
    if (!ok) throw new NotFoundError("トレード");
    await excursionService.refreshTrade(userId, id);
    return this.get(userId, id);
  },

  async delete(userId: string, id: string): Promise<void> {
    if (!(await tradeStore.softDelete(userId, id))) {
      throw new NotFoundError("トレード");
    }
  },

  async restore(userId: string, id: string): Promise<TradeView> {
    if (!(await tradeStore.restore(userId, id))) {
      throw new NotFoundError("トレード");
    }
    return this.get(userId, id);
  },

  /**
   * 一覧（サーバー側でページング）。
   * 「逸脱のみ」はルール判定が導出値のため、条件に合う全件を計算してから絞ってページングする。
   */
  async list(userId: string, q: ListQuery): Promise<Page<TradeView>> {
    const filter: TradeFilter = {
      result: q.result,
      q: q.q,
      pair: q.pair,
      from: q.from,
      to: q.to,
      queue: q.pending ? "all" : undefined,
      sort: q.sort,
    };

    if (q.deviationOnly) {
      const [viewer, { rows }] = await Promise.all([
        loadViewer(userId),
        tradeListStore.list(userId, filter),
      ]);
      const matched = rows.map(viewer.toView).filter((v) => v.deviation);
      const start = pageOffset(q.page, q.limit);
      return {
        items: matched.slice(start, start + q.limit),
        total: matched.length,
        page: q.page,
        limit: q.limit,
      };
    }

    // 設定・ペア・ルールの読み込みと一覧の取得は互いに独立なので、同時に行う
    const [viewer, { rows, total }] = await Promise.all([
      loadViewer(userId),
      tradeListStore.list(userId, filter, {
        limit: q.limit,
        offset: pageOffset(q.page, q.limit),
      }),
    ]);
    return {
      items: rows.map(viewer.toView),
      total,
      page: q.page,
      limit: q.limit,
    };
  },

  /** 期間・通貨ペアで絞った全件（古い順）。統計・週次レビュー・エクスポート用（ページングしない） */
  async listAll(
    userId: string,
    q: { from?: string; to?: string; pair?: string },
  ): Promise<TradeView[]> {
    const [viewer, { rows }] = await Promise.all([
      loadViewer(userId),
      tradeListStore.list(userId, {
        from: q.from,
        to: q.to,
        pair: q.pair,
        sort: "entry_asc",
      }),
    ]);
    return rows.map(viewer.toView);
  },

  /** 未入力キュー。件数の強調はしない（入力は任意）ので、数値だけを返す */
  async queue(userId: string, q: QueueQuery): Promise<QueueResult> {
    const [viewer, { rows, total }, counts] = await Promise.all([
      loadViewer(userId),
      tradeListStore.list(
        userId,
        { queue: q.filter, sort: q.sort },
        { limit: q.limit, offset: pageOffset(q.page, q.limit) },
      ),
      tradeListStore.queueCounts(userId),
    ]);
    return {
      items: rows.map(viewer.toView),
      total,
      page: q.page,
      limit: q.limit,
      ...counts,
      filledCount: counts.totalCount - counts.pendingCount,
    };
  },
};
