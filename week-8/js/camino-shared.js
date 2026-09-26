/* ══════════════════════════════════════════════════════════════════════
   camino-shared.js  ·  보기(camino-frances-bike-2027.html) 와
                        비교하기(camino-route-compare.html) 가 함께 쓰는 부분

   - 저장 열쇠(localStorage) 이름 · 사람별 시간대
   - GPX 읽기 (가민 기온 atemp 포함)
   - DAY 0 궤적 저장 / 불러오기   → 두 페이지가 같은 칸을 씁니다
   - 예측 오차 로그 다시 계산 · 합치기 · 최근 7일 막대 그래프

   두 페이지는 같은 폴더(같은 주소)에 있어야 브라우저 저장소를 함께 봅니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(G){
  "use strict";
  var CS = {};
  CS.VER = "shared-20260926";

  /* 사람 — 색 · 시간대 (JIN 은 한국, BIN 은 미국 동부 · 9월엔 13시간 차) */
  CS.WHO = {
    bin:{ n:"BIN", c:"#1E5FB4", tz:"America/New_York", place:"미국 뉴저지" },
    jin:{ n:"JIN", c:"#C92A2A", tz:"Asia/Seoul",       place:"한국 서울" }
  };
  CS.KEY = {
    d0:      "caminoDay0",          /* + ":bin" / ":jin" */
    plog:    "caminoPredLog",       /* 이 폰에서 쌓인 로그 */
    plogImp: "caminoPredLogImport", /* 가져온 로그 (다른 사람 폰에서 받은 JSON) */
    ride:    "caminoRide"           /* + ":bin" / ":jin" — 그날 다 달리고 올린 실제 주행 GPX */
  };

  /* ── 거리 ── */
  CS.hav = function(a,b){
    var R=6371000, r=Math.PI/180, dla=(b.lat-a.lat)*r, dlo=(b.lon-a.lon)*r;
    var h=Math.sin(dla/2)*Math.sin(dla/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlo/2)*Math.sin(dlo/2);
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  };
  CS.esc = function(t){ return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };
  function unmojibake(t){
    if(!t || !/[ÃÂ][\u0080-\u00BF]?/.test(t)) return t;
    try{ var f=decodeURIComponent(escape(t)); if(!/\uFFFD/.test(f)) return f; }catch(e){}
    return t.replace(/Â·/g,"·").replace(/Â /g," ");
  }
  CS.unmojibake = unmojibake;

  /* ── GPX 읽기 — 시간 · 고도 · 기온(atemp) · 표시 지점 ── */
  function firstTag(el, names){
    for(var i=0;i<names.length;i++){
      var x=el.getElementsByTagName(names[i])[0];
      if(!x) x=el.getElementsByTagNameNS("*", names[i].replace(/^.*:/,""))[0];
      if(x && x.textContent.trim()!=="") return x.textContent.trim();
    }
    return "";
  }
  CS.parseGpx = function(txt){
    var doc=new DOMParser().parseFromString(txt,"application/xml");
    if(doc.querySelector("parsererror")) throw new Error("GPX 형식 오류");
    var pts=[], nodes=doc.getElementsByTagName("trkpt");
    for(var i=0;i<nodes.length;i++){
      var n=nodes[i], la=parseFloat(n.getAttribute("lat")), lo=parseFloat(n.getAttribute("lon"));
      if(isNaN(la)||isNaN(lo)) continue;
      var e=firstTag(n,["ele"]), t=firstTag(n,["time"]), a=firstTag(n,["ns3:atemp","gpxtpx:atemp","atemp"]);
      var tm=t?Date.parse(t):NaN, at=a===""?NaN:parseFloat(a);
      pts.push({lat:la, lon:lo, ele:e===""?0:(parseFloat(e)||0), t:isNaN(tm)?null:tm, at:isNaN(at)?null:at});
    }
    var trk=doc.getElementsByTagName("trk")[0], nm="";
    if(trk){ for(var c=trk.firstElementChild;c;c=c.nextElementSibling) if(c.localName==="name"){ nm=c.textContent.trim(); break; } }
    var wpts=[], wn=doc.getElementsByTagName("wpt");
    for(var j=0;j<wn.length;j++){
      var W=wn[j], wla=parseFloat(W.getAttribute("lat")), wlo=parseFloat(W.getAttribute("lon"));
      if(isNaN(wla)||isNaN(wlo)) continue;
      /* 표시 지점 이름 — name 이 표준이지만 일부 도구는 n 으로 씁니다 */
      wpts.push({lat:wla, lon:wlo, name:unmojibake(firstTag(W,["name","n"])),
                 cmt:unmojibake(firstTag(W,["cmt","desc"])), sym:firstTag(W,["sym"])||"Waypoint"});
    }
    return {pts:pts, name:unmojibake(nm), wpts:wpts};
  };

  /* ── DAY 0 저장 · 불러오기 (두 페이지 공용 형식) ──
     rows: [lat, lon, ele, t(초) | null, 기온 | null]   — 5번째 칸은 이번 판에서 새로 붙음 */
  CS.d0Key = function(who){ return CS.KEY.d0+":"+(who||"bin"); };
  CS.saveDay0 = function(who, pts, name, wpts, extra){
    var rows=pts.map(function(q){ return [+q.lat.toFixed(6), +q.lon.toFixed(6), Math.round(q.ele),
      q.t===null||q.t===undefined?null:Math.round(q.t/1000), q.at===null||q.at===undefined?null:q.at]; });
    var j={name:name||"DAY 0", rows:rows, wpts:wpts||[], saved:Date.now(), who:who};
    if(extra) for(var k in extra) j[k]=extra[k];
    localStorage.setItem(CS.d0Key(who), JSON.stringify(j));
    return j;
  };
  CS.loadDay0 = function(who){
    try{
      var j=JSON.parse(localStorage.getItem(CS.d0Key(who))||"null");
      if(!j||!j.rows||j.rows.length<2) return null;
      return { name:j.name||"DAY 0", wpts:j.wpts||[], saved:j.saved||null, file:j.file||"",
        pts:j.rows.map(function(r){ return {lat:r[0], lon:r[1], ele:r[2]||0,
          t:r[3]===null||r[3]===undefined?null:r[3]*1000, at:r[4]===undefined?null:r[4]}; }) };
    }catch(e){ return null; }
  };

  /* ── 오늘 주행 GPX (실제로 달린 기록) — DAY 0 궤적(길잡이)과 따로 둡니다 ── */
  CS.rideKey = function(who){ return CS.KEY.ride+":"+(who||"bin"); };
  CS.saveRide = function(who, pts, name, wpts, extra){
    /* 1초 간격 기록은 너무 커서 3초·5 m 안쪽 점은 건너뜀 (기온·고도는 유지) */
    var keep=[], last=null;
    pts.forEach(function(q,i){ if(!last || i===pts.length-1 || (q.t!==null&&last.t!==null&&q.t-last.t>=3000) || CS.hav(last,q)>=5){ keep.push(q); last=q; } });
    var rows=keep.map(function(q){ return [+q.lat.toFixed(6), +q.lon.toFixed(6), Math.round(q.ele),
      q.t===null||q.t===undefined?null:Math.round(q.t/1000), q.at===null||q.at===undefined?null:q.at]; });
    var j={name:name||"오늘 주행", rows:rows, wpts:wpts||[], saved:Date.now(), who:who};
    if(extra) for(var k in extra) j[k]=extra[k];
    localStorage.setItem(CS.rideKey(who), JSON.stringify(j));
    return j;
  };
  CS.loadRide = function(who){
    try{
      var j=JSON.parse(localStorage.getItem(CS.rideKey(who))||"null");
      if(!j||!j.rows||j.rows.length<2) return null;
      return { name:j.name, wpts:j.wpts||[], saved:j.saved, file:j.file||"", truth:j.truth||null,
        pts:j.rows.map(function(r){ return {lat:r[0], lon:r[1], ele:r[2]||0, t:r[3]===null?null:r[3]*1000, at:r[4]===undefined?null:r[4]}; }) };
    }catch(e){ return null; }
  };

  /* ── 실제 주행 GPX 로 예측 로그를 채점 ──
     로그에는 수신 순간(recv)의 표시 위치(dispKm)와 수신 시각(t)의 예측(predKm)이 있습니다.
     실제 GPX 로 그 순간 정말 어디 있었는지(truth)를 길잡이 궤적 위 km 로 바꿔 비교합니다.
       표시 − 실제 > 0 : 화면이 앞서 있음 (명소를 "이미 지나감" 으로 보임)
       표시 − 실제 < 0 : 화면이 뒤처짐   (명소에 "아직 도착 못함" 으로 보임) */
  function trackIndex(pts){ var cum=[0]; for(var i=1;i<pts.length;i++) cum.push(cum[i-1]+CS.hav(pts[i-1],pts[i])/1000); return cum; }
  CS.projectKm = function(pts, cum, lat, lon, hintKm, winKm){
    var r=Math.PI/180, cl=Math.cos(lat*r), best=Infinity, bk=null, lo=0, hi=pts.length-1;
    if(typeof hintKm==="number"){ winKm=winKm||2;
      while(lo<hi && cum[lo]<hintKm-winKm) lo++; hi=lo; while(hi<pts.length-1 && cum[hi]<hintKm+winKm) hi++; }
    for(var i=Math.max(0,lo);i<Math.min(pts.length-1,hi+1);i++){
      var a=pts[i], b=pts[i+1], ax=(a.lon-lon)*111320*cl, ay=(a.lat-lat)*111320, bx=(b.lon-lon)*111320*cl, by=(b.lat-lat)*111320;
      var sx=bx-ax, sy=by-ay, L2=sx*sx+sy*sy, t=L2?Math.max(0,Math.min(1,-(ax*sx+ay*sy)/L2)):0, px=ax+sx*t, py=ay+sy*t, d=px*px+py*py;
      if(d<best){ best=d; bk=cum[i]+(cum[i+1]-cum[i])*t; }
    }
    return bk===null?null:{km:bk, off:Math.sqrt(best)};
  };
  function posAt(pts, ms){
    var lo=0, hi=pts.length-1; if(ms<=pts[0].t) return pts[0]; if(ms>=pts[hi].t) return pts[hi];
    while(hi-lo>1){ var m=(lo+hi)>>1; if(pts[m].t<=ms) lo=m; else hi=m; }
    var a=pts[lo], b=pts[hi], f=(ms-a.t)/((b.t-a.t)||1);
    return {lat:a.lat+(b.lat-a.lat)*f, lon:a.lon+(b.lon-a.lon)*f};
  }
  function med(a){ if(!a.length) return null; var b=a.slice().sort(function(x,y){return x-y;}); return b[Math.floor(b.length/2)]; }
  /* 길잡이 궤적이 없어도 되게, 실제 주행 GPX 하나로 계산합니다.
     그 시각 실제 자리 = 주행 GPX 의 누적 거리(시간으로 보간) → 수신 좌표를 같은 GPX 에 투영해 차이를 구하고
     로그의 fixKm 에 더해 "로그 궤적 위 실제 km" 로 옮깁니다. 왕복 궤적도 시간으로 찾으므로 헷갈리지 않습니다. */
  CS.rideTruth = function(S, ride){
    var rp=ride.filter(function(q){ return q.t!==null; }); if(rp.length<2||!S||!S.fixes||!S.fixes.length) return null;
    var s0=Date.parse(S.start), s1=Date.parse(S.end||S.fixes[S.fixes.length-1].recv);
    if(rp[rp.length-1].t<s0-600000 || rp[0].t>s1+600000) return null;            /* 시간이 안 겹침 */
    var cum=trackIndex(rp), T0=rp[0].t, T1=rp[rp.length-1].t;
    function cumAt(ms){ var lo=0, hi=rp.length-1; if(ms<=rp[0].t) return 0; if(ms>=rp[hi].t) return cum[hi];
      while(hi-lo>1){ var m=(lo+hi)>>1; if(rp[m].t<=ms) lo=m; else hi=m; }
      return cum[lo]+(cum[hi]-cum[lo])*(ms-rp[lo].t)/((rp[hi].t-rp[lo].t)||1); }
    function rel(f, ms){                      /* 수신 f 를 기준으로 시각 ms 의 실제 km (로그 궤적 기준) */
      var ct=cumAt(Date.parse(f.t)), p=CS.projectKm(rp,cum,f.lat,f.lon,ct,1);
      if(!p||p.off>120) return null; return f.fixKm + (cumAt(ms)-p.km); }
    var lag=[], fixE=[], predE=[], dispE=[], per=[];
    S.fixes.forEach(function(f){
      var tt=Date.parse(f.t), tv=Date.parse(f.recv), row=null;
      if(tt>=T0 && tt<=T1 && typeof f.fixKm==="number" && typeof f.lat==="number"){
        var ct=cumAt(tt), p=CS.projectKm(rp,cum,f.lat,f.lon,ct,1);
        if(p && p.off<=120){
          var kT=f.fixKm+(ct-p.km), kR=tv<=T1?f.fixKm+(cumAt(tv)-p.km):null;
          row=[+kT.toFixed(4), kR===null?null:+kR.toFixed(4)];
          lag.push((tv-tt)/1000); fixE.push((ct-p.km)*1000);
          if(!f.rest){
            if(typeof f.predKm==="number" && f.errM!==null && f.errM<1500) predE.push((f.predKm-kT)*1000);
            if(typeof f.dispKm==="number" && kR!==null) dispE.push((f.dispKm-kR)*1000); }
        }
      }
      per.push(row);
    });
    if(!lag.length) return null;
    var marks=(S.marks||[]).map(function(m){ var ms=Date.parse(m.at), ref=null;
      S.fixes.forEach(function(f){ if(Date.parse(f.t)<=ms && typeof f.fixKm==="number" && typeof f.lat==="number") ref=f; });
      var o={}; for(var x in m) o[x]=m[x]; if(!ref||ms<T0||ms>T1) return o;
      var k=rel(ref, ms); if(k===null) return o;
      o.truthKm=+k.toFixed(4); o.dispErrM=typeof m.dispKm==="number"?Math.round((m.dispKm-k)*1000):null; o.atWpM=Math.round((k-m.wpKm)*1000); return o; });
    var abs=function(a){ return a.map(Math.abs); }, big=function(a,sg){ return a.filter(function(x){ return sg>0?x>50:x<-50; }).length; };
    return { at:new Date().toISOString(), n:lag.length, lagMedS:med(lag),
      fixMedAbsM:med(abs(fixE)), predMedAbsM:med(abs(predE)), predMedM:med(predE),
      dispN:dispE.length, dispMedAbsM:med(abs(dispE)), dispMedM:med(dispE),
      dispAhead:big(dispE,1), dispBehind:big(dispE,-1),
      predAhead:big(predE,1), predBehind:big(predE,-1), per:per, marks:marks };
  };

  /* ── 시간대별 날짜 ── */
  CS.ymd = function(ms, tz){
    try{
      var p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(ms));
      var o={}; p.forEach(function(x){ o[x.type]=x.value; }); return o.year+"-"+o.month+"-"+o.day;
    }catch(e){ return new Date(ms).toISOString().slice(0,10); }
  };
  CS.clock = function(ms, tz){
    try{ return new Intl.DateTimeFormat("ko-KR",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(ms)); }
    catch(e){ var d=new Date(ms); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
  };
  CS.addDays = function(ymd, n){ var d=new Date(ymd+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };

  /* ── 예측 오차 로그 다시 계산 ──
     비교하기의 기록 방식(오차율 = Σ|오차|·(간격/60초) ÷ 주행 거리, 평균 = 시간가중)은 그대로 두고
     두 가지를 바로잡습니다.
       1. 궤적 위 자리가 한 번에 크게 튄 수신(왕복 궤적 출발점이 도착점으로 잡힌 것 등)은 오차 합에서 뺍니다.
       2. 주행 거리는 "처음 자리 → 마지막 자리" 가 아니라, 튄 곳을 끊고 이어 붙인 진행 거리입니다.
          (9/26 JIN — 첫 수신이 58.9 km(도착점)로 잡혀 거리가 0 이 되고 오차율이 비었던 문제)
     중간에 멈춘 주행(배터리 등)도 달린 만큼으로 계산됩니다. */
  CS.plogRecalc = function(S){
    var F=S.fixes||[];
    if(!F.length) return { distKm:S.distKm||0, errPct:S.errPct, meanErrM:S.meanErrM, skipped:0, n:0, src:"stored" };
    var prev=null, dist=0, seg=0, sumErr=0, sumGap=0, sumErrGap=0, skipped=0, restN=0, n=0;
    for(var i=0;i<F.length;i++){
      var f=F[i], fk=(typeof f.fixKm==="number")?f.fixKm:null, g=f.gapS||60, jump=false;
      if(prev!==null && fk!==null){
        var dk=fk-prev, lim=Math.max(1.0, 80*g/3600);           /* 80 km/h 보다 빨리 옮겨 가면 튄 것 */
        if(Math.abs(dk)>lim){ jump=true; dist+=Math.max(0,seg); seg=0; }
        else seg+=dk;
      }
      if(f.errM!==null && f.errM!==undefined){
        if(f.rest){ restN++; }
        else if(jump || prev===null){ skipped++; }
        else { sumErr+=f.errM/1000*g/60; sumGap+=g; sumErrGap+=f.errM*g; n++; }
      }
      if(fk!==null) prev=fk;
    }
    dist+=Math.max(0,seg);
    return { distKm:dist, errPct: dist>=0.05 ? sumErr/dist*100 : null,
             meanErrM: sumGap ? sumErrGap/sumGap : null, skipped:skipped, restN:restN, n:n, src:"recalc" };
  };

  /* 로그 합치기 — 같은 id·사람은 한 번만 (fixes 가 있는 쪽을 남김) */
  CS.plogMerge = function(lists){
    var m={}, out=[];
    lists.forEach(function(L){ (L||[]).forEach(function(S){
      if(!S||!S.start) return;
      var k=(S.who||"?")+"|"+(S.id||S.start), o=m[k];
      if(!o || ((S.fixes||[]).length > (o.fixes||[]).length)) m[k]=S;
    }); });
    for(var k in m) out.push(m[k]);
    out.sort(function(a,b){ return new Date(a.start)-new Date(b.start); });
    return out;
  };
  CS.plogLocal = function(){
    var a=[], b=[];
    try{ a=JSON.parse(localStorage.getItem(CS.KEY.plog)||"[]"); }catch(e){}
    try{ b=JSON.parse(localStorage.getItem(CS.KEY.plogImp)||"[]"); }catch(e){}
    return CS.plogMerge([a,b]);
  };
  /* 가져온 JSON({sessions:[...]} 또는 배열) 을 가져온 로그 칸에 더함 — 몇 개 늘었는지 돌려줌 */
  CS.plogImport = function(obj){
    var arr = Array.isArray(obj) ? obj : (obj&&obj.sessions) || [];
    var cur=[]; try{ cur=JSON.parse(localStorage.getItem(CS.KEY.plogImp)||"[]"); }catch(e){}
    var before=cur.length, merged=CS.plogMerge([cur, arr]);
    try{ localStorage.setItem(CS.KEY.plogImp, JSON.stringify(merged)); }
    catch(e){ /* 용량이 모자라면 수신 기록을 빼고 요약만 */
      localStorage.setItem(CS.KEY.plogImp, JSON.stringify(merged.map(function(S){ var c={}; for(var k in S) if(k!=="fixes") c[k]=S[k];
        var r=CS.plogRecalc(S); c.distKm=r.distKm; c.errPct=r.errPct; c.meanErrM=r.meanErrM; c.fixes=[]; return c; }))); }
    return merged.length-before;
  };

  /* ── 최근 7일 오차율 막대 ──
     그 사람 시간대로 날짜를 나누고, 하루에 여럿이면 가장 멀리 달린 것.
     endYmd 를 주지 않으면 그 사람 시간대의 오늘까지 7일. */
  CS.errDays = function(sessions, who, endYmd){
    var tz=CS.WHO[who].tz, end=endYmd||CS.ymd(Date.now(), tz), days={};
    sessions.filter(function(S){ return S.who===who; }).forEach(function(S){
      var r=CS.plogRecalc(S); if(r.errPct===null||r.errPct===undefined||r.distKm<3) return;
      var k=CS.ymd(new Date(S.start).getTime(), tz);
      if(!days[k] || r.distKm>days[k].r.distKm) days[k]={S:S, r:r};
    });
    var cols=[]; for(var i=6;i>=0;i--){ var k=CS.addDays(end,-i); cols.push({ymd:k, d:days[k]||null}); }
    return cols;
  };
  CS.errChartSvg = function(sessions, who, opt){
    opt=opt||{};
    var cols=CS.errDays(sessions, who, opt.endYmd), mx=0;
    cols.forEach(function(c){ if(c.d) mx=Math.max(mx, c.d.r.errPct); });
    var ink=opt.ink||"var(--ink)", soft=opt.soft||"#8A8474";
    if(!mx) return '<div style="font-size:.72rem;color:'+soft+';padding:6px 0">최근 7일 기록 없음 · '+CS.WHO[who].n+' ('+CS.WHO[who].place+' 날짜)</div>';
    mx=Math.max(mx, 10);
    var W=opt.w||280, H=opt.h||70, top=14, bw=W/7, h='<svg viewBox="0 0 '+W+' '+(H+top+20)+'" style="width:100%;display:block" role="img" aria-label="'+CS.WHO[who].n+' 최근 7일 예측 오차율">';
    /* 10 % · 20 % 기준선 */
    [10,20].forEach(function(v){ if(v<=mx){ var y=top+H-v/mx*H;
      h+='<line x1="0" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="#E4DFD0" stroke-dasharray="3 3"/>'
       +'<text x="'+(W-1)+'" y="'+(y-2)+'" font-size="8" text-anchor="end" fill="'+soft+'">'+v+'%</text>'; } });
    cols.forEach(function(c,i){
      var x=i*bw+5, w=bw-10, cx=x+w/2, md=c.ymd.slice(5).replace(/^0/,"").replace("-0","-").replace("-","/");
      if(c.d){
        var e=c.d.r.errPct, bh=Math.max(2,e/mx*H), col=e<=10?"#1E7A46":e<=20?"#D97706":"#B91C1C", y=top+H-bh;
        var tip=CS.WHO[who].n+" "+md+" · "+e.toFixed(1)+"% · 평균 "+(c.d.r.meanErrM!==null?Math.round(c.d.r.meanErrM)+" m":"—")
          +" · "+c.d.r.distKm.toFixed(1)+" km"+(c.d.S.done?"":" (중간 멈춤)")+(c.d.r.skipped>1?" · 튄 수신 "+(c.d.r.skipped-1)+"회 뺌":"");
        h+='<g><title>'+CS.esc(tip)+'</title><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+bh+'" rx="3" fill="'+col+'"'
          +(c.d.S.done?'':' fill-opacity=".55" stroke="'+col+'" stroke-dasharray="3 2"')+'/>'
          +'<text x="'+cx+'" y="'+(y-3)+'" font-size="9" font-weight="700" text-anchor="middle" fill="'+ink+'">'+e.toFixed(1)+'</text></g>';
        if(c.d.r.meanErrM!==null) h+='<text x="'+cx+'" y="'+(top+H+19)+'" font-size="7.5" text-anchor="middle" fill="'+soft+'">'+Math.round(c.d.r.meanErrM)+'m</text>';
      } else h+='<rect x="'+x+'" y="'+(top+H-2)+'" width="'+w+'" height="2" rx="1" fill="#E4DFD0"/>';
      h+='<text x="'+cx+'" y="'+(top+H+10)+'" font-size="9" text-anchor="middle" fill="'+soft+'">'+md+'</text>';
    });
    return h+'</svg>';
  };

  G.CaminoShared = CS;
})(window);
