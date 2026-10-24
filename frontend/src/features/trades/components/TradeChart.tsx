import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
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
  type MouseEventParams,
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
import type { ExcursionLevels } from "../utils/excursionLevels";
import { measure, type MeasurePoint, type Measurement } from "../utils/measure";

/** 測定の進み具合: 0=未選択 / 1=1点目まで / 2=2点で結果あり */
export interface MeasureState {
  step: 0 | 1 | 2;
  result: Measurement | null;
}

/** 親から呼ぶ操作 */
export interface TradeChartHandle {
  /** いまの表示を画像（canvas）にする。作れないときは null */
  screenshot: () => HTMLCanvasElement | null;
  /** 縦軸を、いま表示している足に合わせ直す（固定中なら合わせ直してから固定する） */
  refitY: () => void;
}

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
  /** 保有中の最大含み益・含み損と、決済後の最大到達の水準（overlays.excursion のとき線を引く） */
  excursion?: ExcursionLevels | null;
  /** true の間、チャートを2回クリックして2点間の pips・本数・時間を測る */
  measureMode?: boolean;
  onMeasureChange?: (s: MeasureState) => void;
  /**
   * 縦軸を価格軸のドラッグなどで直接動かしたとき（自動追従が切れたとき）に知らせる。
   * 親の「縦軸固定」の表示を、実際の状態に合わせるため
   */
  onAutoScaleChange?: (auto: boolean) => void;
}

const EDGE_BARS = 30;
const MAGNET_PX = 10;
const jst = (t: number) => (t + JST_OFFSET_SEC) as UTCTimestamp;

/**
 * 縦軸の自動追従を切り替える。
 * 固定にするときは、いちど自動で範囲を合わせて描画させてから固定する（描画前に固定すると範囲が空のままになるため）。
 * busy は、その「合わせている途中」の間 true（この間は、利用者の操作による切り替わりと見なさない）
 */
function setYMode(
  candles: ISeriesApi<"Candlestick">,
  auto: boolean,
  rafRef: { current: number },
  busyRef: { current: boolean },
) {
  cancelAnimationFrame(rafRef.current);
  busyRef.current = !auto;
  try {
    candles.priceScale().applyOptions({ autoScale: true });
    if (!auto) {
      rafRef.current = requestAnimationFrame(() => {
        busyRef.current = false;
        try {
          candles.priceScale().applyOptions({ autoScale: false });
        } catch {
          // チャートごと破棄された後は何もしない
        }
      });
    }
  } catch {
    busyRef.current = false;
    // チャートごと破棄された後は何もしない
  }
}

/** 価格を 0.1pips 刻みに丸める */
const snapPrice = (price: number, pipSize: number) => {
  const step = pipSize / 10;
  return Math.round(price / step) * step;
};

/**
 * ローソク足＋EMA＋エントリー/決済/SL/TPの描画だけを担当する。
 * チャートは作りっぱなしにして、足が増えても表示位置を保つ（スクロールで足を足していくため）。
 * エントリーと決済が同じ足のときは、矢印を足の上下に分け、決済は「OUT」と価格を添える。
 */
