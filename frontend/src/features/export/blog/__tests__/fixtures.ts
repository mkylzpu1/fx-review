import type { Trade } from "@/features/trades/types";

let n = 0;
/** テスト用のトレード。内部ID・取り込み元・残高に関わる値を、わざと入れてある（出力に出ないことの確認用） */
export function makeTrade(over: Partial<Trade> = {}): Trade {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    source: "rakuten_csv",
    pair: "USDJPY",
    side: "buy",
    lots: 1,
    entryAt: "2026-10-29T01:00:00.000Z",
    entryPrice: 150,
    slPrice: 149.8,
    tpPrice: 150.4,
    slReason: "直近安値の下",
    tpReason: "前日高値",
    rationaleMemo: "押し目からの反発",
    confidence: 4,
    exitAt: "2026-10-29T02:00:00.000Z",
    exitPrice: 150.2,
    exitMethod: "manual",
    pnlJpy: 2000,
    insight: "待てた",
    nextRule: "同じ形だけ入る",
    status: "closed",
    mfePips: 30,
    maePips: -5,
    afterMaxPips: 40,
    tags: [{ id: "tag-1", name: "押し目", kind: "rationale" }],
    ruleChecks: [{ ruleId: "rule-1", result: "ok" }],
    pips: 20,
    rMultiple: 1,
    plannedRr: 2,
    riskJpy: 2000,
    riskPct: 1,
    holdMinutes: 60,
    ruleResults: [
      { ruleId: "rule-1", title: "SLを置く", result: "ok", isActive: true },
    ],
    deviation: false,
    isUnfilled: false,
    missing: [],
    ...over,
  };
}
