import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
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
  /** この値が変わったときだけ、表示位置をエントリー付近に合わせ直す（足を追加しただけでは動かさない） */
  resetKey?: string;
  /** 端の近くまでスクロールされたとき、その方向の足を追加で読むよう頼む */
  onNeedMore?: (dir: "older" | "newer") => void;
}

const EDGE_BARS = 30;
const jst = (t: number) => (t + JST_OFFSET_SEC) as UTCTimestamp;

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
  resetKey = "",
  onNeedMore,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const emaRefs = useRef<ISeriesApi<"Line">[]>([]);
  const pathRef = useRef<ISeriesApi<"Line"> | null>(null);
  const firstTimeRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const resetRef = useRef<string | null>(null);
  // 利用者がスクロール・ドラッグするまでは、追加読み込みを頼まない（初期表示の位置合わせで読み込みが走らないように）
  const armedRef = useRef(false);
  const needMoreRef = useRef(onNeedMore);
  needMoreRef.current = onNeedMore;

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
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderVisible: false,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
      priceFormat: {
        type: "price",
        precision: priceDigits(pipSize),
        minMove: pipSize,
      },
    });
    chartRef.current = chart;
    candleRef.current = candles;
    markersRef.current = createSeriesMarkers(candles, []);
    emaRefs.current = [];
    pathRef.current = null;
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

    // エントリー→決済を結ぶ線（別の足のときだけ。同じ足は矢印の上下分けで見せる）
    if (pathRef.current) {
      chart.removeSeries(pathRef.current);
      pathRef.current = null;
    }
    const { entryTime, exitTime } = data;
    if (
      entryTime !== null &&
      exitTime !== null &&
      exitTime > entryTime &&
      exitPrice !== null
    ) {
      const win =
        side === "buy" ? exitPrice >= entryPrice : exitPrice <= entryPrice;
      const path = chart.addSeries(LineSeries, {
        color: win ? CHART_COLORS.tp : CHART_COLORS.sl,
        lineWidth: 2,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      path.setData([
        { time: jst(entryTime), value: entryPrice },
        { time: jst(exitTime), value: exitPrice },
      ]);
      pathRef.current = path;
    }

    // マーカー: エントリーは買いなら足の下・売りなら上。決済はその反対側に置いて、同じ足でも重ならないようにする
    const markers: SeriesMarker<Time>[] = [];
    const inBelow = side === "buy";
    if (entryTime !== null) {
      markers.push({
        time: jst(entryTime),
        position: inBelow ? "belowBar" : "aboveBar",
        shape: inBelow ? "arrowUp" : "arrowDown",
        color: CHART_COLORS.entry,
        text: `IN ${entryPrice}`,
      });
    }
    if (exitTime !== null) {
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
      ts.fitContent();
      resetRef.current = resetKey;
      armedRef.current = false;
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
  }, [data, side, entryPrice, exitPrice, resetKey, height, pipSize]);

  // 価格線（エントリー・TP・SL）。決済価格は線ではなくマーカーで見せる
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
    const lines = [dashed(entryPrice, CHART_COLORS.entry, "エントリー")];
    if (tpPrice !== null) lines.push(dashed(tpPrice, CHART_COLORS.tp, "TP"));
    if (slPrice !== null) lines.push(dashed(slPrice, CHART_COLORS.sl, "SL"));
    return () => {
      lines.forEach((l) => {
        try {
          candles.removePriceLine(l);
        } catch {
          // チャートごと破棄された後は何もしない
        }
      });
    };
  }, [entryPrice, tpPrice, slPrice, height, pipSize]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="ローソク足チャート"
      className="w-full"
      style={{ height }}
    />
  );
}
