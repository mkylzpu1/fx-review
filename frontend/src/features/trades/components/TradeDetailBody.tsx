import { useState, type ReactNode } from "react";
import { CHART_COLORS, SIDE_COLORS } from "@/constants/chartTheme";
import { formatHold, formatJst, formatPips, formatPrice } from "@/utils/format";
import type { RuleResult, Trade } from "../types";
import { excursionInsight } from "../utils/excursionLevels";

const EXIT_LABEL = {
  open: "未決済",
  tp: "利確到達",
  sl: "損切り到達",
  manual: "手動決済",
  breakeven: "建値決済",
} as const;
const RESULT_LABEL: Record<RuleResult, string> = {
  ok: "✓ OK",
  ng: "✗ NG",
  na: "— 判定なし",
};

type TabKey = "plan" | "rules" | "review";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-ink-sub">{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  );
}

const text = (v: string | null) =>
  v ? (
    <p className="whitespace-pre-wrap text-sm">{v}</p>
  ) : (
    <p className="text-sm text-ink-mute">未入力</p>
  );

interface Rung {
  key: string;
  label: string;
  note?: string;
  price: number;
  color: string;
}

/** 価格のはしご: TP・決済・エントリー・SLを価格順に縦に並べ、エントリーからのpipsを添える */
function PriceLadder({ trade: t, pipSize }: { trade: Trade; pipSize: number }) {
  const win =
    t.exitPrice === null
      ? false
      : t.side === "buy"
        ? t.exitPrice >= t.entryPrice
        : t.exitPrice <= t.entryPrice;
  const rungs: Rung[] = [
    ...(t.tpPrice === null
      ? []
      : [{ key: "tp", label: "TP", price: t.tpPrice, color: CHART_COLORS.tp }]),
    ...(t.exitPrice === null
      ? []
      : [
          {
            key: "exit",
            label: "決済",
            note: EXIT_LABEL[t.exitMethod],
            price: t.exitPrice,
            color: win ? CHART_COLORS.tp : CHART_COLORS.sl,
          },
        ]),
    {
      key: "entry",
      label: "エントリー",
      price: t.entryPrice,
      color: SIDE_COLORS[t.side],
    },
    ...(t.slPrice === null
      ? []
      : [{ key: "sl", label: "SL", price: t.slPrice, color: CHART_COLORS.sl }]),
  ].sort((a, b) => b.price - a.price);

  const diff = (p: number) => {
    const v = (p - t.entryPrice) / pipSize;
    return v === 0 ? "" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
  };

  return (
    <ol
      className="ml-1 space-y-2 border-l-2 border-field pl-4"
      aria-label="価格のはしご"
    >
      {rungs.map((r) => (
        <li
          key={r.key}
          className="relative flex items-baseline justify-between gap-2 text-sm"
        >
          <span
            aria-hidden
            className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full"
            style={{ background: r.color }}
          />
          <span>
            {r.label}
            {r.note && (
              <span className="ml-1.5 text-xs text-ink-mute">{r.note}</span>
            )}
          </span>
          <span className="num">
            {formatPrice(r.price, pipSize)}
            {diff(r.price) && (
              <span className="ml-1.5 text-xs text-ink-sub">
                {diff(r.price)}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 詳細画面の右側: 計画と結果・ルール・振り返りをタブで切り替える */
export function TradeDetailBody({
  trade: t,
  pipSize,
}: {
  trade: Trade;
  pipSize: number;
}) {
  const [tab, setTab] = useState<TabKey>("plan");
  const rationale = t.tags.filter((x) => x.kind === "rationale");
  const emotion = t.tags.filter((x) => x.kind === "emotion");
  const ex = excursionInsight(t, pipSize);
  const ok = t.ruleResults.filter((r) => r.result === "ok").length;
  const judged = t.ruleResults.filter((r) => r.result !== "na").length;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "plan", label: "計画と結果" },
    {
      key: "rules",
      label: judged > 0 ? `ルール ${ok}/${judged}` : "ルール",
    },
    { key: "review", label: "振り返り" },
  ];

  return (
    <aside
      className="card min-w-0 space-y-3 lg:self-start"
      aria-label="トレードの情報"
    >
      <div
        role="tablist"
        aria-label="情報の切り替え"
        className="flex border-b border-line"
      >
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            id={`tab-${x.key}`}
            aria-selected={tab === x.key}
            aria-controls={`panel-${x.key}`}
            onClick={() => setTab(x.key)}
            className={`-mb-px min-h-touch flex-1 whitespace-nowrap border-b-[3px] px-1 text-[13px] ${
              tab === x.key
                ? "border-accent font-bold text-ink"
                : "border-transparent text-ink-mute"
            }`}
          >
            {x.label}
            {x.key === "rules" && t.deviation && (
              <span
                className="ml-1 text-caution"
                aria-label="守れていないルールあり"
              >
                ⚠
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="panel-plan"
        aria-labelledby="tab-plan"
        hidden={tab !== "plan"}
        className="space-y-3"
      >
        <PriceLadder trade={t} pipSize={pipSize} />
        <dl className="divide-y divide-line">
          <Row label="計画のRR">
            {t.plannedRr === null ? "—" : `1 : ${t.plannedRr.toFixed(2)}`}
          </Row>
          <Row label="想定リスク">
            {t.riskJpy === null
              ? "—"
              : `¥${t.riskJpy.toLocaleString("ja-JP")}${t.riskPct !== null ? `（${t.riskPct}%）` : ""}`}
          </Row>
          <Row label="決済">{t.exitAt ? formatJst(t.exitAt) : "—"}</Row>
          <Row label="保有時間">{formatHold(t.holdMinutes)}</Row>
          <Row label="最大含み益（MFE）">{formatPips(t.mfePips)}</Row>
          <Row label="最大含み損（MAE）">{formatPips(t.maePips)}</Row>
          <Row label="決済後の最大到達">{formatPips(t.afterMaxPips)}</Row>
          {ex.slMarginPips !== null && (
            <Row label="最大含み損の時点で、SLまで">
              {ex.slMarginPips > 0
                ? `あと ${ex.slMarginPips.toFixed(1)} pips`
                : "SLに届いていた"}
            </Row>
          )}
          {ex.tpReachPct !== null && (
            <Row label="最大含み益はTPの">{ex.tpReachPct}%</Row>
          )}
        </dl>
        {t.slReason && (
          <p className="text-sm text-ink-sub">SLの理由: {t.slReason}</p>
        )}
        {t.tpReason && (
          <p className="text-sm text-ink-sub">TPの理由: {t.tpReason}</p>
        )}
        <section className="space-y-2 border-t border-line pt-3">
          <h2 className="text-xs text-ink-sub">エントリー根拠</h2>
          {rationale.length > 0 && (
            <p className="flex flex-wrap gap-2">
              {rationale.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-line px-3 py-1 text-sm"
                >
                  {g.name}
                </span>
              ))}
            </p>
          )}
          {text(t.rationaleMemo)}
          {t.confidence !== null && (
            <p className="text-sm text-ink-sub">
              確信度 <span className="num">{t.confidence} / 5</span>
            </p>
          )}
        </section>
      </div>

      <div
        role="tabpanel"
        id="panel-rules"
        aria-labelledby="tab-rules"
        hidden={tab !== "rules"}
        className="space-y-2"
      >
        <h2 className="text-base font-bold">ルールとの照合</h2>
        {t.ruleResults.length === 0 ? (
          <p className="text-sm text-ink-mute">
            判定の対象になるルールがありません
          </p>
        ) : (
          <ul className="space-y-1">
            {t.ruleResults.map((r) => (
              <li key={r.ruleId} className="flex justify-between gap-3 text-sm">
                <span>
                  {r.title}
                  {!r.isActive && (
                    <span className="ml-2 text-xs text-ink-mute">（無効）</span>
                  )}
                </span>
                <span
                  className={
                    r.result === "ng" ? "font-medium text-caution" : ""
                  }
                >
                  {RESULT_LABEL[r.result]}
                </span>
              </li>
            ))}
          </ul>
        )}
        {t.deviation && (
          <p className="text-sm text-caution">⚠ 守れていないルールがあります</p>
        )}
      </div>

      <div
        role="tabpanel"
        id="panel-review"
        aria-labelledby="tab-review"
        hidden={tab !== "review"}
        className="space-y-2"
      >
        <h2 className="text-base font-bold">振り返り</h2>
        {emotion.length > 0 && (
          <p className="flex flex-wrap gap-2">
            {emotion.map((g) => (
              <span
                key={g.id}
                className="rounded-full border border-line px-3 py-1 text-sm"
              >
                {g.name}
              </span>
            ))}
          </p>
        )}
        <p className="text-xs text-ink-sub">気づき</p>
        {text(t.insight)}
        <p className="text-xs text-ink-sub">次のルール</p>
        {text(t.nextRule)}
      </div>
    </aside>
  );
}
