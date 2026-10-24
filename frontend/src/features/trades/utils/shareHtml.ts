/**
 * 他の人に評価してもらうための、単体のHTMLファイルを作る（純粋関数）。
 * アプリ（認証・サーバー）に依存せず、ファイルを開くだけで、時間足とEMAを自由に切り替えられる。
 * 含めるのは相場の情報とトレード計画だけ。損益額・口座・感情タグ・振り返りの記述は含めない。
 */
import { CHART_COLORS, EMA_COLORS } from "@/constants/chartTheme";
import type { EmaSetting, Timeframe } from "@/features/settings/types";
import { SIDE_LABEL, formatJst, formatPips, formatPrice } from "@/utils/format";
import type { Candle, Trade } from "../types";

export interface ShareFrame {
  tf: Timeframe;
  /** 先頭のウォームアップ（EMA計算用）の足の数 */
  warmupCount: number;
  candles: Candle[];
}

export interface ShareInput {
  trade: Trade;
  pipSize: number;
  frames: ShareFrame[];
  emas: EmaSetting[];
  /** 根拠のタグ・メモ・SL/TPの理由を含めるか */
  includeReasons: boolean;
  /** 最初に表示する時間足 */
  defaultTf: Timeframe;
  /** チャートの描画ライブラリ（standalone 版の中身） */
  librarySource: string;
}

