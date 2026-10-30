import { createElement, createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Timeframe } from "@/features/settings/types";
import {
  TradeChart,
  type TradeChartHandle,
} from "@/features/trades/components/TradeChart";
import type { Trade } from "@/features/trades/types";
import type { ChartData } from "@/features/trades/utils/chartData";

export const IMAGE_WIDTH = 1280;
export const IMAGE_HEIGHT = 720;

export interface RenderInput {
  trade: Trade;
  data: ChartData;
  pipSize: number;
  tf: Timeframe;
}

/** 次の描画を待つ。裏のタブなどで rAF が止まっても進めるよう、時間でも抜ける */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 500);
  });

/** 端末のDPRにかかわらず、最終的に 1280×720 へ揃える */
function toPngBytes(src: HTMLCanvasElement): Promise<Uint8Array> {
  let canvas = src;
  if (src.width !== IMAGE_WIDTH || src.height !== IMAGE_HEIGHT) {
    canvas = document.createElement("canvas");
    canvas.width = IMAGE_WIDTH;
    canvas.height = IMAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("canvasを作れませんでした"));
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => {
      if (!b) return reject(new Error("PNGに変換できませんでした"));
      void b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, "image/png"),
  );
}

// 同時に描くのは1枚だけにする（呼び出し側が並列に呼んでも、ここで順番に直す）
let queue: Promise<unknown> = Promise.resolve();

/**
 * 既存の TradeChart を画面外に 1280×720 で置いて描き、PNGにする。
 * 撮り終えたら（失敗しても）必ずチャートを破棄する。
 */
export function renderChartImage(input: RenderInput): Promise<Uint8Array> {
  const run = async (): Promise<Uint8Array> => {
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${IMAGE_WIDTH}px;height:${IMAGE_HEIGHT}px;pointer-events:none;`;
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    const root = createRoot(host);
    const handle = createRef<TradeChartHandle>();
    try {
      const { trade, data, pipSize } = input;
      flushSync(() =>
        root.render(
          createElement(TradeChart, {
            ref: handle,
            data,
            side: trade.side,
            entryPrice: trade.entryPrice,
            slPrice: trade.slPrice,
            tpPrice: trade.tpPrice,
            exitPrice: trade.exitPrice,
            pipSize,
            height: IMAGE_HEIGHT,
            fitAll: true,
            resetKey: `${trade.id}|${input.tf}`,
          }),
        ),
      );
      await nextFrame();
      await nextFrame();
      const canvas = handle.current?.screenshot() ?? null;
      if (!canvas) throw new Error("チャートの画像を取得できませんでした");
      return await toPngBytes(canvas);
    } finally {
      root.unmount();
      host.remove();
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}
