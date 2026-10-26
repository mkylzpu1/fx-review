/**
 * 評価用HTMLファイルのページ部分（見た目と動き）。
 * チャートの描画仕様はアプリのチャート（TradeChart）と同じ。画面の作りは「チャート最大・操作は上に1行・計画は重ねて表示」。
 * 仕様を変えたときは、こちらも合わせること。
 * 注意: ここは <script> にそのまま入る文字列なので、バッククォートと「${」は使わない。
 */

export const SHARE_PAGE_CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;display:flex;flex-direction:column;height:100vh;height:100dvh;overflow:hidden;background:#0E1116;color:#E6EAF0;font:13px/1.5 "Noto Sans JP",system-ui,-apple-system,"Hiragino Sans",sans-serif;-webkit-font-smoothing:antialiased}
.mono,.num{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
.mute{color:#8B95A5}.win{color:#6EE7C8}.loss{color:#FF7A8A}
button{font:inherit;color:inherit;cursor:pointer}
[hidden]{display:none!important}
#top{display:flex;align-items:center;gap:10px;padding:4px 12px;border-bottom:1px solid #2A4A3C;min-height:48px;flex-wrap:wrap;flex:none}
.ttl{white-space:nowrap}.side{font-weight:700}
.ctl{display:flex;align-items:center;gap:8px;flex:1;min-width:0;flex-wrap:wrap}
.sp{flex:1}
.b{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 12px;border-radius:4px;border:1px solid #35594A;background:transparent;color:#E6EAF0;font-size:12px;white-space:nowrap}
.b:hover{background:rgba(110,231,200,.10);border-color:rgba(110,231,200,.6)}
.b.on{border-color:#6EE7C8;background:rgba(110,231,200,.14);color:#6EE7C8}
.seg{display:inline-flex;border:1px solid #2A4A3C;border-radius:4px;padding:2px;background:#0E1116}
.seg button{min-height:36px;min-width:40px;padding:0 8px;border:0;border-radius:3px;background:transparent;color:#B4BDCA;font-size:12px}
.seg button[aria-checked="true"]{background:#6EE7C8;color:#0E1116;font-weight:700}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 10px;border:1px solid #2A4A3C;border-radius:20px;background:#1A2B24;font-size:12px;white-space:nowrap}
.chip[aria-pressed="false"]{color:#8B95A5;text-decoration:line-through}
.dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
.selb{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 10px;border:1px solid #35594A;border-radius:4px;background:#0E1116;color:#E6EAF0;font-size:13px;white-space:nowrap}
.selb small{color:#8B95A5;font-size:11px}
.sw{display:inline-flex;align-items:center;gap:6px;min-height:40px;border:0;background:transparent;font-size:12px;color:#B4BDCA;white-space:nowrap;padding:0}
.sw i{width:30px;height:18px;border-radius:9px;background:#35594A;position:relative;flex:none}
.sw i:after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#8B95A5}
.sw.on i{background:#6EE7C8}.sw.on i:after{left:14px;background:#0E1116}
.strip{display:none;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #2A4A3C;font-size:11px;background:#161B22;flex:none}
#cvwrap{position:relative;flex:1;min-height:0}
.panes{position:absolute;inset:0;display:grid;gap:2px;grid-template-columns:minmax(0,1fr)}
.panes.dual{grid-template-columns:repeat(2,minmax(0,1fr))}
.pane{position:relative;min-width:0;min-height:0}
.chartbox{position:absolute;inset:0}
.chart{position:absolute;inset:0}
.msg{position:absolute;inset:0;display:grid;place-items:center;color:#8B95A5}
.ptf{position:absolute;right:66px;top:6px;z-index:8}
.hud{position:absolute;left:10px;top:10px;z-index:10;width:236px;max-height:calc(100% - 20px);display:flex;flex-direction:column;background:rgba(22,27,34,.94);border:1px solid #35594A;border-radius:6px;font-size:12px}
.hudhead{display:flex;justify-content:space-between;align-items:center;padding:0 4px 0 10px;min-height:36px;border-bottom:1px solid #2A4A3C}
.hudhead .b{min-height:32px;min-width:32px;padding:0 8px;border:0}
.hudbody{overflow:auto;padding:4px 10px 8px}
.hud.collapsed .hudbody{display:none}.hud.collapsed .hudhead{border-bottom:0}
.hud dl{margin:0}
.row{display:flex;justify-content:space-between;gap:10px;padding:4px 0}
.row dt{color:#8B95A5}.row dd{margin:0;text-align:right;font-family:"JetBrains Mono",ui-monospace,monospace}
.tags{margin:6px 0 2px}
.tag{display:inline-block;border:1px solid #35594A;border-radius:3px;padding:0 6px;color:#B4BDCA;margin:0 2px 2px 0}
.why{margin-top:6px;border-top:1px solid #2A4A3C;padding-top:6px}
.why summary{cursor:pointer;color:#B4BDCA;min-height:28px}
section.blk{margin-top:6px}section.blk h2{font-size:11px;color:#8B95A5;margin:0 0 2px;font-weight:500}
.memo{white-space:pre-wrap;margin:0}
body:not(.show-after) .after{display:none}
.bottom{display:none;flex:none;align-items:center;gap:6px;justify-content:space-between;padding:0 10px;border-top:1px solid #2A4A3C;min-height:52px;padding-bottom:env(safe-area-inset-bottom,0)}
#ov{position:fixed;inset:0;z-index:50}
.dim{position:absolute;inset:0;background:rgba(0,0,0,.55)}
.pop{position:absolute;min-width:200px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 80px);overflow:auto;background:#161B22;border:1px solid #35594A;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.6)}
.pop.wide{width:340px}
.it{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;padding:0 14px;border:0;border-bottom:1px solid #1A2B24;background:transparent;font-size:14px;text-align:left}
.it:last-child{border:0}.it.cur{color:#6EE7C8;font-weight:700;background:rgba(110,231,200,.10)}
.sheet{position:absolute;left:0;right:0;bottom:0;max-height:80dvh;overflow:auto;background:#161B22;border-top:1px solid #35594A;border-radius:14px 14px 0 0;padding:0 14px calc(14px + env(safe-area-inset-bottom,0))}
.ph{display:flex;align-items:center;justify-content:space-between;min-height:48px;position:sticky;top:0;background:#161B22}
.ph b{font-size:14px}
.pop .ph{padding:0 8px 0 14px}.pop .pb{padding:0 14px 12px}
.sec{padding:8px 0 10px;border-top:1px solid #2A4A3C}
.sec h4{margin:0 0 6px;font-size:12px;color:#8B95A5;font-weight:500}
.er{display:flex;align-items:center;gap:10px;min-height:44px}
.er .mono{flex:1;font-size:14px}
.in{min-height:44px;width:84px;border:1px solid #35594A;border-radius:4px;background:#0E1116;color:#E6EAF0;padding:0 10px;font:inherit}
.lg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.lg .sw{white-space:normal;text-align:left;line-height:1.3;border:1px solid #2A4A3C;border-radius:4px;padding:0 8px;background:#1A2B24;min-height:44px}
.err{font-size:12px;color:#FF7A8A;margin:4px 0 0}
.help{margin:0;color:#B4BDCA;line-height:1.7}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #6EE7C8;outline-offset:2px}
@media(max-width:720px){
  #top{padding:2px 10px;min-height:40px;gap:4px}
  .ctl{flex:none;width:100%;gap:6px;padding-bottom:4px}
  .strip{display:flex}
  .bottom{display:flex}
  .panes.dual{grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr))}
  .hud{display:none;left:10px;right:10px;width:auto}
  .hud.show{display:flex}
  .ptf{right:50px}
}
`;

export const SHARE_PAGE_SCRIPT = `
(function(){
var D=JSON.parse(document.getElementById("d").textContent);
var LC=window.LightweightCharts, OFF=32400;
var BEFORE=60, AFTER=40, MAX_EMA=8;
var C=D.colors;
var TFS=D.frames.map(function(f){return f.tf;});
var mq=window.matchMedia("(max-width: 720px)");
function mobile(){return mq.matches;}
var state={
  showAfter:false, dual:false, fixY:false, hudPc:true, hudMobile:false,
  emas:D.emas.map(function(e){return{period:e.period,visible:e.visible};}),
  overlays:{entryLine:true,tpLine:true,slLine:true,exitLine:true,afterShade:true,markers:true,excursion:false}
};
var panes=[], panel=null, emaErr="";
var maxPeriod=Math.max.apply(null,D.emas.map(function(e){return e.period;}).concat([1]));
function $(id){return document.getElementById(id);}
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
function btn(label,fn,cls,key){var b=el("button",cls||"b",label);b.type="button";if(fn)b.onclick=fn;if(key)b.setAttribute("data-key",key);return b;}
function sw(label,on,fn){
  var b=el("button","sw"+(on?" on":""));b.type="button";b.setAttribute("role","switch");b.setAttribute("aria-checked",String(on));
  b.appendChild(el("i"));b.appendChild(document.createTextNode(label));b.onclick=fn;return b;
}
function setYMode(p,auto){
  cancelAnimationFrame(p.raf);
  p.busy=!auto;
  p.candles.priceScale().applyOptions({autoScale:true});
  if(!auto){p.raf=requestAnimationFrame(function(){p.busy=false;p.candles.priceScale().applyOptions({autoScale:false});});}
  else{p.busy=false;}
}

function Pane(idx,tf){
  var p={idx:idx,tf:tf,fixed:state.fixY,busy:false,raf:0,lines:[],emaSeries:[]};
  var root=el("div","pane"),box=el("div","chartbox"),host=el("div","chart");
  var msg=el("div","msg","この時間足のローソク足がありません");msg.hidden=true;
  var ptf=el("div","seg ptf");ptf.setAttribute("role","radiogroup");ptf.setAttribute("aria-label","時間足（画面"+(idx+1)+"）");
  box.appendChild(host);box.appendChild(msg);box.appendChild(ptf);root.appendChild(box);
  p.root=root;
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
    upColor:C.up,downColor:C.down,borderVisible:false,priceLineVisible:false,lastValueVisible:false,
    wickUpColor:C.up,wickDownColor:C.down,
    priceFormat:{type:"price",precision:D.digits,minMove:D.pipSize}
  });
  candles.priceScale().applyOptions({scaleMargins:{top:0.2,bottom:0.15}});
  var markers=LC.createSeriesMarkers(candles,[],{autoScale:false});
  p.chart=chart;p.candles=candles;p.shade=shade;p.markers=markers;p.msg=msg;

  p.renderPtf=function(){
    ptf.hidden=!state.dual;ptf.textContent="";
    TFS.forEach(function(t){
      var b=el("button","mono",t);b.type="button";b.setAttribute("role","radio");b.setAttribute("aria-checked",String(t===p.tf));
      b.onclick=function(){p.setTf(t);};ptf.appendChild(b);
    });
  };
  p.setTf=function(t){p.tf=t;p.renderPtf();p.refresh(true);renderControls();};

  function lines(){
    p.lines.forEach(function(l){try{candles.removePriceLine(l);}catch(e){}});
    p.lines=[];
    var o=state.overlays;
    function pl(price,color,style,title){p.lines.push(candles.createPriceLine({price:price,color:color,lineWidth:1,lineStyle:style,axisLabelVisible:true,title:title}));}
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
    var prevRange=reset?null:chart.timeScale().getVisibleLogicalRange();
    var all=fr.c,ei=indexAt(all,D.entrySec);
    var cs=(state.showAfter||ei<0)?all:all.slice(0,ei+1);
    candles.setData(cs.map(function(c){return{time:c[0]+OFF,open:c[1],high:c[2],low:c[3],close:c[4]};}));
    var entryT=ei>=0?all[ei][0]:null;
    var hasAfter=state.showAfter&&entryT!==null&&cs.some(function(c){return c[0]>entryT;});
    shade.setData(state.overlays.afterShade&&hasAfter?cs.filter(function(c){return c[0]>=entryT;}).map(function(c){return{time:c[0]+OFF,value:1,color:"rgba(110, 231, 200, 0.08)"};}):[]);
    p.emaSeries.forEach(function(s){chart.removeSeries(s);});p.emaSeries=[];
    state.emas.forEach(function(e,i){
      if(!e.visible)return;
      var s=chart.addSeries(LC.LineSeries,{color:emaColor(i),lineWidth:2,priceLineVisible:false,lastValueVisible:false,title:"EMA"+e.period});
      s.setData(ema(cs,e.period));p.emaSeries.push(s);
    });
    var m=[],buy=D.side==="buy";
    if(ei>=0&&state.overlays.markers)m.push({time:cs[ei][0]+OFF,position:buy?"belowBar":"aboveBar",shape:buy?"arrowUp":"arrowDown",color:C.sideColor,text:D.sideLabel+" IN "+D.entryText});
    var xi=(!state.showAfter||D.exitSec===null)?-1:indexAt(cs,D.exitSec);
    if(xi>=0&&state.overlays.markers)m.push({time:cs[xi][0]+OFF,position:buy?"aboveBar":"belowBar",shape:buy?"arrowDown":"arrowUp",color:C.exit,text:D.exitText?"OUT "+D.exitText:"OUT"});
    m.sort(function(a,b){return a.time-b.time;});
    markers.setMarkers(m);
    lines();
    if(prevRange)chart.timeScale().setVisibleLogicalRange(prevRange);
    if(reset){
      if(ei>=0)chart.timeScale().setVisibleLogicalRange({from:ei-BEFORE,to:ei+AFTER});
      else chart.timeScale().fitContent();
      if(p.fixed)setYMode(p,false);
    }
  };
  p.save=function(){
    try{
      var cv=chart.takeScreenshot();
      cv.toBlob(function(b){
        if(!b)return;
        var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=D.imageName+"-"+p.tf+".png";
        document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
      },"image/png");
    }catch(e){}
  };
  var syncTimer=0;
  function syncY(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(function(){
      if(p.busy)return;
      var auto=candles.priceScale().options().autoScale;
      if(auto===p.fixed){p.fixed=!auto;if(p.idx===0){state.fixY=p.fixed;renderControls();}}
    },0);
  }
  ["pointerup","dblclick","wheel"].forEach(function(ev){host.addEventListener(ev,syncY,{passive:true});});
  p.destroy=function(){chart.remove();root.remove();};
  p.renderPtf();
  return p;
}

var panesEl=$("panes");
function nextTf(tf){var i=TFS.indexOf(tf);return TFS[Math.min(i+1,TFS.length-1)];}
function addPane(tf){
  var p=Pane(panes.length,tf);panes.push(p);panesEl.appendChild(p.root);p.refresh(true);
  requestAnimationFrame(function(){requestAnimationFrame(function(){if(panes.indexOf(p)>=0)p.refresh(true);});});
  return p;
}
function refreshAll(){panes.forEach(function(p){p.refresh(false);});}
function setDual(on){
  state.dual=on;panesEl.classList.toggle("dual",on);
  if(on)addPane(nextTf(panes[0].tf));else while(panes.length>1)panes.pop().destroy();
  panes.forEach(function(p){p.renderPtf();});
  renderControls();renderPanel();
}
function setFix(on){
  state.fixY=on;
  panes.forEach(function(p){p.fixed=on;setYMode(p,!on);});
  renderControls();
}
function refit(){panes.forEach(function(p){setYMode(p,!p.fixed);});}
function setAfter(on){
  state.showAfter=on;document.body.classList.toggle("show-after",on);
  renderControls();renderPanel();refreshAll();
}
var fsOk=!!document.documentElement.requestFullscreen;
function toggleFs(){if(!fsOk)return;if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();}
document.addEventListener("fullscreenchange",function(){renderControls();});

/* ---------- 上の操作と下の操作 ---------- */
var topEl=$("ctl-top"),botEl=$("bottom"),hud=$("hud");
function lineItems(){return [
  {key:"entryLine",label:"エントリー価格",show:true},
  {key:"tpLine",label:"TP（利確）",show:D.tpPrice!==null},
  {key:"slLine",label:"SL（損切り）",show:D.slPrice!==null},
  {key:"markers",label:"IN / OUT の矢印",show:true},
  {key:"afterShade",label:"エントリー以降の背景",show:true},
  {key:"exitLine",label:"決済価格",show:D.exitPrice!==null&&state.showAfter},
  {key:"excursion",label:"最大含み益・含み損ほか",show:!!D.excursion&&state.showAfter}
];}
function renderControls(){
  topEl.textContent="";botEl.textContent="";
  var m=mobile(),p0=panes[0];
  if(!state.dual){
    if(m){var tb=btn(p0.tf+" ▾",function(e){openPanel("tf",e.currentTarget);},"selb mono","tf");tb.setAttribute("aria-haspopup","listbox");tb.setAttribute("aria-label","時間足（現在 "+p0.tf+"）");topEl.appendChild(tb);}
    else{
      var sg=el("div","seg");sg.setAttribute("role","radiogroup");sg.setAttribute("aria-label","時間足");
      TFS.forEach(function(t){var b=el("button","mono",t);b.type="button";b.setAttribute("role","radio");b.setAttribute("aria-checked",String(t===p0.tf));b.onclick=function(){p0.setTf(t);};sg.appendChild(b);});
      topEl.appendChild(sg);
    }
  }
  if(m){
    var te=btn("",function(e){openPanel("tech",e.currentTarget);},"selb","tech");te.setAttribute("aria-haspopup","dialog");
    state.emas.forEach(function(e,i){if(e.visible){var d=el("i","dot");d.style.background=emaColor(i);te.appendChild(d);}});
    te.appendChild(document.createTextNode("テクニカル "));te.appendChild(el("small","","▾"));
    topEl.appendChild(te);
    var le=btn("",function(e){openPanel("lines",e.currentTarget);},"selb","lines");le.setAttribute("aria-haspopup","dialog");
    le.appendChild(document.createTextNode("線の表示 "));le.appendChild(el("small","","▾"));
    topEl.appendChild(le);
    topEl.appendChild(el("span","sp"));
    var hb=btn("？",function(e){openPanel("help",e.currentTarget);},"b","help");hb.setAttribute("aria-label","使い方");topEl.appendChild(hb);
    botEl.appendChild(sw("エントリー後",state.showAfter,function(){setAfter(!state.showAfter);}));
    botEl.appendChild(sw("縦軸固定",state.fixY,function(){setFix(!state.fixY);}));
    if(state.fixY)botEl.appendChild(btn("合わせ直す",refit));
    botEl.appendChild(btn("計画 "+(state.hudMobile?"▾":"▴"),function(){state.hudMobile=!state.hudMobile;applyHud();renderControls();}));
  }else{
    state.emas.forEach(function(e,i){
      var c=el("button","chip mono");c.type="button";c.setAttribute("aria-pressed",String(e.visible));
      var d=el("i","dot");d.style.background=emaColor(i);c.appendChild(d);c.appendChild(document.createTextNode("EMA"+e.period));
      c.onclick=function(){e.visible=!e.visible;renderControls();renderPanel();refreshAll();};topEl.appendChild(c);
    });
    var add=btn("＋",function(ev){openPanel("tech",ev.currentTarget);},"chip","tech");add.setAttribute("aria-label","EMAを追加・削除");topEl.appendChild(add);
    topEl.appendChild(el("span","sp"));
    topEl.appendChild(sw("エントリー後の値動き",state.showAfter,function(){setAfter(!state.showAfter);}));
    topEl.appendChild(sw("縦軸固定",state.fixY,function(){setFix(!state.fixY);}));
    if(state.fixY)topEl.appendChild(btn("合わせ直す",refit));
    var le2=btn("線の表示 ▾",function(e){openPanel("lines",e.currentTarget);},"b","lines");le2.setAttribute("aria-haspopup","dialog");topEl.appendChild(le2);
    topEl.appendChild(btn(state.dual?"1画面に戻す":"2画面",function(){setDual(!state.dual);},"b"+(state.dual?" on":"")));
    if(fsOk)topEl.appendChild(btn(document.fullscreenElement?"全画面を閉じる":"全画面",toggleFs));
    var hb2=btn("？",function(e){openPanel("help",e.currentTarget);},"b","help");hb2.setAttribute("aria-label","使い方");topEl.appendChild(hb2);
  }
}

/* ---------- 計画パネル ---------- */
function applyHud(){
  if(mobile()){hud.classList.toggle("show",state.hudMobile);hud.classList.remove("collapsed");}
  else{hud.classList.remove("show");hud.classList.toggle("collapsed",!state.hudPc);}
  $("hudToggle").textContent=(mobile()?"×":(state.hudPc?"▾":"▸"));
}
$("hudToggle").onclick=function(){
  if(mobile())state.hudMobile=false;else state.hudPc=!state.hudPc;
  applyHud();renderControls();
};

/* ---------- プルダウン・シート ---------- */
var ov=$("ov");
function openPanel(kind,anchor){panel={kind:kind,key:anchor?anchor.getAttribute("data-key"):null};renderPanel();}
function closePanel(){panel=null;ov.hidden=true;ov.textContent="";}
function titleOf(k){return k==="tech"?"テクニカル":k==="lines"?"線の表示":"使い方";}
function emaSection(){
  var s=el("div","sec");s.appendChild(el("h4","","EMA"));
  state.emas.forEach(function(e,i){
    var r=el("div","er"),d=el("i","dot");d.style.background=emaColor(i);
    r.appendChild(d);r.appendChild(el("span","mono","EMA"+e.period));
    r.appendChild(sw("表示",e.visible,function(){e.visible=!e.visible;renderControls();renderPanel();refreshAll();}));
    var x=btn("×",function(){state.emas=state.emas.filter(function(y){return y!==e;});emaErr="";renderControls();renderPanel();refreshAll();});x.setAttribute("aria-label","EMA"+e.period+"を削除");
    r.appendChild(x);s.appendChild(r);
  });
  var r2=el("div","er"),inp=el("input","in mono");inp.type="number";inp.min="1";inp.placeholder="期間";inp.setAttribute("inputmode","numeric");inp.setAttribute("aria-label","追加するEMAの期間");
  function doAdd(){
    var v=Number(inp.value);
    if(!isFinite(v)||Math.floor(v)!==v||v<1||v>maxPeriod){emaErr="期間は1〜"+maxPeriod+"の整数で入力してください（このファイルに含まれる足で計算できる上限です）";renderPanel();return;}
    if(state.emas.some(function(y){return y.period===v;})){emaErr="EMA"+v+"はすでにあります";renderPanel();return;}
    if(state.emas.length>=MAX_EMA){emaErr="EMAは"+MAX_EMA+"本までです";renderPanel();return;}
    emaErr="";state.emas.push({period:v,visible:true});renderControls();renderPanel();refreshAll();
  }
  inp.onkeydown=function(ev){if(ev.key==="Enter"){ev.preventDefault();doAdd();}};
  r2.appendChild(inp);r2.appendChild(btn("EMAを追加",doAdd,"b on"));s.appendChild(r2);
  if(emaErr){var er=el("p","err",emaErr);er.setAttribute("role","alert");s.appendChild(er);}
  return s;
}
function linesSection(){
  var s=el("div","sec");s.appendChild(el("h4","","線の表示"));
  var g=el("div","lg");
  lineItems().forEach(function(it){if(!it.show)return;g.appendChild(sw(it.label,state.overlays[it.key],function(){state.overlays[it.key]=!state.overlays[it.key];renderPanel();refreshAll();}));});
  s.appendChild(g);
  if(!state.showAfter){var n=el("p","mute","決済・最大含み益などは、「エントリー後」を入れると選べます");n.style.cssText="margin:6px 0 0;font-size:11px";s.appendChild(n);}
  return s;
}
function otherSection(){
  var s=el("div","sec");s.appendChild(el("h4","","その他"));
  var r=el("div","er");r.style.flexWrap="wrap";
  if(mobile()){
    r.appendChild(btn(state.dual?"1画面に戻す":"2画面",function(){setDual(!state.dual);},"b"+(state.dual?" on":"")));
    if(fsOk)r.appendChild(btn(document.fullscreenElement?"全画面を閉じる":"全画面",toggleFs));
  }
  panes.forEach(function(p){r.appendChild(btn(state.dual?"画面"+(p.idx+1)+"を画像保存":"画像を保存",function(){p.save();}));});
  s.appendChild(r);return s;
}
function renderPanel(){
  if(!panel){return;}
  ov.hidden=false;ov.textContent="";
  var back=el("div","dim");back.onclick=closePanel;ov.appendChild(back);
  var m=mobile(),kind=panel.kind,box;
  var anchor=panel.key?document.querySelector('[data-key="'+panel.key+'"]'):null;
  if(kind==="tf"){
    box=el("div","pop");box.setAttribute("role","listbox");box.setAttribute("aria-label","時間足");
    var names={"1m":"1分足","5m":"5分足","15m":"15分足","1h":"1時間足","4h":"4時間足","1d":"日足"};
    TFS.forEach(function(t){
      var b=el("button","it"+(t===panes[0].tf?" cur":""));b.type="button";b.setAttribute("role","option");b.setAttribute("aria-selected",String(t===panes[0].tf));
      var l=el("span");var bb=el("b","mono",t);l.appendChild(bb);var nm=el("span","mute"," "+(names[t]||""));nm.style.marginLeft="6px";l.appendChild(nm);
      b.appendChild(l);b.appendChild(el("span","",t===panes[0].tf?"✓":""));
      b.onclick=function(){closePanel();panes[0].setTf(t);};box.appendChild(b);
    });
  }else{
    box=el("div",m?"sheet":"pop wide");box.setAttribute("role","dialog");box.setAttribute("aria-label",titleOf(kind));
    var h=el("div","ph");h.appendChild(el("b","",titleOf(kind)));
    var cl=btn("×",closePanel);cl.style.cssText="border:0;font-size:18px";cl.setAttribute("aria-label","閉じる");h.appendChild(cl);box.appendChild(h);
    var body=m?box:el("div","pb");
    if(kind==="tech")body.appendChild(emaSection());
    else if(kind==="lines"){body.appendChild(linesSection());body.appendChild(otherSection());}
    else{
      var hp=el("p","help","評価用の閲覧専用ファイルです。エントリー後の値動きと結果は、初期状態では隠しています（「エントリー後」を入れると見られます）。チャートはドラッグで動かし、ホイールやピンチで拡大・縮小できます。表示は日本時間です。キー操作: 1〜6=時間足 / D=2画面 / F=全画面");
      hp.style.paddingBottom="12px";body.appendChild(hp);
    }
    if(!m)box.appendChild(body);
  }
  ov.appendChild(box);
  if((!m||kind==="tf")&&anchor){
    var r=anchor.getBoundingClientRect();
    box.style.top=(r.bottom+4)+"px";
    if(kind==="tf")box.style.left=Math.max(8,r.left)+"px";
    else box.style.right=Math.max(8,window.innerWidth-r.right)+"px";
  }else if(!m){box.style.top="52px";box.style.right="8px";}
}

/* キーボード: F=全画面 / 1〜6=時間足 / D=2画面 / Esc=閉じる */
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&panel){closePanel();return;}
  var t=e.target;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable))return;
  var k=e.key.toLowerCase();
  if(k==="f")toggleFs();
  else if(k==="d"&&!mobile())setDual(!state.dual);
  else if(/^[1-6]$/.test(k)&&TFS[Number(k)-1]&&!state.dual)panes[0].setTf(TFS[Number(k)-1]);
});
var onMq=function(){applyHud();renderControls();if(panel)renderPanel();};
if(mq.addEventListener)mq.addEventListener("change",onMq);else mq.addListener(onMq);

var first=TFS.indexOf(D.defaultTf)>=0?D.defaultTf:TFS[0];
addPane(first);
applyHud();renderControls();
})();
`;