const EXIT_LABEL = {
  open: "未決済",
  tp: "利確到達",
  sl: "損切り到達",
  manual: "手動決済",
  breakeven: "建値決済",
} as const;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** <script> の中に安全に埋め込める JSON にする */
export function safeJson(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function row(label: string, value: string): string {
  return `<div class="row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function reasonBlock(title: string, text: string | null): string {
  return text
    ? `<section><h2>${escapeHtml(title)}</h2><p class="memo">${escapeHtml(text)}</p></section>`
    : "";
}

export function buildShareHtml(i: ShareInput): string {
  const t = i.trade;
  const p = (v: number | null) => formatPrice(v, i.pipSize);
  const tags = t.tags.filter((x) => x.kind === "rationale").map((x) => x.name);

  const info = [
    row("通貨ペア", t.pair),
    row("売買", SIDE_LABEL[t.side]),
    row("エントリー", `${formatJst(t.entryAt)}  @ ${p(t.entryPrice)}`),
    row("損切り(SL)", t.slPrice === null ? "未設定" : p(t.slPrice)),
    row("利確(TP)", t.tpPrice === null ? "未設定" : p(t.tpPrice)),
    ...(t.exitAt && t.exitPrice !== null
      ? [
          row("決済", `${formatJst(t.exitAt)}  @ ${p(t.exitPrice)}`),
          row("決済の種類", EXIT_LABEL[t.exitMethod]),
          row("結果", formatPips(t.pips)),
        ]
      : [row("決済", "未決済")]),
  ].join("");

  const reasons = i.includeReasons
    ? [
        tags.length > 0
          ? `<section><h2>エントリー根拠</h2><p>${tags.map((n) => `<span class="tag">${escapeHtml(n)}</span>`).join(" ")}</p></section>`
          : "",
        reasonBlock("根拠メモ", t.rationaleMemo),
        reasonBlock("損切りの理由", t.slReason),
        reasonBlock("利確の理由", t.tpReason),
      ].join("")
    : "";

  const data = {
    side: t.side,
    defaultTf: i.defaultTf,
    pipSize: i.pipSize,
    entrySec: Math.floor(Date.parse(t.entryAt) / 1000),
    exitSec: t.exitAt ? Math.floor(Date.parse(t.exitAt) / 1000) : null,
    entryPrice: t.entryPrice,
    slPrice: t.slPrice,
    tpPrice: t.tpPrice,
    exitPrice: t.exitPrice,
    colors: CHART_COLORS,
    emas: i.emas.map((e, idx) => ({
      period: e.period,
      on: e.visible,
      color: EMA_COLORS[idx % EMA_COLORS.length],
    })),
    frames: i.frames.map((f) => ({
      tf: f.tf,
      warmup: f.warmupCount,
      c: f.candles.map((c) => [c.time, c.open, c.high, c.low, c.close]),
    })),
  };

  const c = CHART_COLORS;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t.pair)} ${SIDE_LABEL[t.side]} ${escapeHtml(formatJst(t.entryAt))} のトレード</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0D1117;color:#E6EBF2;font:14px/1.6 system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:0 0 4px}
h2{font-size:14px;margin:0 0 4px}
.note{color:#8B95A5;font-size:12px;margin:0 0 12px}
.card{background:${c.background};border:1px solid ${c.grid};border-radius:12px;padding:12px;margin-bottom:12px}
.bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-bottom:8px}
.bar button{min-height:36px;padding:0 12px;border-radius:8px;border:1px solid #3A4352;background:transparent;color:inherit;cursor:pointer}
.bar button[aria-pressed="true"]{border-color:${c.entry};background:rgba(157,180,255,.15)}
.bar label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
#chart{width:100%;height:440px}
.row{display:flex;justify-content:space-between;gap:16px;padding:4px 0;border-bottom:1px solid ${c.grid}}
.row dt{color:#8B95A5}.row dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
dl{margin:0}
.tag{display:inline-block;border:1px solid #3A4352;border-radius:999px;padding:0 10px;font-size:12px}
.memo{white-space:pre-wrap;margin:0}
section{margin-top:12px}
.key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:#B4BDCA;margin-top:6px}
.key i{display:inline-block;width:14px;height:0;border-top:2px dashed;vertical-align:middle;margin-right:4px}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(t.pair)} ${SIDE_LABEL[t.side]}のトレード</h1>
<p class="note">評価用の閲覧専用ファイルです。時間足とEMAは自由に切り替えられます。チャートはドラッグで動かし、ホイールで拡大・縮小できます。表示は日本時間です。</p>
<div class="card">
  <div class="bar" id="tfs" role="group" aria-label="時間足"></div>
  <div class="bar" id="emas" role="group" aria-label="EMA"></div>
  <div id="chart" role="img" aria-label="ローソク足チャート"></div>
  <div class="key">
    <span><i style="color:${c.entry}"></i>エントリー</span>
    <span><i style="color:${c.sl}"></i>損切り</span>
    <span><i style="color:${c.tp}"></i>利確</span>
    <span><i style="color:${c.exit}"></i>決済</span>
  </div>
</div>
<div class="card">
  <dl>${info}</dl>
  ${reasons}
</div>
</main>
<script>${i.librarySource}</script>
<script type="application/json" id="d">${safeJson(data)}</script>
<script>
(function(){
var D=JSON.parse(document.getElementById("d").textContent);
var OFF=32400, LC=window.LightweightCharts;
var chart=LC.createChart(document.getElementById("chart"),{
  autoSize:true,
  layout:{background:{color:D.colors.background},textColor:D.colors.text},
  grid:{vertLines:{color:D.colors.grid},horzLines:{color:D.colors.grid}},
  rightPriceScale:{borderColor:D.colors.grid},
  timeScale:{borderColor:D.colors.grid,timeVisible:true,secondsVisible:false}
});
var candles=chart.addSeries(LC.CandlestickSeries,{
  upColor:D.colors.up,downColor:D.colors.down,
  borderUpColor:D.colors.up,borderDownColor:D.colors.down,
  wickUpColor:D.colors.up,wickDownColor:D.colors.down,
  priceLineVisible:false,lastValueVisible:false
});
function line(price,color,title){
  if(price===null||price===undefined)return;
  candles.createPriceLine({price:price,color:color,lineWidth:1,lineStyle:LC.LineStyle.Dashed,axisLabelVisible:true,title:title});
}
line(D.entryPrice,D.colors.entry,"IN");
line(D.slPrice,D.colors.sl,"SL");
line(D.tpPrice,D.colors.tp,"TP");
line(D.exitPrice,D.colors.exit,"OUT");
var emaSeries=D.emas.map(function(e){
  return chart.addSeries(LC.LineSeries,{color:e.color,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,visible:e.on});
});
var markers=LC.createSeriesMarkers(candles,[]);
function ema(cs,period){
  if(period<1||cs.length<period)return [];
  var k=2/(period+1),prev=0,i;
  for(i=0;i<period;i++)prev+=cs[i][4];
  prev/=period;
  var out=[{time:cs[period-1][0]+OFF,value:prev}];
  for(i=period;i<cs.length;i++){prev=cs[i][4]*k+prev*(1-k);out.push({time:cs[i][0]+OFF,value:prev});}
  return out;
}
function indexAt(cs,ts){
  var f=-1;
  for(var i=0;i<cs.length;i++){if(cs[i][0]<=ts)f=i;else break;}
  return f;
}
var tfBox=document.getElementById("tfs"),emaBox=document.getElementById("emas"),current=null;
function show(fr){
  current=fr;
  var cs=fr.c;
  candles.setData(cs.map(function(c){return{time:c[0]+OFF,open:c[1],high:c[2],low:c[3],close:c[4]};}));
  D.emas.forEach(function(e,n){emaSeries[n].setData(ema(cs,e.period));});
  var ei=indexAt(cs,D.entrySec),xi=D.exitSec===null?-1:indexAt(cs,D.exitSec),m=[];
  var buy=D.side==="buy";
  if(ei>=0)m.push({time:cs[ei][0]+OFF,position:buy?"belowBar":"aboveBar",shape:buy?"arrowUp":"arrowDown",color:D.colors.entry,text:"IN"});
  if(xi>=0)m.push({time:cs[xi][0]+OFF,position:buy?"aboveBar":"belowBar",shape:buy?"arrowDown":"arrowUp",color:D.colors.exit,text:"OUT"});
  m.sort(function(a,b){return a.time-b.time;});
  markers.setMarkers(m);
  if(ei>=0){
    var from=Math.max(0,ei-60),to=Math.min(cs.length-1,(xi>=0?xi:ei)+40);
    chart.timeScale().setVisibleLogicalRange({from:from,to:to+3});
  }else{chart.timeScale().fitContent();}
  Array.prototype.forEach.call(tfBox.children,function(b){b.setAttribute("aria-pressed",String(b.dataset.tf===fr.tf));});
}
D.frames.forEach(function(fr){
  var b=document.createElement("button");
  b.type="button";b.textContent=fr.tf;b.dataset.tf=fr.tf;
  b.onclick=function(){show(fr);};
  tfBox.appendChild(b);
});
D.emas.forEach(function(e,n){
  var l=document.createElement("label"),cb=document.createElement("input");
  cb.type="checkbox";cb.checked=e.on;
  cb.onchange=function(){emaSeries[n].applyOptions({visible:cb.checked});};
  var sp=document.createElement("span");
  sp.textContent="EMA"+e.period;sp.style.color=e.color;
  l.appendChild(cb);l.appendChild(sp);emaBox.appendChild(l);
});
if(D.frames.length>0){
  var pick=D.frames.filter(function(f){return f.tf===D.defaultTf;})[0]||D.frames[0];
  show(pick);
}else{
  document.getElementById("chart").textContent="この期間のローソク足がありません。";
}
})();
</script>
</body>
</html>`;
}
