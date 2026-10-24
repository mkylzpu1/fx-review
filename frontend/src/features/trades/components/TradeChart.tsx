import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
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
  pipSize: number;
  height?: number;
}

const jst = (t: number) => (t + JST_OFFSET_SEC) as UTCTimestamp;

/** ローソク足＋EMA＋エントリー/SL/TPの水平破線（描画だけを担当する） */
export function TradeChart({
  data,
  side,
  entryPrice,
  slPrice,
  tpPrice,
  pipSize,
  height = 360,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
    candles.setData(data.candles.map((c) => ({ ...c, time: jst(c.time) })));

    data.emaLines.forEach((line, i) => {
      const s = chart.addSeries(LineSeries, {
        color: EMA_COLORS[i % EMA_COLORS.length],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `EMA${line.period}`,
      });
      s.setData(line.points.map((p) => ({ ...p, time: jst(p.time) })));
    });

    const dashed = (price: number, color: string, title: string) =>
      candles.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      });
    dashed(entryPrice, CHART_COLORS.entry, "エントリー");
    if (tpPrice !== null) dashed(tpPrice, CHART_COLORS.tp, "TP");
    if (slPrice !== null) dashed(slPrice, CHART_COLORS.sl, "SL");

    if (data.entryTime !== null) {
      createSeriesMarkers(candles, [
        {
          time: jst(data.entryTime),
          position: side === "buy" ? "belowBar" : "aboveBar",
          shape: side === "buy" ? "arrowUp" : "arrowDown",
          color: CHART_COLORS.entry,
          text: "IN",
        },
      ]);
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, side, entryPrice, slPrice, tpPrice, pipSize, height]);

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
