/* Camino 2027 — 날짜 카드 주입 · 목차 · 내비 단추 · 판 표시 */
/* ── 블록 0 ── */
(function(){
  "use strict";
  var SRC = "camino-days.html";

  function domReady(){
    return new Promise(function(res){
      if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",res);
      else res();
    });
  }
  /* 마커는 "줄 맨 앞에 혼자 있는" 것만 인정합니다.
     (설명문 안에 같은 글자가 있어도 잘못 잡지 않도록) */
  function markAt(txt, name){
    var re = new RegExp("^[ \\t]*<!--#"+name+"#-->[ \\t]*$", "m");
    var m = re.exec(txt);
    return m ? {i:m.index, len:m[0].length} : null;
  }
  function pick(txt, a, b){
    var A = markAt(txt, a); if(!A) return "";
    var B = b ? markAt(txt, b) : null;
    return txt.slice(A.i+A.len, (B && B.i>A.i) ? B.i : txt.length);
  }
  function showError(msg, detail){
    var host=document.getElementById("daysHost");
    if(!host) return;
    host.innerHTML='<div class="loadfail">'
      +'<b>⚠ 날짜별 카드를 불러오지 못했습니다.</b>'
      +'<p>'+msg+'</p>'
      +'<p class="hint"><b>camino-days.html</b> 파일이 이 페이지와 <b>같은 폴더</b>에 있어야 합니다.<br>'
      +'그리고 이 페이지는 <b>웹 서버(http/https)</b>로 열어야 합니다 — 파일을 더블클릭해 여는 '
      +'<code>file://</code> 방식은 브라우저 보안정책 때문에 다른 파일을 읽지 못합니다.<br>'
      +'로컬에서 확인하려면 폴더에서 <code>python -m http.server</code> 를 실행한 뒤 '
      +'<code>http://localhost:8000</code> 으로 여세요.</p>'
      +(detail?'<p class="hint">('+detail+')</p>':'')
      +'</div>';
  }

  var fetching = fetch(SRC, {cache:"no-cache"}).then(function(r){
    if(!r.ok) throw new Error("HTTP "+r.status);
    return r.text();
  });

  window.CAMINO_DAYS_READY = Promise.all([fetching, domReady()]).then(function(a){
    var txt = a[0];
    var nav   = pick(txt, "NAV",   "CARDS").trim();
    var cards = pick(txt, "CARDS", null).trim();
    if(!cards) throw new Error("#CARDS# 마커를 찾지 못했습니다 (줄 맨 앞에 혼자 있어야 합니다)");
    var host = document.getElementById("daysHost");
    if(host) host.innerHTML = cards;
    var navHost = document.getElementById("dayNavHost");
    if(navHost && nav) navHost.innerHTML = nav;
    /* 안전장치: data-day 가 숫자가 아닌 자리는 잘못 들어온 것이므로 제거 */
    (host||document).querySelectorAll(".dextra").forEach(function(el){
      var d = parseInt(el.getAttribute("data-day"),10);
      if(!(d>=1 && d<=13)) el.parentNode.removeChild(el);
    });
    document.dispatchEvent(new CustomEvent("camino:days-ready"));
    return true;
  }).catch(function(e){
    return domReady().then(function(){
      showError("파일을 읽는 중 문제가 발생했습니다.", (e&&e.message)||"");
      return false;
    });
  });

  /* 날짜 카드가 DOM 에 들어온 뒤 실행해야 하는 모듈들이 이 함수를 씁니다.
     실패했을 때도 호출해 주어 나머지 기능이 멈추지 않게 합니다. */
  window.onCaminoDays = function(fn){
    window.CAMINO_DAYS_READY.then(function(){ try{ fn(); }catch(e){} },
                                  function(){ try{ fn(); }catch(e){} });
  };
})();

