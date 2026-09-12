/* Camino 2027 — 실시간 위치 · 고도 프로파일 · 지도 핀 */
/* ── 블록 12 ── */
/* ══════════════════════════════════════════════════════════════════════
   고도 프로파일 위 주행 표시 — BIN · JIN 따로
   · tool/camino-2027-profile-positions.json  픽셀 캘리브레이션
   · tool/camino-2027-profile-lut.json        누적 km → 고도
   · Drive db/progress.json                   실제 주행 기록
   그림은 4840×2530 이고, SVG 를 같은 viewBox 로 덮어 배율을 자동으로 맞춥니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var CAL=null, LUT=null, RIDES=[], svg=null, TESTING={};
  var WHO={ bin:{n:"BIN", c:"#1E5FB4", d:"#12407D"},
            jin:{n:"JIN", c:"#C92A2A", d:"#8E1F1F"} };
  var preview=null;                       /* 손으로 고른 미리보기 위치 */

  var $=function(id){ return document.getElementById(id); };
  var esc=function(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };

  function xOf(km){ return CAL.x_axis.km_0_px + km*CAL.x_axis.px_per_km; }
  function yOf(ele){ return CAL.y_axis.ele_0_px - ele*CAL.y_axis.px_per_m; }
  function eleAt(km){
    if(!LUT||!LUT.length) return 0;
    var lo=0, hi=LUT.length-1;
    if(km<=LUT[0][0]) return LUT[0][1];
    if(km>=LUT[hi][0]) return LUT[hi][1];
    while(hi-lo>1){ var m=(lo+hi)>>1; if(LUT[m][0]<=km) lo=m; else hi=m; }
    var a=LUT[lo], b=LUT[hi], t=(km-a[0])/((b[0]-a[0])||1);
    return a[1]+(b[1]-a[1])*t;
  }

  /* 사람별 가장 멀리 간 지점 */
  function latest(){
    var out={};
    RIDES.forEach(function(r){
      if(r.del) return;
      var w=r.owner||"bin";
      if(!out[w] || r.cumKm>out[w].cumKm) out[w]=r;
    });
    return out;
  }

  function marker(km, col, dark, label, lift){
    var ele=eleAt(km), x=xOf(km), y=yOf(ele), vl=CAL.vertical_line;
    var h='<line x1="'+x+'" y1="'+vl.y_min_px+'" x2="'+x+'" y2="'+vl.y_max_px_incl_bars+'" '
      +'stroke="'+col+'" stroke-width="7" opacity="0.85"/>'
      +'<circle cx="'+x+'" cy="'+y+'" r="34" fill="#FFFFFF" stroke="'+col+'" stroke-width="11"/>'
      +'<circle cx="'+x+'" cy="'+y+'" r="11" fill="'+col+'"/>';
    var w=label.length*27+62, lx=Math.min(Math.max(x-w/2,20), 4840-w-20);
    var ly=vl.y_min_px-96-(lift||0);
    h+='<rect x="'+lx+'" y="'+ly+'" width="'+w+'" height="76" rx="18" fill="'+col+'"/>'
      +'<path d="M'+(x-16)+' '+(ly+76)+' L'+(x+16)+' '+(ly+76)+' L'+x+' '+(ly+104)+' Z" '
      +'fill="'+col+'"/>'
      +'<text x="'+(lx+w/2)+'" y="'+(ly+52)+'" text-anchor="middle" '
      +'font-family="IBM Plex Sans KR, sans-serif" font-size="44" font-weight="700" '
      +'fill="#FFFFFF">'+esc(label)+'</text>';
    return h;
  }

  function draw(){
    if(!CAL||!svg) return;
    var L=latest(), h='', vl=CAL.vertical_line;
    var LV=(window.CAMINO_LIVE?window.CAMINO_LIVE.get().riders:null)||{};
    TESTING={};
    ["bin","jin"].forEach(function(w){
      var v=LV[w];
      if(!v || typeof v.km!=="number") return;
      if(v.test){ TESTING[w]=v; return; }      /* 시험 신호는 표시하지 않습니다 */
      if(!L[w] || v.km>L[w].cumKm)
        L[w]={cumKm:v.km, day:null, live:true, at:v.at, ele:v.ele, dist:0, asc:0};
    });
    var far=Math.max(preview!=null?preview:0,
                     L.bin?L.bin.cumKm:0, L.jin?L.jin.cumKm:0);

    if(far>0){
      h+='<rect x="'+CAL.x_axis.km_0_px+'" y="'+vl.y_min_px+'" '
        +'width="'+(xOf(far)-CAL.x_axis.km_0_px)+'" '
        +'height="'+(vl.y_max_px_incl_bars-vl.y_min_px)+'" fill="#1E7A46" opacity="0.08"/>';
    }
    CAL.days.forEach(function(d){
      if(d.rest) return;
      var passed=d.cum_km_end<=far+0.05;
      h+='<circle cx="'+d.end.x_px+'" cy="'+d.end.y_px+'" r="13" '
        +'fill="'+(passed?"#1E7A46":"#FFFFFF")+'" '
        +'stroke="'+(passed?"#14512B":"#B9B3A4")+'" stroke-width="5"/>';
    });

    /* 두 사람이 거의 같은 자리면 말풍선을 위아래로 어긋나게 */
    var both = L.bin && L.jin;
    var close = both && Math.abs(L.bin.cumKm-L.jin.cumKm) < 25;
    ["bin","jin"].forEach(function(w,i){
      var r=L[w]; if(!r) return;
      var m=WHO[w];
      var tag = r.live && window.CAMINO_LIVE && !window.CAMINO_LIVE.isStale(r) ? " ●" : "";
      /* 가까이 있으면 BIN 을 위로 올립니다 */
      h+=marker(r.cumKm, m.c, m.d,
        m.n+" "+r.cumKm.toFixed(1)+" km"+tag, close && i===0 ? 118 : 0);
    });

    if(preview!=null){
      h+='<line x1="'+xOf(preview)+'" y1="'+vl.y_min_px+'" '
        +'x2="'+xOf(preview)+'" y2="'+vl.y_max_px_incl_bars+'" '
        +'stroke="#8A7F63" stroke-width="5" stroke-dasharray="26 18" opacity="0.8"/>';
    }
    svg.innerHTML=h;
    paintPanel(L);
  }

  function paintPanel(L){
    var el=$("pgStat"); if(!el) return;
    var total=CAL.x_axis.km_total, h="";
    ["bin","jin"].forEach(function(w){
      var r=L[w], m=WHO[w];
      var km=r?r.cumKm:0, pct=total?km/total*100:0;
      var mine=RIDES.filter(function(x){ return !x.del && x.owner===w; });
      var t=TESTING[w];
      if(!r && t){
        h+='<div class="pgs '+w+'"><small>'+m.n+'</small><b>시험 중</b>'
          +'<i>노선에서 '+(t.off>1000?Math.round(t.off/1000)+" km":Math.round(t.off)+" m")+' 떨어짐</i>'
          +'<u>'+(window.CAMINO_LIVE?window.CAMINO_LIVE.ago(t):'')+' · 위치는 표시하지 않습니다</u></div>';
        return;
      }
      var liveTail = r&&r.live&&window.CAMINO_LIVE
        ? (window.CAMINO_LIVE.isStale(r)?"마지막 "+window.CAMINO_LIVE.ago(r)
                                        :"실시간 "+window.CAMINO_LIVE.ago(r)) : "";
      var dist=mine.reduce(function(s,x){ return s+(x.dist||0); },0);
      var asc =mine.reduce(function(s,x){ return s+(x.asc||0); },0);
      h+='<div class="pgs '+w+'">'
        +'<small>'+m.n+'</small>'
        +'<b>'+km.toFixed(1)+' km</b>'
        +'<i>'+(r?((liveTail||("DAY "+r.day))+" · "+pct.toFixed(1)+"%"):"아직 기록 없음")+'</i>'
        +'<div class="pgbar"><span style="width:'+pct.toFixed(2)+'%;background:'+m.c+'"></span></div>'
        +'<u>'+(mine.length?(mine.length+"일 · 실제 "+dist.toFixed(1)+" km · 고도 "
          +asc.toLocaleString()+" m"):"—")+'</u></div>';
    });
    var lead=null;
    if(L.bin&&L.jin){
      var gap=Math.abs(L.bin.cumKm-L.jin.cumKm);
      lead = gap<0.2 ? "나란히 가고 있습니다"
        : (L.bin.cumKm>L.jin.cumKm?"BIN":"JIN")+" 이 "+gap.toFixed(1)+" km 앞";
    }
    h+='<div class="pgs sum"><small>남은 거리</small>'
      +'<b>'+(total-Math.max(L.bin?L.bin.cumKm:0,L.jin?L.jin.cumKm:0)).toFixed(1)+' km</b>'
      +'<i>전체 '+total.toFixed(1)+' km</i>'
      +(lead?'<u>'+esc(lead)+'</u>':'<u>기록을 올리면 나타납니다</u>')+'</div>';
    el.innerHTML=h;
  }

  function build(){
    var box=$("pgBox"); if(!box) return;
    box.innerHTML=
       '<div class="pgwrap">'
      +'<img src="images/camino-2027-elevation-profile.svg" '
        +'alt="카미노 프란세스 고도 프로파일 · GPX 실측" loading="lazy" '
        +'onerror="if(!this.dataset.f){this.dataset.f=1;'
        +"this.src='images/camino-2027-elevation-profile.webp'}\">"
      +'<svg id="pgSvg" viewBox="0 0 4840 2530" preserveAspectRatio="xMidYMid meet" '
        +'aria-hidden="true"></svg></div>'
      +'<div class="pgstat" id="pgStat"></div>'
      +'<div class="pgctl">'
        +'<label>미리 보기 <small>· 기록과 상관없이 그 자리를 봅니다</small>'
        +'<select id="pgDay"><option value="">끄기</option>'
        + CAL.days.filter(function(d){ return !d.rest; }).map(function(d){
            return '<option value="'+d.cum_km_end+'">DAY '+d.day+' · '+esc(d.to)
              +' ('+d.cum_km_end.toFixed(1)+' km)</option>'; }).join("")
        +'</select></label>'
        +'<button type="button" id="pgLive">상대방 주행 위치 보기</button>'
        +'<button type="button" id="pgRl">기록 새로고침</button>'
      +'</div>'
      +'<p class="pgmsg" id="pgMsg">주행 기록은 <b>upload-camino.html → 🚴 주행 기록</b> 에서 '
        +'그날 GPX 를 올리면 채워집니다. BIN 은 파랑, JIN 은 빨강입니다.<br>'
        +'달리는 동안에는 <b>●</b> 표시와 함께 <b>실시간 위치</b>가 앞서 나갑니다 — '
        +'1분마다 새로 읽습니다.<br>'
        +'<small>스페인 노선 밖에서 보낸 신호는 <b>시험 중</b>으로만 알리고 '
        +'위치는 찍지 않습니다 — 엉뚱한 자리에 표시되는 것을 막기 위해서입니다.</small></p>';
    svg=$("pgSvg");
    $("pgDay").addEventListener("change",function(){
      preview = this.value==="" ? null : +this.value;
      draw();
    });
    $("pgLive").addEventListener("click",function(){
      var b=$("pgLive"), m=$("pgMsg");
      b.disabled=true; m.textContent="위치를 읽는 중…";
      var p = window.CAMINO_LIVE ? window.CAMINO_LIVE.refresh() : Promise.resolve(null);
      p.then(function(d){
        b.disabled=false;
        var r=(d&&d.riders)||{}, out=[];
        ["bin","jin"].forEach(function(w){
          var v=r[w]; if(!v||typeof v.km!=="number") return;
          var nm=WHO[w].n, tm=window.CAMINO_LIVE?window.CAMINO_LIVE.ago(v):"";
          if(v.test){
            var z=v.zone==="am"?"아메리카":v.zone==="as"?"아시아":"유럽";
            out.push('<b style="color:'+WHO[w].c+'">'+nm+'</b> 시험 중 · '+z+' · '+tm);
          }else{
            out.push('<b style="color:'+WHO[w].c+'">'+nm+'</b> '
                     +v.km.toFixed(1)+' km · '+tm);
          }
        });
        m.innerHTML = out.length
          ? out.join(" &nbsp;·&nbsp; ")
            +"<br><small>표지가 위 그림과 지도에 함께 나타납니다.</small>"
          : "아직 들어온 위치가 없습니다. 폰에서 OwnTracks 가 켜져 있는지 확인하세요.";
        draw();
      }).catch(function(e){
        b.disabled=false; m.textContent="읽지 못했습니다 — "+esc(e.message||e);
      });
    });

    $("pgRl").addEventListener("click",function(){
      var m=$("pgMsg"); m.textContent="기록을 다시 읽는 중…";
      loadRides().then(function(){ draw();
        m.textContent = RIDES.length ? "기록 "+RIDES.filter(function(r){return !r.del;}).length
          +"건을 읽었습니다." : "아직 올라온 기록이 없습니다."; })
        .catch(function(e){ m.textContent="⚠ "+e.message; });
    });
    draw();
  }

  function loadRides(){
    if(!window.CAMINO_DRIVE) return Promise.resolve();
    return window.CAMINO_DRIVE.files().then(function(files){
      var f=files.filter(function(x){ return x.name==="progress.json"; })[0];
      if(!f){ RIDES=[]; return; }
      return window.CAMINO_DRIVE.text(f.id).then(function(t){
        var j=null; try{ j=JSON.parse(t); }catch(e){}
        RIDES=(j&&j.rides)||[];
      });
    }).catch(function(){ RIDES=[]; });
  }

  function boot(){
    Promise.all([
      fetch("tool/camino-2027-profile-positions.json",{cache:"no-cache"}).then(function(r){
        if(!r.ok) throw new Error("positions.json 을 찾지 못했습니다"); return r.json(); }),
      fetch("tool/camino-2027-profile-lut.json",{cache:"no-cache"}).then(function(r){
        if(!r.ok) throw new Error("lut.json 을 찾지 못했습니다"); return r.json(); })
    ]).then(function(a){
      CAL=a[0]; LUT=(a[1]&&a[1].cum_km_ele)||[];
      build();
      return loadRides();
    }).then(function(){
      draw();
      if(window.CAMINO_LIVE) window.CAMINO_LIVE.on(draw);
    })
    .catch(function(e){
      var el=$("pgBox"); if(!el) return;
      el.innerHTML='<figure class="img-card"><img '
        +'src="images/camino-2027-elevation-profile.svg" alt="고도 프로파일" loading="lazy" '
        +'onerror="if(!this.dataset.f){this.dataset.f=1;'
        +"this.src='images/camino-2027-elevation-profile.webp'}\"></figure>"
        +'<p class="pgmsg">주행 표시를 켜려면 <b>tool/</b> 폴더에 '
        +'<b>camino-2027-profile-positions.json</b> 과 '
        +'<b>camino-2027-profile-lut.json</b> 을 넣어 주세요.<br>'
        +'<small style="color:var(--ink-soft)">'+esc(e.message)+'</small></p>';
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

/* ── 블록 13 ── */
/* ══════════════════════════════════════════════════════════════════════
   실시간 위치 — db/live.json 을 주기적으로 읽습니다
   좌표는 담겨 있지 않고 누적 km 만 있습니다.
   ══════════════════════════════════════════════════════════════════════ */
window.CAMINO_LIVE = (function(){
  "use strict";
  var data={riders:{}}, subs=[], timer=null, POLL=60000, STALE=45*60*1000;

  /* 앱스 스크립트에서 바로 읽으면 Drive·프록시 캐시를 거치지 않습니다. 비우면 Drive 만 읽습니다. */
  var EXEC="https://script.google.com/macros/s/AKfycbz_hOt0SGogE6jSKgqlFxPaLEGUJb-_3_f11m9rpOJNAQzk0Bu6GqFfSa2fVxjkF_Aoyw/exec";
  var KEY="camino2027-bin-jin-x7k2m9";
  function fetchExec(){
    return fetch(EXEC+"?k="+encodeURIComponent(KEY)+"&_="+Date.now(),{cache:"no-store",redirect:"follow"})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(j){
        var riders=j.riders || ((j.bin||j.jin)?j:null);
        if(!riders) throw new Error("shape");
        data={riders:riders}; return data;
      });
  }
  function fetchOnce(){
    if(EXEC) return fetchExec().catch(function(){ return fetchDrive(); });
    return fetchDrive();
  }
  function fetchDrive(){
    if(!window.CAMINO_DRIVE) return Promise.resolve(data);
    return window.CAMINO_DRIVE.files().then(function(files){
      /* live.json 이 여러 개면 가장 최근 것 — 스크립트가 덮어쓰지 않고 새로 만들면 생깁니다 */
      var f=files.filter(function(x){ return x.name==="live.json"; })
                 .sort(function(a,b){ return (b.modifiedTime||"")<(a.modifiedTime||"")?-1:1; })[0];
      if(!f) return data;
      return window.CAMINO_DRIVE.text(f.id).then(function(t){
        var j=null; try{ j=JSON.parse(t); }catch(e){}
        if(j && j.riders) data=j;
        return data;
      });
    }).catch(function(){ return data; });
  }
  function age(r){
    if(!r||!r.at) return Infinity;
    var t=new Date(r.at).getTime();
    return isNaN(t)?Infinity:(Date.now()-t);
  }
  function tell(){ subs.forEach(function(fn){ try{ fn(data); }catch(e){} }); }
  function start(){
    if(timer) return;
    fetchOnce().then(tell);
    timer=setInterval(function(){
      if(document.hidden) return;          /* 탭이 숨으면 쉽니다 */
      fetchOnce().then(tell);
    }, POLL);
    document.addEventListener("visibilitychange",function(){
      if(!document.hidden) fetchOnce().then(tell);
    });
  }
  return {
    on:function(fn){ subs.push(fn); if(data.riders) fn(data); start(); },
    refresh:function(){ return fetchOnce().then(function(d){ tell(); return d; }); },
    get:function(){ return data; },
    age:age,
    isStale:function(r){ return age(r)>STALE; },
    ago:function(r){
      var ms=age(r);
      if(!isFinite(ms)) return "";
      var m=Math.round(ms/60000);
      if(m<2) return "방금";
      if(m<60) return m+"분 전";
      var h=Math.round(m/60);
      return h<24 ? h+"시간 전" : Math.round(h/24)+"일 전";
    }
  };
})();

/* ══════════════════════════════════════════════════════════════════════
   전체 노선 지도 위 주행 핀 — BIN · JIN
   · tool/detail-v2-map-positions.json  노드 좌표 · 루트 폴리라인
   · Drive db/progress.json             실제 주행 기록
   원본 이미지는 그대로 두고 같은 크기의 SVG 를 덮습니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var MAP=null, RIDES=[], svg=null;
  var WHO={ bin:{n:"BIN", c:"#1E5FB4"}, jin:{n:"JIN", c:"#C92A2A"} };

  var $=function(id){ return document.getElementById(id); };
  var esc=function(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };

  /* 누적 km → 지도 좌표 (도식형이라 구간별 보간) */
  function pos(km){
    var ns=MAP.nodes.filter(function(n){ return !n.skip_for_interp; });
    var x;
    if(km<=ns[0].cum_km) x=ns[0].x_px;
    else if(km>=ns[ns.length-1].cum_km) x=ns[ns.length-1].x_px;
    else{
      for(var i=1;i<ns.length;i++){
        if(km<=ns[i].cum_km){
          var a=ns[i-1], b=ns[i], t=(km-a.cum_km)/((b.cum_km-a.cum_km)||1);
          x=a.x_px+(b.x_px-a.x_px)*t; break;
        }
      }
    }
    return {x:x, y:yOn(x)};
  }
  function yOn(x){
    var p=MAP.route_line.polyline;
    if(x<=p[0][0]) return p[0][1];
    if(x>=p[p.length-1][0]) return p[p.length-1][1];
    for(var i=1;i<p.length;i++){
      if(x<=p[i][0]){
        var a=p[i-1], b=p[i], t=(x-a[0])/((b[0]-a[0])||1);
        return a[1]+(b[1]-a[1])*t;
      }
    }
    return p[p.length-1][1];
  }

  function latest(){
    var out={};
    RIDES.forEach(function(r){
      if(r.del) return;
      var w=r.owner||"bin";
      if(!out[w] || r.cumKm>out[w].cumKm) out[w]=r;
    });
    return out;
  }

  function pin(km, col, label, top, live, stale){
    var p=pos(km), P=MAP.pin;
    var h=P.label_h_px, w=label.length*11+30;
    var lx=Math.min(Math.max(p.x-w/2, 8), MAP.image.width_px-w-8);
    return ''
      /* 노드까지 내려가는 선 */
      +'<line x1="'+p.x+'" y1="'+(top+h)+'" x2="'+p.x+'" y2="'+(p.y-9)+'" '
        +'stroke="'+col+'" stroke-width="3" opacity="0.85"/>'
      /* 지도 위 점 */
      +(live&&!stale ? '<circle cx="'+p.x+'" cy="'+p.y+'" r="17" fill="'+col+'" opacity="0.22">'
          +'<animate attributeName="r" values="11;20;11" dur="2.2s" repeatCount="indefinite"/>'
          +'<animate attributeName="opacity" values="0.32;0.05;0.32" dur="2.2s" '
          +'repeatCount="indefinite"/></circle>' : '')
      +'<circle cx="'+p.x+'" cy="'+p.y+'" r="9" fill="#FFFFFF" stroke="'+col+'" stroke-width="4"'
      +(stale?' opacity="0.55"':'')+'/>'
      +'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.4" fill="'+col+'"/>'
      /* 이름표 */
      +'<rect x="'+lx+'" y="'+top+'" width="'+w+'" height="'+h+'" rx="'+(h/2)+'" '
        +'fill="'+col+'"/>'
      +'<path d="M'+(p.x-6)+' '+(top+h)+' L'+(p.x+6)+' '+(top+h)+' L'+p.x+' '+(top+h+9)+' Z" '
        +'fill="'+col+'"/>'
      +'<text x="'+(lx+w/2)+'" y="'+(top+h/2+6)+'" text-anchor="middle" '
        +'font-family="IBM Plex Sans KR, sans-serif" font-size="17" font-weight="700" '
        +'fill="#FFFFFF">'+esc(label)+'</text>';
  }

  function draw(){
    if(!MAP||!svg) return;
    var L=latest(), P=MAP.pin, h='';
    /* 실시간 위치가 더 앞서면 그것을 씁니다 */
    var LV=(window.CAMINO_LIVE?window.CAMINO_LIVE.get().riders:null)||{};
    var TESTED={};
    ["bin","jin"].forEach(function(w){
      var v=LV[w];
      if(!v || typeof v.km!=="number") return;
      /* 노선 밖에서 보낸 시험 신호는 핀을 찍지 않습니다 —
         km 가 0 이라 생장에 서 버려 거짓말이 됩니다 */
      if(v.test){ TESTED[w]=v; return; }
      if(!L[w] || v.km>L[w].cumKm)
        L[w]={cumKm:v.km, day:null, live:true, at:v.at, ele:v.ele};
    });
    var any=L.bin||L.jin;

    /* 지나온 구간을 굵게 덧그림 */
    var far=Math.max(L.bin?L.bin.cumKm:0, L.jin?L.jin.cumKm:0);
    if(far>0){
      var p=MAP.route_line.polyline, d='', started=false, end=pos(far).x;
      for(var i=0;i<p.length;i++){
        if(p[i][0]>end) break;
        d+=(started?'L':'M')+p[i][0]+' '+p[i][1]+' '; started=true;
      }
      d+='L'+end+' '+yOn(end);
      h+='<path d="'+d+'" fill="none" stroke="#1E7A46" stroke-width="7" '
        +'stroke-linecap="round" opacity="0.55"/>';
    }
    /* 지나온 노드에 초록 표시 */
    MAP.nodes.forEach(function(n){
      if(n.day===0 || n.rest) return;
      if(n.cum_km<=far+0.05)
        h+='<circle cx="'+n.x_px+'" cy="'+n.y_px+'" r="6" fill="#1E7A46" '
          +'stroke="#FFFFFF" stroke-width="2"/>';
    });

    var both=L.bin&&L.jin;
    var close=both && Math.abs(L.bin.cumKm-L.jin.cumKm)<40;
    ["bin","jin"].forEach(function(w,i){
      var r=L[w]; if(!r) return;
      /* 가까이 있으면 BIN 을 한 칸 위로 올리고 JIN 은 제자리 —
         이름표 높이만큼 벌어져 겹치지 않습니다 */
      var top=P.leader_top_px-P.label_h_px;
      if(close && i===0) top-=P.label_h_px+4;
      var stale=r.live && window.CAMINO_LIVE && window.CAMINO_LIVE.isStale(r);
      h+=pin(r.cumKm, WHO[w].c, WHO[w].n+" "+r.cumKm.toFixed(1)+" km", top, r.live, stale);
    });

    svg.innerHTML=h;
    var note=$("mpNote");
    if(note){
      var testMsg="";
      ["bin","jin"].forEach(function(w){
        var v=TESTED[w]; if(!v) return;
        var far=v.off>1000 ? Math.round(v.off/1000)+" km" : Math.round(v.off)+" m";
        testMsg+='<span class="tst"><b style="color:'+WHO[w].c+'">'+WHO[w].n+'</b> 시험 중'
          +' · 노선에서 '+far+' 떨어짐'
          +(window.CAMINO_LIVE?' · '+window.CAMINO_LIVE.ago(v):'')+'</span>';
      });
      if(!any) note.innerHTML = testMsg
        || '주행 기록을 올리면 여기에 <b>BIN</b>·<b>JIN</b> 위치가 표시됩니다.';
      else{
        var t=[];
        ["bin","jin"].forEach(function(w){
          var r=L[w]; if(!r) return;
          var tail = r.live
            ? (window.CAMINO_LIVE
                ? (window.CAMINO_LIVE.isStale(r) ? '마지막 '+window.CAMINO_LIVE.ago(r)
                                                 : '실시간 · '+window.CAMINO_LIVE.ago(r))
                : '실시간')
            : (r.day?'DAY '+r.day:'');
          t.push('<b style="color:'+WHO[w].c+'">'+WHO[w].n+'</b> '
            +r.cumKm.toFixed(1)+' km'+(tail?' · '+tail:''));
        });
        note.innerHTML=t.join(' &nbsp;·&nbsp; ')+(testMsg?'<br>'+testMsg:'');
      }
    }
  }

  function loadRides(){
    if(!window.CAMINO_DRIVE) return Promise.resolve();
    return window.CAMINO_DRIVE.files().then(function(files){
      var f=files.filter(function(x){ return x.name==="progress.json"; })[0];
      if(!f){ RIDES=[]; return; }
      return window.CAMINO_DRIVE.text(f.id).then(function(t){
        var j=null; try{ j=JSON.parse(t); }catch(e){}
        RIDES=(j&&j.rides)||[];
      });
    }).catch(function(){ RIDES=[]; });
  }

  function boot(){
    var fig=document.querySelector("figure.detail-map");
    if(!fig) return;
    var img=fig.querySelector("img"); if(!img) return;

    fetch("tool/detail-v2-map-positions.json",{cache:"no-cache"})
      .then(function(r){ if(!r.ok) throw new Error("좌표 파일 없음"); return r.json(); })
      .then(function(j){
        MAP=j;
        var wrap=document.createElement("div");
        wrap.className="mpwrap";
        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        var s=document.createElementNS("http://www.w3.org/2000/svg","svg");
        s.setAttribute("viewBox","0 0 "+MAP.image.width_px+" "+MAP.image.height_px);
        s.setAttribute("preserveAspectRatio","xMidYMid meet");
        s.setAttribute("aria-hidden","true");
        s.id="mpSvg";
        wrap.appendChild(s);
        svg=s;
        var n=document.createElement("p");
        n.className="mpnote"; n.id="mpNote";
        fig.insertBefore(n, fig.querySelector("figcaption"));
        draw();
        return loadRides();
      })
      .then(function(){
        draw();
        if(window.CAMINO_LIVE) window.CAMINO_LIVE.on(draw);
      })
      .catch(function(){ /* 좌표 파일이 없으면 지도만 그대로 */ });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

/* ── 블록 14 ── */
/* ══════════════════════════════════════════════════════════════════════
   전체 개요 그림(camino-frances-bike-2027.webp) 위 주행 위치
   · 이 그림은 오른쪽이 생장(0 km), 왼쪽이 산티아고(793.6 km)
   · 위쪽 지도와 아래쪽 고도 프로파일 두 곳에 함께 찍습니다
   · 원본 이미지는 손대지 않고 같은 크기의 SVG 를 덮습니다
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var CFG=null, svg=null, RIDES=[];
  var WHO={ bin:{n:"BIN", c:"#1E5FB4"}, jin:{n:"JIN", c:"#C92A2A"} };

  var $=function(id){ return document.getElementById(id); };
  var esc=function(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };

  /* ── km → 좌표 ── */
  function mapPos(km){
    var n=CFG.map.nodes;
    if(km<=n[0].cum_km) return {x:n[0].x_px, y:n[0].y_px};
    if(km>=n[n.length-1].cum_km)
      return {x:n[n.length-1].x_px, y:n[n.length-1].y_px};
    for(var i=1;i<n.length;i++){
      if(km<=n[i].cum_km){
        var a=n[i-1], b=n[i], t=(km-a.cum_km)/((b.cum_km-a.cum_km)||1);
        return {x:a.x_px+(b.x_px-a.x_px)*t, y:a.y_px+(b.y_px-a.y_px)*t};
      }
    }
    return {x:n[0].x_px, y:n[0].y_px};
  }
  function profX(km){
    /* 그림에 인쇄된 축은 782.4 km 기준이라 실제 거리를 그 비율로 줄여 찍습니다 */
    var P=CFG.profile, sc=(P.total_km_printed && P.total_km_actual)
      ? P.total_km_printed/P.total_km_actual : 1;
    return P.km_to_x.a*(km*sc) + P.km_to_x.b;
  }
  function profY(x){
    var p=CFG.profile.ridge;
    if(x<=p[0][0]) return p[0][1];
    if(x>=p[p.length-1][0]) return p[p.length-1][1];
    for(var i=1;i<p.length;i++){
      if(x<=p[i][0]){
        var a=p[i-1], b=p[i], t=(x-a[0])/((b[0]-a[0])||1);
        return a[1]+(b[1]-a[1])*t;
      }
    }
    return CFG.profile.baseline_y_px;
  }

  /* ── 어디에 찍을지 정하기 ── */
  function positions(){
    var out={};
    var LV=(window.CAMINO_LIVE?window.CAMINO_LIVE.get().riders:null)||{};
    /* 올려 둔 주행 기록 */
    RIDES.forEach(function(r){
      if(r.del) return;
      var w=r.owner||"bin";
      if(!out[w] || r.cumKm>out[w].km) out[w]={km:r.cumKm, live:false, day:r.day};
    });
    /* 실시간 */
    ["bin","jin"].forEach(function(w){
      var v=LV[w]; if(!v || typeof v.km!=="number") return;
      if(v.test){
        /* 시험 중 — 대륙에 따라 양 끝에 세웁니다 */
        var z=CFG.test_zone_km[v.zone];
        if(z===undefined) z=0;          /* 모르는 대륙도 생장에 세웁니다 */
        out[w]={km:z, live:true, test:true, at:v.at, zone:v.zone};
      }else if(!out[w] || v.km>out[w].km){
        out[w]={km:v.km, live:true, at:v.at, ele:v.ele};
      }
    });
    return out;
  }

  function chip(x, y, col, text, small){
    var fs = small ? 21 : 25;
    var w = text.length*(small?12:14)+26, h = small?30:36;
    var lx=Math.min(Math.max(x-w/2, 6), CFG.image.width_px-w-6);
    return '<rect x="'+lx+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(h/2)+'" '
      +'fill="'+col+'"/>'
      +'<path d="M'+(x-6)+' '+(y+h)+' L'+(x+6)+' '+(y+h)+' L'+x+' '+(y+h+9)+' Z" '
      +'fill="'+col+'"/>'
      +'<text x="'+(lx+w/2)+'" y="'+(y+h/2+fs*0.36)+'" text-anchor="middle" '
      +'font-family="IBM Plex Sans KR, sans-serif" font-size="'+fs+'" font-weight="700" '
      +'fill="#FFFFFF">'+esc(text)+'</text>';
  }

  function draw(){
    if(!CFG||!svg) return;
    var P=positions(), h='';
    var order=["bin","jin"], any=false;

    order.forEach(function(w,i){
      var p=P[w]; if(!p) return;
      any=true;
      var m=WHO[w], col=m.c;
      var stale = p.live && window.CAMINO_LIVE && window.CAMINO_LIVE.isStale(p);
      var op = stale ? 0.5 : 1;

      /* ── 위 지도 ── */
      var mp=mapPos(p.km);
      var chipY = mp.y - CFG.map.chip_dy_px - 36 - (i===0 ? 44 : 0);
      h+='<g opacity="'+op+'">'
        +'<line x1="'+mp.x+'" y1="'+(chipY+36+9)+'" x2="'+mp.x+'" y2="'+(mp.y-11)+'" '
          +'stroke="'+col+'" stroke-width="4"/>'
        + (p.live && !stale
            ? '<circle cx="'+mp.x+'" cy="'+mp.y+'" r="16" fill="'+col+'" opacity="0.25">'
              +'<animate attributeName="r" values="11;22;11" dur="2.2s" repeatCount="indefinite"/>'
              +'<animate attributeName="opacity" values="0.35;0.05;0.35" dur="2.2s" '
              +'repeatCount="indefinite"/></circle>' : '')
        +'<circle cx="'+mp.x+'" cy="'+mp.y+'" r="11" fill="#FFFFFF" stroke="'+col+'" stroke-width="5"/>'
        +'<circle cx="'+mp.x+'" cy="'+mp.y+'" r="4" fill="'+col+'"/>'
        + chip(mp.x, chipY, col, m.n + (p.test ? " 시험" : ""), true)
        +'</g>';

      /* ── 아래 고도 프로파일 ── */
      var px=profX(p.km), py=profY(px);
      var lab = m.n+" "+p.km.toFixed(1)+" km";
      var cy = CFG.profile.label_y_px - (i===0 ? 44 : 0);
      h+='<g opacity="'+op+'">'
        +'<line x1="'+px+'" y1="'+(cy+36+9)+'" x2="'+px+'" y2="'+CFG.profile.baseline_y_px+'" '
          +'stroke="'+col+'" stroke-width="4" opacity="0.85"/>'
        +'<circle cx="'+px+'" cy="'+py+'" r="10" fill="#FFFFFF" stroke="'+col+'" stroke-width="5"/>'
        +'<circle cx="'+px+'" cy="'+py+'" r="3.5" fill="'+col+'"/>'
        + chip(px, cy, col, lab, false)
        +'</g>';
    });

    svg.innerHTML=h;

    var note=$("ovNote");
    if(note){
      if(!any){ note.innerHTML='주행 기록을 올리거나 실시간 위치가 들어오면 '
        +'<b>BIN</b>·<b>JIN</b> 이 여기에 표시됩니다.'; return; }
      var t=[];
      order.forEach(function(w){
        var p=P[w]; if(!p) return;
        var tail = p.test
          ? "시험 중 · " + (p.zone==="am" ? "아메리카" : p.zone==="as" ? "아시아" : "유럽")
          : (p.live
              ? (window.CAMINO_LIVE
                  ? (window.CAMINO_LIVE.isStale(p) ? "마지막 "+window.CAMINO_LIVE.ago(p)
                                                   : "실시간 "+window.CAMINO_LIVE.ago(p))
                  : "실시간")
              : (p.day ? "DAY "+p.day : ""));
        t.push('<b style="color:'+WHO[w].c+'">'+WHO[w].n+'</b> '
          +p.km.toFixed(1)+' km'+(tail?' · '+tail:''));
      });
      note.innerHTML=t.join(' &nbsp;·&nbsp; ');
    }
  }

  function loadRides(){
    if(!window.CAMINO_DRIVE) return Promise.resolve();
    return window.CAMINO_DRIVE.files().then(function(files){
      var f=files.filter(function(x){ return x.name==="progress.json"; })[0];
      if(!f) return;
      return window.CAMINO_DRIVE.text(f.id).then(function(t){
        var j=null; try{ j=JSON.parse(t); }catch(e){}
        RIDES=(j&&j.rides)||[];
      });
    }).catch(function(){});
  }

  function boot(){
    var fig=document.querySelector("figure.overview-map");
    if(!fig) return;
    var img=fig.querySelector("img"); if(!img) return;
    fetch("tool/overview-map-positions.json",{cache:"no-cache"})
      .then(function(r){ if(!r.ok) throw new Error("좌표 파일 없음"); return r.json(); })
      .then(function(j){
        CFG=j;
        var wrap=document.createElement("div");
        wrap.className="ovwrap";
        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        var s=document.createElementNS("http://www.w3.org/2000/svg","svg");
        s.setAttribute("viewBox","0 0 "+CFG.image.width_px+" "+CFG.image.height_px);
        s.setAttribute("preserveAspectRatio","xMidYMid meet");
        s.setAttribute("aria-hidden","true");
        s.id="ovSvg"; wrap.appendChild(s); svg=s;
        var n=document.createElement("p");
        n.className="ovnote"; n.id="ovNote";
        fig.appendChild(n);
        draw();
        return loadRides();
      })
      .then(function(){
        draw();
        if(window.CAMINO_LIVE) window.CAMINO_LIVE.on(draw);
      })
      .catch(function(){ /* 좌표 파일이 없으면 그림만 그대로 */ });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

/* ── 블록 15 ── */
/* ══════════════════════════════════════════════════════════════════════
   날짜 카드의 고도 프로파일 — 노면 색으로 칠하고 BIN·JIN 위치도 얹습니다
     route/camino-2027-dayNN.gpx     좌표와 고도
     tool/surface-segments.json      노면 분류
   화면에 들어올 때만 읽습니다 (12일치를 한꺼번에 받지 않도록).
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var SEG=null, GPX={}, CUM={}, ELE={}, RIDES=[], ready=false;
  var COLOR=["#16a34a","#eab308","#f97316","#dc2626","#9ca3af"];
  var KNAME=["포장","다짐","자갈","거친 길","자료 없음"];
  var WHO={bin:{n:"BIN",c:"#1E5FB4"}, jin:{n:"JIN",c:"#C92A2A"}};
  /* 중간 경유지 — [한글, 원어, lat, lon]. 그날 GPX 에 투영해 km 를 구하고, 노선에서 800 m 넘게 떨어지면 뺍니다 */
  var VIA={
    1:[["생 미셸","Saint-Michel",43.1134,-1.2366],["최고점 1,240 m","우회로 정상",43.0299,-1.2278,"pass"],["론세스바예스","Roncesvalles",43.0092,-1.3195]],   /* 우회로 — 오리손·발카를로스는 지나지 않음 */
    2:[["팜플로나","Pamplona",42.8169,-1.6432],["페르돈 고개","Alto del Perdón · 자전거 도로 고갯마루",42.7457,-1.7241,"pass"],["푸엔테 라 레이나","Puente la Reina",42.6720,-1.8150]],
    3:[["로스 아르코스","Los Arcos",42.5686,-2.1920],["로그로뇨","Logroño",42.4650,-2.4450]],
    4:[["나헤라","Nájera",42.4165,-2.7330],["산토 도밍고","Santo Domingo de la Calzada",42.4405,-2.9535]],
    5:[["오카 산","Montes de Oca · N-120 고갯길",42.3689,-3.3724,"pass"],["산 후안 데 오르테가","San Juan de Ortega",42.3760,-3.4370],["부르고스","Burgos",42.3410,-3.7040],["오르니요스","Hornillos del Camino",42.3386,-3.9250]],
    6:[["프로미스타","Frómista",42.2670,-4.4060],["카리온","Carrión de los Condes",42.3380,-4.6030],["칼사디야","Calzadilla de la Cueza",42.3245,-4.8000]],
    7:[["엘 부르고 라네로","El Burgo Ranero",42.4230,-5.2200],["만시야","Mansilla de las Mulas",42.4990,-5.4170]],
    9:[["산 마르틴","San Martín del Camino",42.5000,-5.8090],["아스토르가","Astorga",42.4575,-6.0560]],
    10:[["철의 십자가","Cruz de Ferro · 1,500 m",42.4899,-6.3527,"pass"],["몰리나세카","Molinaseca",42.5385,-6.5245],["폰페라다","Ponferrada",42.5460,-6.5920],["카카벨로스","Cacabelos",42.6000,-6.7230]],
    11:[["오 세브레이로","O Cebreiro · 1,300 m",42.7080,-7.0430,"pass"],["알토 도 포이오","Alto do Poio · 1,335 m",42.7345,-7.1667,"pass"],["트리아카스텔라","Triacastela",42.7560,-7.2400]],
    12:[["포르토마린","Portomarín",42.8075,-7.6160],["팔라스 데 레이","Palas de Rei",42.8730,-7.8690],["멜리데","Melide",42.9145,-8.0140]],
    13:[["오 페드로우소","O Pedrouzo",42.9060,-8.3620],["몬테 도 고소","Monte do Gozo",42.8880,-8.4980]]
  };
  function viaFor(d){
    var pts=GPX[d], C=CUM[d]; if(!pts||!(VIA[d]||[]).length) return [];
    var out=[];
    VIA[d].forEach(function(v){
      var best=Infinity, bi=0, cl=Math.cos(v[2]*Math.PI/180);
      for(var i=0;i<pts.length;i+=2){
        var dy=(pts[i][0]-v[2])*111320, dx=(pts[i][1]-v[3])*111320*cl, dd=dx*dx+dy*dy;
        if(dd<best){ best=dd; bi=i; }
      }
      if(Math.sqrt(best)<=800) out.push({n:v[0], sub:v[1], m:C[bi], i:bi, pass:v[4]==="pass"});
    });
    out.sort(function(a,b){ return a.m-b.m; });
    return out;
  }
  var CITY={1:["생장","수비리"],2:["수비리","에스테야"],3:["에스테야","나바레테"],
    4:["나바레테","벨로라도"],5:["벨로라도","카스트로헤리스"],6:["카스트로헤리스","사아군"],
    7:["사아군","레온"],9:["레온","라바날"],10:["라바날","베가 데 발카르세"],
    11:["베가 데 발카르세","사리아"],12:["사리아","아르수아"],13:["아르수아","산티아고"]};
  var CUMK={1:[0.0,59.9],2:[59.9,125.9],3:[125.9,187.2],4:[187.2,245.9],5:[245.9,335.9],6:[335.9,418.2],7:[418.2,472.9],9:[472.9,541.8],10:[541.8,616.1],11:[616.1,678.4],12:[678.4,754.7],13:[754.7,793.6]};

  function esc(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function hav(a,b){
    var R=6371000, r=Math.PI/180;
    var dla=(b[0]-a[0])*r, dlo=(b[1]-a[1])*r;
    var h=Math.sin(dla/2)*Math.sin(dla/2)
        + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dlo/2)*Math.sin(dlo/2);
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function niceStep(range, want){
    var raw=range/want, p=Math.pow(10, Math.floor(Math.log10(raw))), n=raw/p;
    return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p;
  }

  function loadGpx(d){
    if(GPX[d]) return Promise.resolve(true);
    var url="route/camino-2027-day"+(d<10?"0":"")+d+".gpx";
    return fetch(url,{cache:"force-cache"}).then(function(r){
      if(!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function(t){
      var doc=new DOMParser().parseFromString(t,"application/xml");
      var n=doc.getElementsByTagName("trkpt"), pts=[], ele=[];
      for(var i=0;i<n.length;i++){
        var la=parseFloat(n[i].getAttribute("lat")), lo=parseFloat(n[i].getAttribute("lon"));
        if(isNaN(la)||isNaN(lo)) continue;
        pts.push([la,lo]);
        var e=n[i].getElementsByTagName("ele")[0];
        ele.push(e ? (parseFloat(e.textContent)||0) : 0);
      }
      var cum=[0];
      for(var j=1;j<pts.length;j++) cum.push(cum[j-1]+hav(pts[j-1],pts[j]));
      GPX[d]=pts; CUM[d]=cum; ELE[d]=ele;
      return true;
    });
  }

  /* 그날 화면에 얹을 BIN·JIN */
  function marksFor(d){
    var out=[];
    var LV=(window.CAMINO_LIVE ? window.CAMINO_LIVE.get().riders : null) || {};
    ["bin","jin"].forEach(function(w){
      var km=null, live=false;
      RIDES.forEach(function(r){
        if(r.del || (r.owner||"bin")!==w) return;
        if(km===null || r.cumKm>km) km=r.cumKm;
      });
      var v=LV[w];
      if(v && typeof v.km==="number" && !v.test && (km===null || v.km>km)){
        km=v.km; live=true;
      }
      if(km===null || !CUMK[d]) return;
      var rel=km-CUMK[d][0], span=CUMK[d][1]-CUMK[d][0];
      if(rel<-0.15 || rel>span+0.15) return;
      out.push({w:w, m:Math.max(0,rel)*1000, c:WHO[w].c,
                t:WHO[w].n+" "+km.toFixed(1), live:live});
    });
    if(out.length===2){
      var span2=(CUMK[d][1]-CUMK[d][0])*1000;
      if(Math.abs(out[0].m-out[1].m) < span2*0.12) out[1].row=1;
    }
    out.forEach(function(o){ if(o.row===undefined) o.row=0; });
    return out;
  }

  function render(box, d){
    var pts=GPX[d], C=CUM[d], E=ELE[d];
    if(!pts||!C||!E||E.length!==pts.length){ box.innerHTML=""; return false; }
    var W=box.clientWidth, H=box.clientHeight;
    if(W<120||H<70) return false;   /* 아직 화면에 크기가 없습니다 */
    var PL=44, PR=12, PT=30, PB=19;
    var iw=W-PL-PR, ih=H-PT-PB, tot=C[C.length-1];

    var lo=Infinity, hi=-Infinity, i;
    for(i=0;i<E.length;i++){ if(E[i]<lo)lo=E[i]; if(E[i]>hi)hi=E[i]; }
    if(hi-lo<80) hi=lo+80;
    var eStep=niceStep(hi-lo,3);
    lo=Math.floor(lo/eStep)*eStep;
    hi=Math.ceil((hi+eStep*0.15)/eStep)*eStep;

    var X=function(m){ return PL+iw-(m/tot)*iw; };      /* 오른쪽이 출발 */
    var Y=function(e){ return PT+(1-(e-lo)/(hi-lo))*ih; };
    var F=function(n){ return n.toFixed(1); };

    var h='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" '
      +'aria-label="DAY '+d+' 고도와 노면">';
    for(var e=lo; e<=hi+0.1; e+=eStep){
      var y=Y(e);
      h+='<line x1="'+PL+'" y1="'+F(y)+'" x2="'+(PL+iw)+'" y2="'+F(y)
        +'" stroke="#EAE6D8" stroke-width="1"/>'
        +'<text class="dp-ax" x="'+(PL-6)+'" y="'+F(y+3.5)+'" text-anchor="end">'
        +Math.round(e).toLocaleString()+'</text>';
    }
    h+='<text class="dp-ax" x="'+(PL-6)+'" y="'+(PT-8)+'" text-anchor="end">고도 m</text>';

    var info=SEG && SEG.days && SEG.days[d];
    if(info && info.runs && info.runs.length){
      var k0=0;
      info.runs.forEach(function(r){
        var k=r[0], n=r[1], a=k0, b=Math.min(k0+n, E.length-1);
        if(b>a){
          var dpath="M"+F(X(C[a]))+" "+F(PT+ih), st=Math.max(1,Math.floor((b-a)/160));
          for(var j=a;j<=b;j+=st) dpath+="L"+F(X(C[j]))+" "+F(Y(E[j]));
          dpath+="L"+F(X(C[b]))+" "+F(Y(E[b]))+"L"+F(X(C[b]))+" "+F(PT+ih)+"Z";
          h+='<path d="'+dpath+'" fill="'+COLOR[k]+'" opacity="0.8"/>';
        }
        k0+=n;
      });
    }else{
      var dp="M"+F(X(0))+" "+F(PT+ih), s2=Math.max(1,Math.floor(E.length/400));
      for(i=0;i<E.length;i+=s2) dp+="L"+F(X(C[i]))+" "+F(Y(E[i]));
      dp+="L"+F(X(tot))+" "+F(PT+ih)+"Z";
      h+='<path d="'+dp+'" fill="#9ca3af" opacity="0.65"/>';
    }
    var line="", s3=Math.max(1,Math.floor(E.length/500));
    for(i=0;i<E.length;i+=s3) line+=(line?"L":"M")+F(X(C[i]))+" "+F(Y(E[i]));
    h+='<path d="'+line+'" fill="none" stroke="#3F5C3A" stroke-width="1.2" opacity=".7"/>';

    var km=tot/1000, dStep=niceStep(km,5);
    h+='<line x1="'+PL+'" y1="'+F(PT+ih)+'" x2="'+(PL+iw)+'" y2="'+F(PT+ih)
      +'" stroke="#CFC9B6" stroke-width="1"/>';
    for(var t2=0; t2<=km+0.01; t2+=dStep){
      var x2=X(t2*1000);
      h+='<line x1="'+F(x2)+'" y1="'+F(PT+ih)+'" x2="'+F(x2)+'" y2="'+F(PT+ih+4)
        +'" stroke="#CFC9B6" stroke-width="1"/>'
        +'<text class="dp-ax" x="'+F(x2)+'" y="'+(PT+ih+14)+'" text-anchor="middle">'
        +(dStep<1?t2.toFixed(1):Math.round(t2))+'</text>';
    }
    h+='<text class="dp-ax" x="'+(PL-6)+'" y="'+(PT+ih+14)+'" text-anchor="end">km</text>';

    var c=CITY[d]||["출발","도착"], k2=CUMK[d]||[0,0];
    function stem(m, name, sub, col, side){
      var x=X(m), anchor=(side==="right"?"end":"start"), dx=(side==="right"?-6:6);
      return '<line x1="'+F(x)+'" y1="'+(PT-2)+'" x2="'+F(x)+'" y2="'+F(PT+ih)
        +'" stroke="'+col+'" stroke-width="1.5" opacity=".8"/>'
        +'<circle cx="'+F(x)+'" cy="'+F(Y(m===0?E[0]:E[E.length-1]))+'" r="4" '
        +'fill="#fff" stroke="'+col+'" stroke-width="2.2"/>'
        +'<text class="dp-name" x="'+F(x+dx)+'" y="'+(PT-15)+'" text-anchor="'+anchor
        +'" fill="'+col+'">'+esc(name)+'</text>'
        +'<text class="dp-ax" x="'+F(x+dx)+'" y="'+(PT-5)+'" text-anchor="'+anchor+'">'
        +esc(sub)+'</text>';
    }
    h+=stem(0, c[0], k2[0].toFixed(1)+" km", d===1?"#1E7A46":"#6B7280", "right");
    h+=stem(tot, c[1], k2[1].toFixed(1)+" km", d===13?"#8E2C3A":"#152A55", "left");

    /* 중간 경유지 — 세로선 · 고도와 만나는 자리에 동그라미 · 이름과 그날 km.
       이웃과 가까우면 이름을 그래프 안쪽 줄로 내려 겹치지 않게 */
    var vias=viaFor(d), lastX=-1e9, vcol="#7A5EA8";
    vias.forEach(function(v){
      var x=X(v.m), inner = (Math.abs(x-lastX) < 90), col = v.pass ? "#8E2C3A" : vcol;
      lastX = inner ? lastX : x;
      var ny = inner ? PT+13 : PT-15, ky = inner ? PT+24 : PT-5;
      h+='<line x1="'+F(x)+'" y1="'+(inner?PT+28:PT-2)+'" x2="'+F(x)+'" y2="'+F(PT+ih)
        +'" stroke="'+col+'" stroke-width="1.2" stroke-dasharray="3 3" opacity=".85"/>'
        +'<circle cx="'+F(x)+'" cy="'+F(Y(E[v.i]))+'" r="3.6" fill="#fff" stroke="'+col+'" stroke-width="2"/>'
        +'<text class="dp-name" x="'+F(x)+'" y="'+ny+'" text-anchor="middle" fill="'+col
        +'" style="paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round">'+(v.pass?"⛰ ":"")+esc(v.n)+'</text>'
        +'<text class="dp-ax" x="'+F(x)+'" y="'+ky+'" text-anchor="middle" style="paint-order:stroke;stroke:#fff;stroke-width:3px">'
        +(v.m/1000).toFixed(1)+' km</text>';
    });

    marksFor(d).forEach(function(mk){
      var x=X(mk.m), ei=0;
      for(var j=1;j<C.length;j++){ ei=j; if(C[j]>=mk.m) break; }
      var ey=Y(E[ei]), lh=18, ly=3+(mk.row||0)*(lh+3);
      h+='<line x1="'+F(x)+'" y1="'+(ly+lh)+'" x2="'+F(x)+'" y2="'+F(ey)
        +'" stroke="'+mk.c+'" stroke-width="2"/>'
        +'<circle cx="'+F(x)+'" cy="'+F(ey)+'" r="5.5" fill="#fff" stroke="'+mk.c
        +'" stroke-width="2.8"/>';
      var w=mk.t.length*7+16, lx=Math.min(Math.max(x-w/2,PL),PL+iw-w);
      h+='<rect x="'+F(lx)+'" y="'+ly+'" width="'+F(w)+'" height="'+lh+'" rx="'+(lh/2)
        +'" fill="'+mk.c+'"/>'
        +'<text class="dp-lab" x="'+F(lx+w/2)+'" y="'+(ly+12.5)+'" text-anchor="middle">'
        +esc(mk.t)+(mk.live?" ●":"")+'</text>';
    });
    h+='</svg>';
    box.innerHTML=h;
    box.dataset.drawn="1";
    return true;
  }

  function fill(box){
    var d=+box.dataset.day;
    if(box.dataset.busy) return;
    box.dataset.busy="1";
    loadGpx(d).then(function(){
      box.dataset.busy=""; box.dataset.ready="1";
      render(box,d);            /* 폭이 0 이면 그리지 못하지만 자료는 남습니다 */
    }).catch(function(){ box.dataset.busy="";
      box.innerHTML='<p class="dp-none">고도 자료를 읽지 못했습니다</p>'; });
  }

  /* 상자에 크기가 생기는 순간 그립니다 — 탭으로 숨어 있다가 나타나는 경우 */
  var ro = ("ResizeObserver" in window) ? new ResizeObserver(function(ents){
    ents.forEach(function(en){
      var b=en.target, w=en.contentRect.width;
      if(w<120) return;
      var d=+b.dataset.day;
      if(!b.dataset.ready){ fill(b); return; }
      render(b,d);
    });
  }) : null;

  function boot(){
    var cards=document.querySelectorAll("article.dcard[id^=day]");
    if(!cards.length) return;

    Promise.all([
      fetch("tool/surface-segments.json",{cache:"no-cache"})
        .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
      (window.CAMINO_DRIVE ? window.CAMINO_DRIVE.files().then(function(f){
        var x=f.filter(function(y){ return y.name==="progress.json"; })[0];
        if(!x) return null;
        return window.CAMINO_DRIVE.text(x.id).then(function(t){
          try{ return JSON.parse(t); }catch(e){ return null; } });
      }).catch(function(){ return null; }) : Promise.resolve(null))
    ]).then(function(a){
      SEG=a[0];
      RIDES=(a[1] && a[1].rides) || [];
      ready=true;

      Array.prototype.forEach.call(cards, function(card){
        var n=+(card.id.replace("day","")); if(!n || n===8) return;
        var fig=card.querySelector("figure.dmapreal");
        if(!fig) return;
        var box=document.createElement("div");
        box.className="dprof"; box.dataset.day=String(n);
        /* .dbody 안에 두고 순서는 CSS order 로 잡습니다 —
           좁은 화면은 지도 다음·QR 앞, 넓은 화면은 둘 아래 한 줄 전체. */
        fig.insertAdjacentElement("afterend", box);
      });

      var boxes=document.querySelectorAll(".dprof");
      if("IntersectionObserver" in window){
        var io=new IntersectionObserver(function(ents){
          ents.forEach(function(en){
            if(!en.isIntersecting) return;
            var b=en.target;
            if(b.dataset.drawn){ io.unobserve(b); return; }
            fill(b);              /* 그려질 때까지 계속 지켜봅니다 */
          });
        },{rootMargin:"300px"});
        Array.prototype.forEach.call(boxes, function(b){ io.observe(b); });
      }else Array.prototype.forEach.call(boxes, fill);
      if(ro) Array.prototype.forEach.call(boxes, function(b){ ro.observe(b); });

      var rz=null;
      window.addEventListener("resize", function(){
        clearTimeout(rz);
        rz=setTimeout(function(){
          Array.prototype.forEach.call(document.querySelectorAll(".dprof"), function(b){
            if(GPX[+b.dataset.day]) render(b, +b.dataset.day); else fill(b);
          });
        }, 250);
      });

      if(window.CAMINO_LIVE) window.CAMINO_LIVE.on(function(){
        Array.prototype.forEach.call(document.querySelectorAll(".dprof"), function(b){
          if(GPX[+b.dataset.day]) render(b, +b.dataset.day);
        });
      });
    });
  }

  if(window.onCaminoDays) window.onCaminoDays(boot);
  else if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();