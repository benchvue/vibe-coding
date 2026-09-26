/* ══════════════════════════════════════════════════════════════════════
   camino-day0.js  ·  보기 페이지의 "날짜별 상세 카드" 맨 앞에 DAY 0 카드 두 장(BIN · JIN)

   DAY 1~13 이 현지에서 제대로 도는지 미리 시험하려고, 각자 사는 곳에서 달린 GPX 로
   같은 형식의 카드를 만듭니다.
     · 지도 위 주행 경로 · 고도 프로파일 · 경로 순서
     · 출발 · 최고점 · 도착 날씨 — GPX 에 찍힌 "실제 주행 날짜" 의 시간별 기록 (Open-Meteo)
     · 기온 프로파일 — 그날 기상 기록과 GPX(가민 atemp) 실측을 한 그래프에
     · 최근 7일 예측 오차율 (비교하기의 주행 로그)

   GPX 는 어디서 오나 (위가 먼저)
     1. 비교하기(camino-route-compare.html)에서 그 사람으로 올린 DAY 0  — 브라우저 저장소 caminoDay0:bin / :jin
        비교하기에서 새로 올리면 이 페이지가 열려 있어도 바로 다시 그립니다.
     2. 이 카드의 "GPX 올리기" 로 고른 파일   — 같은 저장소에 넣으므로 비교하기에도 그대로 보입니다.
     3. 폴더의 기본 파일 route/day0-bin.gpx · route/day0-jin.gpx  (다른 폰에서도 보이게 하려면 여기에)
   오차 로그: 이 폰의 로그 + 가져온 로그 + logs/pred-log.json
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var CS = window.CaminoShared;
  if(!CS){ console.warn("camino-day0: camino-shared.js 가 먼저 있어야 합니다"); return; }
  var esc = CS.esc, hav = CS.hav;
  var CFG = {
    files: { bin:"route/day0-bin.gpx", jin:"route/day0-jin.gpx" },
    logs:  ["logs/pred-log.json"],
    compare: "camino-route-compare.html",
    leafletJs:  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    leafletCss: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  };
  if(window.CAMINO_D0_CFG) for(var k in window.CAMINO_D0_CFG) CFG[k]=window.CAMINO_D0_CFG[k];

  var STATE = { bin:null, jin:null }, STATIC_LOGS = [], MAPS = {};

  /* ─────────── 스타일 (페이지의 dcard · wxcard 모양을 그대로 쓰고 모자란 것만) ─────────── */
  var CSS = ''
  + '.d0card .dhead{background:var(--d0c,#152A55)}'
  + '.d0card .dnum{color:#fff;background:rgba(255,255,255,.16);border-radius:8px;padding:1px 9px}'
  + '.d0card .dtitle small{color:rgba(255,255,255,.72)}'
  + '.d0card .dkm{color:#fff}'
  + '.d0tag{display:inline-block;margin-left:8px;font-size:.62rem;font-weight:700;background:var(--flecha);color:#3B2E00;border-radius:20px;padding:2px 8px;vertical-align:2px}'
  + '.d0grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px;padding:14px 14px 4px}'
  + '@media(max-width:820px){.d0grid{grid-template-columns:1fr}}'
  + '.d0map{height:300px;border:1px solid #D4DFF2;border-radius:12px;overflow:hidden;background:#EEF2F6;position:relative}'
  + '.d0map svg{display:block;width:100%;height:100%}'
  + '.d0side{display:flex;flex-direction:column;gap:10px;min-width:0}'
  + '.d0side .dprof{height:170px;order:0;flex:0 0 auto;margin:0;width:100%}'
  + '.d0facts{display:grid;grid-template-columns:1fr 1fr;gap:6px}'
  + '.d0facts div{background:#FBFAF5;border:1px solid var(--line);border-radius:10px;padding:6px 9px;font-size:.68rem;color:var(--ink-soft);line-height:1.35}'
  + '.d0facts b{display:block;font-size:.9rem;color:var(--ink);font-variant-numeric:tabular-nums}'
  + '.d0card .droute-wrap{padding:6px 14px 0}'
  + '.d0card .dwx{padding:12px 14px 14px;border-top:1px dashed var(--line)}'
  + '.wxb.p{background:#7A4FB5}'
  + '.d0tp{margin-top:12px;background:#fff;border:1px solid var(--line);border-radius:13px;padding:8px 8px 4px}'
  + '.d0tp h5,.d0err h5{font-size:.76rem;color:var(--camino-blue);margin:2px 4px 6px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}'
  + '.d0tp h5 small,.d0err h5 small{font-weight:400;color:var(--ink-soft)}'
  + '.d0lg{display:inline-flex;align-items:center;gap:4px;font-size:.66rem;font-weight:600;color:var(--ink-soft)}'
  + '.d0lg i{display:inline-block;width:16px;height:0;border-top:2.5px solid}'
  + '.d0err{padding:12px 14px;border-top:1px dashed var(--line)}'
  + '.d0err .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:.72rem;color:var(--ink-soft);margin-top:6px}'
  + '.d0err .row b{color:var(--ink)}'
  + '.d0btn{border:1px solid var(--line);background:#fff;border-radius:20px;padding:5px 12px;font:inherit;font-size:.7rem;font-weight:600;color:var(--camino-blue);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:4px}'
  + '.d0btn:hover{background:var(--camino-blue);color:#fff;border-color:var(--camino-blue)}'
  + '.d0btn input{display:none}'
  + '.d0card .dfoot{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
  + '.d0card .dfoot span{flex:1;min-width:200px}'
  + '.d0empty{padding:22px 16px;text-align:center;color:var(--ink-soft);font-size:.8rem}'
  + '.d0pin{width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.35)}'
  + '.daynav a.d0nav{border-style:dashed}'
  + '.d0flash{animation:d0f 1.6s ease-out 1}@keyframes d0f{0%{box-shadow:0 0 0 4px var(--flecha)}100%{box-shadow:0 2px 8px rgba(21,42,85,.05)}}'
  + '@media(prefers-reduced-motion:reduce){.d0flash{animation:none}}';

  /* ─────────── 날씨 코드 ─────────── */
  function wxText(c){
    if(c===0) return ["☀️","맑음"]; if(c===1) return ["🌤","대체로 맑음"]; if(c===2) return ["⛅","구름 조금"]; if(c===3) return ["☁️","흐림"];
    if(c===45||c===48) return ["🌫","안개"]; if(c>=51&&c<=57) return ["🌦","이슬비"]; if(c>=61&&c<=67) return ["🌧","비"];
    if(c>=71&&c<=77) return ["🌨","눈"]; if(c>=80&&c<=82) return ["🌦","소나기"]; if(c>=85&&c<=86) return ["🌨","눈 소나기"];
    if(c>=95) return ["⛈","뇌우"]; return ["·","—"];
  }
  function dirK(d){ if(d===null||d===undefined) return ""; return ["북","북동","동","남동","남","남서","서","북서"][Math.round(d/45)%8]; }

  /* ─────────── 궤적 분석 ─────────── */
  function analyse(src){
    var p=src.pts, n=p.length, cum=[0];
    for(var i=1;i<n;i++) cum.push(cum[i-1]+hav(p[i-1],p[i])/1000);
    var hasTime=p[0].t!==null && p[n-1].t!==null;
    /* 획득고도 — 3 m 넘게 움직일 때만 셈 */
    var gain=0, ref=p[0].ele, hi=0, lo=0;
    for(var j=1;j<n;j++){ var d=p[j].ele-ref; if(d>=3){ gain+=d; ref=p[j].ele; } else if(d<=-3) ref=p[j].ele;
      if(p[j].ele>p[hi].ele) hi=j; if(p[j].ele<p[lo].ele) lo=j; }
    /* 움직인 시간 (2 km/h 넘는 구간) */
    var moving=0; if(hasTime) for(var m=1;m<n;m++){ var dt=(p[m].t-p[m-1].t)/1000; if(dt>0&&dt<120&&(cum[m]-cum[m-1])/dt*3600>2) moving+=dt; }
    var atN=0; p.forEach(function(q){ if(q.at!==null&&q.at!==undefined) atN++; });
    return {cum:cum, total:cum[n-1], gain:gain, hi:hi, lo:lo, hasTime:hasTime, moving:moving,
            t0:hasTime?p[0].t:null, t1:hasTime?p[n-1].t:null, hasAt:atN>n*0.5,
            loop: hav(p[0],p[n-1])<300};
  }
  /* 표시 지점을 궤적 순서대로 — 파일 순서를 따라가며 앞으로만 찾고, 300 m 넘게 멀면 전체에서 */
  function orderWpts(src, A){
    var p=src.pts, last=0, out=[];
    function near(w, from){ var bi=-1, bd=Infinity, step=Math.max(1,Math.floor(p.length/4000));
      for(var i=from;i<p.length;i+=step){ var d=hav(w,p[i]); if(d<bd){ bd=d; bi=i; } } return {i:bi,d:bd}; }
    (src.wpts||[]).forEach(function(w){
      var r=near(w,last); if(r.d>300) r=near(w,0);
      out.push({w:w, i:r.i, km:A.cum[Math.max(0,r.i)], d:r.d}); if(r.d<=300 && r.i>last) last=r.i;
    });
    out.sort(function(a,b){ return a.i-b.i; });
    return out.filter(function(o){ return o.d<=400; });
  }
  function wname(w){ return (w.name||w.cmt||"지점").replace(/\s+/g," "); }
  function nearName(src, q, lim){ var best=null, bd=lim||400;
    (src.wpts||[]).forEach(function(w){ var d=hav(w,q); if(d<bd){ bd=d; best=w; } }); return best?wname(best):null; }

  /* ─────────── 카드 틀 ─────────── */
  function cardShell(who){
    var W=CS.WHO[who];
    return '<article class="dcard d0card" id="d0'+who+'" style="--d0c:'+W.c+'">'
      + '<header class="dhead"><span class="dnum">DAY 0 · '+W.n+'</span>'
      + '<div class="dtitle"><b data-f="title">'+W.n+' 시험 주행</b><small data-f="sub">'+W.place+' · 불러오는 중…</small></div>'
      + '<span class="dkm" data-f="km"></span></header>'
      + '<div data-f="body"><div class="d0empty">GPX 를 찾는 중…</div></div>'
      + '<footer class="dfoot"><span data-f="src">—</span>'
      + '<label class="d0btn">GPX 올리기<input type="file" data-act="file"></label>'
      + '<button class="d0btn" data-act="static" type="button">기본 파일로</button>'
      + '<a class="d0btn" href="'+esc(CFG.compare)+'" target="_blank" rel="noopener">비교하기 열기</a></footer>'
      + '</article>';
  }

  /* ─────────── 한 사람 그리기 ─────────── */
  function render(who){
    var el=document.getElementById("d0"+who); if(!el) return;
    var st=STATE[who], W=CS.WHO[who];
    var f=function(k){ return el.querySelector('[data-f="'+k+'"]'); };
    if(!st){
      f("sub").textContent=W.place+" · 아직 GPX 가 없습니다";
      f("km").textContent="";
      f("body").innerHTML='<div class="d0empty">'+W.n+' 의 DAY 0 GPX 가 없습니다.<br>'
        +'비교하기에서 <b>'+W.n+'</b> 로 GPX 를 넣거나, 아래 <b>GPX 올리기</b> 를 누르세요.</div>'+errBlock(who);
      f("src").textContent="GPX 없음";
      bindErr(el, who);
      return;
    }
    var src=st.src, A=st.A=analyse(src), tz=W.tz, p=src.pts;
    var dateMs = A.t0 || st.saved || Date.now(), ymd=CS.ymd(dateMs, tz);
    st.ymd=ymd;
    var wd=new Intl.DateTimeFormat("ko-KR",{timeZone:tz,weekday:"short"}).format(new Date(dateMs));
    f("title").textContent = src.name || (W.n+" 시험 주행");
    f("sub").textContent = ymd.replace(/-/g,". ")+" ("+wd+") · "+W.place+" · "+(A.t0?CS.clock(A.t0,tz)+" 출발 → "+CS.clock(A.t1,tz)+" 도착 (현지)":"시간 기록 없음");
    f("km").innerHTML = A.total.toFixed(1)+' km · 획득고도 '+Math.round(A.gain).toLocaleString()+' m<span class="d0tag">시험</span>';
    f("src").innerHTML = esc(st.from)+(st.file?' · '+esc(st.file):'')+' · '+p.length.toLocaleString()+'점'+(A.hasAt?' · 기온 기록 있음':'');

    /* 경로 순서 */
    var ow=orderWpts(src, A), stops=[], hiKm=A.cum[A.hi];
    var sN=nearName(src,p[0])||"출발", eN=nearName(src,p[p.length-1])||(A.loop?"출발지로 복귀":"도착");
    stops.push({c:"start", b:sN, s:"0 km"});
    var via=ow.filter(function(o){ return o.km>0.3 && o.km<A.total-0.3; });
    if(via.length>5){ var pick=[]; for(var v=0;v<5;v++) pick.push(via[Math.round((v+0.5)*via.length/5-0.5)]); via=pick; }
    var hiPlaced=false;
    via.forEach(function(o){ if(!hiPlaced && o.km>hiKm){ stops.push({c:"via",b:"최고점 "+Math.round(p[A.hi].ele)+" m",s:hiKm.toFixed(1)+" km"}); hiPlaced=true; }
      stops.push({c:"via", b:wname(o.w), s:o.km.toFixed(1)+" km"}); });
    if(!hiPlaced) stops.push({c:"via",b:"최고점 "+Math.round(p[A.hi].ele)+" m",s:hiKm.toFixed(1)+" km"});
    stops.push({c:"end", b:eN, s:A.total.toFixed(1)+" km"});
    var droute='<div class="droute-wrap"><div class="droute">'+stops.map(function(s,i){
      return (i?'<div class="leg"><span>▶</span></div>':'')+'<div class="stop '+s.c+'"><i></i><b>'+esc(s.b)+'</b><small>'+esc(s.s)+'</small></div>'; }).join("")+'</div></div>';
    var orderTxt = ow.length ? [sN].concat(ow.map(function(o){ return wname(o.w); })).concat([eN])
                                 .filter(function(x,i,a){ return i===0 || x!==a[i-1]; }).join(" → ")
                             : sN+" → 최고점 "+Math.round(p[A.hi].ele)+" m ("+hiKm.toFixed(1)+" km) → "+eN;

    var hh=Math.floor(A.moving/3600), mm=Math.round(A.moving%3600/60);
    var facts='<div class="d0facts">'
      +'<div>거리<b>'+A.total.toFixed(1)+' km</b></div>'
      +'<div>획득고도<b>'+Math.round(A.gain)+' m</b></div>'
      +'<div>움직인 시간<b>'+(A.hasTime?hh+':'+String(mm).padStart(2,"0"):'—')+'</b></div>'
      +'<div>평균 속도<b>'+(A.hasTime&&A.moving?(A.total/(A.moving/3600)).toFixed(1)+' km/h':'—')+'</b></div>'
      +'<div>최저 · 최고<b>'+Math.round(p[A.lo].ele)+' · '+Math.round(p[A.hi].ele)+' m</b></div>'
      +'<div>GPX 기온<b>'+(A.hasAt?atRange(p):'없음')+'</b></div></div>';

    f("body").innerHTML =
        '<div class="d0grid"><div class="d0map" id="d0map-'+who+'"></div>'
      + '<div class="d0side"><div class="dprof">'+profileSvg(p, A, W.c, ow)+'</div>'+facts+'</div></div>'
      + droute
      + '<div class="dorder"><b>경로 순서</b>'+esc(orderTxt)+'</div>'
      + '<div class="dwx"><h4>DAY 0 날씨 <small>'+esc(ymd.replace(/-/g,". "))+' 실제 기록 · 출발 · 최고점 · 도착 · 현지 시각</small></h4>'
      +   '<div class="wxgrid" data-f="wx"><div class="wxload">그날 날씨 기록을 불러오는 중… <small>Open-Meteo</small></div></div>'
      +   '<div class="d0tp" data-f="tp"></div>'
      +   '<div class="wxnote">날씨는 그 좌표의 시간별 기상 기록(재분석 · 관측 보정)입니다. GPX 기온은 가민 기기 온도계 값이라 '
      +   '햇볕 · 몸열 · 출발 전 실내 온도의 영향을 받습니다. 둘의 차이를 보고 DAY 1~13 에서 예보를 얼마나 믿을지 가늠하세요.</div></div>'
      + errBlock(who);
    bindErr(el, who);
    drawMap(who, src, A, ow);
    loadWeather(who);
  }
  function atRange(p){ var a=Infinity,b=-Infinity; p.forEach(function(q){ if(q.at!==null&&q.at!==undefined){ a=Math.min(a,q.at); b=Math.max(b,q.at); } }); return Math.round(a)+' ~ '+Math.round(b)+'°'; }

  /* ─────────── 고도 프로파일 (날짜 카드와 같은 모양) ─────────── */
  function profileSvg(p, A, col, ow){
    var W=520, H=170, L=30, R=8, T=12, B=20, n=p.length, step=Math.max(1,Math.floor(n/600));
    var e0=p[A.lo].ele, e1=p[A.hi].ele, pad=Math.max(10,(e1-e0)*.12), lo=e0-pad, hi=e1+pad;
    var X=function(km){ return L+(W-L-R)*km/(A.total||1); }, Y=function(e){ return T+(H-T-B)*(1-(e-lo)/(hi-lo)); };
    var d="M"+X(0)+","+(H-B), ln="";
    for(var i=0;i<n;i+=step){ d+="L"+X(A.cum[i]).toFixed(1)+","+Y(p[i].ele).toFixed(1); ln+=(ln?"L":"M")+X(A.cum[i]).toFixed(1)+","+Y(p[i].ele).toFixed(1); }
    d+="L"+X(A.total)+","+(H-B)+"Z";
    var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:100%" role="img" aria-label="고도 프로파일">';
    var gs=niceStep((hi-lo)/3);
    for(var g=Math.ceil(lo/gs)*gs; g<=hi; g+=gs) s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(g)+'" y2="'+Y(g)+'" stroke="#E7E1D2"/><text class="dp-ax" x="'+(L-4)+'" y="'+(Y(g)+3)+'" text-anchor="end">'+Math.round(g)+'</text>';
    var ks=niceStep(A.total/6);
    for(var k=0;k<=A.total;k+=ks) s+='<text class="dp-ax" x="'+X(k)+'" y="'+(H-6)+'" text-anchor="middle">'+k+(k===0?' km':'')+'</text>';
    s+='<path d="'+d+'" fill="'+col+'" fill-opacity=".14"/><path d="'+ln+'" fill="none" stroke="'+col+'" stroke-width="1.8"/>';
    (ow||[]).forEach(function(o){ s+='<line x1="'+X(o.km)+'" x2="'+X(o.km)+'" y1="'+(H-B)+'" y2="'+(H-B-5)+'" stroke="#7A4FB5" stroke-width="1.2"><title>'+esc(wname(o.w))+'</title></line>'; });
    var hx=X(A.cum[A.hi]), hy=Y(p[A.hi].ele);
    s+='<circle cx="'+hx+'" cy="'+hy+'" r="3.5" fill="#7A4FB5" stroke="#fff" stroke-width="1.5"/>'
     +'<text class="dp-name" x="'+(hx>W-60?hx-6:hx<L+40?hx+6:hx)+'" y="'+Math.max(T+9,hy-6)+'" text-anchor="'+(hx>W-60?'end':hx<L+40?'start':'middle')+'" fill="#7A4FB5">▲ '+Math.round(p[A.hi].ele)+' m</text>';
    return s+'</svg>';
  }
  function niceStep(x){ var e=Math.pow(10,Math.floor(Math.log10(Math.max(x,1e-6)))), f=x/e; return (f<1.5?1:f<3?2:f<7?5:10)*e; }

  /* ─────────── 지도 (Leaflet · 안 되면 SVG) ─────────── */
  var leafletP=null;
  function ensureLeaflet(){
    if(window.L) return Promise.resolve(window.L);
    if(leafletP) return leafletP;
    leafletP=new Promise(function(res,rej){
      var c=document.createElement("link"); c.rel="stylesheet"; c.href=CFG.leafletCss; document.head.appendChild(c);
      var s=document.createElement("script"); s.src=CFG.leafletJs; s.onload=function(){ window.L?res(window.L):rej(); }; s.onerror=rej;
      document.head.appendChild(s); setTimeout(rej,8000);
    });
    return leafletP;
  }
  function drawMap(who, src, A, ow){
    var box=document.getElementById("d0map-"+who); if(!box) return;
    var col=CS.WHO[who].c, p=src.pts, step=Math.max(1,Math.floor(p.length/1500));
    var ll=[]; for(var i=0;i<p.length;i+=step) ll.push([p[i].lat,p[i].lon]); ll.push([p[p.length-1].lat,p[p.length-1].lon]);
    svgMap(box, ll, col, p, A, ow);             /* 먼저 SVG 로 바로 보이고 */
    ensureLeaflet().then(function(L){           /* 지도 타일이 되면 바꿔 끼움 */
      if(!document.body.contains(box)) return;
      if(MAPS[who]){ try{ MAPS[who].remove(); }catch(e){} }
      box.innerHTML="";
      var m=L.map(box,{scrollWheelZoom:false, attributionControl:true}); MAPS[who]=m;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18, attribution:"© OpenStreetMap"}).addTo(m);
      var line=L.polyline(ll,{color:"#fff",weight:7,opacity:.9}).addTo(m); L.polyline(ll,{color:col,weight:4}).addTo(m);
      var pin=function(q,c,t){ return L.marker([q.lat,q.lon],{icon:L.divIcon({className:"",html:'<div class="d0pin" style="background:'+c+'"></div>',iconSize:[14,14],iconAnchor:[7,7]})}).bindTooltip(t).addTo(m); };
      (ow||[]).forEach(function(o){ L.circleMarker([o.w.lat,o.w.lon],{radius:4,color:"#fff",weight:1.5,fillColor:"#7A4FB5",fillOpacity:1})
        .bindTooltip(esc(wname(o.w))+" · "+o.km.toFixed(1)+" km").addTo(m); });
      pin(p[0],"#1E7A46","출발"); pin(p[A.hi],"#7A4FB5","최고점 "+Math.round(p[A.hi].ele)+" m"); pin(p[p.length-1],"#8E2C3A",A.loop?"도착 (출발지)":"도착");
      m.fitBounds(line.getBounds(),{padding:[16,16]});
    }).catch(function(){ /* 타일을 못 쓰면 SVG 그대로 */ });
  }
  function svgMap(box, ll, col, p, A, ow){
    var la0=Infinity,la1=-Infinity,lo0=Infinity,lo1=-Infinity;
    ll.forEach(function(q){ la0=Math.min(la0,q[0]); la1=Math.max(la1,q[0]); lo0=Math.min(lo0,q[1]); lo1=Math.max(lo1,q[1]); });
    var cl=Math.cos((la0+la1)/2*Math.PI/180), w=(lo1-lo0)*cl||1e-4, h=(la1-la0)||1e-4, W=520, H=300, pad=18;
    var sc=Math.min((W-2*pad)/w,(H-2*pad)/h), ox=(W-w*sc)/2, oy=(H-h*sc)/2;
    var P=function(la,lo){ return [(ox+(lo-lo0)*cl*sc).toFixed(1),(oy+(la1-la)*sc).toFixed(1)]; };
    var d=ll.map(function(q,i){ var x=P(q[0],q[1]); return (i?"L":"M")+x[0]+","+x[1]; }).join("");
    var dot=function(q,c,r){ var x=P(q.lat,q.lon); return '<circle cx="'+x[0]+'" cy="'+x[1]+'" r="'+r+'" fill="'+c+'" stroke="#fff" stroke-width="2"/>'; };
    box.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="주행 경로"><rect width="'+W+'" height="'+H+'" fill="#EEF2F6"/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="3.5" stroke-linejoin="round"/>'
      +(ow||[]).map(function(o){ return dot(o.w,"#7A4FB5",3.5); }).join("")
      +dot(p[0],"#1E7A46",6)+dot(p[A.hi],"#7A4FB5",6)+dot(p[p.length-1],"#8E2C3A",5)
      +'<text x="8" y="'+(H-8)+'" font-size="10" fill="#8A8474">지도 타일 없이 그린 경로</text></svg>';
  }

  /* ─────────── 날씨 (그날의 시간별 기록) ─────────── */
  var WXC={};
  function wxUrl(lat, lon, ymd, archive){
    var q="latitude="+lat.toFixed(4)+"&longitude="+lon.toFixed(4)+"&start_date="+ymd+"&end_date="+ymd
      +"&hourly=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m"
      +"&daily=sunrise,sunset&timezone=auto&wind_speed_unit=kmh";
    return (archive?"https://archive-api.open-meteo.com/v1/archive?":"https://api.open-meteo.com/v1/forecast?")+q;
  }
  function wxGet(lat, lon, ymd){
    var key=lat.toFixed(3)+","+lon.toFixed(3)+","+ymd;
    if(WXC[key]) return WXC[key];
    var ss=null; try{ ss=JSON.parse(sessionStorage.getItem("d0wx:"+key)||"null"); }catch(e){}
    if(ss && ss.hourly) return (WXC[key]=Promise.resolve(ss));
    var ageDays=(Date.now()-Date.parse(ymd+"T12:00:00Z"))/86400000;
    var first=ageDays>80;     /* 석 달 가까이 지났으면 기록 보관소부터 */
    var go=function(arch){ return fetch(wxUrl(lat,lon,ymd,arch)).then(function(r){ if(!r.ok) throw new Error("날씨 "+r.status); return r.json(); })
      .then(function(j){ if(!j.hourly||!j.hourly.time||!j.hourly.time.length||j.hourly.temperature_2m.every(function(v){return v===null;})) throw new Error("빈 기록"); return j; }); };
    WXC[key]=go(first).catch(function(){ return go(!first); }).then(function(j){
      var off=(j.utc_offset_seconds||0)*1000;
      j._ms=j.hourly.time.map(function(t){ return Date.parse(t+":00Z")-off; });
      /* 오늘 주행이면 아직 오지 않은 시간은 예보 — 구분해서 그림 */
      j._fetched=Date.now();
      try{ if(ageDays>1.5) sessionStorage.setItem("d0wx:"+key, JSON.stringify(j)); }catch(e){}
      return j; });
    WXC[key].catch(function(){ delete WXC[key]; });
    return WXC[key];
  }
  function hourAt(j, ms, field){       /* 시간별 값을 그 순간으로 직선 보간 */
    var t=j._ms, v=j.hourly[field]; if(!t) return null;
    if(ms<=t[0]) return v[0]; if(ms>=t[t.length-1]) return v[v.length-1];
    for(var i=1;i<t.length;i++) if(ms<=t[i]){ var a=v[i-1], b=v[i]; if(a===null||b===null) return a===null?b:a; return a+(b-a)*(ms-t[i-1])/(t[i]-t[i-1]); }
    return null;
  }
  function hourIdx(j, ms){ var t=j._ms, bi=0; for(var i=0;i<t.length;i++) if(Math.abs(t[i]-ms)<Math.abs(t[bi]-ms)) bi=i; return bi; }
  /* 그 지점을 지난 순간 GPX 기온 — 앞뒤 2분 가운데값 */
  function gpxAtNear(p, idx){
    if(p[idx].t===null) return p[idx].at;
    var t=p[idx].t, v=[]; for(var i=Math.max(0,idx-600);i<Math.min(p.length,idx+600);i++) if(Math.abs(p[i].t-t)<=120000 && p[i].at!==null&&p[i].at!==undefined) v.push(p[i].at);
    if(!v.length) return null; v.sort(function(a,b){return a-b;}); return v[Math.floor(v.length/2)];
  }

  function loadWeather(who){
    var st=STATE[who], el=document.getElementById("d0"+who); if(!st||!el) return;
    var box=el.querySelector('[data-f="wx"]'), p=st.src.pts, A=st.A, ymd=st.ymd, tz=CS.WHO[who].tz;
    var pts=[
      {k:"s", lab:"출발",   i:0,          name:nearName(st.src,p[0])||"출발 지점"},
      {k:"p", lab:"최고점", i:A.hi,       name:(nearName(st.src,p[A.hi])||"가장 높은 곳")+" · "+Math.round(p[A.hi].ele)+" m"},
      {k:"e", lab:"도착",   i:p.length-1, name:nearName(st.src,p[p.length-1])||(A.loop?"출발지로 복귀":"도착 지점")}
    ];
    Promise.all(pts.map(function(q){ return wxGet(p[q.i].lat, p[q.i].lon, ymd).catch(function(e){ return {err:e}; }); })).then(function(res){
      if(STATE[who]!==st) return;          /* 그 사이 GPX 가 바뀌었으면 버림 */
      var ok=res.filter(function(r){ return !r.err; });
      if(!ok.length){
        box.innerHTML='<div class="wxerr">그날 날씨 기록을 불러오지 못했습니다 ('+esc(String(res[0].err&&res[0].err.message||"네트워크"))+')'
          +'<button class="wxretry" type="button">다시</button></div>';
        box.querySelector(".wxretry").onclick=function(){ box.innerHTML='<div class="wxload">다시 불러오는 중…</div>'; loadWeather(who); };
        tempProfile(who, null); return;
      }
      box.innerHTML=pts.map(function(q,n){ return res[n].err ? '<div class="wxerr">'+q.lab+' 날씨 없음</div>' : wxCard(who, q, res[n]); }).join("");
      st.wx=res; tempProfile(who, res, pts);
    });
  }
  function wxCard(who, q, j){
    var st=STATE[who], p=st.src.pts, A=st.A, tz=CS.WHO[who].tz, pt=p[q.i];
    var ms=pt.t!==null?pt.t:Date.parse(st.ymd+"T09:00:00Z"), hi=hourIdx(j,ms), H=j.hourly;
    var tNow=hourAt(j,ms,"temperature_2m"), ic=wxText(H.weather_code[hi]);
    var tmax=-Infinity,tmin=Infinity,rain=0; H.temperature_2m.forEach(function(v){ if(v!==null){ tmax=Math.max(tmax,v); tmin=Math.min(tmin,v); } });
    H.precipitation.forEach(function(v){ rain+=v||0; });
    var rideRain=0; if(A.t0) j._ms.forEach(function(t,i){ if(t>=A.t0-3600000&&t<=A.t1) rideRain+=H.precipitation[i]||0; });
    var gx=A.hasAt?gpxAtNear(p,q.i):null;
    var sr=j.daily&&j.daily.sunrise?String(j.daily.sunrise[0]).slice(11,16):"", ss=j.daily&&j.daily.sunset?String(j.daily.sunset[0]).slice(11,16):"";
    return '<div class="wxcard"><div class="wxhead"><span class="wxb '+q.k+'">'+q.lab+'</span>'
      +'<div class="wxnm"><b>'+esc(q.name)+'</b><small>'+pt.lat.toFixed(4)+', '+pt.lon.toFixed(4)+' · '+Math.round(pt.ele)+' m · '+A.cum[q.i].toFixed(1)+' km</small></div>'
      +'<span class="wxsum">'+ic[0]+' '+(tNow!==null?tNow.toFixed(1)+'°':'—')+' '+ic[1]+'</span>'
      +(pt.t!==null?'<span class="wxride">'+CS.clock(pt.t,tz)+' 통과 <i>현지 시각</i></span>':'')
      +(gx!==null&&gx!==undefined?'<span class="wxmeas">GPX 실측 '+gx.toFixed(0)+'°'+(tNow!==null?' <i>기록과 '+(gx-tNow>=0?'+':'')+(gx-tNow).toFixed(1)+'°</i>':'')+'</span>':'')
      +'</div><div class="wxchart">'+dayChart(j, st, pt.t)+'</div>'
      +'<div class="wxstats"><span class="wxhi">최고 <b>'+tmax.toFixed(0)+'°</b></span><span class="wxlo">최저 <b>'+tmin.toFixed(0)+'°</b></span>'
      +'<span class="wxrain">비 <b>'+rain.toFixed(1)+'</b> mm'+(A.t0?' · 주행 중 '+rideRain.toFixed(1):'')+'</span>'
      +'<span class="wxwind">바람 <b>'+Math.round(H.wind_speed_10m[hi]||0)+'</b> km/h '+dirK(H.wind_direction_10m[hi])+(H.wind_gusts_10m[hi]?' <i>돌풍 '+Math.round(H.wind_gusts_10m[hi])+'</i>':'')+'</span>'
      +'<span>습도 <b>'+Math.round(H.relative_humidity_2m[hi]||0)+'</b>%</span>'
      +(sr?'<span class="wxsun">🌅 '+sr+'</span><span class="wxsun">🌇 '+ss+'</span>':'')+'</div></div>';
  }
  /* 하루 24시간 기온선 · 비 막대 · 주행 시간 띠 · 통과 순간 */
  function dayChart(j, st, passMs){
    var W=320, Hh=120, L=24, R=6, T=10, B=18, H=j.hourly, n=H.time.length, A=st.A;
    var tv=H.temperature_2m.filter(function(v){return v!==null;}), mn=Math.min.apply(null,tv)-1, mx=Math.max.apply(null,tv)+1;
    var X=function(i){ return L+(W-L-R)*i/(n-1); }, Y=function(v){ return T+(Hh-T-B)*(1-(v-mn)/(mx-mn)); };
    var XT=function(ms){ var t0=j._ms[0], t1=j._ms[n-1]; return L+(W-L-R)*(ms-t0)/(t1-t0); };
    var s='<svg viewBox="0 0 '+W+' '+Hh+'" style="width:100%;display:block">';
    if(A.t0) s+='<rect x="'+XT(A.t0)+'" y="'+T+'" width="'+Math.max(2,XT(A.t1)-XT(A.t0))+'" height="'+(Hh-T-B)+'" fill="#FFE8A3" fill-opacity=".55"/>';
    var rmax=Math.max(2,Math.max.apply(null,H.precipitation.map(function(v){return v||0;})));
    H.precipitation.forEach(function(v,i){ if(v>0){ var bh=v/rmax*(Hh-T-B)*.5; s+='<rect x="'+(X(i)-4)+'" y="'+(Hh-B-bh)+'" width="8" height="'+bh+'" fill="#1E5FB4" fill-opacity=".45"/>'; } });
    var gs=niceStep((mx-mn)/3); for(var g=Math.ceil(mn/gs)*gs; g<=mx; g+=gs) s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(g)+'" y2="'+Y(g)+'" stroke="#EFEADC"/><text x="'+(L-3)+'" y="'+(Y(g)+3)+'" font-size="8.5" text-anchor="end" fill="#9A9280">'+Math.round(g)+'°</text>';
    [0,6,12,18,23].forEach(function(h){ if(h<n) s+='<text x="'+X(h)+'" y="'+(Hh-5)+'" font-size="8.5" text-anchor="middle" fill="#9A9280">'+h+'시</text>'; });
    var now=Date.now(), dPast="", dFut="";
    H.temperature_2m.forEach(function(v,i){ if(v===null) return; var c=X(i).toFixed(1)+","+Y(v).toFixed(1);
      if(j._ms[i]<=now+3600000) dPast+=(dPast?"L":"M")+c; if(j._ms[i]>=now) dFut+=(dFut?"L":"M")+c; });
    s+='<path d="'+dPast+'" fill="none" stroke="#C2410C" stroke-width="2"/>';
    if(dFut) s+='<path d="'+dFut+'" fill="none" stroke="#C2410C" stroke-width="1.6" stroke-dasharray="4 3" opacity=".7"><title>아직 오지 않은 시간 — 예보</title></path>';
    if(passMs){ var tv2=hourAt(j,passMs,"temperature_2m"); if(tv2!==null) s+='<circle cx="'+XT(passMs)+'" cy="'+Y(tv2)+'" r="4" fill="#fff" stroke="#C2410C" stroke-width="2"/>'; }
    return s+'</svg>';
  }

  /* ─────────── 기온 프로파일: 그날 기록 vs GPX 실측 ─────────── */
  function tempProfile(who, res, pts){
    var st=STATE[who], el=document.getElementById("d0"+who); if(!st||!el) return;
    var box=el.querySelector('[data-f="tp"]'), p=st.src.pts, A=st.A, tz=CS.WHO[who].tz;
    if(!A.t0){ box.innerHTML='<h5>기온 프로파일 <small>GPX 에 시간이 없어 그릴 수 없습니다</small></h5>'; return; }
    /* 1분마다: 궤적 위 자리 · 고도 · GPX 기온(가운데값) · 기록 기온(가장 가까운 날씨 지점, 고도차 0.65°/100 m 보정) */
    var rows=[], i=0, win=[];
    for(var t=A.t0; t<=A.t1; t+=60000){
      while(i<p.length-1 && p[i+1].t<=t) i++;
      win.length=0; for(var k=i; k>=0 && p[k].t>t-60000; k--) if(p[k].at!==null&&p[k].at!==undefined) win.push(p[k].at);
      for(k=i+1; k<p.length && p[k].t<t+60000; k++) if(p[k].at!==null&&p[k].at!==undefined) win.push(p[k].at);
      win.sort(function(a,b){return a-b;});
      var gx=win.length?win[Math.floor(win.length/2)]:null, md=null;
      if(res){ var best=-1,bd=Infinity; pts.forEach(function(q,n){ if(res[n].err) return; var d=hav(p[i],p[q.i]); if(d<bd){ bd=d; best=n; } });
        if(best>=0){ var v=hourAt(res[best],t,"temperature_2m"); if(v!==null) md=v-(p[i].ele-p[pts[best].i].ele)*0.0065; } }
      rows.push({t:t, km:A.cum[i], ele:p[i].ele, gx:gx, md:md});
    }
    var W=720, H=210, L=34, R=34, T=14, B=24, all=[];
    rows.forEach(function(r){ if(r.gx!==null) all.push(r.gx); if(r.md!==null) all.push(r.md); });
    if(!all.length){ box.innerHTML='<h5>기온 프로파일 <small>기온 자료 없음</small></h5>'; return; }
    var mn=Math.floor(Math.min.apply(null,all))-1, mx=Math.ceil(Math.max.apply(null,all))+1;
    var e0=p[A.lo].ele, e1=p[A.hi].ele, ep=Math.max(10,(e1-e0)*.1);
    var X=function(t){ return L+(W-L-R)*(t-A.t0)/((A.t1-A.t0)||1); }, Y=function(v){ return T+(H-T-B)*(1-(v-mn)/(mx-mn)); };
    var YE=function(e){ return T+(H-T-B)*(1-(e-(e0-ep))/((e1+ep)-(e0-ep))); };
    var s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block" role="img" aria-label="기온 프로파일">';
    var ea="M"+X(A.t0)+","+(H-B); rows.forEach(function(r){ ea+="L"+X(r.t).toFixed(1)+","+YE(r.ele).toFixed(1); }); ea+="L"+X(A.t1)+","+(H-B)+"Z";
    s+='<path d="'+ea+'" fill="#152A55" fill-opacity=".07"/>';
    var gs=niceStep((mx-mn)/4); for(var g=Math.ceil(mn/gs)*gs; g<=mx; g+=gs) s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(g)+'" y2="'+Y(g)+'" stroke="#EFEADC"/><text x="'+(L-4)+'" y="'+(Y(g)+3)+'" font-size="9.5" text-anchor="end" fill="#9A9280">'+g+'°</text>';
    s+='<text x="'+(W-R+4)+'" y="'+(YE(e1)+3)+'" font-size="9" fill="#9AA3B5">'+Math.round(e1)+' m</text><text x="'+(W-R+4)+'" y="'+(YE(e0)+3)+'" font-size="9" fill="#9AA3B5">'+Math.round(e0)+' m</text>';
    var span=A.t1-A.t0, tstep=span>4*3600000?3600000:span>90*60000?1800000:900000;
    for(var tt=Math.ceil(A.t0/tstep)*tstep; tt<=A.t1; tt+=tstep) s+='<text x="'+X(tt)+'" y="'+(H-7)+'" font-size="9.5" text-anchor="middle" fill="#9A9280">'+CS.clock(tt,tz)+'</text>';
    var pth=function(key){ var d=""; rows.forEach(function(r){ if(r[key]===null){ return; } d+=(d?"L":"M")+X(r.t).toFixed(1)+","+Y(r[key]).toFixed(1); }); return d; };
    s+='<path d="'+pth("md")+'" fill="none" stroke="#1E5FB4" stroke-width="2.2" stroke-dasharray="6 4"/>';
    s+='<path d="'+pth("gx")+'" fill="none" stroke="#C2410C" stroke-width="2.2"/>';
    /* 출발 · 최고점 · 도착 눈금 */
    var lastX=-99, row=0;
    [[p[0].t,"출발","#1E7A46"],[p[A.hi].t,"최고점","#7A4FB5"],[p[p.length-1].t,"도착","#8E2C3A"]].forEach(function(m){
      var x=X(m[0]); row = (x-lastX<44) ? row+1 : 0; lastX=x;       /* 가까우면 한 줄 아래로 */
      s+='<line x1="'+x+'" x2="'+x+'" y1="'+T+'" y2="'+(H-B)+'" stroke="'+m[2]+'" stroke-width="1" stroke-dasharray="2 3"/>'
       +'<text x="'+(x>W-R-30?x-3:x<L+20?x+3:x)+'" y="'+(T-3+row*11)+'" font-size="9" font-weight="700" text-anchor="'+(x>W-R-30?'end':x<L+20?'start':'middle')+'" fill="'+m[2]+'">'+m[1]+'</text>'; });
    s+='</svg>';
    /* 차이 — 출발 10분(기기가 바깥 공기에 맞춰지는 시간)은 빼고 */
    var dif=[]; rows.forEach(function(r){ if(r.gx!==null&&r.md!==null&&r.t>A.t0+600000) dif.push(r.gx-r.md); });
    var mean=dif.length?dif.reduce(function(a,b){return a+b;},0)/dif.length:null;
    var gxv=rows.filter(function(r){return r.gx!==null;}).map(function(r){return r.gx;}), mdv=rows.filter(function(r){return r.md!==null;}).map(function(r){return r.md;});
    box.innerHTML='<h5>기온 프로파일 <small>주행 시간 · 현지 '+CS.clock(A.t0,tz)+'–'+CS.clock(A.t1,tz)+'</small>'
      +'<span class="d0lg"><i style="border-color:#C2410C"></i>GPX 실측'+(gxv.length?' '+Math.min.apply(null,gxv).toFixed(0)+'~'+Math.max.apply(null,gxv).toFixed(0)+'°':' 없음')+'</span>'
      +'<span class="d0lg"><i style="border-color:#1E5FB4;border-top-style:dashed"></i>그날 기록'+(mdv.length?' '+Math.min.apply(null,mdv).toFixed(1)+'~'+Math.max.apply(null,mdv).toFixed(1)+'°':' 없음')+'</span>'
      +'<span class="d0lg"><i style="border-color:#152A55;opacity:.25;border-top-width:6px"></i>고도</span></h5>'
      +s+(mean!==null?'<div class="wxnote" style="margin:2px 6px 6px">출발 10분 뒤부터 GPX 가 기록보다 평균 <b>'+(mean>=0?'+':'')+mean.toFixed(1)+'°</b>'
      +(Math.abs(mean)>=2?(mean>0?' 높습니다 — 기기가 햇볕·몸열을 받았거나 출발 전 실내 온도가 남은 것일 수 있습니다.':' 낮습니다 — 바람 · 그늘 · 물가 구간의 영향일 수 있습니다.'):' — 거의 같습니다. 예보 기온을 그대로 믿어도 되겠습니다.')+'</div>':'');
  }

  /* ─────────── 최근 7일 예측 오차율 ─────────── */
  function allSessions(){ return CS.plogMerge([CS.plogLocal(), STATIC_LOGS]); }
  function errBlock(who){
    var W=CS.WHO[who], ss=allSessions(), mine=ss.filter(function(S){ return S.who===who; }), last=mine[mine.length-1];
    var lastTxt="";
    if(last){ var r=CS.plogRecalc(last);
      lastTxt='<div class="row">마지막 로그 <b>'+CS.ymd(new Date(last.start).getTime(),W.tz).slice(5).replace("-","/")+' '+CS.clock(new Date(last.start).getTime(),W.tz)+'</b>'
        +' · 오차율 <b>'+(r.errPct!==null?r.errPct.toFixed(1)+' %':'—')+'</b> · 평균 <b>'+(r.meanErrM!==null?Math.round(r.meanErrM)+' m':'—')+'</b>'
        +' · 주행 <b>'+r.distKm.toFixed(1)+'</b>'+(last.trackKm?' / '+(+last.trackKm).toFixed(1):'')+' km'
        +(last.done?' · 완주':' · <b style="color:#B45309">중간 멈춤</b>')+(r.skipped>1?' · 튄 수신 '+(r.skipped-1)+'회 뺌':'')+'</div>'; }
    return '<div class="d0err"><h5>최근 7일 예측 오차율 · '+W.n+' <small>'+W.place+' 날짜 기준 · 막대 위 % · 아래 평균 오차 m · 점선은 중간에 멈춘 날</small></h5>'
      + '<div style="max-width:560px">'+CS.errChartSvg(ss, who, {w:420, h:70})+'</div>'
      + lastTxt
      + '<div class="row"><label class="d0btn">로그 JSON 가져오기<input type="file" multiple data-act="log"></label>'
      + '<span>다른 폰에서 받은 pred-log-*.json 을 넣으면 이 폰에서도 그 사람 그래프가 보입니다.</span></div></div>';
  }
  function bindErr(el, who){
    var inp=el.querySelector('[data-act="log"]'); if(!inp || inp._b) return; inp._b=1;
    inp.addEventListener("change",function(){
      var files=[].slice.call(inp.files||[]), added=0;
      Promise.all(files.map(function(fl){ return fl.text().then(function(t){ try{ added+=CS.plogImport(JSON.parse(t)); }catch(e){ alert(fl.name+" 을 읽지 못했습니다 — "+e.message); } }); }))
        .then(function(){ rerenderErr(); if(added===0 && files.length) alert("새 세션이 없습니다 (이미 들어 있음)"); });
    });
  }
  function rerenderErr(){ ["bin","jin"].forEach(function(w){ var el=document.getElementById("d0"+w); if(!el) return;
    var old=el.querySelector(".d0err"); if(!old) return; var tmp=document.createElement("div"); tmp.innerHTML=errBlock(w); old.replaceWith(tmp.firstChild); bindErr(el,w); }); }

  /* ─────────── GPX 불러오기 ─────────── */
  function fromStore(who){
    var j=CS.loadDay0(who); if(!j) return null;
    return {src:{pts:j.pts, name:j.name, wpts:j.wpts}, from:"비교하기 · 저장된 DAY 0", file:j.file, saved:j.saved};
  }
  function fromStatic(who){
    var url=CFG.files[who]; if(!url) return Promise.resolve(null);
    return fetch(url,{cache:"no-cache"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
      .then(function(t){ var g=CS.parseGpx(t); return g.pts.length<2?null:{src:g, from:"폴더 기본 파일", file:url.split("/").pop(), saved:null}; })
      .catch(function(){ return null; });
  }
  function load(who, preferStatic){
    var s=preferStatic?null:fromStore(who);
    if(s){ STATE[who]=s; render(who); return Promise.resolve(); }
    return fromStatic(who).then(function(x){ STATE[who]=x; render(who); });
  }
  function bindCard(who){
    var el=document.getElementById("d0"+who);
    el.querySelector('[data-act="file"]').addEventListener("change",function(e){
      var fl=e.target.files[0]; if(!fl) return;
      fl.text().then(function(t){
        var g=CS.parseGpx(t); if(g.pts.length<2) throw new Error("트랙 점이 2개 미만");
        var name=g.name||fl.name.replace(/\.gpx$/i,"");
        try{ CS.saveDay0(who, g.pts, name, g.wpts, {file:fl.name}); }catch(err){ console.warn("저장 실패(용량?)",err); }
        STATE[who]={src:{pts:g.pts,name:name,wpts:g.wpts}, from:"이 카드에서 올림", file:fl.name, saved:Date.now()}; render(who); flash(who);
      }).catch(function(err){ alert("GPX 를 읽지 못했습니다 — "+err.message); });
      e.target.value="";
    });
    el.querySelector('[data-act="static"]').addEventListener("click",function(){ load(who,true).then(function(){ flash(who); }); });
  }
  function flash(who){ var el=document.getElementById("d0"+who); if(!el) return; el.classList.remove("d0flash"); void el.offsetWidth; el.classList.add("d0flash"); }

  /* 비교하기에서 GPX 를 새로 넣거나 로그가 쌓이면 바로 다시 그림 (다른 탭 · 창) */
  window.addEventListener("storage",function(e){
    if(!e.key) return;
    ["bin","jin"].forEach(function(w){ if(e.key===CS.d0Key(w)){ var s=fromStore(w); if(s){ STATE[w]=s; render(w); flash(w); } else load(w); } });
    if(e.key===CS.KEY.plog || e.key===CS.KEY.plogImp) rerenderErr();
  });
  /* 같은 폰에서 비교하기를 다녀오면 저장 시각을 비교해 다시 그림 */
  document.addEventListener("visibilitychange",function(){
    if(document.hidden) return;
    ["bin","jin"].forEach(function(w){ var j=CS.loadDay0(w), st=STATE[w];
      if(j && (!st || st.saved!==j.saved)){ STATE[w]=fromStore(w); render(w); flash(w); } });
    rerenderErr();
  });

  /* ─────────── 자리 잡기 ─────────── */
  var BOX=null;
  function place(){
    var host=document.getElementById("daysHost"); if(!host||!BOX) return;
    var first=host.querySelector(".dcard:not(.d0card)");
    if(first){ if(BOX.nextElementSibling!==first || BOX.parentNode!==first.parentNode) first.parentNode.insertBefore(BOX, first); }
    else if(BOX.parentNode!==host) host.insertBefore(BOX, host.firstChild);
  }
  function mount(){
    if(BOX) return place();
    var host=document.getElementById("daysHost"); if(!host) return;
    var st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
    BOX=document.createElement("div"); BOX.id="d0host";
    BOX.innerHTML=cardShell("bin")+cardShell("jin");
    place();
    bindCard("bin"); bindCard("jin");
    Promise.all(CFG.logs.map(function(u){ return fetch(u,{cache:"no-cache"}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }))
      .then(function(ls){ ls.forEach(function(j){ if(j) STATIC_LOGS=STATIC_LOGS.concat(Array.isArray(j)?j:(j.sessions||[])); }); rerenderErr(); });
    load("bin"); load("jin");
  }
  function navLinks(){
    var nav=document.querySelector("#dayNavHost .in"); if(!nav || nav.querySelector(".d0nav")) return;
    nav.insertAdjacentHTML("afterbegin",'<a href="#d0bin" class="d0nav">D0<small>BIN</small></a><a href="#d0jin" class="d0nav">D0<small>JIN</small></a>');
  }
  /* 날짜 카드는 camino-days.html 을 읽어 늦게 들어옵니다. 들어온 뒤(또는 다시 그려진 뒤)에도 늘 맨 앞에 */
  function tick(){
    var host=document.getElementById("daysHost"); if(!host) return;
    if(host.querySelector(".dcard:not(.d0card)") || host.querySelector(".loadfail")) mount();
    else if(BOX) place();
    navLinks();
  }
  var busy=false;
  function start(){
    tick();
    new MutationObserver(function(){ if(busy) return; busy=true; requestAnimationFrame(function(){ busy=false; tick(); }); })
      .observe(document.body,{childList:true,subtree:true});
    setTimeout(function(){ mount(); navLinks(); }, 6000);   /* 로더가 늦거나 멈춰도 카드는 보이게 */
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start); else start();

  window.CaminoDay0={ reload:function(w){ return w?load(w):Promise.all([load("bin"),load("jin")]); }, state:STATE, cfg:CFG };
})();
