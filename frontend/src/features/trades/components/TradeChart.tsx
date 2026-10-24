import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  CHART_COLORS,
  EMA_COLORS,
  JST_OFFSET_SEC,
} from "@/constants/chartTheme";
import { priceDigits } from "@/utils/format";
import type { Side } from "../types";
import type { ChartData } from "../utils/chartData";
import {
  DEFAULT_OVERLAYS,
  INITIAL_BARS_AFTER,
  INITIAL_BARS_BEFORE,
  type ChartOverlays,
} from "../utils/chartOverlays";

interface Props {
  data: ChartData;
  side: Side;
  entryPrice: number;
  slPrice: number | null;
  tpPrice: number | null;
  /** 決済価格。未決済は null */
  exitPrice?: number | null;
  pipSize: number;
  height?: number;
  /** true のとき、親の高さいっぱいに広げる（全画面表示）。チャートは作り直さない */
  fill?: boolean;
  /** 重ねて表示するものの表示・非表示 */
  overlays?: ChartOverlays;
  /** true: 縦軸を表示中の足に合わせて自動で追従する / false: いまの縦軸の範囲で固定する */
  autoScaleY?: boolean;
  /** この値が変わったときだけ、表示位置をエントリー付近に合わせ直す（足を追加しただけでは動かさない） */
  resetKey?: string;
  /** 端の近くまでスクロールされたとき、その方向の足を追加で読むよう頼む */
  onNeedMore?: (dir: "older" | "newer") => void;
}

const EDGE_BARS = 30;
const jst = (t: number) => (t + JST_OFFSET_SEC) as UTCTimestamp;

/**
 * 縦軸の自動追従を切り替える。
 * 固定にするときは、いちど自動で範囲を合わせて描画させてから固定する（描画前に固定すると範囲が空のままになるため）
 */
function setYMode(
  candles: ISeriesApi<"Candlestick">,
  auto: boolean,
  rafRef: { current: number },
) {
  cancelAnimationFrame(rafRef.current);
  try {
    candles.priceScale().applyOptions({ autoScale: true });
    if (!auto) {
      rafRef.current = requestAnimationFrame(() => {
        try {
          candles.priceScale().applyOptions({ autoScale: false });
        } catch {
          // チャートごと破棄された後は何もしない
        }
      });
    }
  } catch {
    // チャートごと破棄された後は何もしない
  }
}

/**
 * ローソク足＋EMA＋エントリー/決済/SL/TPの描画だけを担当する。
 * チャートは作りっぱなしにして、足が増えても表示位置を保つ（スクロールで足を足していくため）。
 * エントリーと決済が同じ足のときは、矢印を足の上下に分け、決済は「OUT」と価格を添える。
 */