/* ══════════════════════════════════════════════════════════════════════
   숙소 · 항공 섹션 — 따로 둔 파일을 실행 중에 제자리에 끼워 넣습니다.
   본 파일이 커지지 않고, 그 부분만 고칠 때 작은 파일만 건드리면 됩니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var PARTS = [
    {mark:"HOTEL",  src:"camino-hotel.html",  name:"숙소"},
    {mark:"FLIGHT", src:"camino-flight.html", name:"항공 · 환승"}
  ];

  function domReady(){
    return new Promise(function(res){
      if(document.readyState==="loading")
        document.addEventListener("DOMContentLoaded", res);
      else res();
    });
  }
  /* 주석 마커를 찾아 그 자리에 바꿔 넣습니다 */
  function slotFor(mark){
    var it=document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT);
    var n, want="#"+mark+"#";
    while((n=it.nextNode())) if(n.nodeValue.trim()===want) return n;
    return null;
  }
  function fail(node, part, why){
    var d=document.createElement("div");
    d.className="loadfail";
    d.innerHTML='<b>⚠ '+part.name+' 부분을 불러오지 못했습니다.</b>'
      +'<p class="hint"><b>'+part.src+'</b> 이 이 페이지와 같은 폴더에 있어야 합니다. '
      +'그리고 웹 서버(http/https)로 열어야 합니다 — '
      +'<code>file://</code> 로는 다른 파일을 읽지 못합니다.'
      +(why?'<br>('+why+')':'')+'</p>';
    if(node && node.parentNode) node.parentNode.replaceChild(d, node);
  }

  window.CAMINO_PARTS_READY = domReady().then(function(){
    return Promise.all(PARTS.map(function(part){
      var node=slotFor(part.mark);
      if(!node) return true;                    /* 자리가 없으면 조용히 넘어갑니다 */
      return fetch(part.src, {cache:"no-cache"})
        .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.text(); })
        .then(function(txt){
          var w=document.createElement("div");
          w.innerHTML=txt;
          var frag=document.createDocumentFragment();
          while(w.firstChild) frag.appendChild(w.firstChild);
          node.parentNode.replaceChild(frag, node);
          return true;
        })
        .catch(function(e){ fail(node, part, (e&&e.message)||""); return false; });
    }));
  }).then(function(r){
    document.dispatchEvent(new CustomEvent("camino:parts-ready"));
    return r;
  });

  /* 숙소·항공이 DOM 에 들어온 뒤 실행해야 하는 모듈이 씁니다 */
  window.onCaminoParts = function(fn){
    window.CAMINO_PARTS_READY.then(function(){ try{ fn(); }catch(e){} },
                                   function(){ try{ fn(); }catch(e){} });
  };
})();

/* ── 블록 2 ── */
/* ══ 목차 ══ */
(function(){
  var btn=document.getElementById("tocBtn"),sheet=document.getElementById("tocSheet");
  btn.addEventListener("click",function(){sheet.classList.add("show");});
  document.getElementById("tocClose").addEventListener("click",function(){sheet.classList.remove("show");});
  sheet.addEventListener("click",function(e){
    if(e.target===sheet)sheet.classList.remove("show");
    if(e.target.tagName==="A")sheet.classList.remove("show");  /* 링크 탭 → 닫고 이동 */
  });
})();
/* ══ To Do 체크 저장 (기기별, localStorage — 미지원 환경에서도 무해) ══ */
(function(){
  var KEY="camino-todo-2027";
  var saved={};
  try{saved=JSON.parse(localStorage.getItem(KEY)||"{}");}catch(e){}
  document.querySelectorAll(".todo").forEach(function(ul){
    var grp=ul.dataset.td;
    ul.querySelectorAll("li").forEach(function(li,i){
      var cb=li.querySelector("input");
      var k=grp+"-"+i;
      if(saved[k]){cb.checked=true;li.classList.add("done");}
      cb.addEventListener("change",function(){
        li.classList.toggle("done",cb.checked);
        saved[k]=cb.checked;
        try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(e){}
      });
    });
  });
})();