export const TradeChart = forwardRef<TradeChartHandle, Props>(
  function TradeChart(
    {
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
      excursion = null,
      measureMode = false,
      onMeasureChange,
      onAutoScaleChange,
    },
    handleRef,
  ) {
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
    const yBusyRef = useRef(false);
    const autoChangeRef = useRef(onAutoScaleChange);
    autoChangeRef.current = onAutoScaleChange;
    const measureChangeRef = useRef(onMeasureChange);
    measureChangeRef.current = onMeasureChange;
    // 足の開始時刻（UTC秒・昇順）。測定のクリック位置を足に合わせるのに使う
    const timesRef = useRef<number[]>([]);
    const candlesDataRef = useRef(data.candles);
    candlesDataRef.current = data.candles;
    // 水準線は値そのものを依存にして、同じ値なら引き直さない
    const mfeLevel = excursion?.mfe ?? null;
    const maeLevel = excursion?.mae ?? null;
    const afterMaxLevel = excursion?.afterMax ?? null;

    useImperativeHandle(
      handleRef,
      () => ({
        screenshot: () => {
          try {
            return chartRef.current?.takeScreenshot() ?? null;
          } catch {
            return null;
          }
        },
        refitY: () => {
          const candles = candleRef.current;
          if (candles) setYMode(candles, autoYRef.current, rafRef, yBusyRef);
        },
      }),
      [],
    );

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
      markersRef.current = createSeriesMarkers(candles, [], {
        autoScale: false,
      });
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

      // 価格軸のドラッグ・ダブルクリックなどで自動追従が切れた（戻った）ら、親の「縦軸固定」を実際の状態に合わせる。
      // ライブラリ側の状態の更新を待つため、操作の直後（次のタスク）に確かめる
      let syncTimer = 0;
      const syncY = () => {
        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(() => {
          const c = candleRef.current;
          if (!c || yBusyRef.current) return;
          try {
            const auto = c.priceScale().options().autoScale;
            if (auto !== autoYRef.current) autoChangeRef.current?.(auto);
          } catch {
            // チャートごと破棄された後は何もしない
          }
        }, 0);
      };
      const syncEvents = ["pointerup", "dblclick", "wheel"] as const;
      syncEvents.forEach((e) =>
        el.addEventListener(e, syncY, { passive: true }),
      );

      return () => {
        window.clearTimeout(syncTimer);
        syncEvents.forEach((e) => el.removeEventListener(e, syncY));
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
      timesRef.current = data.candles.map((c) => c.time);
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
        if (!autoYRef.current) setYMode(candles, false, rafRef, yBusyRef);
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
      // 利用者が価格軸を直接動かして、すでに同じ状態になっているときは、範囲を合わせ直さない（動かした範囲が飛ばないように）
      try {
        if (candles.priceScale().options().autoScale === autoScaleY) return;
      } catch {
        return;
      }
      setYMode(candles, autoScaleY, rafRef, yBusyRef);
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
      // 保有中の最大含み益・含み損と、決済後の最大到達（点線より細かい点で、基本の線と見分ける）
      if (excursion && overlays.excursion) {
        const sparse = (price: number, color: string, title: string) =>
          candles.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.SparseDotted,
            axisLabelVisible: true,
            title,
          });
        if (mfeLevel !== null)
          lines.push(sparse(mfeLevel, CHART_COLORS.tp, "最大含み益"));
        if (maeLevel !== null)
          lines.push(sparse(maeLevel, CHART_COLORS.sl, "最大含み損"));
        if (afterMaxLevel !== null)
          lines.push(sparse(afterMaxLevel, CHART_COLORS.exit, "決済後最大"));
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
      overlays.excursion,
      exitPrice,
      side,
      excursion,
      mfeLevel,
      maeLevel,
      afterMaxLevel,
    ]);

    // 2点間の測定（測定モードの間だけ。1回目・2回目のクリックで点を置き、3回目で測り直す）
    useEffect(() => {
      const chart = chartRef.current;
      const candles = candleRef.current;
      if (!chart || !candles || !measureMode) return;

      const segment = chart.addSeries(LineSeries, {
        color: CHART_COLORS.entry,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      let marks: IPriceLine[] = [];
      let first: MeasurePoint | null = null;

      const clearMarks = () => {
        marks.forEach((l) => {
          try {
            candles.removePriceLine(l);
          } catch {
            // チャートごと破棄された後は何もしない
          }
        });
        marks = [];
        try {
          segment.setData([]);
        } catch {
          // チャートごと破棄された後は何もしない
        }
      };
      const mark = (p: MeasurePoint, title: string) =>
        candles.createPriceLine({
          price: p.price,
          color: CHART_COLORS.entry,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        });

      /** クリック位置を、近い足の時刻と（4本値が近ければ）その価格に合わせる */
      const pointAt = (p: MouseEventParams<Time>): MeasurePoint | null => {
        if (!p.point) return null;
        const times = timesRef.current;
        if (times.length === 0) return null;
        const price = candles.coordinateToPrice(p.point.y);
        const logical = chart.timeScale().coordinateToLogical(p.point.x);
        if (price === null || logical === null) return null;
        const idx = Math.min(
          times.length - 1,
          Math.max(0, Math.round(logical)),
        );
        let snapped = snapPrice(price, pipSize);
        const c = candlesDataRef.current[idx];
        if (c) {
          let best = MAGNET_PX + 1;
          for (const v of [c.high, c.low, c.open, c.close]) {
            const y = candles.priceToCoordinate(v);
            if (y === null) continue;
            const d = Math.abs(y - p.point.y);
            if (d < best) {
              best = d;
              snapped = v;
            }
          }
        }
        return { price: snapped, logical: idx, timeSec: times[idx] };
      };

      const onClick = (p: MouseEventParams<Time>) => {
        const pt = pointAt(p);
        if (!pt) return;
        if (first === null) {
          clearMarks();
          first = pt;
          marks = [mark(pt, "A")];
          measureChangeRef.current?.({ step: 1, result: null });
          return;
        }
        const a = first;
        first = null;
        marks.push(mark(pt, "B"));
        // 同じ足の2点は、線を引けない（時刻が同じ）ので、水準線だけにする
        if (a.timeSec !== pt.timeSec) {
          const [p1, p2] = a.timeSec < pt.timeSec ? [a, pt] : [pt, a];
          segment.setData([
            { time: jst(p1.timeSec), value: p1.price },
            { time: jst(p2.timeSec), value: p2.price },
          ]);
        }
        measureChangeRef.current?.({
          step: 2,
          result: measure(a, pt, pipSize),
        });
      };

      chart.subscribeClick(onClick);
      measureChangeRef.current?.({ step: 0, result: null });
      return () => {
        try {
          chart.unsubscribeClick(onClick);
          clearMarks();
          chart.removeSeries(segment);
        } catch {
          // チャートごと破棄された後は何もしない
        }
        measureChangeRef.current?.({ step: 0, result: null });
      };
    }, [measureMode, height, pipSize]);

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
  },
);
