/**
 * 評価用HTMLファイルのページ部分（見た目と動き）。
 * アプリのチャート（TradeChart / ChartPane / ChartPanel / ChartLegend / EmaControls）と同じ仕様にそろえる。
 * 仕様を変えたときは、こちらも合わせること。
 * 注意: ここは <script> にそのまま入る文字列なので、バッククォートと「${」は使わない。
 */

export const SHARE_PAGE_CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0E1116;color:#E6EAF0;font:14px/1.6 "Noto Sans JP",system-ui,-apple-system,"Hiragino Sans",sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:0 0 4px}
h2{font-size:14px;margin:0 0 4px}
.num,.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
.note{color:#8B95A5;font-size:12px;margin:0 0 12px}
.card{background:#161B22;border:1px solid #262D38;border-radius:12px;padding:24px;margin-bottom:12px}
@media(max-width:640px){.card{padding:12px}}
#panel{display:flex;flex-direction:column;gap:12px;min-width:0}
#panel:fullscreen{background:#0E1116;padding:12px;overflow:auto}
.row2{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.group{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px}
button{font:inherit;color:inherit;cursor:pointer}
.btn{display:inline-flex;min-height:44px;align-items:center;justify-content:center;border-radius:8px;border:1px solid #2B3441;background:transparent;padding:0 16px;font-size:14px;font-weight:500;color:#E6EAF0}
.btn:hover{background:#1B222C}
.btn:disabled{opacity:.5;cursor:default}
.btn.sm{font-size:12px}
.btn[aria-pressed="true"]{border-color:#3E63DD;background:rgba(62,99,221,.1);color:#9DB4FF}
.chk{display:flex;min-height:44px;align-items:center;gap:8px;font-size:14px;color:#B4BDCA;cursor:pointer}
.tfsel{display:inline-flex;border-radius:8px;background:#0E1116;padding:4px}
.tfsel button{min-height:44px;min-width:48px;border-radius:8px;border:0;background:transparent;padding:0 12px;font-size:14px;color:#B4BDCA}
.tfsel button[aria-checked="true"]{background:#3E63DD;color:#fff}
.chips{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.chip{display:inline-flex;align-items:center;border-radius:22px;border:1px solid #262D38;background:#1F2630}
.chip button{min-height:44px;border:0;background:transparent;border-radius:22px;padding:0 12px;font-size:14px;color:#E6EAF0}
.chip button.x{padding:0 12px 0 0;color:#8B95A5}
.chip button.x:hover{color:#E6EAF0}
.chip button[aria-pressed="false"]{color:#8B95A5;text-decoration:line-through}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.emaadd{display:flex;align-items:center;gap:4px;font-size:14px;color:#B4BDCA}
.emaadd input{width:5rem;min-height:44px;border-radius:8px;border:1px solid #2B3441;background:#0E1116;color:#E6EAF0;padding:0 12px;font-size:14px}
.err{font-size:12px;color:#FF7A8A;margin:0}
.legend{display:flex;flex-wrap:wrap;gap:4px}
.legend button{display:inline-flex;min-height:44px;align-items:center;gap:8px;border-radius:22px;border:1px solid #262D38;background:#1F2630;padding:0 12px;font-size:12px;color:#E6EAF0}
.legend button[aria-pressed="false"]{color:#8B95A5;text-decoration:line-through;opacity:.6;background:transparent}
.panes{display:grid;gap:12px;min-width:0}
.panes.dual{grid-template-columns:minmax(0,1fr)}
@media(min-width:768px){.panes.dual{grid-template-columns:repeat(2,minmax(0,1fr))}}
#panel:fullscreen .panes{flex:1;min-height:0}
.pane{display:flex;flex-direction:column;gap:8px;min-width:0}
.pane h3{font-size:14px;margin:0}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px}
.toolbar .lock{display:inline-flex;align-items:center;border-radius:22px;border:1px solid #262D38;background:#1F2630;padding:2px 8px;font-size:12px;color:#F5B94A}
.chartbox{position:relative;width:100%;min-width:0;height:360px;overflow:hidden}
#panel:fullscreen .chartbox{flex:1;height:auto;min-height:280px}
.chart{position:absolute;inset:0}
.badge{position:absolute;left:8px;top:8px;z-index:10;pointer-events:none;border:1px solid;border-radius:22px;padding:2px 8px;font-size:12px;font-weight:700}
.msg{position:absolute;inset:0;display:grid;place-items:center;color:#8B95A5;font-size:14px}
.side{border:1px solid;border-radius:22px;padding:0 10px;font-size:15px}
.info .row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-size:14px}
.info .row dt{color:#B4BDCA}
.info .row dd{margin:0;text-align:right;font-family:"JetBrains Mono",ui-monospace,monospace}
dl{margin:0}
.tag{display:inline-block;border:1px solid #262D38;border-radius:22px;background:#1F2630;padding:0 12px;font-size:12px}
.memo{white-space:pre-wrap;margin:0;font-size:14px}
section.blk{margin-top:12px}
.hint{font-size:12px;color:#8B95A5;margin:0}
body:not(.show-after) .after{display:none}
[hidden]{display:none!important}
button:focus-visible,input:focus-visible{outline:2px solid #9DB4FF;outline-offset:2px}
`;

export const SHARE_PAGE_SCRIPT = `
(function(){
var D=JSON.parse(document.getElementById("d").textContent);
var LC=window.LightweightCharts, OFF=32400, HEIGHT=360;
var BEFORE=60, AFTER=40, MAX_EMA=8;
var C=D.colors;
var TFS=D.frames.map(function(f){return f.tf;});
var state={
  showAfter:false, dual:false,
  emas:D.emas.map(function(e){return{period:e.period,visible:e.visible};}),
  overlays:{entryLine:true,tpLine:true,slLine:true,exitLine:true,afterShade:true,markers:true,excursion:false}
};
var panes=[];
var maxPeriod=Math.max.apply(null,D.emas.map(function(e){return e.period;}).concat([1]));

function emaColor(i){return D.emaColors[i%D.emaColors.length];}
function frameFor(tf){for(var i=0;i<D.frames.length;i++)if(D.frames[i].tf===tf)return D.frames[i];return null;}
function indexAt(cs,ts){var f=-1;for(var i=0;i<cs.length;i++){if(cs[i][0]<=ts)f=i;else break;}return f;}
function ema(cs,period){
  if(period<1||cs.length<period)return [];
  var k=2/(period+1),prev=0,i;
  for(i=0;i<period;i++)prev+=cs[i][4];
  prev/=period;
  var out=[{time:cs[period-1][0]+OFF,value:prev}];
  for(i=period;i<cs.length;i++){prev=cs[i][4]*k+prev*(1-k);out.push({time:cs[i][0]+OFF,value:prev});}
  return out;
}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}

/* 縦軸の自動追従の切り替え（アプリと同じ: 固定は、いちど自動で合わせてから固定する） */
function setYMode(p,auto){
  cancelAnimationFrame(p.raf);
  p.busy=!auto;
  p.candles.priceScale().applyOptions({autoScale:true});
  if(!auto){
    p.raf=requestAnimationFrame(function(){
      p.busy=false;
      p.candles.priceScale().applyOptions({autoScale:false});
    });
  }else{p.busy=false;}
}

function Pane(title,tf,withTitle){
  var p={tf:tf,fixed:false,busy:false,raf:0,lines:[],emaSeries:[],resetKey:null};
  var root=el("div","pane");
  var h=el("h3","",title);h.hidden=!withTitle;
  var tfsel=el("div","tfsel");tfsel.setAttribute("role","radiogroup");tfsel.setAttribute("aria-label","時間足（"+title+"）");
  var toolbar=el("div","toolbar");
  var left=el("div","group"),right=el("div","group");
  var imgBtn=el("button","btn sm","画像を保存");imgBtn.type="button";
  var lock=el("span","lock","縦軸を固定中");lock.setAttribute("role","status");lock.hidden=true;
  var refit=el("button","btn sm","範囲を合わせ直す");refit.type="button";refit.hidden=true;
  var fixLbl=el("label","chk"),fix=el("input");fix.type="checkbox";
  fixLbl.appendChild(fix);fixLbl.appendChild(document.createTextNode("縦軸固定"));
  left.appendChild(imgBtn);right.appendChild(lock);right.appendChild(refit);right.appendChild(fixLbl);
  toolbar.appendChild(left);toolbar.appendChild(right);
  var box=el("div","chartbox"),host=el("div","chart");
  var badge=el("span","badge",D.side==="buy"?"▲ 買い":"▼ 売り");
  badge.style.color=C.sideColor;badge.style.borderColor=C.sideColor;badge.style.background=C.background;
  var msg=el("div","msg","この時間足のローソク足がありません");msg.hidden=true;
  box.appendChild(host);box.appendChild(badge);box.appendChild(msg);
  root.appendChild(h);root.appendChild(tfsel);root.appendChild(toolbar);root.appendChild(box);
  p.root=root;p.title=h;

  /* チャート本体（アプリの TradeChart と同じ設定） */
  var chart=LC.createChart(host,{
    autoSize:true,
    layout:{background:{type:LC.ColorType.Solid,color:C.background},textColor:C.text,fontFamily:'"JetBrains Mono", ui-monospace, monospace'},
    grid:{vertLines:{color:C.grid},horzLines:{color:C.grid}},
    rightPriceScale:{borderColor:C.grid},
    timeScale:{borderColor:C.grid,timeVisible:true,secondsVisible:false}
  });
  var shade=chart.addSeries(LC.HistogramSeries,{priceScaleId:"after-shade",priceLineVisible:false,lastValueVisible:false,base:0});
  shade.priceScale().applyOptions({scaleMargins:{top:0,bottom:0},visible:false});
  var candles=chart.addSeries(LC.CandlestickSeries,{
    upColor:C.up,downColor:C.down,borderVisible:false,
    priceLineVisible:false,lastValueVisible:false,
    wickUpColor:C.up,wickDownColor:C.down,
    priceFormat:{type:"price",precision:D.digits,minMove:D.pipSize}
  });
  candles.priceScale().applyOptions({scaleMargins:{top:0.2,bottom:0.15}});
  var markers=LC.createSeriesMarkers(candles,[],{autoScale:false});
  p.chart=chart;p.shade=shade;p.candles=candles;p.markers=markers;p.host=host;p.msg=msg;

  function tfButtons(){
    tfsel.textContent="";
    TFS.forEach(function(t){
      var b=el("button","num",t);b.type="button";b.setAttribute("role","radio");
      b.setAttribute("aria-checked",String(t===p.tf));
      b.onclick=function(){setTf(t);};
      tfsel.appendChild(b);
    });
  }
  function setTf(t){p.tf=t;tfButtons();p.refresh(true);}
  p.setTf=setTf;

  function lines(){
    p.lines.forEach(function(l){try{candles.removePriceLine(l);}catch(e){}});
    p.lines=[];
    var o=state.overlays;
    function pl(price,color,style,title){
      p.lines.push(candles.createPriceLine({price:price,color:color,lineWidth:1,lineStyle:style,axisLabelVisible:true,title:title}));
    }
    if(o.entryLine)pl(D.entryPrice,C.sideColor,LC.LineStyle.Dashed,D.sideLabel+"エントリー");
    if(D.tpPrice!==null&&o.tpLine)pl(D.tpPrice,C.tp,LC.LineStyle.Dashed,"TP");
    if(D.slPrice!==null&&o.slLine)pl(D.slPrice,C.sl,LC.LineStyle.Dashed,"SL");
    if(state.showAfter){
      if(D.exitPrice!==null&&o.exitLine)pl(D.exitPrice,D.exitWin?C.tp:C.sl,LC.LineStyle.Dotted,"決済");
      if(D.excursion&&o.excursion){
        if(D.excursion.mfe!==null)pl(D.excursion.mfe,C.tp,LC.LineStyle.SparseDotted,"最大含み益");
        if(D.excursion.mae!==null)pl(D.excursion.mae,C.sl,LC.LineStyle.SparseDotted,"最大含み損");
        if(D.excursion.afterMax!==null)pl(D.excursion.afterMax,C.exit,LC.LineStyle.SparseDotted,"決済後最大");
      }
    }
  }

  p.refresh=function(reset){
    var fr=frameFor(p.tf);
    p.msg.hidden=fr!==null&&fr.c.length>0;
    if(!fr||fr.c.length===0){candles.setData([]);shade.setData([]);markers.setMarkers([]);p.emaSeries.forEach(function(s){chart.removeSeries(s);});p.emaSeries=[];return;}
    var all=fr.c,ei=indexAt(all,D.entrySec);
    var cs=(state.showAfter||ei<0)?all:all.slice(0,ei+1);
    candles.setData(cs.map(function(c){return{time:c[0]+OFF,open:c[1],high:c[2],low:c[3],close:c[4]};}));
    /* エントリーの足から右を薄く塗る */
    var entryT=ei>=0?all[ei][0]:null;
    var hasAfter=state.showAfter&&entryT!==null&&cs.some(function(c){return c[0]>entryT;});
    shade.setData(state.overlays.afterShade&&hasAfter?cs.filter(function(c){return c[0]>=entryT;}).map(function(c){return{time:c[0]+OFF,value:1,color:"rgba(157, 180, 255, 0.10)"};}):[]);
    /* EMA（表示中のものだけ。色は追加順） */
    p.emaSeries.forEach(function(s){chart.removeSeries(s);});
    p.emaSeries=[];
    state.emas.forEach(function(e,i){
      if(!e.visible)return;
      var s=chart.addSeries(LC.LineSeries,{color:emaColor(i),lineWidth:2,priceLineVisible:false,lastValueVisible:false,title:"EMA"+e.period});
      s.setData(ema(cs,e.period));
      p.emaSeries.push(s);
    });
    /* IN / OUT の矢印: 買いは足の下に IN・上に OUT、売りはその反対 */
    var m=[],buy=D.side==="buy";
    if(ei>=0&&state.overlays.markers)m.push({time:cs[ei][0]+OFF,position:buy?"belowBar":"aboveBar",shape:buy?"arrowUp":"arrowDown",color:C.sideColor,text:D.sideLabel+" IN "+D.entryText});
    var xi=(!state.showAfter||D.exitSec===null)?-1:indexAt(cs,D.exitSec);
    if(xi>=0&&state.overlays.markers)m.push({time:cs[xi][0]+OFF,position:buy?"aboveBar":"belowBar",shape:buy?"arrowDown":"arrowUp",color:C.exit,text:D.exitText?"OUT "+D.exitText:"OUT"});
    m.sort(function(a,b){return a.time-b.time;});
    markers.setMarkers(m);
    lines();
    if(reset){
      /* どの時間足でも同じ本数（エントリーの足の前後）を見せる */
      if(ei>=0)chart.timeScale().setVisibleLogicalRange({from:ei-BEFORE,to:ei+AFTER});
      else chart.timeScale().fitContent();
      if(p.fixed)setYMode(p,false);
    }
  };

  function lockUi(){lock.hidden=!p.fixed;refit.hidden=!p.fixed;fix.checked=p.fixed;}
  fix.onchange=function(){p.fixed=fix.checked;setYMode(p,!p.fixed);lockUi();};
  refit.onclick=function(){setYMode(p,!p.fixed);};
  imgBtn.onclick=function(){
    try{
      var cv=chart.takeScreenshot();
      cv.toBlob(function(b){
        if(!b)return;
        var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=D.imageName+"-"+p.tf+".png";
        document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
      },"image/png");
    }catch(e){}
  };
  /* 価格軸のドラッグなどで自動追従が切れたら、「縦軸固定」を実際の状態に合わせる */
  var syncTimer=0;
  function syncY(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(function(){
      if(p.busy)return;
      var auto=candles.priceScale().options().autoScale;
      if(auto===p.fixed){p.fixed=!auto;lockUi();}
    },0);
  }
  ["pointerup","dblclick","wheel"].forEach(function(ev){host.addEventListener(ev,syncY,{passive:true});});

  tfButtons();lockUi();
  p.destroy=function(){chart.remove();root.remove();};
  return p;
}

var panesEl=document.getElementById("panes");
function addPane(title,tf){var p=Pane(title,tf,state.dual);panes.push(p);panesEl.appendChild(p.root);p.refresh(true);
  /* 描画幅が決まってから、表示位置を合わせ直す（幅が0の間に範囲を決めるとずれるため） */
  requestAnimationFrame(function(){requestAnimationFrame(function(){if(panes.indexOf(p)>=0)p.refresh(true);});});
  return p;}
function refreshAll(){panes.forEach(function(p){p.refresh(false);});}

function nextTf(tf){var i=TFS.indexOf(tf);return TFS[Math.min(i+1,TFS.length-1)];}
var first=TFS.indexOf(D.defaultTf)>=0?D.defaultTf:TFS[0];
addPane("画面1",first);

/* 上部の操作 */
var afterChk=document.getElementById("showAfter");
afterChk.onchange=function(){
  state.showAfter=afterChk.checked;
  document.body.classList.toggle("show-after",state.showAfter);
  renderLegend();refreshAll();
};
var dualBtn=document.getElementById("dual");
function setDual(on){
  state.dual=on;
  dualBtn.setAttribute("aria-pressed",String(on));
  dualBtn.textContent=on?"1画面に戻す":"時間足を並べる";
  panesEl.classList.toggle("dual",on);
  if(on){
    var second=addPane("画面2",nextTf(panes[0].tf));
    second.title.hidden=false;
  }else{
    while(panes.length>1)panes.pop().destroy();
  }
  panes[0].title.hidden=!on;
}
dualBtn.onclick=function(){setDual(!state.dual);};
var fsBtn=document.getElementById("fs"),panel=document.getElementById("panel");
if(!panel.requestFullscreen){fsBtn.hidden=true;}
function toggleFs(){
  if(!panel.requestFullscreen)return;
  if(document.fullscreenElement)document.exitFullscreen();else panel.requestFullscreen();
}
fsBtn.onclick=toggleFs;
document.addEventListener("fullscreenchange",function(){
  var on=!!document.fullscreenElement;
  fsBtn.setAttribute("aria-pressed",String(on));
  fsBtn.textContent=on?"全画面を閉じる":"全画面";
});

/* EMA（ON/OFFと、期間の追加・削除） */
var emaBox=document.getElementById("emas");
function renderEma(errText){
  emaBox.textContent="";
  state.emas.forEach(function(e,i){
    var chip=el("span","chip");
    var b=el("button","num");b.type="button";b.setAttribute("aria-pressed",String(e.visible));
    var dot=el("span","dot");dot.style.background=emaColor(i);dot.setAttribute("aria-hidden","true");
    b.appendChild(dot);b.appendChild(document.createTextNode("EMA"+e.period));
    b.onclick=function(){e.visible=!e.visible;renderEma();refreshAll();};
    var x=el("button","x","×");x.type="button";x.setAttribute("aria-label","EMA"+e.period+"を削除");
    x.onclick=function(){state.emas=state.emas.filter(function(y){return y!==e;});renderEma();refreshAll();};
    chip.appendChild(b);chip.appendChild(x);emaBox.appendChild(chip);
  });
  var lbl=el("label","emaadd"),input=el("input");input.type="number";input.min="1";input.placeholder="期間";input.setAttribute("aria-label","追加するEMAの期間");
  var add=el("button","btn","追加");add.type="button";
  lbl.appendChild(input);lbl.appendChild(add);emaBox.appendChild(lbl);
  var err=el("p","err",errText||"");err.hidden=!errText;if(errText)err.setAttribute("role","alert");emaBox.appendChild(err);
  function doAdd(){
    var v=Number(input.value);
    if(!isFinite(v)||Math.floor(v)!==v||v<1||v>maxPeriod){renderEma("期間は1〜"+maxPeriod+"の整数で入力してください（このファイルに含まれる足の範囲で計算できる上限です）");return;}
    if(state.emas.some(function(y){return y.period===v;})){renderEma("EMA"+v+"はすでにあります");return;}
    if(state.emas.length>=MAX_EMA){renderEma("EMAは"+MAX_EMA+"本までです");return;}
    state.emas.push({period:v,visible:true});renderEma();refreshAll();
  }
  add.onclick=doAdd;
  input.onkeydown=function(ev){if(ev.key==="Enter"){ev.preventDefault();doAdd();}};
}

/* 凡例（各行を押すと、その表示・非表示を切り替える） */
var legendBox=document.getElementById("legend");
function swatch(kind,color){
  var ns="http://www.w3.org/2000/svg",s=document.createElementNS(ns,"svg");
  s.setAttribute("aria-hidden","true");
  if(kind==="shade"){
    s.setAttribute("width","18");s.setAttribute("height","12");s.setAttribute("viewBox","0 0 18 12");
    var r=document.createElementNS(ns,"rect");r.setAttribute("x","1");r.setAttribute("y","1");r.setAttribute("width","16");r.setAttribute("height","10");r.setAttribute("rx","2");r.setAttribute("fill",color);r.setAttribute("fill-opacity","0.35");s.appendChild(r);
  }else if(kind==="arrow"){
    s.setAttribute("width","18");s.setAttribute("height","12");s.setAttribute("viewBox","0 0 18 12");
    var pa=document.createElementNS(ns,"path");pa.setAttribute("d","M9 1 L15 10 L3 10 Z");pa.setAttribute("fill",color);s.appendChild(pa);
  }else{
    s.setAttribute("width","22");s.setAttribute("height","12");s.setAttribute("viewBox","0 0 22 12");
    var l=document.createElementNS(ns,"line");l.setAttribute("x1","1");l.setAttribute("y1","6");l.setAttribute("x2","21");l.setAttribute("y2","6");l.setAttribute("stroke",color);l.setAttribute("stroke-width","2");l.setAttribute("stroke-dasharray",kind==="dashed"?"5 3":"1.5 3");l.setAttribute("stroke-linecap","round");s.appendChild(l);
  }
  return s;
}
function renderLegend(){
  legendBox.textContent="";
  var items=[
    {key:"entryLine",label:"エントリー価格",sw:"dashed",color:C.sideColor,show:true},
    {key:"tpLine",label:"TP（利確）",sw:"dashed",color:C.tp,show:D.tpPrice!==null},
    {key:"slLine",label:"SL（損切り）",sw:"dashed",color:C.sl,show:D.slPrice!==null},
    {key:"exitLine",label:"決済価格（勝ち緑・負け赤）",sw:"dotted",color:C.tp,show:D.exitPrice!==null&&state.showAfter},
    {key:"excursion",label:"最大含み益・含み損・決済後最大",sw:"dotted",color:C.exit,show:!!D.excursion&&state.showAfter},
    {key:"afterShade",label:"エントリー以降の背景",sw:"shade",color:C.entry,show:true},
    {key:"markers",label:"IN / OUT の矢印",sw:"arrow",color:C.exit,show:true}
  ];
  items.forEach(function(it){
    if(!it.show)return;
    var on=state.overlays[it.key];
    var b=el("button");b.type="button";b.setAttribute("aria-pressed",String(on));
    b.appendChild(swatch(it.sw,it.color));b.appendChild(document.createTextNode(it.label));
    b.onclick=function(){state.overlays[it.key]=!state.overlays[it.key];renderLegend();refreshAll();};
    legendBox.appendChild(b);
  });
}

/* キーボード: F=全画面 / 1〜6=時間足 / D=2画面 */
document.addEventListener("keydown",function(e){
  var t=e.target;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable)&&t.type!=="checkbox")return;
  var k=e.key.toLowerCase();
  if(k==="f")toggleFs();
  else if(k==="d")setDual(!state.dual);
  else if(/^[1-6]$/.test(k)&&TFS[Number(k)-1])panes[0].setTf(TFS[Number(k)-1]);
});

renderEma();renderLegend();
})();
`;
