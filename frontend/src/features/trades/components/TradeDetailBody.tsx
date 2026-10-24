import type { ReactNode } from "react";
import {
  SIDE_LABEL,
  formatHold,
  formatJst,
  formatPips,
  formatPrice,
  formatR,
  formatYenSigned,
} from "@/utils/format";
import type { RuleResult, Trade } from "../types";
import { excursionInsight } from "../utils/excursionLevels";
import { MissingBadges } from "./MissingBadges";

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-ink-sub">{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

const text = (v: string | null) =>
  v ? (
    <p className="whitespace-pre-wrap text-sm">{v}</p>
  ) : (
    <p className="text-sm text-ink-mute">未入力</p>
  );

/** 詳細画面の右側: 結果・計画と結果・根拠・ルール判定・振り返り */
export function TradeDetailBody({
  trade: t,
  pipSize,
  chart,
}: {
  trade: Trade;
  pipSize: number;
  /** チャート領域（取得・状態管理は呼び出し側の ChartPanel が持つ） */
  chart: ReactNode;
}) {
  const rationale = t.tags.filter((x) => x.kind === "rationale");
  const emotion = t.tags.filter((x) => x.kind === "emotion");
  const ex = excursionInsight(t, pipSize);
  const win = (t.pnlJpy ?? 0) > 0;
  const loss = (t.pnlJpy ?? 0) < 0;

  return (
    <div className="min-w-0 space-y-4">
      <div className="card flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-sub">
            {t.pair} {SIDE_LABEL[t.side]} ・ {t.lots} lot ・{" "}
            {formatJst(t.entryAt)}
            {t.status === "draft" && " ・ 下書き"}
          </p>
          <p
            className={`num mt-1 text-3xl font-bold ${win ? "text-profit" : loss ? "text-loss" : ""}`}
          >
            {formatYenSigned(t.pnlJpy)}
          </p>
          <p className="num mt-1 text-sm">
            {formatPips(t.pips)} ・ {formatR(t.rMultiple)}
            {t.status !== "closed" && t.pnlJpy === null && "（未決済）"}
          </p>
        </div>
        <MissingBadges missing={t.missing} />
      </div>

      {chart}

      <Block title="計画と結果">
        <dl className="divide-y divide-line">
          <Row label="エントリー">{formatPrice(t.entryPrice, pipSize)}</Row>
          <Row label="損切り（SL）">{formatPrice(t.slPrice, pipSize)}</Row>
          <Row label="利確（TP）">{formatPrice(t.tpPrice, pipSize)}</Row>
          <Row label="計画のRR">
            {t.plannedRr === null ? "—" : `1 : ${t.plannedRr.toFixed(2)}`}
          </Row>
          <Row label="想定リスク">
            {t.riskJpy === null
              ? "—"
              : `¥${t.riskJpy.toLocaleString("ja-JP")}${t.riskPct !== null ? `（${t.riskPct}%）` : ""}`}
          </Row>
          <Row label="決済">
            {t.exitAt
              ? `${formatJst(t.exitAt)} ${formatPrice(t.exitPrice, pipSize)}`
              : "—"}
          </Row>
          <Row label="決済の仕方">{EXIT_LABEL[t.exitMethod]}</Row>
          <Row label="保有時間">{formatHold(t.holdMinutes)}</Row>
          <Row label="保有中の最大含み益（MFE）">{formatPips(t.mfePips)}</Row>
          <Row label="保有中の最大含み損（MAE）">{formatPips(t.maePips)}</Row>
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
      </Block>

      <Block title="エントリー根拠">
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
      </Block>

      <Block title="ルールとの照合">
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
      </Block>

      <Block title="振り返り">
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
      </Block>
    </div>
  );
}