export function TradeChart({
  data,
  side,
  entryPrice,
  slPrice,
  tpPrice,
  exitPrice = null,
  pipSize,
  height = 360,
  fill = false,
  overlays = DEFAULT_OVERLAYS,
  autoScaleY = true,
  resetKey = "",
  onNeedMore,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const shadeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaRefs = useRef<ISeriesApi<"Line">[]>([]);
  const firstTimeRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const resetRef = useRef<string | null>(null);
  // 利用者がスクロール・ドラッグするまでは、追加読み込みを頼まない（初期表示の位置合わせで読み込みが走らないように）
  const armedRef = useRef(false);
  const needMoreRef = useRef(onNeedMore);
  needMoreRef.current = onNeedMore;
  const autoYRef = useRef(autoScaleY);
  autoYRef.current = autoScaleY;
  const rafRef = useRef(0);

  // チャート本体（高さと価格の桁が変わったときだけ作り直す）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      rightPriceScale: { borderColor: CHART_COLORS.grid },
      timeScale: {
        borderColor: CHART_COLORS.grid,
        timeVisible: true,
        secondsVisible: false,
      },
    });
    // エントリー以降の背景。専用の価格軸に全高で描くので、ローソク足の縦の範囲には影響しない
    const shade = chart.addSeries(HistogramSeries, {
      priceScaleId: "after-shade",
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    });
    shade.priceScale().applyOptions({
      scaleMargins: { top: 0, bottom: 0 },
      visible: false,
    });
    shadeRef.current = shade;
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderVisible: false,
      // 最新の足の終値に自動で引かれる線とラベルは出さない（右外に読み込み済みの足があると、関係ない位置に線が出るため）
      priceLineVisible: false,
      lastValueVisible: false,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
      priceFormat: {
        type: "price",
        precision: priceDigits(pipSize),
        minMove: pipSize,
      },
    });
    // 矢印の置き場所はあらかじめ上下に余白を確保しておく。
    // 余白はマーカーの有無で変えない（IN/OUTの表示を切り替えても縦軸が動かないように）
    candles.priceScale().applyOptions({
      scaleMargins: { top: 0.2, bottom: 0.15 },
    });
    chartRef.current = chart;
    candleRef.current = candles;
    // autoScale: false … マーカーの分だけ価格軸の範囲を広げる機能を切る（切らないと、表示するたびに縦軸が変わる）
    markersRef.current = createSeriesMarkers(candles, [], { autoScale: false });
    emaRefs.current = [];
    firstTimeRef.current = null;
    resetRef.current = null;

    // 左右の端に近づいたら、その方向の足を追加で読む
    const onRange = (r: { from: number; to: number } | null) => {
      if (!r || countRef.current === 0 || !armedRef.current) return;
      if (r.from < EDGE_BARS) needMoreRef.current?.("older");
      if (r.to > countRef.current - EDGE_BARS) needMoreRef.current?.("newer");
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    const arm = () => {
      armedRef.current = true;
    };
    const events = ["wheel", "pointerdown", "touchstart"] as const;
    events.forEach((e) => el.addEventListener(e, arm, { passive: true }));

    return () => {
      events.forEach((e) => el.removeEventListener(e, arm));
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      shadeRef.current = null;
      markersRef.current = null;
    };
  }, [height, pipSize]);

  // 足・EMA・マーカー（データが変わるたびに差し替える）
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candleRef.current;
    if (!chart || !candles) return;

    const ts = chart.timeScale();
    const prevFirst = firstTimeRef.current;
    const prevRange = ts.getVisibleLogicalRange();
    const isReset = resetRef.current !== resetKey || prevFirst === null;
    const prevCount = countRef.current;

    candles.setData(data.candles.map((c) => ({ ...c, time: jst(c.time) })));
    countRef.current = data.candles.length;
    // エントリーの足から右を薄く塗る（エントリー後の足が無いときは塗らない）
    const entryT = data.entryTime;
    const hasAfter =
      entryT !== null && data.candles.some((c) => c.time > entryT);
    shadeRef.current?.setData(
      overlays.afterShade && hasAfter
        ? data.candles
            .filter((c) => c.time >= entryT)
            .map((c) => ({
              time: jst(c.time),
              value: 1,
              color: "rgba(157, 180, 255, 0.10)",
            }))
        : [],
    );
    const newFirst = data.candles[0]?.time ?? null;

    // EMAは本数が変わりうるので、作り直す
    emaRefs.current.forEach((s) => chart.removeSeries(s));
    emaRefs.current = data.emaLines.map((line, i) => {
      const s = chart.addSeries(LineSeries, {
        color: EMA_COLORS[i % EMA_COLORS.length],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `EMA${line.period}`,
      });
      s.setData(line.points.map((p) => ({ ...p, time: jst(p.time) })));
      return s;
    });

    const { entryTime, exitTime } = data;

    // マーカー: エントリーは買いなら足の下・売りなら上。決済はその反対側に置いて、同じ足でも重ならないようにする
    const markers: SeriesMarker<Time>[] = [];
    const inBelow = side === "buy";
    if (entryTime !== null && overlays.markers) {
      markers.push({
        time: jst(entryTime),
        position: inBelow ? "belowBar" : "aboveBar",
        shape: inBelow ? "arrowUp" : "arrowDown",
        color: CHART_COLORS.entry,
        text: `IN ${entryPrice}`,
      });
    }
    if (exitTime !== null && overlays.markers) {
      markers.push({
        time: jst(exitTime),
        position: inBelow ? "aboveBar" : "belowBar",
        shape: inBelow ? "arrowDown" : "arrowUp",
        color: CHART_COLORS.exit,
        text: exitPrice !== null ? `OUT ${exitPrice}` : "OUT",
      });
    }
    markersRef.current?.setMarkers(markers);

    if (isReset) {
      // どの時間足でも同じ本数（エントリーの足の前後）を見せる。エントリーが範囲外なら全体を見せる
      const idx =
        data.entryTime === null
          ? -1
          : data.candles.findIndex((c) => c.time === data.entryTime);
      if (idx >= 0)
        ts.setVisibleLogicalRange({
          from: idx - INITIAL_BARS_BEFORE,
          to: idx + INITIAL_BARS_AFTER,
        });
      else ts.fitContent();
      resetRef.current = resetKey;
      armedRef.current = false;
      // 別のトレード・時間足に変わったときは、固定中でも縦軸を新しい足に合わせ直す
      if (!autoYRef.current) setYMode(candles, false, rafRef);
    } else if (prevRange && prevFirst !== null && newFirst !== null) {
      // 古い足が前に足されたぶん、見ている位置を後ろへずらして、画面を動かさない
      const added = data.candles.filter((c) => c.time < prevFirst).length;
      ts.setVisibleLogicalRange({
        from: prevRange.from + added,
        to: prevRange.to + added,
      });
      // 追加した範囲に足が無かった（週末など）のに端のままなら、さらに先を頼む
      if (data.candles.length === prevCount && armedRef.current) {
        const r = ts.getVisibleLogicalRange();
        if (r && r.from < EDGE_BARS) needMoreRef.current?.("older");
        if (r && r.to > data.candles.length - EDGE_BARS)
          needMoreRef.current?.("newer");
      }
    }
    firstTimeRef.current = newFirst;
  }, [
    data,
    side,
    entryPrice,
    exitPrice,
    resetKey,
    height,
    pipSize,
    overlays.markers,
    overlays.afterShade,
  ]);

  // 縦軸の自動追従 / 固定（足の差し替えより後に動かして、描画済みの範囲で固定する）
  useEffect(() => {
    const candles = candleRef.current;
    if (!candles) return;
    setYMode(candles, autoScaleY, rafRef);
  }, [autoScaleY, height, pipSize]);

  // 価格線（エントリー・TP・SL・決済）。端から端までの線
  useEffect(() => {
    const candles = candleRef.current;
    if (!candles) return;
    const dashed = (price: number, color: string, title: string) =>
      candles.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      });
    const lines: IPriceLine[] = [];
    if (overlays.entryLine)
      lines.push(dashed(entryPrice, CHART_COLORS.entry, "エントリー"));
    if (tpPrice !== null && overlays.tpLine)
      lines.push(dashed(tpPrice, CHART_COLORS.tp, "TP"));
    if (slPrice !== null && overlays.slLine)
      lines.push(dashed(slPrice, CHART_COLORS.sl, "SL"));
    // 決済価格: エントリーと同じく端から端までの点線。勝ちなら緑・負けなら赤
    if (exitPrice !== null && overlays.exitLine) {
      const win =
        side === "buy" ? exitPrice >= entryPrice : exitPrice <= entryPrice;
      lines.push(
        candles.createPriceLine({
          price: exitPrice,
          color: win ? CHART_COLORS.tp : CHART_COLORS.sl,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "決済",
        }),
      );
    }
    return () => {
      lines.forEach((l) => {
        try {
          candles.removePriceLine(l);
        } catch {
          // チャートごと破棄された後は何もしない
        }
      });
    };
  }, [
    entryPrice,
    tpPrice,
    slPrice,
    height,
    pipSize,
    overlays.entryLine,
    overlays.tpLine,
    overlays.slLine,
    overlays.exitLine,
    exitPrice,
    side,
  ]);

  // 外側の箱が大きさを決め、チャート（autoSize）は内側の箱いっぱいに描くだけにする。
  // チャートの canvas が親の幅を押し広げないので、全画面から戻ったときに横幅が元に戻る
  return (
    <div
      className="relative w-full min-w-0 overflow-hidden"
      style={{ height: fill ? "100%" : height }}
    >
      <div
        ref={ref}
        role="img"
        aria-label="ローソク足チャート"
        className="absolute inset-0"
      />
    </div>
  );
}