/* ── 블록 7 ── */
/* ══════════════════════════════════════════════════════════════════════
   목차·바로가기 위치 보정
   사진·지도·차트가 나중에 불러와지면서 위쪽 높이가 늘어나면,
   먼저 뛰어간 자리가 아래로 밀려 "이전 섹션"이 보였습니다.
   이동한 뒤 잠시 따라가며 목표 위치를 다시 맞춥니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var timers=[], watching=null, userMoved=false;

  function marginOf(el){
    var v=getComputedStyle(el).scrollMarginTop;
    var n=parseFloat(v);
    return isNaN(n)?0:n;
  }
  function off(el){
    return el.getBoundingClientRect().top - marginOf(el);
  }
  function clearAll(){
    timers.forEach(clearTimeout); timers=[]; watching=null;
  }
  function settle(el){
    clearAll(); watching=el; userMoved=false;
    /* 늦게 들어오는 사진·차트 때문에 밀리는지 확인하며 보정 */
    [180,400,750,1200,1800,2600].forEach(function(ms){
      timers.push(setTimeout(function(){
        if(watching!==el || userMoved) return;
        if(Math.abs(off(el))>14) el.scrollIntoView({block:"start"});
      },ms));
    });
  }
  function target(hash){
    if(!hash || hash.length<2) return null;
    try{ return document.querySelector(hash); }catch(e){ return null; }
  }

  document.addEventListener("click",function(e){
    var a=e.target.closest && e.target.closest('a[href^="#"]');
    if(!a) return;
    var h=a.getAttribute("href");
    if(!h || h==="#") return;
    var el=target(h);
    if(!el) return;
    e.preventDefault();
    try{ history.pushState(null,"",h); }catch(err){}
    el.scrollIntoView({block:"start", behavior:"smooth"});
    settle(el);
  });

  /* 사용자가 직접 스크롤하면 보정을 멈춥니다 */
  ["wheel","touchstart","keydown","pointerdown"].forEach(function(ev){
    window.addEventListener(ev,function(){ if(watching) userMoved=true; },{passive:true});
  });

  /* 주소에 #이 붙은 채로 열렸을 때도 같은 보정 */
  function onHash(){
    var el=target(location.hash);
    if(el){ el.scrollIntoView({block:"start"}); settle(el); }
  }
  window.addEventListener("hashchange",onHash);
  if(location.hash){
    if(document.readyState==="loading")
      document.addEventListener("DOMContentLoaded",function(){ setTimeout(onHash,60); });
    else setTimeout(onHash,60);
  }
  /* 흐름도 그림이 없으면 자리만 감춤 */
  (function(){
    function hide(){
      document.querySelectorAll(".jfig img,.afig img").forEach(function(im){
        im.addEventListener("error",function(){
          var f=im.closest("figure"); if(f) f.style.display="none";
        });
      });
      /* 안내 그림은 글씨가 작아 눌러서 크게 볼 수 있게 */
      document.querySelectorAll(".afig img,.jfig img").forEach(function(im){
        im.addEventListener("click",function(){ bigView(im); });
      });
    }
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",hide);
    else hide();
  })();

  /* 문장 복사 버튼 */
  (function(){
    function bind(){
      document.querySelectorAll(".jcopy").forEach(function(b){
        if(b._bound) return; b._bound=true;      /* 두 번 묶이지 않도록 */
        b.addEventListener("click",function(){
          var el=document.getElementById(b.dataset.c); if(!el) return;
          var t=el.textContent;
          var done=function(){
            var old=b.textContent;
            b.textContent="복사됨"; b.classList.add("done");
            setTimeout(function(){ b.textContent=old; b.classList.remove("done"); },1600);
          };
          if(navigator.clipboard && navigator.clipboard.writeText)
            navigator.clipboard.writeText(t).then(done,function(){ fallback(t,done); });
          else fallback(t,done);
        });
      });
    }
    function fallback(t,done){
      var ta=document.createElement("textarea");
      ta.value=t; ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); done(); }catch(e){}
      document.body.removeChild(ta);
    }
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bind);
    else bind();
    /* 숙소·항공·날짜 카드가 나중에 들어오므로 그때 다시 묶습니다 */
    document.addEventListener("camino:parts-ready", bind);
    document.addEventListener("camino:days-ready", bind);
  })();

  /* 그림 크게 보기 */
  var bv=null;
  function bigView(im){
    if(!bv){
      bv=document.createElement("div"); bv.className="bigview";
      bv.innerHTML='<button class="bv-x" type="button" aria-label="닫기">✕</button><img alt="">';
      document.body.appendChild(bv);
      bv.addEventListener("click",function(e){
        if(e.target===bv||e.target.className==="bv-x") close();
      });
      document.addEventListener("keydown",function(e){
        if(bv.classList.contains("show")&&e.key==="Escape") close();
      });
    }
    function close(){ bv.classList.remove("show"); document.body.style.overflow=""; }
    bv.querySelector("img").src=im.src;
    bv.querySelector("img").alt=im.alt||"";
    bv.classList.add("show"); document.body.style.overflow="hidden";
  }

  /* 날짜 카드·숙소·항공이 나중에 들어오므로, 그 시점에도 한 번 더 */
  document.addEventListener("camino:days-ready",function(){
    if(location.hash) setTimeout(onHash,80);
  });
  document.addEventListener("camino:parts-ready",function(){
    if(location.hash) setTimeout(onHash,80);
  });
})();

