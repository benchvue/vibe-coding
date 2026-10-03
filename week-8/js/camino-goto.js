/* ══════════════════════════════════════════════════════════════════════
   camino-goto.js  ·  좌표로 가서 위성 사진 보기 (보기 · 비교하기 공용)

   두 형식 모두 받습니다
     43.042122,-1.247377
     43°02'05.45"N 1°13'55.30"W
   (구글 지도 주소 …/@43.04,-1.24,17z 를 그대로 붙여 넣어도 됩니다)

   · 비교하기: 이미 떠 있는 Cesium 지도를 그 자리로 옮기고 위성 사진으로 바꿉니다.
   · 보기    : Cesium 지도가 없으므로 창을 하나 띄워 그 자리를 보여 줍니다.
   · 위성 사진은 두 가지 — Cesium(ion · Bing) 과 Esri. 찍은 시기가 달라 한쪽에 안 보이는 길이
     다른 쪽엔 보이기도 합니다. 구글 위성 지도로 바로 여는 단추도 있습니다.
   · 주소 끝에 ?goto=43.042122,-1.247377 을 붙이면 열자마자 그 자리로 갑니다 (JIN 에게 링크로 보내기).
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var CS = window.CaminoShared;
  if(!CS || !CS.parseLatLon){ console.warn("camino-goto: camino-shared.js 가 먼저 있어야 합니다"); return; }
  var CESIUM_VER = "1.119";
  var ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  var KEY_LAST = "caminoGotoLast";
  var O = {}, PANEL = null, OWN = null, CUR = null;

  var CSS = ''
  + '.cg-fab{position:fixed;left:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:9000;border:none;border-radius:22px;'
  +   'padding:9px 14px;font:600 13px/1 system-ui,sans-serif;background:#152A55;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.3);cursor:pointer}'
  + '.cg-fab.hide{display:none}'
  + '.cg-panel{position:fixed;left:12px;bottom:calc(122px + env(safe-area-inset-bottom,0px));z-index:9001;width:min(360px,calc(100vw - 24px));'
  +   'background:#fff;color:#1F2430;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.35);padding:12px;font:13px/1.45 system-ui,sans-serif}'
  + '.cg-panel.hide{display:none}'
  + '.cg-panel h4{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center}'
  + '.cg-panel h4 button{border:none;background:none;font-size:18px;cursor:pointer;color:#888}'
  + '.cg-row{display:flex;gap:6px;margin-bottom:6px}'
  + '.cg-row input{flex:1;min-width:0;border:1px solid #CFC8B6;border-radius:8px;padding:8px;font:13px ui-monospace,Menlo,monospace}'
  + '.cg-btn{border:1px solid #152A55;background:#152A55;color:#fff;border-radius:8px;padding:7px 12px;font:600 12px system-ui,sans-serif;cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-block}'
  + '.cg-btn.ghost{background:#fff;color:#152A55}'
  + '.cg-btn.on{background:#F5B917;border-color:#C99400;color:#3B2E00}'
  + '.cg-ex{font-size:11px;color:#8A8474;margin:-2px 0 8px}'
  + '.cg-ex code{background:#F4F1E8;border-radius:4px;padding:0 4px;cursor:pointer}'
  + '.cg-out{font-size:12px;background:#F7F5EE;border-radius:8px;padding:7px 9px;margin:6px 0;display:none}'
  + '.cg-out.on{display:block} .cg-out b{font-family:ui-monospace,Menlo,monospace;font-size:12px}'
  + '.cg-out.err{background:#FDECEC;color:#B91C1C}'
  + '.cg-img{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}'
  + '.cg-links{display:flex;gap:6px;flex-wrap:wrap}'
  + '.cg-modal{position:fixed;inset:0;z-index:8999;background:rgba(10,16,30,.6);display:flex;align-items:center;justify-content:center}'
  + '.cg-modal.hide{display:none}'
  + '.cg-box{position:relative;width:min(1000px,96vw);height:min(720px,86vh);background:#000;border-radius:12px;overflow:hidden}'
  + '.cg-box .cg-x{position:absolute;right:8px;top:8px;z-index:3;border:none;border-radius:16px;background:rgba(255,255,255,.9);padding:6px 12px;font:600 13px system-ui;cursor:pointer}'
  + '.cg-box .cg-map{position:absolute;inset:0}'
  + '.cg-box .cg-wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:14px system-ui}';

  function $(id){ return document.getElementById(id); }
  function esc(t){ return CS.esc(t); }

  /* ───────── 패널 ───────── */
  function buildPanel(){
    var st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
    var fab=document.createElement("button"); fab.className="cg-fab"; fab.id="cgFab"; fab.type="button"; fab.textContent="📍 좌표로 가기";
    var p=document.createElement("div"); p.className="cg-panel hide"; p.id="cgPanel";
    p.innerHTML='<h4>좌표로 가서 위성 사진 보기 <button type="button" id="cgClose" aria-label="닫기">×</button></h4>'
      +'<div class="cg-row"><input id="cgIn" autocomplete="off" spellcheck="false" placeholder="43.042122,-1.247377"><button class="cg-btn" id="cgGo" type="button">가기</button></div>'
      +'<div class="cg-ex">예: <code data-ex="43.042122,-1.247377">43.042122,-1.247377</code> · '
      +'<code data-ex="43°02\'05.45&quot;N 1°13\'55.30&quot;W">43°02\'05.45"N 1°13\'55.30"W</code></div>'
      +'<div class="cg-out" id="cgOut"></div>'
      +'<div class="cg-img"><span style="font-size:12px;color:#8A8474;align-self:center">위성:</span>'
      +'<button class="cg-btn ghost" data-img="ion" type="button">Cesium (Bing)</button>'
      +'<button class="cg-btn ghost" data-img="esri" type="button">Esri</button>'
      +'<button class="cg-btn ghost" data-img="osm" type="button">그린 지도</button></div>'
      +'<div class="cg-links" id="cgLinks"></div>';
    document.body.appendChild(fab); document.body.appendChild(p);
    PANEL=p;
    fab.onclick=function(){ p.classList.toggle("hide"); if(!p.classList.contains("hide")) $("cgIn").focus(); };
    $("cgClose").onclick=function(){ p.classList.add("hide"); };
    $("cgGo").onclick=function(){ go($("cgIn").value); };
    $("cgIn").addEventListener("keydown",function(e){ if(e.key==="Enter") go($("cgIn").value); });
    p.querySelectorAll("[data-ex]").forEach(function(c){ c.onclick=function(){ $("cgIn").value=c.getAttribute("data-ex"); go($("cgIn").value); }; });
    p.querySelectorAll("[data-img]").forEach(function(b){ b.onclick=function(){ setImagery(b.getAttribute("data-img")); }; });
    try{ var last=localStorage.getItem(KEY_LAST); if(last) $("cgIn").value=last; }catch(e){}
    if(O.hidden) setInterval(function(){ var h=!!O.hidden(); fab.classList.toggle("hide",h); if(h) p.classList.add("hide"); }, 800);
  }
  function show(html, err){ var o=$("cgOut"); o.innerHTML=html; o.className="cg-out on"+(err?" err":""); }

  /* ───────── 가기 ───────── */
  function go(text){
    var r=CS.parseLatLon(text);
    if(r.err){ show("못 읽었습니다 — "+esc(r.err), true); return; }
    CUR=r;
    try{ localStorage.setItem(KEY_LAST, String(text).trim()); }catch(e){}
    var dec=CS.fmtDec(r.lat,r.lon), dms=CS.fmtDMS(r.lat,r.lon);
    show('<b>'+esc(dec)+'</b><br><b>'+esc(dms)+'</b>');
    var share=location.origin+location.pathname+"?goto="+encodeURIComponent(dec);
    $("cgLinks").innerHTML=
        '<a class="cg-btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps?q='+dec+'&t=k&z=18">구글 위성 지도</a>'
      + '<button class="cg-btn ghost" type="button" id="cgCopy">이 자리 링크 복사</button>';
    $("cgCopy").onclick=function(){ copy(share, this); };
    withViewer(function(v){
      if(O.beforeGo) try{ O.beforeGo(); }catch(e){}
      if(!IMG) setImagery(O.ownViewer ? (hasToken()?"ion":"esri") : "ion");
      pin(v, r);
      v.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(r.lon, r.lat, 700),
        orientation:{ heading:0, pitch:Cesium.Math.toRadians(-90), roll:0 }, duration: O.ownViewer?0.8:2.2 });
    });
  }
  function copy(t, btn){
    var done=function(){ var o=btn.textContent; btn.textContent="복사했습니다"; setTimeout(function(){ btn.textContent=o; },1500); };
    if(navigator.clipboard) navigator.clipboard.writeText(t).then(done).catch(function(){ prompt("복사하세요",t); });
    else prompt("복사하세요",t);
  }
  function pin(v, r){
    var old=v.entities.getById("cg-pin"); if(old) v.entities.remove(old);
    v.entities.add({ id:"cg-pin", position:Cesium.Cartesian3.fromDegrees(r.lon, r.lat),
      point:{ pixelSize:14, color:Cesium.Color.fromCssColorString("#F5B917"), outlineColor:Cesium.Color.BLACK, outlineWidth:2,
              heightReference:Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance:Number.POSITIVE_INFINITY },
      label:{ text:CS.fmtDec(r.lat,r.lon), font:"600 13px system-ui", fillColor:Cesium.Color.WHITE, outlineColor:Cesium.Color.BLACK,
              outlineWidth:3, style:Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new Cesium.Cartesian2(0,-22),
              heightReference:Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance:Number.POSITIVE_INFINITY } });
  }

  /* ───────── 위성 사진 고르기 ───────── */
  var IMG=null;
  function setImagery(kind){
    withViewer(function(v){
      IMG=kind;
      PANEL.querySelectorAll("[data-img]").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-img")===kind); });
      /* 비교하기는 자기 바탕 지도 단추와 맞춰 둠 */
      if(O.setBase && kind!=="esri"){ O.setBase(kind==="ion"?"sat":"map"); return; }
      var L=v.imageryLayers, add=function(p){ L.removeAll(); L.addImageryProvider(p); };
      if(kind==="esri") add(new Cesium.UrlTemplateImageryProvider({ url:ESRI, maximumLevel:19,
        credit:"Esri, Maxar, Earthstar Geographics, and the GIS User Community" }));
      else if(kind==="osm") add(new Cesium.OpenStreetMapImageryProvider({ url:"https://tile.openstreetmap.org/" }));
      else if(hasToken()) Cesium.createWorldImageryAsync().then(add).catch(function(){ setImagery("esri"); });
      else { show("Cesium 위성은 토큰이 있어야 합니다 — Esri 로 보여 드립니다"); setImagery("esri"); }
    });
  }
  function hasToken(){ return !!(window.Cesium && Cesium.Ion && Cesium.Ion.defaultAccessToken && Cesium.Ion.defaultAccessToken.length>20 && !O.noIon); }

  /* ───────── 지도 얻기 — 비교하기는 받은 것, 보기는 창을 띄워 새로 ───────── */
  function withViewer(fn){
    if(O.viewer){ var v=typeof O.viewer==="function"?O.viewer():O.viewer; if(v) return fn(v); }
    openOwn().then(fn).catch(function(e){
      var o=$("cgOut"); o.innerHTML+='<div style="color:#B91C1C;margin-top:4px">지도를 열지 못했습니다 — '+esc(e.message||e)+'<br>아래 구글 위성 지도 단추로 보세요.</div>';
      var m=$("cgModal"); if(m) m.remove(); OWN=null; });
  }
  function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=function(){ rej(new Error(src+" 를 못 불러옴")); }; document.head.appendChild(s); }); }
  function openOwn(){
    var m=$("cgModal");
    if(m){ m.classList.remove("hide"); return OWN; }
    m=document.createElement("div"); m.className="cg-modal"; m.id="cgModal";
    m.innerHTML='<div class="cg-box"><button class="cg-x" type="button" id="cgX">닫기 ×</button><div class="cg-map" id="cgMap"></div><div class="cg-wait" id="cgWait">지도를 불러오는 중…</div></div>';
    document.body.appendChild(m);
    $("cgX").onclick=function(){ m.classList.add("hide"); };
    O.ownViewer=true;
    var need=[];
    if(!window.Cesium){
      var css=document.createElement("link"); css.rel="stylesheet"; css.href="https://unpkg.com/cesium@"+CESIUM_VER+"/Build/Cesium/Widgets/widgets.css"; document.head.appendChild(css);
      need.push(loadScript("https://unpkg.com/cesium@"+CESIUM_VER+"/Build/Cesium/Cesium.js"));
    }
    if(!window.CESIUM_ION_TOKEN) need.push(loadScript("camino-token.js").catch(function(){}));
    OWN=Promise.all(need).then(function(){
      var tok=window.CESIUM_ION_TOKEN;
      if(!tok){ try{ tok=localStorage.getItem("caminoIonToken"); }catch(e){} }   /* 비교하기에서 저장해 둔 토큰 */
      if(tok && tok.length>20) Cesium.Ion.defaultAccessToken=tok; else O.noIon=true;
      var v=new Cesium.Viewer("cgMap",{ animation:false, timeline:false, homeButton:false, sceneModePicker:false, navigationHelpButton:false,
        fullscreenButton:false, geocoder:false, infoBox:false, selectionIndicator:false, baseLayerPicker:false, baseLayer:false });
      if(!O.noIon) Cesium.createWorldTerrainAsync().then(function(t){ v.terrainProvider=t; }).catch(function(){});
      v.scene.globe.depthTestAgainstTerrain=false;
      $("cgWait").remove();
      O.viewer=v;
      return v;
    });
    return OWN;
  }

  /* ───────── 붙이기 ───────── */
  window.CaminoGoto = {
    /* opts: viewer(Cesium.Viewer 또는 그것을 돌려주는 함수) · setBase("map"|"sat") · beforeGo() · hidden() */
    mount: function(opts){
      if(PANEL) { for(var k in opts) O[k]=opts[k]; return; }
      O=opts||{};
      buildPanel();
      var q=new URLSearchParams(location.search).get("goto");
      if(q){ $("cgIn").value=q; PANEL.classList.remove("hide"); setTimeout(function(){ go(q); }, O.viewer?1500:300); }
    },
    go: function(t){ if(!PANEL) this.mount({}); $("cgIn").value=t; PANEL.classList.remove("hide"); go(t); }
  };
  /* 보기 페이지처럼 아무도 붙이지 않으면 스스로 붙음 (자체 지도 창 사용) */
  function auto(){ if(!PANEL && !window.CAMINO_GOTO_MANUAL) window.CaminoGoto.mount({}); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){ setTimeout(auto,0); }); else setTimeout(auto,0);
})();