/* ── 블록 8 ── */
/* ══════════════════════════════════════════════════════════════════════
   자전거 내비게이션 (GPX) 내려받기 버튼
   · 링크 자체는 순수 HTML 이라 자바스크립트가 없어도 내려받아집니다.
   · 화면에 들어올 때만 GPX 를 읽어 경로 모양을 작은 지도로 그립니다
     (12개 파일 합계 약 1.6MB — 한꺼번에 받지 않도록 지연 처리)
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  function parse(txt){
    var pts=[], re=/<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"/g, m;
    while((m=re.exec(txt))){
      var la=parseFloat(m[1]), lo=parseFloat(m[2]);
      if(!isNaN(la)&&!isNaN(lo)) pts.push([la,lo]);
    }
    if(!pts.length){                                   /* lon 이 먼저 오는 파일 대비 */
      re=/<trkpt[^>]*lon="([-\d.]+)"[^>]*lat="([-\d.]+)"/g;
      while((m=re.exec(txt))){
        var lo2=parseFloat(m[1]), la2=parseFloat(m[2]);
        if(!isNaN(la2)&&!isNaN(lo2)) pts.push([la2,lo2]);
      }
    }
    return pts;
  }
  function wpt(txt){
    var m=txt.match(/<wpt[\s>]/g);
    return m?m.length:0;
  }
  function km(pts){
    var R=6371, rad=Math.PI/180, d=0;
    for(var i=1;i<pts.length;i++){
      var a=pts[i-1], b=pts[i];
      var dla=(b[0]-a[0])*rad, dlo=(b[1]-a[1])*rad;
      var h=Math.sin(dla/2)*Math.sin(dla/2)
        + Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlo/2)*Math.sin(dlo/2);
      d+=2*R*Math.asin(Math.min(1,Math.sqrt(h)));
    }
    return d;
  }
  function thin(pts,max){
    if(pts.length<=max) return pts;
    var step=pts.length/max, out=[];
    for(var i=0;i<max;i++) out.push(pts[Math.floor(i*step)]);
    out.push(pts[pts.length-1]);
    return out;
  }

  function draw(box, pts){
    var W=118, H=62, P=7;
    var p=thin(pts,240);
    var la=p.map(function(x){return x[0];}), lo=p.map(function(x){return x[1];});
    var la0=Math.min.apply(null,la), la1=Math.max.apply(null,la);
    var lo0=Math.min.apply(null,lo), lo1=Math.max.apply(null,lo);
    /* 위도에 따라 경도 폭이 줄어드는 것을 반영 */
    var kx=Math.cos((la0+la1)/2*Math.PI/180);
    var w=Math.max(1e-6,(lo1-lo0)*kx), h=Math.max(1e-6,la1-la0);
    var s=Math.min((W-P*2)/w,(H-P*2)/h);
    var ox=(W-w*s)/2, oy=(H-h*s)/2;
    var d=p.map(function(x,i){
      var X=ox+(x[1]-lo0)*kx*s, Y=H-(oy+(x[0]-la0)*s);
      return (i?"L":"M")+X.toFixed(1)+" "+Y.toFixed(1);
    }).join("");
    var f=p[0], e=p[p.length-1];
    function xy(x){ return [ox+(x[1]-lo0)*kx*s, H-(oy+(x[0]-la0)*s)]; }
    var fa=xy(f), ea=xy(e);
    box.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="100%" aria-hidden="true">'
      +'<path d="'+d+'" fill="none" stroke="#1E3A6E" stroke-opacity=".25" stroke-width="4.5" '
      +'stroke-linecap="round" stroke-linejoin="round"/>'
      +'<path d="'+d+'" fill="none" stroke="#8E2C3A" stroke-width="2" '
      +'stroke-linecap="round" stroke-linejoin="round"/>'
      +'<circle cx="'+fa[0].toFixed(1)+'" cy="'+fa[1].toFixed(1)+'" r="3" fill="#fff" stroke="#1E7A46" stroke-width="2"/>'
      +'<circle cx="'+ea[0].toFixed(1)+'" cy="'+ea[1].toFixed(1)+'" r="3" fill="#fff" stroke="#8E2C3A" stroke-width="2"/>'
      +'</svg>';
    box.classList.add("ok");
  }

  function load(a){
    if(a.dataset.done) return;
    a.dataset.done="1";
    var box=a.querySelector(".gpxthumb");
    var sub=a.querySelector(".gpxlab small");
    fetch(a.getAttribute("href"),{cache:"no-cache"})
      .then(function(r){ if(!r.ok) throw 0; return r.blob(); })
      .then(function(b){
        a._blob=b;                                   /* 눌렀을 때 바로 쓰려고 보관 */
        return b.text().then(function(t){ a._text=t; return t; });
      })
      .then(function(t){
        var pts=parse(t);
        if(pts.length<2) throw 0;
        draw(box,pts);
        if(sub){
          var w=wpt(t), bits=[];
          bits.push((a.dataset.km||km(pts).toFixed(1))+" km");
          if(w) bits.push("알베르게·포토존 "+w+"곳");
          if(a.dataset.note) bits.push(a.dataset.note);
          sub.textContent=bits.join(" · ");
          a._sub=sub.textContent;
        }
      })
      .catch(function(){
        box.classList.add("na");
        if(sub) sub.textContent="GPX 내려받기";
      });
  }

  /* ── 내려받기 / 공유 ──
     아이폰 사파리는 download 속성을 무시하고 .gpx 를 글자로 펼쳐 보여 줍니다.
     휴대폰에서는 공유 시트를 띄워 "파일에 저장" 하거나 내비 앱으로 바로 보내게 합니다. */
  /* 파일은 반드시 Blob 그대로 다뤄야 합니다.
     텍스트로 읽었다가 되돌리면 ZIP 같은 바이너리는 깨집니다. */
  function mimeOf(name){
    if(/\.zip$/i.test(name)) return "application/zip";
    if(/\.tcx$/i.test(name)) return "application/vnd.garmin.tcx+xml";
    return "application/gpx+xml";
  }
  function nameOf(a){
    return a.getAttribute("download")
        || (a.getAttribute("href")||"file").split("/").pop().split("?")[0];
  }
  function fileOf(a){
    if(!a._blob) return null;
    var n=nameOf(a);
    try{ return new File([a._blob], n, {type:mimeOf(n)}); }catch(e){ return null; }
  }
  function saveBlob(a, blob){
    var n=nameOf(a);
    var url=URL.createObjectURL(blob);
    var t=document.createElement("a");
    t.href=url; t.download=n; t.rel="noopener";
    document.body.appendChild(t); t.click();
    setTimeout(function(){ document.body.removeChild(t); URL.revokeObjectURL(url); },1500);
  }
  function note(a,msg,ms){
    var sub=a.querySelector(".gpxlab small")||a.querySelector("small"); if(!sub) return;
    if(a._note) clearTimeout(a._note);
    if(!a._sub) a._sub=sub.textContent;
    sub.textContent=msg;
    a._note=setTimeout(function(){ sub.textContent=a._sub; },ms||2200);
  }

  function onClick(e){
    var a=e.currentTarget;
    var n=nameOf(a);

    /* 압축 파일은 주소가 같으면 예전에 받아 둔 것이 그대로 나옵니다.
       누를 때마다 시각을 붙여 반드시 새로 받게 합니다. */
    if(/\.zip$/i.test(n)){
      var base=(a.getAttribute("href")||"").split("?")[0];
      a.setAttribute("href", base+"?t="+Date.now());
      return;                       /* 브라우저 기본 내려받기 — 가장 안전합니다 */
    }

    var f=fileOf(a);

    /* ① 파일 공유가 되는 기기 — 손짓이 살아 있을 때 곧바로 호출 */
    if(f && navigator.canShare && navigator.canShare({files:[f]}) && navigator.share){
      e.preventDefault();
      navigator.share({files:[f], title:n})
        .catch(function(err){
          if(err && err.name==="AbortError") return;
          saveBlob(a, a._blob);
        });
      return;
    }

    /* ② 이미 받아 둔 것이 있으면 그대로 저장 */
    if(a._blob){ e.preventDefault(); saveBlob(a, a._blob); return; }

    /* ③ 아직 없으면 받아서 처리 — 실패하면 원래 링크 동작으로 */
    e.preventDefault();
    note(a,"준비 중…",8000);
    fetch(a.getAttribute("href"),{cache:"no-cache"})
      .then(function(r){ if(!r.ok) throw 0; return r.blob(); })
      .then(function(b){
        a._blob=b;
        var f2=fileOf(a);
        if(f2 && navigator.canShare && navigator.canShare({files:[f2]}) && navigator.share)
          return navigator.share({files:[f2], title:n})
            .catch(function(err){ if(!(err&&err.name==="AbortError")) saveBlob(a,b); });
        saveBlob(a,b);
      })
      .catch(function(){ location.href=a.getAttribute("href"); });
  }

  function boot(){
    var list=[].slice.call(document.querySelectorAll(".gpxbtn"));
    if(!list.length) return;
    var canShare=!!(navigator.canShare && navigator.share);
    document.querySelectorAll(".gpxdlx").forEach(function(a){
      a.addEventListener("click",onClick);
    });
    list.forEach(function(a){
      a.addEventListener("click",onClick);
      a.title = canShare ? "눌러서 저장하거나 내비 앱으로 보내기" : "눌러서 GPX 내려받기";
    });
    if(!("IntersectionObserver" in window)){ list.forEach(load); return; }
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting){ load(e.target); io.unobserve(e.target); }
      });
    },{rootMargin:"300px"});
    list.forEach(function(a){ io.observe(a); });
  }
  if(window.onCaminoDays) window.onCaminoDays(boot);
  else if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

/* ── 블록 10 ── */
/* ══════ 판(build) 표시 · 캐시 무시하고 다시 받기 ══════
   아이폰 사파리는 HTML 을 오래 붙들고 있어서 새 파일을 올려도 예전 화면이 나올 수 있습니다.
   아래 번호가 최신인지 확인하고, 다르면 [↻ 최신본] 을 누르세요. */
(function(){
  var BUILD="20260907-0106";
  function paint(){
    document.querySelectorAll(".buildver").forEach(function(el){ el.textContent="v"+BUILD; });
    document.querySelectorAll(".buildreload").forEach(function(b){
      b.addEventListener("click",function(){
        var u=location.pathname+"?v="+Date.now()+location.hash;
        location.replace(u);
      });
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",paint);
  else paint();
})();
