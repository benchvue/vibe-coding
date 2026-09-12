/* Camino 2027 — Drive 자료 · 명소 · 날씨 · 여권 · 할 일 · 비용 · 숙소 */
/* ── 블록 1 ── */
/* ══════ DAY별 사진 (Google Drive) ══════
   각 day 카드 아래에 Drive의 day1~day13 하위 폴더 사진(webp)을 표시합니다.
   ※ apiKey는 읽기 전용 키 — SUPER-ADMIN-camino.md의 발급 방법 참고.
     키가 비어 있으면 사진 없이 빈 프레임만 표시됩니다. */
const PHOTOS = {
  apiKey: "AIzaSyDzahk0Yhz3faRfMhDS2vQzQ2oADYXhPRg",
  /* (선택) 폰에서 유튜브식 네이티브 재생을 원하면: Drive API만 제한 + 웹사이트 제한 '없는'
     보조 키를 만들어 여기에. 비워두면 apiKey 사용 → 폰은 Drive 플레이어로 자동 폴백 */
  mediaKey: "",
  /* Relive식 3D 주행 보기용 — cesium.com/ion 에서 발급한 Access Token을 붙여넣기 */
  /* (권장) GPX용 Apps Script 프록시 URL — 구글이 alt=media에 CORS를 안 줘서 필요.
     SUPER-ADMIN §12의 5분 설정 후 "https://script.google.com/macros/s/.../exec" 붙여넣기.
     비워두면 공영 CORS 프록시로 자동 폴백(설정 없이 동작하나 속도·안정성은 프록시가 남) */
  gpxProxy: "https://script.google.com/macros/s/AKfycbwLNVcRKh5Fgj6LZ-z2TNWcw5-1mVq4EwyafJ52GXjUurkOMkOpPpzkOr-Go9ymAw6H/exec",
  cesiumToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkNmY1YjBhNi1mOWU5LTRmMTYtYjNjMi01ZTgxOTkyZmJlOWIiLCJpZCI6OTg5MzksInN1YiI6Inltam9uZ2JpbiIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiJkcm9uZSIsImlhdCI6MTc4NTExNDA0MH0.CzGt5r2mi4jKQlSdwwq6_gfxeRAGZkzpypf7eHjCNzU",          /* Google Cloud → API key (Drive API, 리퍼러 제한) */
  parentId: "1z6EJEVanJ_Hal3gIzqeAc0eOUfr1EOAK",
  dayCount: 13,
  thumbW: 400, fullW: 1600, placeholders: 3
};
(function(){
  var IMG_RE=/\.(webp|jpe?g|png|gif)$/i;
  var VID_RE=/\.(mp4|mov|m4v|webm)$/i;
  var TRK_RE=/\.gpx$/i;
  var MEDIA_RE=/\.(webp|jpe?g|png|gif|mp4|mov|m4v|webm|gpx)$/i;
  function trkNum(n){var m=n.match(/^track_(\d+)/i);return m?parseInt(m[1],10):999;}
  function vidTown(n){var m=n.match(/^video_\d+__(.+)\.\w+$/i);return m?m[1].replace(/-/g," "):null;}
  function vidNum(n){var m=n.match(/^video_(\d+)/i);return m?parseInt(m[1],10):999;}
  var HOSTS=[
    function(id,w){return "https://lh3.googleusercontent.com/d/"+id+"=w"+w;},
    function(id,w){return "https://drive.google.com/thumbnail?id="+id+"&sz=w"+w;}
  ];
  function thumbLinkUrl(link,w){ /* Drive가 준 공식 썸네일 URL을 원하는 크기로 */
    return link?link.replace(/=s\d+[^&]*$/,"=s"+w):null;}
  function setImg(img,id,w,vid,link){
    /* 우선순위: ① 목록 응답의 thumbnailLink(가장 확실) ② thumbnail 엔드포인트 ③ lh3 */
    var chain=[];
    var tl=thumbLinkUrl(link,w);
    if(tl)chain.push(function(){return tl;});
    if(vid){chain.push(function(){return HOSTS[1](id,w);});chain.push(function(){return HOSTS[0](id,w);});}
    else   {chain.push(function(){return HOSTS[0](id,w);});chain.push(function(){return HOSTS[1](id,w);});}
    var k=0;
    img.onerror=function(){k++;
      if(k<chain.length)img.src=chain[k]();
      else{img.onerror=null;
        var box=img.closest(".pthumb");
        if(box&&box.classList.contains("isvid"))img.style.visibility="hidden"; /* 처리 전이면 ▶만 표시 */
        else if(box)box.style.display="none";}};
    img.src=chain[0]();}
  function drive(q){
    return fetch("https://www.googleapis.com/drive/v3/files?q="+encodeURIComponent(q)
      +"&fields="+encodeURIComponent("files(id,name,mimeType,thumbnailLink,size)")
      +"&pageSize=1000&key="+PHOTOS.apiKey)
      .then(function(r){if(!r.ok)throw new Error("drive "+r.status);return r.json();})
      .then(function(d){return d.files||[];});}
  function numOf(n){var m=n.match(/^photo_(\d+)\.webp$/i);return m?parseInt(m[1],10):null;}
  function sortFiles(fs){return fs.slice().sort(function(a,b){
    var na=numOf(a.name),nb=numOf(b.name);
    if(na!=null&&nb!=null)return na-nb;
    if(na!=null)return -1; if(nb!=null)return 1;
    return a.name.localeCompare(b.name);});}

  /* 라이트박스 (사진 + 동영상: 네이티브 플레이어 → 실패 시 Drive iframe) */
  var gallery=[],idx=0;   /* 항목: {id, vid:bool, town} */
  var plb=document.getElementById("plb"),plbImg=document.getElementById("plbImg"),
      plbVideo=document.getElementById("plbVideo"),plbLoc=document.getElementById("plbLoc"),
      plbCnt=document.getElementById("plbCnt"),plbFrame=document.getElementById("plbFrame"),
      plbDl=document.getElementById("plbDl");
  var vidBlobCache={};   /* {fileId: objectURL} — 같은 세션에서 재다운로드 방지 */
  var BLOB_MAX=250*1024*1024;  /* 이보다 크면 blob 대신 Drive 플레이어 */
  /* 네이티브 <video> 소스 후보 — mediaKey(도메인 제한 없는 보조 키)가 있으면 그것부터.
     아이폰은 미디어 요청에 Referer를 안 붙여 도메인 제한 키가 403이 나므로,
     폰에서 깨끗한 네이티브 재생을 원하면 mediaKey 설정이 필수 (SUPER-ADMIN §11 참고) */
  function videoSrcs(id){
    var base="https://www.googleapis.com/drive/v3/files/"+id+"?alt=media&key=";
    var a=[];
    if(PHOTOS.mediaKey)a.push(base+PHOTOS.mediaKey);
    a.push(base+PHOTOS.apiKey);
    a.push("https://drive.google.com/uc?export=download&id="+id);
    return a;
  }
  function hideAll(){plbImg.style.display="none";
    if(G._vAbort){G._vAbort();G._vAbort=null;}
    plbVideo.onerror=plbVideo.onloadeddata=plbVideo.onplaying=null;
    plbVideo.pause();plbVideo.removeAttribute("src");plbVideo.load();plbVideo.style.display="none";
    plbFrame.src="about:blank";plbFrame.style.display="none";
    plbLoc.style.display="none";plbDl.style.display="none";}
  function show(i){
    if(!gallery.length)return;
    idx=(i+gallery.length)%gallery.length;
    var it=gallery[idx];
    hideAll();
    if(it.town){plbLoc.textContent="⛿ "+it.town;plbLoc.style.display="";}
    if(it.vid){
      /* 유튜브처럼: 네이티브 <video> = 컨트롤이 하단 바에만, 재생 시작하면 자동 숨김 */
      plbVideo.style.display="";
      if(it.tl)plbVideo.poster=thumbLinkUrl(it.tl,800); else plbVideo.removeAttribute("poster");
      var srcs=videoSrcs(it.id),si=0,wd=null,aborted=false;
      var toFrame=function(){ /* 최후: Drive 플레이어 (재생은 보장, UI는 구글 것) */
        clearTimeout(wd);plbVideo.onerror=null;
        plbVideo.pause();plbVideo.removeAttribute("src");plbVideo.load();
        plbVideo.style.display="none";plbDl.style.display="none";
        plbFrame.style.display="";
        plbFrame.src="https://drive.google.com/file/d/"+it.id+"/preview";};
      var playUrl=function(u){clearTimeout(wd);plbVideo.onerror=null;
        plbDl.style.display="none";plbVideo.style.display="";
        plbVideo.src=u;plbVideo.play().catch(function(){});};
      var toBlob=function(){ /* fetch는 Referer를 붙이므로 도메인 제한 키도 통과 →
          내려받아 네이티브로 재생 (폰에서 깨끗한 UI의 핵심) */
        clearTimeout(wd);plbVideo.onerror=null;
        if(vidBlobCache[it.id])return playUrl(vidBlobCache[it.id]);
        if(it.size&&it.size>BLOB_MAX)return toFrame();
        plbDl.style.display="";plbDl.textContent="영상 불러오는 중…";
        fetch(srcs[0]).then(function(r){
          if(!r.ok)throw 0;
          var total=it.size||parseInt(r.headers.get("Content-Length")||"0",10);
          if(!r.body||!r.body.getReader)return r.blob();
          var reader=r.body.getReader(),chunks=[],got=0;
          return new Promise(function(res,rej){
            (function pump(){reader.read().then(function(x){
              if(aborted)return rej(0);
              if(x.done)return res(new Blob(chunks,{type:"video/mp4"}));
              chunks.push(x.value);got+=x.value.length;
              if(total)plbDl.textContent="영상 불러오는 중 "+Math.round(got/total*100)+"% (이번 한 번만)";
              pump();
            }).catch(rej);})();
          });
        }).then(function(b){
          if(aborted)return;
          var u=URL.createObjectURL(b);vidBlobCache[it.id]=u;playUrl(u);
        }).catch(function(){if(!aborted)toFrame();});};
      var advance=function(){clearTimeout(wd);toBlob();};
      var armWd=function(){ /* 직접 스트리밍이 4초 무반응(주로 폰: Referer 미포함 403)이면 blob 경로로 */
        clearTimeout(wd);wd=setTimeout(advance,4000);};
      plbVideo.onerror=advance;
      plbVideo.onloadeddata=function(){clearTimeout(wd);};
      plbVideo.onplaying=function(){clearTimeout(wd);};
      G._vAbort=function(){aborted=true;clearTimeout(wd);};
      armWd();
      plbVideo.src=srcs[0];
      plbVideo.play().catch(function(){});
    }else{
      plbImg.style.display="";
      plbImg.onerror=null;setImg(plbImg,it.id,PHOTOS.fullW,false,it.tl);
    }
    plbCnt.textContent=(idx+1)+" / "+gallery.length;
    plb.classList.add("show");}
  function closeLb(){plb.classList.remove("show");hideAll();}
  document.getElementById("plbPrev").addEventListener("click",function(e){e.stopPropagation();show(idx-1);});
  document.getElementById("plbNext").addEventListener("click",function(e){e.stopPropagation();show(idx+1);});
  document.getElementById("plbClose").addEventListener("click",closeLb);
  plb.addEventListener("click",function(e){if(e.target===plb)closeLb();});
  document.addEventListener("keydown",function(e){
    if(!plb.classList.contains("show"))return;
    if(e.key==="ArrowLeft")show(idx-1);
    else if(e.key==="ArrowRight")show(idx+1);
    else if(e.key==="Escape")closeLb();});
  function mountDay(d,media){
    var card=document.getElementById("day"+d);
    if(!card)return;
    var photos=media?media.filter(function(f){return IMG_RE.test(f.name);}):[];
    var vids  =media?media.filter(function(f){return VID_RE.test(f.name);}):[];
    var trks  =media?media.filter(function(f){return TRK_RE.test(f.name);}):[];
    photos=sortFiles(photos);
    vids.sort(function(a,b){return vidNum(a.name)-vidNum(b.name);});
    trks.sort(function(a,b){return trkNum(a.name)-trkNum(b.name);});
    var sec=document.createElement("div");sec.className="dphotos";
    var html="";

    /* ── 사진 row ── */
    html+="<h4>📷 DAY "+d+" 사진 <small>· "+(photos.length?photos.length+"장":"아직 없음")+"</small></h4>";
    html+='<div class="pstrip" data-kind="p">';
    if(photos.length){
      photos.forEach(function(f,i){
        html+='<div class="pthumb" data-gi="'+i+'"><img loading="lazy" alt="DAY '+d+' 사진 '+(i+1)+'" data-id="'+f.id+'"></div>';});
    }else{
      for(var i=0;i<PHOTOS.placeholders;i++)html+='<div class="pthumb ph">사진 예정</div>';
    }
    html+="</div>";

    /* ── 동영상 row (영상이 있을 때만) ── */
    if(vids.length){
      html+='<h4 style="margin-top:10px">🎬 DAY '+d+' 영상 <small>· '+vids.length+'개</small></h4>';
      html+='<div class="pstrip" data-kind="v">';
      vids.forEach(function(f,i){
        var town=vidTown(f.name);
        html+='<div class="pthumb isvid" data-gi="'+i+'">'
          +'<img loading="lazy" alt="DAY '+d+' 동영상 '+(i+1)+'" data-id="'+f.id+'">'
          +'<span class="vplay"><i></i></span>'
          +(town?'<span class="ploc">⛿ '+town+'</span>':'')
          +'</div>';});
      html+="</div>";
    }
    /* ── 주행 기록 row (GPX가 있을 때만) ── */
    if(trks.length){
      html+='<h4 style="margin-top:10px">🗺 DAY '+d+' 주행 기록 <small>· '+trks.length+'개 · 탭하면 지도+고도 재생</small></h4>';
      html+='<div class="pstrip" data-kind="t">';
      trks.forEach(function(f,i){
        html+='<div class="pthumb istrk" data-gi="'+i+'" data-id="'+f.id+'">'
          +'<canvas width="118" height="88"></canvas>'
          +'<span class="vplay"><i></i></span>'
          +'<span class="ploc" style="display:none"></span>'
          +'</div>';});
      html+="</div>";
    }
    sec.innerHTML=html;

    var pItems=photos.map(function(f){return {id:f.id,vid:false,tl:f.thumbnailLink||null};});
    var vItems=vids.map(function(f){return {id:f.id,vid:true,town:vidTown(f.name),tl:f.thumbnailLink||null,size:parseInt(f.size||"0",10)};});
    sec.querySelectorAll('[data-kind="p"] .pthumb:not(.ph)').forEach(function(box,i){
      var img=box.querySelector("img");
      setImg(img,img.dataset.id,PHOTOS.thumbW,false,pItems[i]&&pItems[i].tl);
      box.style.cursor="zoom-in";
      box.addEventListener("click",function(){gallery=pItems;show(parseInt(box.dataset.gi,10));});
    });
    sec.querySelectorAll('[data-kind="v"] .pthumb').forEach(function(box,i){
      var img=box.querySelector("img");
      setImg(img,img.dataset.id,PHOTOS.thumbW,true,vItems[i]&&vItems[i].tl);
      box.style.cursor="pointer";
      box.addEventListener("click",function(){gallery=vItems;show(parseInt(box.dataset.gi,10));});
    });
    sec.querySelectorAll('[data-kind="t"] .pthumb').forEach(function(box){
      box.style.cursor="pointer";
      gpxThumb(box);   /* 경로 모양 미리보기 그리기 */
      box.addEventListener("click",function(){openGpx(box.dataset.id,"DAY "+d+" 주행 기록");});
    });
    var foot=card.querySelector(".dsello")||card.querySelector(".dfoot");
    card.insertBefore(sec,foot||null);
    /* 날씨 차트에 "라이딩 시간대"를 그리도록 첫 번째 주행기록을 알려줌 */
    try{ if(window.CAMINO_RIDE) window.CAMINO_RIDE.tracks(d, trks, media!=null); }catch(err){}
  }

  /* ══════ GPX: 파싱·미리보기·재생 ══════ */
  var gpxCache={};
  function fetchGpx(id){
    if(gpxCache[id])return Promise.resolve(gpxCache[id]);
    /* 구글이 alt=media 응답에 CORS 헤더를 안 줘서(2024~ 정책) 직접 fetch가 막힐 수 있음
       → 다단계: ①직접 ②Apps Script 프록시(설정 시) ③④공영 CORS 프록시(무설정 폴백) */
    var uc="https://drive.google.com/uc?export=download&id="+id;
    var cands=[];
    /* 프록시가 있으면 1순위 — 직접 다운로드는 구글이 CORS를 막아 콘솔 에러만 남기므로 */
    if(PHOTOS.gpxProxy)cands.push(PHOTOS.gpxProxy+(PHOTOS.gpxProxy.indexOf("?")<0?"?":"&")+"id="+id);
    cands.push("https://www.googleapis.com/drive/v3/files/"+id+"?alt=media&key="+PHOTOS.apiKey);
    cands.push("https://api.allorigins.win/raw?url="+encodeURIComponent(uc));
    cands.push("https://corsproxy.io/?url="+encodeURIComponent(uc));
    cands.push("https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(uc));
    var tryFetch=function(k){
      if(k>=cands.length)
        return Promise.reject(new Error("GPX를 받을 수 없습니다 — 공영 프록시가 모두 응답하지 않습니다. "
          +"SUPER-ADMIN §12의 Apps Script 프록시(5분 설정)를 넣으면 확실하고 빠르게 해결됩니다"));
      /* 응답 없는 프록시에서 하염없이 기다리지 않도록 후보당 8초 제한 */
      var ac=("AbortController" in window)?new AbortController():null;
      var to=ac?setTimeout(function(){ac.abort();},8000):null;
      return fetch(cands[k],{referrerPolicy:"strict-origin-when-cross-origin",
          signal:ac?ac.signal:undefined})
        .then(function(r){if(!r.ok)throw 0;return r.text();})
        .then(function(txt){
          clearTimeout(to);
          if(txt.indexOf("<trkpt")<0)throw 0;   /* 프록시가 에러 페이지를 줄 수 있어 내용 검증 */
          return txt;})
        .catch(function(){clearTimeout(to);return tryFetch(k+1);});
    };
    return tryFetch(0)
      .then(function(txt){
        var doc=new DOMParser().parseFromString(txt,"application/xml");
        var nodes=doc.querySelectorAll("trkpt");
        var pts=[],R=6371000,rad=Math.PI/180,dist=0,prev=null,gain=0,lastEl=null,t0=null,lastMs=null;
        /* 주행 중 실측 기온 — Garmin gpxtpx:atemp, gpxdata:temp, ns3:atemp 등 접두사가 제각각이라
           네임스페이스를 무시하고 지역명(localName)으로 찾습니다. wtemp(수온)는 제외. */
        var TEMP_TAGS=["atemp","temp","temperature","airtemp","air_temp"],tempTag=null,nTemp=0;
        var findTemp=function(n){
          var e,i,v;
          if(tempTag){
            e=n.getElementsByTagNameNS?n.getElementsByTagNameNS("*",tempTag):null;
            if(e&&e.length){v=parseFloat(e[0].textContent);
              if(!isNaN(v)&&v>-60&&v<70)return v;}
            return null;
          }
          if(!n.getElementsByTagNameNS)return null;
          for(i=0;i<TEMP_TAGS.length;i++){
            e=n.getElementsByTagNameNS("*",TEMP_TAGS[i]);
            if(e&&e.length){v=parseFloat(e[0].textContent);
              if(!isNaN(v)&&v>-60&&v<70){tempTag=TEMP_TAGS[i];return v;}}
          }
          return null;
        };
        nodes.forEach(function(n){
          var la=parseFloat(n.getAttribute("lat")),lo=parseFloat(n.getAttribute("lon"));
          if(isNaN(la)||isNaN(lo))return;
          var eN=n.querySelector("ele"),tN=n.querySelector("time");
          var el=eN?parseFloat(eN.textContent):0;
          if(prev){
            var x=Math.sin((la-prev.la)*rad/2),y=Math.sin((lo-prev.lo)*rad/2);
            var h=x*x+Math.cos(prev.la*rad)*Math.cos(la*rad)*y*y;
            dist+=2*R*Math.asin(Math.sqrt(h));
          }
          if(lastEl!=null&&el-lastEl>0.5)gain+=el-lastEl;
          if(lastEl==null||Math.abs(el-lastEl)>0.5)lastEl=el;
          var tt=null;
          if(tN){var ms=Date.parse(tN.textContent);
            if(!isNaN(ms)){if(t0==null)t0=ms;lastMs=ms;tt=(ms-t0)/1000;}}
          var tp=findTemp(n);
          if(tp!=null)nTemp++;
          pts.push({la:la,lo:lo,el:el,d:dist,tt:tt,tp:tp});
          prev={la:la,lo:lo};
        });
        /* 재생 축 = 실제 기록 시간(기본). 시간이 없으면 누적 거리로 대체 */
        var hasTime=pts.length>1&&pts[pts.length-1].tt!=null&&pts[pts.length-1].tt>0;
        if(hasTime){var last=0;pts.forEach(function(p){if(p.tt==null)p.tt=last;else last=p.tt;});}
        else pts.forEach(function(p){p.tt=p.d;});
        var T=pts.length?pts[pts.length-1].tt:0;
        /* 구간 속도(km/h) — 히트맵·상태표시용 */
        for(var i=0;i<pts.length;i++){
          if(i===0){pts[i].sp=0;continue;}
          var dd=pts[i].d-pts[i-1].d, dts=Math.max(pts[i].tt-pts[i-1].tt,0.5);
          pts[i].sp=hasTime?(dd/dts*3.6):0;
        }
        /* ☕ 휴식 지점: 기록 간격이 10분 이상이면 진짜 휴식으로 판단
           (1분 기준은 신호등·잠깐 멈춤까지 다 잡혀서 상향) */
        var REST_MIN_SEC=600;
        var rests=[];
        if(hasTime)for(var i=1;i<pts.length;i++){
          var gap=pts[i].tt-pts[i-1].tt;
          if(gap>=REST_MIN_SEC)rests.push({la:pts[i-1].la,lo:pts[i-1].lo,min:Math.round(gap/60)});
        }
        var data={pts:pts,km:dist/1000,gain:Math.round(gain),T:T,hasTime:hasTime,rests:rests,t0ms:t0,t1ms:lastMs,hasTemp:nTemp>1,nTemp:nTemp};
        gpxCache[id]=data;return data;
      });
  }
  window.CAMINO_GPX=fetchGpx;   /* 날씨 차트의 라이딩 시간대 표시에서 사용 */
  function gpxThumb(box){
    fetchGpx(box.dataset.id).then(function(g){
      var cv=box.querySelector("canvas"),ctx=cv.getContext("2d");
      var pts=g.pts;if(!pts.length)return;
      var minLa=1e9,maxLa=-1e9,minLo=1e9,maxLo=-1e9;
      pts.forEach(function(p){if(p.la<minLa)minLa=p.la;if(p.la>maxLa)maxLa=p.la;
        if(p.lo<minLo)minLo=p.lo;if(p.lo>maxLo)maxLo=p.lo;});
      var cos=Math.cos((minLa+maxLa)/2*Math.PI/180);
      var w=cv.width,h=cv.height,pad=10;
      var sx=(w-pad*2)/Math.max((maxLo-minLo)*cos,1e-9),
          sy=(h-pad*2)/Math.max(maxLa-minLa,1e-9),
          sc=Math.min(sx,sy);
      ctx.fillStyle="#EAF3EC";ctx.fillRect(0,0,w,h);
      ctx.strokeStyle="#152A55";ctx.lineWidth=2.4;ctx.lineJoin="round";ctx.beginPath();
      pts.forEach(function(p,i){
        var x=pad+((p.lo-minLo)*cos)*sc+((w-pad*2)-((maxLo-minLo)*cos)*sc)/2;
        var y=h-pad-(p.la-minLa)*sc-((h-pad*2)-(maxLa-minLa)*sc)/2;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.stroke();
      var lab=box.querySelector(".ploc");
      lab.textContent=g.km.toFixed(1)+"km ↑"+g.gain+"m";lab.style.display="";
    }).catch(function(e){
      var lab=box.querySelector(".ploc");
      lab.textContent="⚠ 불러오기 실패";lab.style.display="";
      box.title=e&&e.message?e.message:"";});
  }

  /* ── 플레이어 ── */
  var gpxbox=document.getElementById("gpxbox"),gMapEl=document.getElementById("gpxMap"),
      gElev=document.getElementById("gpxElev"),gPlay=document.getElementById("gpxPlay"),
      gSeek=document.getElementById("gpxSeek"),gSpeed=document.getElementById("gpxSpeed"),
      gStats=document.getElementById("gpxStats"),gTitle=document.getElementById("gpxTitle");
  var G={map:null,segs:null,dot:null,pts:[],lls:[],T:0,hasTime:false,
         playing:false,u:0,speed:1,raf:0,last:0,elevBase:null};
  function idxAt(u){ /* 재생 위치 u(0~1) → 포인트 인덱스 (주행거리 d 이진 탐색)
       — 시간 축은 휴식마다 멈춰 어색해서 거리 축으로: 끊김 없이 자연스럽게 진행 */
    var target=u*G.T,lo=0,hi=G.pts.length-1;
    while(lo<hi){var mid=(lo+hi)>>1;
      if(G.pts[mid].d<target)lo=mid+1;else hi=mid;}
    return lo;}
  /* 속도 히트맵 색 (🔵 느림 → 🟢 → 🟡 → 🔴 빠름) */
  var HEAT=[[59,130,246],[34,197,94],[245,185,23],[239,68,68]];
  function heatColor(t){
    t=Math.max(0,Math.min(1,t));var seg=Math.min(2,Math.floor(t*3)),f=t*3-seg;
    var a=HEAT[seg],b=HEAT[seg+1];
    return "rgb("+Math.round(a[0]+(b[0]-a[0])*f)+","+Math.round(a[1]+(b[1]-a[1])*f)+","
      +Math.round(a[2]+(b[2]-a[2])*f)+")";}
  var BASE_SEC=45; /* 1×에서 완주 재생 시간 */
  function loadLeaflet(){
    if(window.L)return Promise.resolve();
    var CDN=[
      ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"],
      ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
       "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"]
    ];
    function tryCdn(i){
      if(i>=CDN.length)return Promise.reject(new Error("지도 라이브러리 로드 실패 — 네트워크가 cdnjs·unpkg를 차단하는지 확인"));
      return new Promise(function(res,rej){
        var css=document.createElement("link");css.rel="stylesheet";css.href=CDN[i][0];
        document.head.appendChild(css);
        var js=document.createElement("script");js.src=CDN[i][1];
        js.onload=res;js.onerror=rej;
        document.head.appendChild(js);
      }).catch(function(){return tryCdn(i+1);});
    }
    return tryCdn(0);
  }
  function drawElevBase(){
    var dpr=window.devicePixelRatio||1,W=gElev.clientWidth,H=120;
    if(!W){G.eb=null;G.elevBase=null;return;} /* 창이 안 보이는 상태 — 그리기 생략 */
    gElev.width=W*dpr;gElev.height=H*dpr;
    var ctx=gElev.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    var pts=G.pts,km=pts[pts.length-1].d;
    var minE=1e9,maxE=-1e9;
    pts.forEach(function(p){if(p.el<minE)minE=p.el;if(p.el>maxE)maxE=p.el;});
    if(maxE-minE<50)maxE=minE+50;
    G.eb={W:W,H:H,minE:minE,maxE:maxE,km:km,
      x:function(d){return 8+(W-16)*(d/km);},
      y:function(e){return H-18-(H-34)*((e-G.eb.minE)/(G.eb.maxE-G.eb.minE));}};
    ctx.fillStyle="#131A2E";ctx.fillRect(0,0,W,H);
    ctx.beginPath();ctx.moveTo(G.eb.x(0),H-18);
    pts.forEach(function(p){ctx.lineTo(G.eb.x(p.d),G.eb.y(p.el));});
    ctx.lineTo(G.eb.x(km),H-18);ctx.closePath();
    ctx.fillStyle="rgba(245,185,23,.25)";ctx.fill();
    ctx.beginPath();
    pts.forEach(function(p,i){i?ctx.lineTo(G.eb.x(p.d),G.eb.y(p.el)):ctx.moveTo(G.eb.x(p.d),G.eb.y(p.el));});
    ctx.strokeStyle="#F5B917";ctx.lineWidth=1.6;ctx.stroke();
    ctx.fillStyle="#8A93A6";ctx.font="10px sans-serif";
    ctx.fillText(Math.round(G.eb.maxE)+"m",8,14);
    ctx.fillText(Math.round(G.eb.minE)+"m",8,H-6);
    G.elevBase=ctx.getImageData(0,0,gElev.width,gElev.height);
  }
  function drawElevCursor(i){
    if(!G.eb||!G.elevBase)return;
    var ctx=gElev.getContext("2d");
    var dpr=window.devicePixelRatio||1;
    /* ⚠ drawElevBase가 남긴 scale(dpr) 위에 save+scale(dpr)을 또 하면 dpr²가 되어
       레티나 기기에서 커서가 그래프 범위를 넘어 3배 빨리 움직인다 —
       setTransform으로 매번 절대 배율을 지정해 중복을 원천 차단 */
    ctx.setTransform(1,0,0,1,0,0);           /* putImageData는 픽셀 좌표 기준 */
    ctx.putImageData(G.elevBase,0,0);
    ctx.setTransform(dpr,0,0,dpr,0,0);       /* 이후 그리기는 CSS 좌표 */
    var p=G.pts[i],x=G.eb.x(p.d),y=G.eb.y(p.el);
    ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,6);ctx.lineTo(x,G.eb.H-18);ctx.stroke();
    ctx.fillStyle="#F5B917";ctx.beginPath();ctx.arc(x,y,5.5,0,7);ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,5.5,0,7);ctx.stroke();
  }
  function renderPos(){
    if(!G.pts.length||!G.dot)return;   /* 로드 실패 상태 가드 */
    var i=idxAt(G.u);            /* 지도 점·고도 커서가 같은 인덱스 → 완전 동기 */
    var p=G.pts[i];
    G.dot.setLatLng(G.lls[i]);
    drawElevCursor(i);
    gSeek.value=Math.round(1000*G.u);
    var txt=(p.d/1000<10?(p.d/1000).toFixed(2):(p.d/1000).toFixed(1))+" km · 고도 "+Math.round(p.el)+" m";
    if(G.hasTime){
      txt+=" · "+Math.round(p.sp)+" km/h";
      var m=Math.floor(p.tt/60);
      txt+=" · "+Math.floor(m/60)+":"+("0"+(m%60)).slice(-2);   /* 경과 h:mm */
    }
    gStats.textContent=txt;
  }
  function tick(ts){
    if(!G.playing)return;
    if(!G.last)G.last=ts;
    var dt=(ts-G.last)/1000;G.last=ts;
    G.u+=dt*G.speed/BASE_SEC;    /* 거리 비율로 진행 — 휴식에서 멈추지 않고 계속 흐름 */
    if(G.u>=1){G.u=1;pause();}
    renderPos();
    if(G.playing)G.raf=requestAnimationFrame(tick);
  }
  function play(){if(!G.pts.length||!G.dot)return;
    if(G.u>=1)G.u=0;
    G.playing=true;G.last=0;gPlay.textContent="⏸ 정지";G.raf=requestAnimationFrame(tick);}
  function pause(){G.playing=false;cancelAnimationFrame(G.raf);gPlay.textContent="▶ 재생";}
  gPlay.addEventListener("click",function(){G.playing?pause():play();});
  gSpeed.addEventListener("click",function(){
    G.speed=G.speed===1?2:(G.speed===2?4:1);gSpeed.textContent=G.speed+"×";});
  gSeek.addEventListener("input",function(){
    pause();G.u=gSeek.value/1000;renderPos();});
  function closeGpx(){pause();gpxbox.classList.remove("show");}
  document.getElementById("gpxClose").addEventListener("click",closeGpx);
  gpxbox.addEventListener("click",function(e){if(e.target===gpxbox)closeGpx();});

  function openGpx(id,title){
    gpxCache_lastId=id;C3.title=title;
    gTitle.textContent="🗺 "+title;
    gpxbox.classList.add("show");
    Promise.all([loadLeaflet(),fetchGpx(id)]).then(function(rr){
      if(!gpxbox.classList.contains("show"))return; /* 로딩 중 3D로 넘어갔거나 닫음 — 데이터는 캐시됨 */
      var g=rr[1];
      G.pts=g.pts;G.lls=g.pts.map(function(p){return [p.la,p.lo];});
      G.T=g.pts.length?g.pts[g.pts.length-1].d:1;  /* 재생 축 = 총 주행거리 */
      G.hasTime=g.hasTime;
      G.u=0;G.speed=1;gSpeed.textContent="1×";
      gTitle.innerHTML="🗺 "+title+" · "+g.km.toFixed(1)+"km · ↑"+g.gain+"m"
        +(g.rests&&g.rests.length?" · ☕ 휴식 "+g.rests.length+"회":"")
        +(g.hasTime?' · <span style="font-weight:400;color:#8A93A6;font-size:.72rem">경로 색 = 속도 (🔵 느림 → 🔴 빠름)</span>':"");
      if(!G.map){
        G.map=L.map(gMapEl,{zoomControl:true,preferCanvas:true});
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {attribution:'© OpenStreetMap',maxZoom:18}).addTo(G.map);
      }
      if(G.segs)G.map.removeLayer(G.segs);
      if(G.dot)G.map.removeLayer(G.dot);
      /* ⚠ 캔버스 렌더러(preferCanvas)는 시점(view) 설정 전에 선을 추가하면
         내부 _bounds.min 오류가 나므로, 반드시 fitBounds 먼저 → 레이어 추가 순서 */
      G.map.invalidateSize();
      G.map.fitBounds(L.latLngBounds(G.lls),{padding:[20,20]});
      /* 속도 히트맵: 경로를 최대 700구간으로 축약, 10~90백분위 정규화 */
      var N=G.pts.length,step=Math.max(1,Math.ceil(N/700));
      var speeds=[];for(var k=step;k<N;k+=step)speeds.push(G.pts[k].sp);
      speeds.sort(function(a,b){return a-b;});
      var p10=speeds[Math.floor(speeds.length*0.10)]||0,
          p90=speeds[Math.floor(speeds.length*0.90)]||1;
      if(p90-p10<1)p90=p10+1;
      var layers=[];
      for(var k=0;k<N-1;k+=step){
        var end=Math.min(k+step,N-1);
        var col=g.hasTime?heatColor((G.pts[end].sp-p10)/(p90-p10)):"#F5B917"; /* 시간 없으면 노란 단색 */
        layers.push(L.polyline(G.lls.slice(k,end+1),{color:col,weight:5,opacity:.95}));
      }
      G.segs=L.layerGroup(layers).addTo(G.map);
      /* ☕ 휴식 지점: 빈 원 + 탭하면 몇 분 쉬었는지 */
      if(G.rests)G.map.removeLayer(G.rests);
      G.rests=null;
      if(g.rests&&g.rests.length){
        G.rests=L.layerGroup(g.rests.map(function(r){
          return L.circleMarker([r.la,r.lo],{radius:9,color:"#152A55",weight:3,
            fillColor:"#fff",fillOpacity:.25})
            .bindTooltip("☕ "+r.min+"분 휴식");})).addTo(G.map);
      }
      G.dot=L.circleMarker(G.lls[0],{radius:8,color:"#fff",weight:3,fillColor:"#152A55",fillOpacity:1}).addTo(G.map);
      drawElevBase();renderPos();
      setTimeout(play,600);   /* 지도 뜨면 자동 재생 */
    }).catch(function(e){
      gTitle.textContent="🗺 불러오기 실패 — "+(e&&e.message?e.message:"알 수 없는 오류");
      if(window.console)console.error("GPX player:",e);
    });
  }

  /* ══════ 3D 주행 보기 (Cesium — Relive 스타일) ══════ */
  var C3={viewer:null,pts:null,lls:null,T:0,u:0,playing:false,speed:1,raf:0,last:0,
          auto:true,head:0,heat:null,dot:null,title:""};
  var g3dbox=document.getElementById("g3dbox"),g3dPlay=document.getElementById("g3dPlay"),
      g3dSeek=document.getElementById("g3dSeek"),g3dSpeed=document.getElementById("g3dSpeed"),
      g3dCam=document.getElementById("g3dCam"),g3dStats=document.getElementById("g3dStats"),
      g3dTitle=document.getElementById("g3dTitle"),g3dHint=document.getElementById("g3dHint"),
      g3dElev=document.getElementById("g3dElev");
  function c3ElevBase(){ /* 3D용 고도 프로필 — 2D drawElevBase와 동일 로직 */
    var dpr=window.devicePixelRatio||1,W=g3dElev.clientWidth,H=120;
    if(!W){C3.eb=null;C3.elevBase=null;return;}
    g3dElev.width=W*dpr;g3dElev.height=H*dpr;
    var ctx=g3dElev.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    var pts=C3.pts,km=pts[pts.length-1].d;
    var minE=1e9,maxE=-1e9;
    pts.forEach(function(p){if(p.el<minE)minE=p.el;if(p.el>maxE)maxE=p.el;});
    if(maxE-minE<50)maxE=minE+50;
    C3.eb={W:W,H:H,minE:minE,maxE:maxE,km:km,
      x:function(d){return 8+(W-16)*(d/km);},
      y:function(e){return H-18-(H-34)*((e-C3.eb.minE)/(C3.eb.maxE-C3.eb.minE));}};
    ctx.fillStyle="#131A2E";ctx.fillRect(0,0,W,H);
    ctx.beginPath();ctx.moveTo(C3.eb.x(0),H-18);
    pts.forEach(function(p){ctx.lineTo(C3.eb.x(p.d),C3.eb.y(p.el));});
    ctx.lineTo(C3.eb.x(km),H-18);ctx.closePath();
    ctx.fillStyle="rgba(245,185,23,.25)";ctx.fill();
    ctx.beginPath();
    pts.forEach(function(p,i){i?ctx.lineTo(C3.eb.x(p.d),C3.eb.y(p.el)):ctx.moveTo(C3.eb.x(p.d),C3.eb.y(p.el));});
    ctx.strokeStyle="#F5B917";ctx.lineWidth=1.6;ctx.stroke();
    ctx.fillStyle="#8A93A6";ctx.font="10px sans-serif";
    ctx.fillText(Math.round(C3.eb.maxE)+"m",8,14);
    ctx.fillText(Math.round(C3.eb.minE)+"m",8,H-6);
    C3.elevBase=ctx.getImageData(0,0,g3dElev.width,g3dElev.height);
  }
  function c3ElevCursor(i){ /* ⚠ setTransform 절대 배율 — dpr 중복 금지 (2D에서 잡은 버그) */
    if(!C3.eb||!C3.elevBase)return;
    var ctx=g3dElev.getContext("2d"),dpr=window.devicePixelRatio||1;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.putImageData(C3.elevBase,0,0);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    var p=C3.pts[i],x=C3.eb.x(p.d),y=C3.eb.y(p.el);
    ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,6);ctx.lineTo(x,C3.eb.H-18);ctx.stroke();
    ctx.fillStyle="#F5B917";ctx.beginPath();ctx.arc(x,y,5.5,0,7);ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,5.5,0,7);ctx.stroke();
  }
  function loadCesium(){
    if(window.Cesium)return Promise.resolve();
    return new Promise(function(res,rej){
      var css=document.createElement("link");css.rel="stylesheet";
      css.href="https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/Widgets/widgets.css";
      document.head.appendChild(css);
      var js=document.createElement("script");
      js.src="https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/Cesium.js";
      js.onload=res;js.onerror=function(){rej(new Error("Cesium 로드 실패 — 네트워크 확인"));};
      document.head.appendChild(js);
    });
  }
  function c3IdxAt(u){ /* 거리 축 재생 (2D와 동일) */
    var target=u*C3.T,lo=0,hi=C3.pts.length-1;
    while(lo<hi){var mid=(lo+hi)>>1;if(C3.pts[mid].d<target)lo=mid+1;else hi=mid;}return lo;}
  function bearingRad(a,b){ /* 진행 방향(라디안) */
    var r=Math.PI/180,la1=a.la*r,la2=b.la*r,dlo=(b.lo-a.lo)*r;
    return Math.atan2(Math.sin(dlo)*Math.cos(la2),
      Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dlo));}
  function lerpAngle(a,b,t){var d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
    return a+d*t;}
  function c3Render(){
    if(!C3.pts||!C3.pts.length||!C3.dot)return;   /* 로드 실패 상태 가드 */
    var i=c3IdxAt(C3.u),p=C3.pts[i];
    var pos=Cesium.Cartesian3.fromDegrees(p.lo,p.la);
    C3.dot.position=pos;
    c3ElevCursor(i);                       /* 고도 커서 — 지도 점과 같은 인덱스로 완전 동기 */
    if(C3.auto){ /* Relive식 추적 카메라: 진행 방향 뒤에서 비스듬히 */
      var j=i;while(j<C3.pts.length-1&&C3.pts[j].d-p.d<150)j++;   /* 150m 앞 지점으로 방위 */
      var hd=bearingRad(p,C3.pts[Math.max(j,Math.min(i+1,C3.pts.length-1))]);
      C3.head=lerpAngle(C3.head,hd,0.08);                          /* 부드럽게 회전 */
      C3.viewer.camera.lookAt(pos,
        new Cesium.HeadingPitchRange(C3.head,Cesium.Math.toRadians(-28),1000));
    }
    g3dSeek.value=Math.round(1000*C3.u);
    var txt=(p.d/1000<10?(p.d/1000).toFixed(2):(p.d/1000).toFixed(1))+" km · 고도 "+Math.round(p.el)+" m";
    if(C3.hasTime){txt+=" · "+Math.round(p.sp)+" km/h";
      var m=Math.floor(p.tt/60);txt+=" · "+Math.floor(m/60)+":"+("0"+(m%60)).slice(-2);}
    g3dStats.textContent=txt;
    C3.viewer.scene.requestRender();
  }
  function c3Tick(ts){
    if(!C3.playing)return;
    if(!C3.last)C3.last=ts;
    var dt=(ts-C3.last)/1000;C3.last=ts;
    C3.u+=dt*C3.speed/(BASE_SEC*2);   /* 3D는 1×를 2D의 절반 속도로 — 지형 감상용 */
    if(C3.u>=1){C3.u=1;c3Pause();}
    c3Render();
    if(C3.playing)C3.raf=requestAnimationFrame(c3Tick);
  }
  function c3Play(){if(!C3.pts||!C3.pts.length||!C3.dot)return;
    if(C3.u>=1)C3.u=0;
    C3.playing=true;C3.last=0;g3dPlay.textContent="⏸ 정지";C3.raf=requestAnimationFrame(c3Tick);}
  function c3Pause(){C3.playing=false;cancelAnimationFrame(C3.raf);g3dPlay.textContent="▶ 재생";}
  function c3SetAuto(on){
    C3.auto=on;g3dCam.textContent=on?"자동":"수동";
    g3dHint.style.opacity=on?"1":"0";
    if(!on)C3.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); /* 카메라 잠금 해제 */
    else c3Render();
  }
  g3dPlay.addEventListener("click",function(){C3.playing?c3Pause():c3Play();});
  g3dSpeed.addEventListener("click",function(){
    C3.speed=C3.speed===1?2:(C3.speed===2?4:1);g3dSpeed.textContent=C3.speed+"×";});
  g3dSeek.addEventListener("input",function(){c3Pause();C3.u=g3dSeek.value/1000;c3Render();});
  g3dCam.addEventListener("click",function(){c3SetAuto(!C3.auto);});
  function closeG3d(){c3Pause();g3dbox.classList.remove("show");}
  document.getElementById("g3dClose").addEventListener("click",closeG3d);
  document.getElementById("g3dTo2d").addEventListener("click",function(){
    /* 2D로 복귀 — 재생 위치 유지 */
    closeG3d();G.u=C3.u;gpxbox.classList.add("show");renderPos();});
  document.getElementById("gpxTo3d").addEventListener("click",function(){
    if(!PHOTOS.cesiumToken||/여기에/.test(PHOTOS.cesiumToken)){
      alert("3D 보기를 쓰려면 PHOTOS.cesiumToken에 Cesium Ion 토큰을 넣어주세요 (cesium.com/ion)");return;}
    pause();gpxbox.classList.remove("show");
    open3d(gpxCache_lastId,G.u);
  });
  var gpxCache_lastId=null;   /* 마지막으로 연 GPX id — openGpx에서 기록 */
  function open3d(id,startU){
    g3dbox.classList.add("show");
    g3dTitle.textContent="⛰ 3D 로딩 중…";
    Promise.all([loadCesium(),fetchGpx(id)]).then(function(rr){  /* 캐시 없으면 여기서 직접 로드 */
      if(!g3dbox.classList.contains("show"))return; /* 로딩 중 닫음 */
      var g=rr[1];
      C3.pts=g.pts;
      C3.T=g.pts.length?g.pts[g.pts.length-1].d:1;  /* 재생 축 = 총 주행거리 */
      C3.hasTime=g.hasTime;
      C3.u=startU||0;C3.speed=1;g3dSpeed.textContent="1×";
      g3dTitle.innerHTML="⛰ "+C3.title+" · "+g.km.toFixed(1)+"km · ↑"+g.gain+"m"
        +(g.rests&&g.rests.length?" · ☕ 휴식 "+g.rests.length+"회":"")
        +(g.hasTime?' · <span style="font-weight:400;color:#8A93A6;font-size:.72rem">경로 색 = 속도 (🔵 느림 → 🔴 빠름)</span>':"");
      if(!C3.viewer){
        Cesium.Ion.defaultAccessToken=PHOTOS.cesiumToken;
        C3.viewer=new Cesium.Viewer("g3dMap",{
          terrain:Cesium.Terrain.fromWorldTerrain(),   /* 3차원 지형 */
          animation:false,timeline:false,baseLayerPicker:false,geocoder:false,
          homeButton:false,sceneModePicker:false,navigationHelpButton:false,
          fullscreenButton:false,infoBox:false,selectionIndicator:false,
          requestRenderMode:true});
        C3.viewer.scene.globe.depthTestAgainstTerrain=true;
        /* 화면을 만지면 자동 카메라 해제 (핀치 줌·패닝 지원) */
        C3.viewer.canvas.addEventListener("pointerdown",function(){if(C3.auto)c3SetAuto(false);});
        C3.viewer.canvas.addEventListener("wheel",function(){if(C3.auto)c3SetAuto(false);},{passive:true});
      }
      if(C3.heat){
        (C3.heatGround?C3.viewer.scene.groundPrimitives:C3.viewer.scene.primitives).remove(C3.heat);
        C3.heat=null;}
      if(C3.dot)C3.viewer.entities.remove(C3.dot);
      /* 속도 히트맵 (2D와 동일한 스케일: ~700구간 · 10~90백분위 정규화) */
      var N3=g.pts.length,step3=Math.max(1,Math.ceil(N3/700));
      var sp3=[];for(var k=step3;k<N3;k+=step3)sp3.push(g.pts[k].sp);
      sp3.sort(function(a,b){return a-b;});
      var q10=sp3[Math.floor(sp3.length*0.10)]||0,
          q90=sp3[Math.floor(sp3.length*0.90)]||1;
      if(q90-q10<1)q90=q10+1;
      var colAt=function(endIdx){return Cesium.ColorGeometryInstanceAttribute.fromColor(
        Cesium.Color.fromCssColorString(
          g.hasTime?heatColor((g.pts[endIdx].sp-q10)/(q90-q10)):"#F5B917"));};
      var groundOK=Cesium.GroundPolylinePrimitive.isSupported(C3.viewer.scene);
      if(groundOK){
        /* 데스크톱 등: 지면 밀착선 한 프리미티브로 (최고 품질) */
        var inst=[];
        for(var k=0;k<N3-1;k+=step3){
          var end=Math.min(k+step3,N3-1),pos=[];
          for(var q=k;q<=end;q++)pos.push(g.pts[q].lo,g.pts[q].la);
          inst.push(new Cesium.GeometryInstance({
            geometry:new Cesium.GroundPolylineGeometry({
              positions:Cesium.Cartesian3.fromDegreesArray(pos),width:5}),
            attributes:{color:colAt(end)}}));
        }
        C3.heat=C3.viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
          geometryInstances:inst,appearance:new Cesium.PolylineColorAppearance()}));
        C3.heatGround=true;
      }else{
        /* 일부 폰 GPU/웹뷰: 지면 밀착선 미지원 → 지형 높이를 샘플링해 일반 색상선으로 (색 동일) */
        if(window.console)console.log("3D: GroundPolyline 미지원 → 지형 샘플링 폴백");
        var idxs=[];for(var k=0;k<N3-1;k+=step3)idxs.push(k);idxs.push(N3-1);
        var carts=idxs.map(function(i){return Cesium.Cartographic.fromDegrees(g.pts[i].lo,g.pts[i].la);});
        var buildFlat=function(cs){
          var inst=[];
          for(var m=0;m<idxs.length-1;m++){
            var a=cs[m],b=cs[m+1];
            inst.push(new Cesium.GeometryInstance({
              geometry:new Cesium.PolylineGeometry({positions:[
                Cesium.Cartesian3.fromRadians(a.longitude,a.latitude,(a.height||0)+4),
                Cesium.Cartesian3.fromRadians(b.longitude,b.latitude,(b.height||0)+4)],
                width:5,vertexFormat:Cesium.PolylineColorAppearance.VERTEX_FORMAT}),
              attributes:{color:colAt(idxs[m+1])}}));
          }
          C3.heat=C3.viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances:inst,appearance:new Cesium.PolylineColorAppearance()}));
          C3.heatGround=false;
          C3.viewer.scene.requestRender();
        };
        Cesium.sampleTerrainMostDetailed(C3.viewer.terrainProvider,carts)
          .then(buildFlat)
          .catch(function(){buildFlat(carts);});   /* 샘플 실패 시 지표 근사 */
      }
      /* requestRenderMode에서 비동기 지형·프리미티브가 뜨도록 첫 8초간 렌더 보장 */
      (function(){var t0=Date.now(),iv=setInterval(function(){
        C3.viewer.scene.requestRender();
        if(Date.now()-t0>8000)clearInterval(iv);},250);})();
      /* ☕ 휴식 지점: 빈 원 + 분 라벨 */
      if(C3.rests)C3.rests.forEach(function(e){C3.viewer.entities.remove(e);});
      C3.rests=[];
      (g.rests||[]).forEach(function(r){
        C3.rests.push(C3.viewer.entities.add({
          position:Cesium.Cartesian3.fromDegrees(r.lo,r.la),
          point:{pixelSize:14,color:Cesium.Color.WHITE.withAlpha(0.2),
            outlineColor:Cesium.Color.fromCssColorString("#152A55"),outlineWidth:3,
            heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance:Number.POSITIVE_INFINITY},
          label:{text:"☕"+r.min+"분",font:"12px sans-serif",
            fillColor:Cesium.Color.WHITE,showBackground:true,
            backgroundColor:Cesium.Color.fromCssColorString("#152A55").withAlpha(0.8),
            pixelOffset:new Cesium.Cartesian2(0,-20),
            heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance:Number.POSITIVE_INFINITY}}));
      });
      C3.dot=C3.viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(g.pts[0].lo,g.pts[0].la),
        point:{pixelSize:13,color:Cesium.Color.fromCssColorString("#152A55"),
          outlineColor:Cesium.Color.WHITE,outlineWidth:3,
          heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance:Number.POSITIVE_INFINITY}});
      C3.head=bearingRad(g.pts[0],g.pts[Math.min(5,g.pts.length-1)]);
      c3ElevBase();                        /* 지도 아래 주행 고도 프로필 */
      c3SetAuto(true);
      c3Render();
      setTimeout(c3Play,800);   /* 지형 뜨면 자동 재생 */
    }).catch(function(e){
      g3dTitle.textContent="⛰ 3D 로드 실패 — "+(e&&e.message?e.message:"토큰·네트워크 확인");
    });
  }

  function init(){
    if(!PHOTOS.apiKey||/여기에/.test(PHOTOS.apiKey)){
      for(var d=1;d<=PHOTOS.dayCount;d++)mountDay(d,null);
      return;
    }
    drive("'"+PHOTOS.parentId+"' in parents and trashed=false")
    .then(function(items){
      var map={},foodId=null;
      items.forEach(function(f){
        if(f.mimeType==="application/vnd.google-apps.folder"){
          var m=f.name.match(/^day\s*(\d{1,2})$/i);
          if(m)map[parseInt(m[1],10)]=f.id;
          else if(/^food$/i.test(f.name))foodId=f.id;}});
      /* ── Ⅸ 식당 섹션: food 폴더 이미지 자동 배치 ── */
      if(foodId)drive("'"+foodId+"' in parents and trashed=false").then(function(fs){
        var imgs=fs.filter(function(x){return IMG_RE.test(x.name);});
        var fdItems=[],byDay={},ov=null;
        imgs.sort(function(a,b){return a.name.localeCompare(b.name);});
        imgs.forEach(function(f){
          var m=f.name.match(/^Day(\d{1,2})_/i);
          if(m)byDay[parseInt(m[1],10)]=f;
          else if(/^00_/.test(f.name))ov=f;});
        var seq=[];if(ov)seq.push(ov);
        for(var d=1;d<=13;d++)if(byDay[d])seq.push(byDay[d]);
        seq.forEach(function(f){fdItems.push({id:f.id,vid:false,tl:f.thumbnailLink||null});});
        var mountFd=function(box,f,gi,w){
          box.style.display="";
          var img=box.querySelector("img");
          setImg(img,f.id,w,false,f.thumbnailLink||null);
          box.style.cursor="zoom-in";
          box.addEventListener("click",function(){gallery=fdItems;show(gi);});};
        var gi=0;
        if(ov){mountFd(document.getElementById("fdOverview"),ov,gi++,1200);}
        for(var d=1;d<=13;d++){
          if(!byDay[d])continue;
          var box=document.querySelector('.fd-img[data-fd="'+d+'"]');
          if(box)mountFd(box,byDay[d],gi,300);
          gi++;
        }
      }).catch(function(){});
      var chain=Promise.resolve();
      var d;
      var run=function(day){
        chain=chain.then(function(){
          if(!map[day]){mountDay(day,null);return;}
          return drive("'"+map[day]+"' in parents and trashed=false")
            .then(function(fs){mountDay(day,fs.filter(function(x){return MEDIA_RE.test(x.name);}));})
            .catch(function(){mountDay(day,null);});
        });};
      for(d=1;d<=PHOTOS.dayCount;d++)run(d);
      return chain;
    })
    .catch(function(){ /* 키 오류·오프라인 → 빈 프레임 */
      for(var d=1;d<=PHOTOS.dayCount;d++)mountDay(d,null);
    });
  }
  /* DAY 카드가 camino-days.html 에서 들어온 뒤에 시작 */
  if(window.onCaminoDays) window.onCaminoDays(init);
  else if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();

/* ── 블록 3 ── */
/* ══════════════════════════════════════════════════════════════════════
   DAY별 명소 데이터
   k=한글명 · o=현지명(스페인어/프랑스어) · e=영문명 · d=한글 설명
   w="위키언어|문서제목"  q=위키미디어 커먼즈 검색어(사진 예비 검색)
   ══════════════════════════════════════════════════════════════════════ */
var CAMINO_SPOTS = {
1:[
 {k:"생장피에드포르 구시가지",o:"Saint-Jean-Pied-de-Port",e:"Saint-Jean-Pied-de-Port Old Town",w:"fr|Saint-Jean-Pied-de-Port",q:"Saint-Jean-Pied-de-Port rue de la Citadelle",
  d:"프랑스 바스크 지방의 붉은 사암 마을로, 카미노 프란세스 800km가 시작되는 출발점입니다. 성벽으로 둘러싸인 구시가지의 시타델 언덕에 오르면 넘어야 할 피레네 산맥이 한눈에 들어옵니다. 순례자 사무소에서 크레덴시알(순례자 여권)을 발급받고 첫 세요(도장)를 찍는 곳입니다."},
 {k:"오리송 전망대",o:"Orisson",e:"Orisson Viewpoint",w:"|",q:"Orisson Route Napoleon Pyrenees",
  d:"생장에서 나폴레옹 루트를 8km 남짓 치고 올라간 해발 약 800m 지점의 산장 겸 전망대입니다. 발아래로 초원과 계곡이 겹겹이 펼쳐지고 양떼가 풀을 뜯는 풍경이 이어집니다. 첫날 가장 힘든 오르막에 대한 보상 같은 장소라 잠시 멈춰 숨을 고르기 좋습니다."},
 {k:"론세스바예스 왕립 수도원",o:"Real Colegiata de Santa María de Roncesvalles",e:"Royal Collegiate Church of Roncesvalles",w:"es|Real Colegiata de Roncesvalles",q:"Colegiata de Roncesvalles",
  d:"피레네를 넘어 스페인 땅에서 처음 만나는 13세기 고딕 수도원입니다. 은과 보석으로 장식된 성모상, 산초 7세 왕의 무덤, 롤랑의 전설이 깃든 곳입니다. 매일 저녁 순례자 미사와 여러 언어로 진행되는 축복 기도가 열려 순례의 시작을 실감하게 합니다."},
 {k:"수비리 중세 다리",o:"Puente de la Rabia",e:"Bridge of the Rabies",w:"|",q:"Puente de la Rabia Zubiri",
  d:"아르가 강을 건너 수비리 마을로 들어가는 14세기 고딕 다리입니다. 가축을 이 다리 아래 교각을 세 바퀴 돌게 하면 광견병이 낫는다는 전설에서 '라비아(광견병) 다리'라는 이름이 붙었습니다. 첫날 48km, 획득고도 1,350m를 마무리하는 상징적인 도착 지점입니다."}
],
2:[
 {k:"팜플로나 대성당",o:"Catedral de Santa María la Real de Pamplona",e:"Pamplona Cathedral",w:"es|Catedral de Pamplona",q:"Catedral de Pamplona claustro",
  d:"신고전주의 파사드 뒤에 15세기 고딕 본당과 스페인에서 손꼽히는 아름다운 회랑을 감추고 있는 대성당입니다. 나바라 왕 카를로스 3세 부부의 설화석고 무덤이 본당 중앙에 놓여 있습니다. 부속 교구 박물관(Occidens)까지 둘러보면 팜플로나에서 가장 볼거리가 많은 곳입니다."},
 {k:"카스티요 광장",o:"Plaza del Castillo",e:"Castle Square",w:"es|Plaza del Castillo (Pamplona)",q:"Plaza del Castillo Pamplona",
  d:"팜플로나 시민 생활의 중심이 되는 아케이드 광장입니다. 헤밍웨이가 소설 《태양은 다시 떠오른다》를 쓰며 즐겨 앉았던 카페 이루냐가 이 광장에 있습니다. 산 페르민 축제 때 소몰이가 지나는 골목들이 이곳에서 사방으로 뻗어 나갑니다."},
 {k:"푸엔테 라 레이나 로마네스크 다리",o:"Puente Románico de Puente la Reina",e:"Romanesque Bridge of Puente la Reina",w:"es|Puente la Reina",q:"Puente la Reina puente romanico",
  d:"11세기 나바라 왕비가 순례자를 위해 놓아 마을 이름까지 '왕비의 다리'가 된 여섯 아치의 로마네스크 다리입니다. 프랑스에서 내려온 여러 길과 아라곤 길이 바로 이 지점에서 하나로 합쳐집니다. 카미노를 상징하는 가장 유명한 다리로, 강물에 비친 아치가 사진 포인트입니다."},
 {k:"에스테야 구시가지",o:"Casco Antiguo de Estella",e:"Estella Old Town",w:"es|Estella-Lizarra",q:"Estella Navarra casco antiguo",
  d:"'북쪽의 톨레도'라 불릴 만큼 로마네스크 건축이 밀집한 중세 도시입니다. 스페인에 몇 남지 않은 로마네스크 왕궁인 나바라 왕궁과 산 페드로 데 라 루아 성당의 회랑이 대표 볼거리입니다. 에가 강을 낀 좁은 골목과 계단길이 그대로 남아 있어 하루를 마무리하기 좋습니다."}
],
3:[
 {k:"이라체 수도원",o:"Monasterio de Irache",e:"Irache Monastery",w:"es|Monasterio de Irache",q:"Monasterio de Irache",
  d:"10세기부터 순례자를 돌보아 온 베네딕토회 수도원으로, 로마네스크 교회에 르네상스 회랑이 더해진 구조입니다. 16세기에는 대학으로도 쓰였을 만큼 이 지역 학문의 중심이었습니다. 지금은 조용한 회랑을 자유롭게 둘러볼 수 있어 아침 라이딩의 첫 쉼표가 됩니다."},
 {k:"이라체 와인 분수",o:"Fuente del Vino de Irache",e:"Irache Wine Fountain",w:"|",q:"Fuente del vino Irache bodegas",
  d:"보데가스 이라체가 순례자에게 와인을 무료로 내어주는 벽면 수도꼭지입니다. 왼쪽에서는 리오하 레드와인이, 오른쪽에서는 물이 나옵니다. \"산티아고까지 힘차게 가려거든 이 샘에서 한 잔\"이라는 문구가 새겨져 있지만, 자전거 순례자는 라이딩 중이니 상징적으로 한 모금만 권합니다."},
 {k:"로스 아르코스 산타 마리아 성당",o:"Iglesia de Santa María de Los Arcos",e:"Church of Santa María de Los Arcos",w:"es|Iglesia de Santa María de Los Arcos",q:"Iglesia Santa Maria Los Arcos Navarra retablo",
  d:"작은 마을 규모에 비해 놀랍도록 화려한 성당으로, 카미노의 '숨은 보석'으로 불립니다. 금빛으로 뒤덮인 바로크 제단화와 회전하는 듯한 장식이 문을 여는 순간 압도합니다. 고딕 회랑과 르네상스 종탑까지 양식이 층층이 쌓여 있습니다."},
 {k:"로그로뇨 산타 마리아 라 레돈다 공동대성당",o:"Concatedral de Santa María de la Redonda",e:"Co-Cathedral of Santa María de la Redonda",w:"es|Concatedral de Santa María de la Redonda",q:"Concatedral Santa Maria la Redonda Logrono",
  d:"'쌍둥이 탑'이라 불리는 두 개의 바로크 탑이 인상적인 라 리오하의 대표 성당입니다. 원형 로마네스크 교회 자리에 세워져 '라 레돈다(둥근)'라는 이름이 붙었습니다. 내부에 미켈란젤로 화풍의 십자가 그림이 소장되어 있습니다."},
 {k:"로그로뇨 구시가지",o:"Casco Antiguo de Logroño",e:"Logroño Old Town",w:"es|Logroño",q:"Logrono calle Laurel pinchos",
  d:"라 리오하 와인의 수도이자 카미노에서 손꼽히는 미식 도시입니다. 저녁이면 라우렐 거리(Calle Laurel)의 수십 개 바가 저마다 한 가지 핀초만 전문으로 내놓습니다. 버섯 꼬치, 감자 요리에 리오하 와인 한 잔을 곁들이며 순례 중 가장 즐거운 저녁을 보낼 수 있습니다."}
],
4:[
 {k:"나헤라 산타 마리아 라 레알 수도원",o:"Monasterio de Santa María la Real de Nájera",e:"Monastery of Santa María la Real of Nájera",w:"es|Monasterio de Santa María la Real (Nájera)",q:"Monasterio Santa Maria la Real Najera claustro",
  d:"붉은 사암 절벽 아래 동굴 위에 세워진 11세기 왕립 수도원입니다. 나바라와 카스티야 왕들이 잠든 판테온, 레이스처럼 정교한 '기사의 회랑', 16세기 성가대석 조각이 백미입니다. 절벽과 건물이 한 몸처럼 붙어 있는 독특한 풍경을 보여줍니다."},
 {k:"산토 도밍고 데 라 칼사다 대성당",o:"Catedral de Santo Domingo de la Calzada",e:"Santo Domingo de la Calzada Cathedral",w:"es|Catedral de Santo Domingo de la Calzada",q:"Catedral Santo Domingo de la Calzada gallinero",
  d:"성당 안에서 살아 있는 흰 수탉과 암탉을 기르는, 세계에서 유일한 대성당입니다. 억울하게 처형당한 순례자를 성인이 살려냈다는 '닭의 기적' 전설에서 비롯된 전통입니다. 순례자를 위해 길과 다리를 놓은 성 도밍고의 무덤과 로마네스크 후진도 함께 볼 수 있습니다."},
 {k:"라 리오하 포도밭",o:"Viñedos de La Rioja",e:"La Rioja Vineyards",w:"es|La Rioja (España)",q:"La Rioja vineyards landscape",
  d:"나헤라에서 벨로라도까지 붉은 흙과 포도나무의 물결이 끝없이 이어집니다. 5월이면 새순이 올라와 줄줄이 초록빛으로 물들고, 멀리 눈이 남은 시에라 데 라 데만다 산맥이 배경이 됩니다. 자전거 속도로 달릴 때 가장 아름다운 구간 중 하나입니다."}
],
5:[
 {k:"산 후안 데 오르테가 수도원",o:"Monasterio de San Juan de Ortega",e:"Monastery of San Juan de Ortega",w:"es|San Juan de Ortega (Burgos)",q:"Iglesia San Juan de Ortega Burgos",
  d:"험한 산길에 다리와 순례자 숙소를 지어 길을 닦은 성 후안을 기리는 12세기 로마네스크 성당입니다. 춘분과 추분 무렵 오후 햇빛이 수태고지 주두를 정확히 비추는 '빛의 기적'으로 유명합니다. 깊은 참나무 숲 한가운데라 인적이 드물고 고요합니다."},
 {k:"부르고스 대성당",o:"Catedral de Santa María de Burgos",e:"Burgos Cathedral",w:"es|Catedral de Burgos",q:"Catedral de Burgos exterior",
  d:"유네스코 세계유산이자 스페인 고딕 건축의 정점으로 꼽히는 대성당입니다. 별처럼 뚫린 팔각 랜턴 돔 아래에 엘 시드 부부의 무덤이 있고, 황금 계단과 파피모스카 시계 인형이 유명합니다. 카미노 전체에서 가장 압도적인 건축물이라 시간을 넉넉히 쓸 만합니다."},
 {k:"부르고스 구시가지",o:"Casco Antiguo de Burgos",e:"Burgos Old Town",w:"es|Burgos",q:"Burgos Arco de Santa Maria",
  d:"아를란손 강변 산책로와 개선문 같은 산타 마리아 문, 엘 시드 기마상이 이어지는 도시입니다. 강가 플라타너스 그늘 아래 벤치가 많아 자전거를 세우고 쉬기 좋습니다. 모르시야(선지 순대)와 부르고스 프레시 치즈가 이 도시의 대표 먹거리입니다."},
 {k:"오르니요스 델 카미노",o:"Hornillos del Camino",e:"Hornillos del Camino",w:"es|Hornillos del Camino",q:"Hornillos del Camino village",
  d:"메세타 한가운데 길 하나만 관통하는 전형적인 카미노 마을입니다. 밀밭 사이에 낮게 엎드린 돌집들과 종탑, 그리고 마을 어귀의 수탉 조형물이 전부입니다. 순례길 특유의 고요함과 단순함이 가장 잘 드러나는 곳입니다."},
 {k:"카스트로헤리스 성",o:"Castillo de Castrojeriz",e:"Castrojeriz Castle",w:"es|Castrojeriz",q:"Castillo de Castrojeriz",
  d:"마을 위 원뿔형 언덕에 서 있는 9세기 성채 유적입니다. 해 질 무렵 올라가면 끝없이 펼쳐진 메세타 평원과 마을의 붉은 지붕이 황금빛으로 물듭니다. 이날 96.5km를 달린 뒤 맞이하는 보상 같은 전망입니다."}
],
6:[
 {k:"프로미스타 산 마르틴 성당",o:"Iglesia de San Martín de Frómista",e:"Church of San Martín de Frómista",w:"es|Iglesia de San Martín de Tours (Frómista)",q:"Iglesia San Martin de Fromista",
  d:"1066년에 세워진 스페인 로마네스크 건축의 교과서 같은 성당입니다. 군더더기 없는 완벽한 비례와 원통형 탑 두 개가 특징입니다. 처마를 따라 사람·동물·괴물을 새긴 300여 개의 칸세요 조각을 하나씩 찾아보는 재미가 있습니다."},
 {k:"카리온 산타 마리아 델 카미노 성당",o:"Iglesia de Santa María del Camino",e:"Church of Santa María del Camino",w:"es|Iglesia de Santa María del Camino (Carrión de los Condes)",q:"Santa Maria del Camino Carrion de los Condes",
  d:"무어인에게 해마다 처녀 100명을 바치던 시절, 황소가 나타나 그들을 구했다는 전설이 남문 조각에 새겨진 12세기 로마네스크 성당입니다. 소박한 외관과 달리 문 주변 조각의 밀도가 대단합니다."},
 {k:"카리온 데 로스 콘데스",o:"Carrión de los Condes",e:"Carrión de los Condes",w:"es|Carrión de los Condes",q:"Carrion de los Condes San Zoilo",
  d:"중세에는 만 명이 넘게 살았던 순례길의 중심 도시로, 산 소일로 수도원의 플라테레스크 회랑이 백미입니다. 이곳을 지나면 그늘도 마을도 없는 로마 가도가 17km 이어집니다. 물과 간식을 반드시 채우고 출발해야 하는 지점입니다."},
 {k:"카스티야 메세타 평원",o:"Meseta Castellana",e:"Castilian Meseta",w:"es|Meseta Central",q:"Meseta Castilla wheat fields Camino",
  d:"지평선까지 밀밭과 하늘만 이어지는 해발 800m의 고원입니다. 걷는 순례자에게는 가장 힘든 구간이지만, 자전거로는 시원하게 속도를 낼 수 있습니다. 다만 그늘이 없고 맞바람이 변수라 아침 일찍 통과하는 편이 좋습니다."},
 {k:"사아군 라 페레그리나 성소",o:"Santuario de la Peregrina",e:"Sanctuary of La Peregrina",w:"es|Santuario de la Peregrina",q:"Santuario de la Peregrina Sahagun",
  d:"무데하르 양식 벽돌 건축이 아름다운 13세기 수도원으로, 언덕 위에서 마을을 내려다봅니다. 사아군은 카미노 프란세스의 지리적 중간 지점이라 이곳에서 '중간 지점 증명서(Carta Peregrina)'를 받을 수 있습니다."}
],
7:[
 {k:"엘 부르고 라네로 산 페드로 성당",o:"Iglesia de San Pedro de El Burgo Ranero",e:"Church of San Pedro",w:"es|El Burgo Ranero",q:"El Burgo Ranero iglesia adobe",
  d:"흙벽돌(아도베)로 지은 소박한 마을 성당입니다. 종탑 위 황새 둥지와 마을 어귀의 연못이 메세타 마을의 전형적인 풍경을 만듭니다. 화려함은 없지만 순례길이 지나온 시골의 얼굴을 보여주는 곳입니다."},
 {k:"만시야 데 라스 물라스 성벽",o:"Murallas de Mansilla de las Mulas",e:"Walls of Mansilla de las Mulas",w:"es|Mansilla de las Mulas",q:"Mansilla de las Mulas murallas",
  d:"12세기 성벽이 상당 부분 그대로 남아 있는 성곽 마을입니다. 두께 2m가 넘는 흙과 자갈 벽이 마을을 감싸고 네 개의 문이 남아 있습니다. 에슬라 강가에 자리해 레온에 들어가기 전 마지막으로 쉬어 가는 곳입니다."},
 {k:"에슬라강 다리",o:"Puente sobre el Río Esla",e:"Bridge over the Esla River",w:"es|Río Esla",q:"Rio Esla puente Mansilla",
  d:"만시야를 나서며 건너는 긴 다리로, 두에로 강의 가장 큰 지류인 에슬라 강을 지납니다. 강변 포플러 숲과 물새가 어우러진 초록빛 풍경이 잠시 이어집니다. 메마른 메세타에서 갑자기 물이 나타나는 반가운 구간입니다."},
 {k:"레온 대성당",o:"Catedral de León",e:"León Cathedral",w:"es|Catedral de León (España)",q:"Catedral de Leon vidrieras",
  d:"1,800㎡가 넘는 스테인드글라스 덕에 '빛의 대성당'이라 불리는 프랑스식 고딕 걸작입니다. 벽 대신 유리를 세운 듯한 구조라 해가 기울 무렵 들어가면 내부 전체가 색으로 물듭니다. 카미노에서 가장 감동적인 실내로 꼽히는 공간입니다."}
],
8:[
 {k:"레온 대성당",o:"Catedral de León",e:"León Cathedral",w:"es|Catedral de León (España)",q:"Leon cathedral stained glass interior",
  d:"휴식일이니 서두르지 말고 오디오 가이드를 빌려 천천히 둘러보기를 권합니다. 130개가 넘는 창을 채운 13~15세기 색유리와 장미창, 회랑의 벽화까지 시간이 넉넉해야 제대로 보입니다. 오후 늦은 빛이 가장 아름답습니다."},
 {k:"산 이시도로 대성당",o:"Real Colegiata de San Isidoro de León",e:"Basilica of San Isidoro",w:"es|Basílica de San Isidoro de León",q:"Panteon Real San Isidoro Leon frescos",
  d:"'로마네스크의 시스티나 성당'이라 불리는 왕실 판테온 천장화가 있는 성당입니다. 12세기 프레스코가 덧칠 없이 원형 그대로 남아 색이 놀랍도록 선명합니다. 레온 왕국 왕들의 무덤과 성 이시도로의 유해가 안치되어 있습니다."},
 {k:"카사 보티네스",o:"Casa Botines",e:"Casa Botines",w:"es|Casa Botines",q:"Casa Botines Leon Gaudi",
  d:"가우디가 바르셀로나 밖에 남긴 몇 안 되는 건물로, 1892년에 지은 네오고딕 양식의 상가 주택입니다. 뾰족한 첨탑과 화강암 외벽이 동화 속 성처럼 보입니다. 앞 벤치에 앉아 있는 가우디 동상 옆자리가 사진 명소입니다."},
 {k:"산 마르코스 수도원",o:"Convento de San Marcos",e:"Convent of San Marcos",w:"es|Convento de San Marcos (León)",q:"Convento de San Marcos Leon fachada",
  d:"길이 100m에 달하는 화려한 플라테레스크 파사드를 지닌 옛 순례자 병원으로, 지금은 국영 파라도르 호텔로 쓰입니다. 앞 광장에는 십자가 발치에서 신발을 벗고 쉬는 지친 순례자 동상이 있어 많은 이들이 옆에 앉아 사진을 찍습니다."},
 {k:"레온 마요르 광장",o:"Plaza Mayor de León",e:"León Main Square",w:"es|Plaza Mayor de León",q:"Plaza Mayor de Leon",
  d:"17세기 아케이드에 둘러싸인 광장으로 수요일과 토요일에는 장이 섭니다. 광장 주변 바리오 우메도(Barrio Húmedo) 골목은 음료를 시키면 타파스를 무료로 내주는 전통으로 유명합니다. 휴식일 저녁을 보내기에 가장 좋은 동네입니다."},
 {k:"카스티야 이 레온 현대미술관",o:"MUSAC",e:"MUSAC Contemporary Art Museum",w:"es|Museo de Arte Contemporáneo de Castilla y León",q:"MUSAC Leon museum facade",
  d:"대성당 스테인드글라스에서 색을 뽑아낸 3,300여 장의 컬러 유리로 파사드를 만든 미술관입니다. 2007년 유럽 현대건축상(미스 반 데어 로에 상)을 받았습니다. 중세로 가득한 하루 끝에 전혀 다른 감각을 얹어 주는 장소입니다."}
],
9:[
 {k:"오르비고 다리",o:"Puente de Órbigo",e:"Órbigo Bridge",w:"es|Hospital de Órbigo",q:"Puente de Orbigo Paso Honroso",
  d:"20개의 아치가 이어지는 스페인에서 가장 긴 중세 다리 중 하나입니다. 1434년 기사 수에로 데 키뇨네스가 사랑의 맹세를 지키려 한 달 동안 이 다리를 막고 마상 창 시합을 벌인 '명예의 통로(Paso Honroso)'로 유명합니다. 돌바닥이 울퉁불퉁하니 자전거는 속도를 줄이는 편이 좋습니다."},
 {k:"아스토르가 대성당",o:"Catedral de Santa María de Astorga",e:"Astorga Cathedral",w:"es|Catedral de Astorga",q:"Catedral de Astorga fachada",
  d:"고딕에서 바로크까지 300년에 걸쳐 지어져 양식이 층층이 쌓인 대성당입니다. 색이 다른 두 개의 사암 탑과 은세공 제단화가 특징입니다. 바로 옆 가우디의 주교궁과 나란히 서 있어 한 프레임에 담을 수 있습니다."},
 {k:"아스토르가 주교궁",o:"Palacio Episcopal de Astorga",e:"Episcopal Palace of Astorga",w:"es|Palacio Episcopal de Astorga",q:"Palacio Episcopal de Astorga Gaudi",
  d:"가우디가 설계한 동화 속 성 같은 네오고딕 건물로, 지금은 카미노 박물관으로 쓰입니다. 흰 화강암과 뾰족한 첨탑, 빛이 쏟아지는 내부 아치가 인상적입니다. 아스토르가에서는 초콜릿과 만테카다(버터 카스텔라)도 함께 맛볼 만합니다."},
 {k:"라바날 델 카미노",o:"Rabanal del Camino",e:"Rabanal del Camino",w:"es|Rabanal del Camino",q:"Rabanal del Camino village",
  d:"이라고 산으로 오르기 전 마지막 돌담 마을로, 템플 기사단이 순례자를 보호하던 곳입니다. 산타 마리아 성당에서는 베네딕토회 수도사들이 저녁마다 그레고리오 성가로 만과를 드립니다. 해발 1,150m라 5월에도 밤에는 제법 쌀쌀합니다."}
],
10:[
 {k:"철십자가",o:"Cruz de Ferro",e:"Iron Cross",w:"es|Cruz de Ferro",q:"Cruz de Ferro Camino de Santiago",
  d:"해발 1,505m, 카미노 프란세스의 최고 지점에 서 있는 철 십자가입니다. 순례자들이 고향에서 가져온 돌을 발밑 돌무더기에 내려놓으며 짐과 근심을 함께 두고 가는, 순례길에서 가장 상징적인 장소입니다. 이른 아침에 도착하면 안개 속에 홀로 서 있는 십자가를 만날 수 있습니다."},
 {k:"몰리나세카 순례자 다리",o:"Puente de los Peregrinos de Molinaseca",e:"Pilgrims' Bridge of Molinaseca",w:"es|Molinaseca",q:"Molinaseca puente peregrinos rio Meruelo",
  d:"메루엘로 강을 건너는 중세 다리와 강변 천연 수영장이 있는 예쁜 마을입니다. 이라고 산의 가파른 자갈 내리막을 끝낸 직후라 발을 담그고 쉬어 가기에 완벽합니다. 돌바닥 골목과 문장이 새겨진 저택들이 잘 보존되어 있습니다."},
 {k:"폰페라다 템플 기사단 성",o:"Castillo de los Templarios de Ponferrada",e:"Templar Castle of Ponferrada",w:"es|Castillo de Ponferrada",q:"Castillo de los Templarios Ponferrada",
  d:"12세기 템플 기사단이 순례자를 보호하기 위해 세운 8,000㎡ 규모의 성입니다. 성벽 위를 걸어 돌 수 있고 내부에는 중세 필사본 복제본 도서관이 전시되어 있습니다. 카미노에서 가장 '성다운 성'이라 자전거를 세우고 들를 만합니다."},
 {k:"비에르소 포도밭",o:"Viñedos del Bierzo",e:"Bierzo Vineyards",w:"es|El Bierzo",q:"Bierzo vineyards landscape",
  d:"산으로 둘러싸인 분지의 온화한 기후 덕에 멘시아(Mencía) 품종 레드와인으로 이름난 산지입니다. 폰페라다에서 카카벨로스까지 포도밭과 체리 과수원이 번갈아 이어집니다. 갈리시아로 넘어가기 전 마지막으로 부드러운 풍경을 즐기는 구간입니다."},
 {k:"카카벨로스",o:"Cacabelos",e:"Cacabelos",w:"es|Cacabelos",q:"Cacabelos Leon village",
  d:"쿠아 강변의 와인 마을로, 고고학 박물관과 강 건너 킨타 앙구스티아 성소가 있습니다. 다음 날 오 세브레이로 대오르막을 앞두고 물과 먹거리를 넉넉히 보급하기 좋은 지점입니다."}
],
11:[
 {k:"오 세브레이로",o:"O Cebreiro",e:"O Cebreiro",w:"es|O Cebreiro",q:"O Cebreiro village Galicia",
  d:"해발 1,300m, 갈리시아의 관문이 되는 돌마을입니다. 8km에 걸쳐 이어지는 카미노 최대 난이도의 오르막 끝에 나타나 성취감이 남다릅니다. 안개가 자주 끼는 능선 위 마을 풍경이 비현실적으로 아름다워 많은 순례자가 최고의 장소로 꼽습니다."},
 {k:"오 세브레이로 산타 마리아 라 레알 성당",o:"Iglesia de Santa María la Real do Cebreiro",e:"Church of Santa María la Real of O Cebreiro",w:"es|Iglesia de Santa María la Real (O Cebreiro)",q:"Iglesia Santa Maria O Cebreiro",
  d:"9세기에 세워진 카미노에서 가장 오래된 성당 중 하나입니다. 눈보라를 뚫고 미사에 온 농부 앞에서 빵과 포도주가 살과 피로 변했다는 '성배의 기적' 전설이 전해집니다. 그 기적의 성배와 성반이 지금도 이곳에 보관되어 있습니다."},
 {k:"오 세브레이로 파요사 전통가옥",o:"Pallozas de O Cebreiro",e:"Traditional Pallozas of O Cebreiro",w:"es|Palloza",q:"Palloza O Cebreiro",
  d:"켈트 시대부터 이어진 타원형 돌집에 짚으로 이엉을 얹은 갈리시아 전통 가옥입니다. 사람과 가축이 한 지붕 아래 살던 구조로, 몇 채는 민속 박물관으로 공개되어 내부를 볼 수 있습니다."},
 {k:"산 로케 고개",o:"Alto de San Roque",e:"San Roque Pass",w:"|",q:"Alto de San Roque peregrino estatua Camino",
  d:"해발 1,270m 고개에 바람을 맞으며 걷는 거대한 순례자 청동상이 서 있습니다. 모자를 붙잡고 앞으로 나아가는 자세가 이 구간의 바람을 그대로 보여줍니다. 갈리시아의 산줄기가 겹겹이 펼쳐지는 최고의 전망 포인트입니다."},
 {k:"트리아카스텔라",o:"Triacastela",e:"Triacastela",w:"es|Triacastela",q:"Triacastela Galicia",
  d:"'세 개의 성'이라는 이름을 가진 계곡 마을로, 오 세브레이로 내리막이 끝나는 지점입니다. 중세 순례자들은 이곳에서 석회석을 짊어지고 산티아고까지 날라 대성당 건축을 도왔다고 합니다. 사모스 수도원 길과 산실 길이 여기서 갈라집니다."}
],
12:[
 {k:"포르토마린 산 니콜라스 성당",o:"Iglesia de San Nicolás de Portomarín",e:"Church of San Nicolás of Portomarín",w:"es|Iglesia de San Juan de Portomarín",q:"Iglesia San Nicolas Portomarin",
  d:"댐 건설로 마을이 수몰될 때 돌 하나하나에 번호를 매겨 언덕 위로 옮겨 재조립한 12세기 요새형 성당입니다. 지금도 벽돌에 새겨진 번호를 눈으로 찾아볼 수 있습니다. 장미창과 마태오 마에스트로 화풍의 정문 조각이 볼거리입니다."},
 {k:"미뇨강",o:"Río Miño",e:"Miño River",w:"es|Río Miño",q:"Portomarin puente rio Mino",
  d:"갈리시아에서 가장 긴 강으로, 벨레사르 저수지 위로 놓인 긴 다리를 건너 포르토마린으로 들어갑니다. 다리를 건넌 뒤 가파른 계단을 올라야 마을에 닿습니다. 가뭄으로 수위가 낮아지면 물속에 잠긴 옛 마을과 다리의 잔해가 드러납니다."},
 {k:"팔라스 데 레이 산 티르소 성당",o:"Iglesia de San Tirso de Palas de Rei",e:"Church of San Tirso",w:"es|Palas de Rei",q:"Palas de Rei igrexa San Tirso",
  d:"12세기 로마네스크 정문이 남아 있는 마을 성당입니다. 이름은 '왕의 궁전'이라는 뜻으로 서고트 왕의 거처가 있었다는 전설에서 유래했습니다. 산티아고까지 남은 거리를 알리는 표석이 촘촘해지는 구간의 중심 마을입니다."},
 {k:"멜리데 산타 마리아 성당",o:"Iglesia de Santa María de Melide",e:"Church of Santa María of Melide",w:"es|Melide",q:"Santa Maria de Melide igrexa romanica",
  d:"마을 외곽에 서 있는 12세기 로마네스크 성당으로, 후진 안쪽의 중세 프레스코화가 잘 남아 있습니다. 소박한 규모지만 갈리시아 로마네스크의 정취를 잘 보여줍니다."},
 {k:"멜리데",o:"Melide",e:"Melide",w:"es|Melide",q:"pulpo a feira Melide pulperia",
  d:"북쪽에서 내려온 카미노 프리미티보가 합류하는 갈리시아 미식의 중심 마을입니다. 문어를 구리솥에 삶아 나무 접시에 올리고 올리브유와 파프리카 가루를 뿌린 풀포 아 페이라(pulpo á feira)가 명물입니다. 순례자들이 일부러 점심시간을 맞춰 도착하는 곳입니다."},
 {k:"아르수아",o:"Arzúa",e:"Arzúa",w:"es|Arzúa",q:"Arzua queso Galicia",
  d:"부드럽고 크리미한 아르수아-우요아(Arzúa-Ulloa) 치즈로 유명한 마을입니다. 산티아고 전 마지막 큰 마을이라 여러 갈래에서 온 순례자들이 한꺼번에 모입니다. 이날 76.5km를 마무리하고 마지막 날을 준비하는 지점입니다."}
],
13:[
 {k:"오 페드로우소",o:"O Pedrouzo",e:"O Pedrouzo",w:"es|O Pino",q:"O Pedrouzo eucalyptus forest Camino",
  d:"유칼립투스 숲에 둘러싸인, 산티아고 20km 전 마지막 마을입니다. 이른 새벽 숲길로 출발하면 나무 사이로 빛이 스며드는 장면과 함께 특유의 향을 맡을 수 있습니다."},
 {k:"라바코야",o:"Lavacolla",e:"Lavacolla",w:"es|Lavacolla",q:"Lavacolla Santiago Camino",
  d:"중세 순례자들이 성지에 들어가기 전 개울에서 몸을 씻던 곳으로, 지명 자체가 '씻다'라는 말에서 유래했습니다. 지금은 산티아고 공항이 자리한 마을이라 하늘로 내려앉는 비행기를 보며 지나게 됩니다."},
 {k:"몬테 도 고소 · 기쁨의 언덕",o:"Monte do Gozo",e:"Mount of Joy",w:"es|Monte do Gozo",q:"Monte do Gozo monumento peregrinos",
  d:"대성당의 첨탑이 처음 눈에 들어오는 언덕으로, 순례자들이 환호했다 하여 '기쁨의 산'이라 불립니다. 요한 바오로 2세 방문 기념 조형물과 산티아고를 가리키는 두 순례자 동상이 서 있습니다. 여기서 대성당까지는 내리막 4.5km입니다."},
 {k:"산티아고 데 콤포스텔라 대성당",o:"Catedral de Santiago de Compostela",e:"Cathedral of Santiago de Compostela",w:"es|Catedral de Santiago de Compostela",q:"Catedral de Santiago de Compostela Obradoiro",
  d:"808km 순례의 종착점입니다. 마태오 장인의 걸작 '영광의 문'과 천장을 가로지르는 거대한 향로 보타푸메이로로 유명합니다. 정오 순례자 미사에서는 그날 도착한 순례자들의 출발지와 인원이 호명됩니다."},
 {k:"오브라도이로 광장",o:"Praza do Obradoiro",e:"Obradoiro Square",w:"es|Plaza del Obradoiro",q:"Praza do Obradoiro Santiago",
  d:"대성당의 바로크 정면을 마주 보는 광장으로, 모든 순례자의 도착 지점입니다. 배낭과 자전거를 내려놓고 바닥에 누워 첨탑을 올려다보는 사람들, 서로 얼싸안는 순례자들을 언제나 볼 수 있습니다. 광장 한가운데 0km 표시가 새겨져 있습니다."},
 {k:"성 야고보 사도 무덤",o:"Sepulcro del Apóstol Santiago",e:"Tomb of Saint James the Apostle",w:"|",q:"cripta sepulcro apostol Santiago catedral",
  d:"대성당 중앙 제단 아래 지하 묘실에 은제 유골함으로 모셔진 사도 야고보의 무덤입니다. 제단 뒤 계단을 올라 성인상을 뒤에서 안는 '아브라소' 의식과 함께, 순례자가 마지막으로 치르는 순서입니다. 이어서 순례자 사무소에서 콤포스텔라 증서를 받으면 여정이 완성됩니다."}
]
};

window.CAMINO_SPOTS=CAMINO_SPOTS;
/* ══════════════════════════════════════════════════════════════════════
   ① DAY별 경로 지도 (탭 → 확대 뷰어)
   ② DAY별 명소 프리뷰 캐러셀 (좌우 스와이프 / 화살표)
   ③ 공용 확대 뷰어 (핀치·휠·더블탭 줌 + 드래그 이동 + 좌우 이동)
   사진은 위키백과 / 위키미디어 커먼즈에서 자동으로 가져옵니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  if(!window.CAMINO_SPOTS) return;
  var SPOTS = window.CAMINO_SPOTS;

  /* 지도 파일 경로
     1순위: camino-days.html 의 data-map / data-svg 값
     그 뒤로는 흔한 위치를 차례로 시도합니다. */
  function cands(given, list){
    var a = given ? [given] : [];
    return a.concat(list);
  }
  function pngCands(d, given){
    return cands(given, ["images/day"+d+"-map.webp","images/day"+d+"-map.png",
                         "images/maps/day"+d+"-map.webp","images/maps/day"+d+"-map.png",
                         "day"+d+"-map.webp","day"+d+"-map.png"]);
  }
  function png2Cands(d, given){
    return cands(given, ["images/day"+d+"-map-photo.webp","images/day"+d+"-map-photo.png",
                         "images/maps/day"+d+"-map-photo.webp","images/maps/day"+d+"-map-photo.png",
                         "day"+d+"-map-photo.webp","day"+d+"-map-photo.png"]);
  }
  function svgCands(d, given){
    return cands(given, ["images/day"+d+"-map-photo.svg","images/maps/day"+d+"-map-photo.svg",
                         "day"+d+"-map-photo.svg","images/day"+d+"-map.svg"]);
  }

  /* 한 장짜리 지도 블록을 만들어 줍니다 */
  function mapBlock(cls, tag, alt, cap, hint){
    return '<div class="dmapblock '+cls+'">'
      +'<button class="dmap" type="button" data-kind="'+cls+'" aria-label="'+esc(alt)+' 크게 보기">'
      +'<span class="dtag'+(cls==="png"?"":" alt")+'">'+tag+'</span>'
      +'<img alt="'+esc(alt)+'">'
      +'<span class="zhint">'+hint+'</span></button>'
      +'<p class="dmap-cap">'+cap+'</p></div>';
  }

  function buildMap(box,d){
    var wrap=document.createElement("div"); wrap.className="dmapbox";
    var title=dayTitle(d);
    var rest=(d===8);

    wrap.innerHTML=
       '<h4>🗺 DAY '+d+' 지도 <small>· 탭하면 크게 볼 수 있습니다</small></h4>'
      +(rest?'':mapBlock("png","DAY "+d,
          "DAY "+d+" "+title+" 경로 지도",
          '<b>경로와 고도</b> — DAY '+d+' · '+esc(title),
          "⤢ 탭하면 확대"))
      +mapBlock("png2","📍 포토·맛집",
          "DAY "+d+" 세요·포토존·맛집 지도",
          '<b>세요 · 포토존 · 맛집</b> — 도장 받는 곳과 순서, 오늘의 포토존, 점심·저녁 추천',
          "⤢ 탭하면 확대")
      +mapBlock("svg","🔠 글자 선명본 · SVG",
          "DAY "+d+" 지명 (벡터)",
          '위 <b>포토·맛집 지도의 글자만 벡터(SVG)</b>로 다시 그린 것입니다 — '
          +'300% 이상 확대해도 지명이 깨지지 않습니다',
          "⤢ 몇 배로 키워도 또렷");

    var blocks={};
    ["png","png2","svg"].forEach(function(k){
      var el=wrap.querySelector('.dmapblock.'+k);
      if(el) blocks[k]={box:el, btn:el.querySelector(".dmap"), img:el.querySelector("img"), ok:false};
    });

    function chain(o, list, onFail){
      if(!o) return;
      var i=0;
      o.img.onerror=function(){
        i++;
        if(i<list.length){ o.img.src=list[i]; return; }
        o.img.onerror=null; onFail(o);
      };
      o.img.addEventListener("load",function(){ o.ok=true; });
      o.img.src=list[0];
    }

    if(blocks.png)
      chain(blocks.png, pngCands(d, box.dataset.map), function(o){
        o.btn.classList.add("err");
        o.btn.innerHTML='경로 지도를 찾지 못했습니다<br><small style="opacity:.8">'
          +'images/ 폴더에 <b>day'+d+'-map.webp</b> 파일을 넣어 주세요</small>';
      });
    chain(blocks.png2, png2Cands(d, box.dataset.map2), function(o){
      o.btn.classList.add("err");
      o.btn.innerHTML='포토·맛집 지도를 찾지 못했습니다<br><small style="opacity:.8">'
        +'images/ 폴더에 <b>day'+d+'-map-photo.webp</b> 파일을 넣어 주세요</small>';
    });
    chain(blocks.svg, svgCands(d, box.dataset.svg), function(o){
      o.box.hidden=true;                 /* 보조 자료라 없으면 조용히 감춤 */
    });

    /* 확대 뷰어 — 세 장을 좌우로 넘겨 볼 수 있게 함께 넘김 */
    var META={
      png :{tab:"🗺 경로",   k:"DAY "+d+" 경로와 고도",
            d:"오늘 달리는 길과 고도 변화입니다. 두 손가락으로 벌리거나 +/− 로 확대하세요."},
      png2:{tab:"📍 포토·맛집", k:"DAY "+d+" 세요 · 포토존 · 맛집",
            d:"도장 받는 곳과 순서, 오늘의 포토존, 점심·저녁 맛집입니다. "
              +"글자가 흐려지면 위의 [🔠 글자] 를 누르세요 — 배율은 그대로 유지됩니다."},
      svg :{tab:"🔠 글자",   k:"DAY "+d+" 지명 (글자 선명본)",
            d:"벡터(SVG)라 몇 배로 확대해도 지명이 또렷합니다."}
    };
    function items(){
      var a=[];
      ["png","png2","svg"].forEach(function(k){
        var o=blocks[k];
        if(!o || o.box.hidden || o.btn.classList.contains("err")) return;
        var m=META[k];
        a.push({img:o.img.src, big:o.img.src, tab:m.tab, pair:true,
                k:m.k, o:title, d:m.d, badge:"DAY "+d});
      });
      return a;
    }
    ["png","png2","svg"].forEach(function(k){
      var o=blocks[k]; if(!o) return;
      o.btn.addEventListener("click",function(){
        if(o.btn.classList.contains("err")) return;
        var a=items();
        var i=0;
        for(var n=0;n<a.length;n++) if(a[n].tab===META[k].tab){ i=n; break; }
        openViewer(a, i);
      });
    });

    box.appendChild(wrap);
  }

  function dayTitle(d){
    var card=document.getElementById("day"+d);
    var t=card&&card.querySelector(".dtitle b");
    return t?t.textContent.trim():"";
  }

  function buildSpots(box,d){
    var arr=SPOTS[d]; if(!arr||!arr.length) return;
    var wrap=document.createElement("div"); wrap.className="dspots";
    var h='<h4>📍 DAY '+d+' 명소 <small>· 총 '+arr.length+'곳 · 좌우로 넘겨 보세요</small></h4>'
      +'<div class="spotwrap">'
      +'<button class="sarrow prev" type="button" aria-label="이전 명소">‹</button>'
      +'<div class="strack">';
    arr.forEach(function(s,i){
      h+='<button class="scard" type="button" data-i="'+i+'">'
        +'<span class="sthumb">'
        +'<span class="sload">사진 불러오는 중…</span>'
        +'<img alt="'+esc(s.k)+'" data-kr="'+esc(s.k)+'" loading="lazy">'
        +'<span class="sidx">'+("0"+(i+1)).slice(-2)+' / '+("0"+arr.length).slice(-2)+'</span>'
        +'<span class="szoom">⤢ 크게</span>'
        +'</span>'
        +'<span class="sbody">'
        +'<b>'+esc(s.k)+'</b>'
        +'<span class="sorig">'+esc(s.o)+'</span>'
        +'<span class="sdesc">'+esc(s.d)+'</span>'
        +'<span class="smore">탭하면 사진 확대 + 설명 전체보기 →</span>'
        +'</span></button>';
    });
    h+='</div><button class="sarrow next" type="button" aria-label="다음 명소">›</button></div>'
      +'<div class="sdots"></div>';
    wrap.innerHTML=h;

    var track=wrap.querySelector(".strack"),
        prev=wrap.querySelector(".sarrow.prev"),
        next=wrap.querySelector(".sarrow.next"),
        dots=wrap.querySelector(".sdots");

    /* 이미지 연결 */
    wrap.querySelectorAll(".scard").forEach(function(c,i){
      var im=c.querySelector("img"), s=arr[i];
      if(s.img) setThumb(im,s.img); else s._el.push(im);
      c.addEventListener("click",function(){ openViewer(arr.map(toItem),i); });
    });

    /* 점 표시 */
    var dh=""; arr.forEach(function(_,i){ dh+='<i data-i="'+i+'"></i>'; });
    dh+='<span class="scount"><b>1</b> / '+arr.length+'</span>';
    dots.innerHTML=dh;
    var dotEls=dots.querySelectorAll("i"), cnt=dots.querySelector(".scount b");

    function step(){ var c=track.querySelector(".scard"); return c?c.offsetWidth+12:300; }
    function cur(){ return Math.round(track.scrollLeft/step()); }
    function sync(){
      var i=Math.max(0,Math.min(arr.length-1,cur()));
      dotEls.forEach(function(el,k){ el.classList.toggle("on",k===i); });
      cnt.textContent=i+1;
      prev.disabled=track.scrollLeft<4;
      next.disabled=track.scrollLeft>=track.scrollWidth-track.clientWidth-4;
    }
    prev.addEventListener("click",function(){ track.scrollLeft-=step(); });
    next.addEventListener("click",function(){ track.scrollLeft+=step(); });
    dotEls.forEach(function(el){ el.addEventListener("click",function(){ track.scrollLeft=step()*(+el.dataset.i); }); });
    track.addEventListener("scroll",function(){
      clearTimeout(track._t); track._t=setTimeout(sync,60);
    });
    setTimeout(sync,80);
    window.addEventListener("resize",function(){ clearTimeout(track._r); track._r=setTimeout(sync,150); });

    box.appendChild(wrap);
  }

  function toItem(s){
    return {img:s.img||ph(s.k),big:bigger(s.img)||ph(s.k),k:s.k,o:s.o+(s.e?" · "+s.e:""),d:s.d,page:s.page,badge:"DAY "+s._d};
  }

  /* ───────── 확대 뷰어 ───────── */
  var vw=document.createElement("div");
  vw.className="cvw"; vw.id="caminoViewer";
  vw.innerHTML=
     '<div class="cv-top"><span class="cv-badge"></span><span class="cv-ttl"></span>'
    +'<button class="cv-x" type="button" aria-label="닫기">✕</button></div>'
    +'<div class="cv-stage"><span class="cv-spin">불러오는 중…</span><img alt=""></div>'
    +'<button class="cv-nav prev" type="button" aria-label="이전">‹</button>'
    +'<button class="cv-nav next" type="button" aria-label="다음">›</button>'
    +'<div class="cv-cap"><b></b><span class="cv-orig"></span><p></p><a class="cv-src" target="_blank" rel="noopener">사진 출처 보기 ↗</a></div>'
    +'<div class="cv-tabs" hidden></div>'
    +'<div class="cv-bar">'
    +'<button data-z="out" type="button">−</button><span class="cv-zl">100%</span>'
    +'<button data-z="in" type="button">+</button>'
    +'<button data-z="reset" type="button">원래대로</button>'
    +'<button data-z="close" type="button">닫기</button>'
    +'<span class="cv-cnt"></span></div>';
  document.body.appendChild(vw);

  var vStage=vw.querySelector(".cv-stage"), vImg=vStage.querySelector("img"),
      vSpin=vStage.querySelector(".cv-spin"), vTtl=vw.querySelector(".cv-ttl"),
      vBadge=vw.querySelector(".cv-badge"), vCap=vw.querySelector(".cv-cap"),
      vPrev=vw.querySelector(".cv-nav.prev"), vNext=vw.querySelector(".cv-nav.next"),
      vZl=vw.querySelector(".cv-zl"), vCnt=vw.querySelector(".cv-cnt"),
      vSrc=vw.querySelector(".cv-src"), vTabs=vw.querySelector(".cv-tabs");

  var items=[], idx=0, sc=1, tx=0, ty=0, MIN=1, MAX=6;

  function apply(){
    vImg.style.transform="translate("+tx+"px,"+ty+"px) scale("+sc+")";
    vZl.textContent=Math.round(sc*100)+"%";
    vStage.style.cursor = sc>1 ? "grab" : "zoom-in";
  }
  function reset(){ sc=1; tx=0; ty=0; apply(); }
  function clamp(){
    var r=vStage.getBoundingClientRect(), w=vImg.clientWidth*sc, h=vImg.clientHeight*sc;
    var mx=Math.max(0,(w-r.width)/2), my=Math.max(0,(h-r.height)/2);
    tx=Math.max(-mx,Math.min(mx,tx)); ty=Math.max(-my,Math.min(my,ty));
  }
  function zoom(f,cx,cy){
    var ns=Math.max(MIN,Math.min(MAX,sc*f));
    if(ns===sc) return;
    if(cx!=null){
      var r=vStage.getBoundingClientRect();
      var ox=cx-r.left-r.width/2, oy=cy-r.top-r.height/2;
      tx=ox-(ox-tx)*(ns/sc); ty=oy-(oy-ty)*(ns/sc);
    }
    sc=ns; clamp(); apply();
  }

  var keepNext=false;
  function render(){
    var it=items[idx]; if(!it) return;
    /* 짝지어진 그림(지도 PNG ↔ 글자 SVG)끼리 옮길 때는 확대 배율·위치를 그대로 유지 */
    var keep=keepNext, ks=sc, kx=tx, ky=ty; keepNext=false;
    vSpin.style.display="";
    vImg.style.visibility="hidden";
    vImg.onload=function(){
      vSpin.style.display="none"; vImg.style.visibility="visible";
      if(keep){ sc=ks; tx=kx; ty=ky; clamp(); apply(); } else reset();
    };
    vImg.onerror=function(){
      if(it.big&&vImg.src===it.big&&it.img&&it.img!==it.big){ vImg.src=it.img; return; }
      vImg.onerror=null; vSpin.style.display="none"; vImg.style.visibility="visible"; vImg.src=ph(it.k);
    };
    vImg.src=it.big||it.img;
    vBadge.textContent=it.badge||"";
    vBadge.style.display=it.badge?"":"none";
    vTtl.textContent=it.k||"";
    vCap.querySelector("b").textContent=it.k||"";
    vCap.querySelector(".cv-orig").textContent=it.o||"";
    vCap.querySelector("p").textContent=it.d||"";
    if(it.page){ vSrc.href=it.page; vSrc.style.display=""; } else vSrc.style.display="none";
    var many=items.length>1;
    vPrev.hidden=!many; vNext.hidden=!many;
    vCnt.textContent=many?(idx+1)+" / "+items.length:"";
    /* 이름표가 있는 묶음(지도/글자)이면 위쪽에 전환 버튼을 띄움 */
    if(many && items.some(function(x){return x.tab;})){
      vTabs.hidden=false;
      vTabs.innerHTML='<span class="cv-tl">보기 전환</span>'+items.map(function(x,i){
        return '<button type="button" data-i="'+i+'" class="'+(i===idx?"on":"")+'">'
             +(x.tab||("① ②③④⑤".charAt(i)||(i+1)))+'</button>';
      }).join("");
    }else vTabs.hidden=true;
    if(!keep) reset();
  }
  function go(n, keep){
    if(!items.length) return;
    var ni=(n+items.length)%items.length;
    if(keep && items[idx] && items[ni] && items[idx].pair && items[ni].pair) keepNext=true;
    idx=ni; render();
  }
  function openViewer(list,i){
    items=list||[]; idx=i||0;
    vw.classList.add("show");
    document.body.style.overflow="hidden";
    render();
  }
  function closeViewer(){
    vw.classList.remove("show");
    document.body.style.overflow="";
    vImg.removeAttribute("src");
  }

  /* 날짜 카드의 실제 경로 지도 — 같은 확대 뷰어로 엽니다 */
  function bindRealMaps(){
    document.querySelectorAll("figure.dmapreal").forEach(function(fig){
      if(fig._bound) return; fig._bound=true;
      fig.addEventListener("click",function(){
        var img=fig.querySelector("img"); if(!img) return;
        var cap=fig.querySelector("figcaption");
        var t=cap?cap.childNodes[0].nodeValue.trim():"경로 지도";
        openViewer([{img:img.getAttribute("src"), big:img.getAttribute("src"),
                     t:t, s:"손가락이나 휠로 확대할 수 있습니다"}],0);
      });
    });
  }
  if(window.onCaminoDays) window.onCaminoDays(bindRealMaps);
  else if(document.readyState!=="loading") bindRealMaps();
  else document.addEventListener("DOMContentLoaded",bindRealMaps);

  vw.querySelector(".cv-x").addEventListener("click",closeViewer);
  vPrev.addEventListener("click",function(e){ e.stopPropagation(); go(idx-1,true); });
  vNext.addEventListener("click",function(e){ e.stopPropagation(); go(idx+1,true); });
  vTabs.addEventListener("click",function(e){
    var b=e.target.closest("button[data-i]"); if(!b) return;
    e.stopPropagation(); go(+b.dataset.i, true);
  });
  vw.querySelector(".cv-bar").addEventListener("click",function(e){
    var b=e.target.closest("button[data-z]"); if(!b) return;
    var z=b.dataset.z;
    if(z==="in") zoom(1.4); else if(z==="out") zoom(1/1.4);
    else if(z==="reset") reset(); else if(z==="close") closeViewer();
  });
  document.addEventListener("keydown",function(e){
    if(!vw.classList.contains("show")) return;
    if(e.key==="Escape") closeViewer();
    else if(e.key==="ArrowLeft") go(idx-1,true);
    else if(e.key==="ArrowRight") go(idx+1,true);
    else if(e.key==="+"||e.key==="=") zoom(1.4);
    else if(e.key==="-") zoom(1/1.4);
    else if(e.key==="0") reset();
  });

  /* 휠 줌 */
  vStage.addEventListener("wheel",function(e){
    e.preventDefault();
    zoom(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY);
  },{passive:false});

  /* 더블탭 / 더블클릭 줌 */
  var lastTap=0;
  vStage.addEventListener("dblclick",function(e){
    if(sc>1) reset(); else zoom(2.5,e.clientX,e.clientY);
  });

  /* 포인터: 드래그 이동 · 핀치 줌 · 스와이프 전환 */
  var pts={}, startD=0, startSc=1, sx=0, sy=0, stx=0, sty=0, moved=false, downT=0, atEdgeX=false;
  vStage.addEventListener("pointerdown",function(e){
    vStage.setPointerCapture(e.pointerId);
    pts[e.pointerId]={x:e.clientX,y:e.clientY};
    var ks=Object.keys(pts);
    if(ks.length===1){
      sx=e.clientX; sy=e.clientY; stx=tx; sty=ty; moved=false; downT=Date.now();
      var r0=vStage.getBoundingClientRect();
      var mx0=Math.max(0,(vImg.clientWidth*sc-r0.width)/2);
      atEdgeX = mx0<1 || Math.abs(Math.abs(tx)-mx0)<2;   /* 이미 좌우 끝에 닿아 있나 */
      vStage.classList.add("grabbing");
    }else if(ks.length===2){
      var a=pts[ks[0]],b=pts[ks[1]];
      startD=Math.hypot(a.x-b.x,a.y-b.y); startSc=sc;
    }
  });
  vStage.addEventListener("pointermove",function(e){
    if(!pts[e.pointerId]) return;
    pts[e.pointerId]={x:e.clientX,y:e.clientY};
    var ks=Object.keys(pts);
    if(ks.length>=2){
      var a=pts[ks[0]],b=pts[ks[1]];
      var d=Math.hypot(a.x-b.x,a.y-b.y);
      if(startD>0){
        var ns=Math.max(MIN,Math.min(MAX,startSc*(d/startD)));
        sc=ns; clamp(); apply(); moved=true;
      }
      return;
    }
    var dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dx)>6||Math.abs(dy)>6) moved=true;
    if(sc>1){ tx=stx+dx; ty=sty+dy; clamp(); apply(); }
  });
  function up(e){
    var was=pts[e.pointerId];
    delete pts[e.pointerId];
    vStage.classList.remove("grabbing");
    if(!was) return;
    if(Object.keys(pts).length) return;
    var dx=e.clientX-sx, dy=e.clientY-sy;
    var horiz = Math.abs(dx)>Math.abs(dy)*1.4;
    /* 확대하지 않았으면 좌우로 크게 밀어 이전/다음 */
    if(sc<=1.02 && Math.abs(dx)>55 && horiz && items.length>1){
      go(dx<0?idx+1:idx-1,true); return;
    }
    /* 확대한 상태에서도, 좌우 끝까지 민 뒤 더 밀면 전환 (배율 유지) */
    if(sc>1.02 && horiz && Math.abs(dx)>70 && items.length>1 && atEdgeX && Math.abs(tx-stx)<3){
      go(dx<0?idx+1:idx-1,true); return;
    }
    /* 탭(짧게 누름) → 확대 토글 */
    if(!moved && Date.now()-downT<300){
      var now=Date.now();
      if(now-lastTap<320){ if(sc>1) reset(); else zoom(2.5,e.clientX,e.clientY); lastTap=0; }
      else lastTap=now;
    }
  }
  vStage.addEventListener("pointerup",up);
  vStage.addEventListener("pointercancel",up);

  /* ───────── 시작 ───────── */
  function build(){
    document.querySelectorAll(".dextra").forEach(function(box){
      var d=+box.dataset.day;
      buildMap(box,d);
      buildSpots(box,d);
    });
    stepTitles().then(stepWikiSearch).then(stepCommons).then(finish).catch(finish);
  }
  /* DAY 카드는 camino-days.html 에서 나중에 들어옵니다 */
  if(window.onCaminoDays) window.onCaminoDays(build);
  else if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",build);
  else build();
})();

/* ── 블록 4 ── */
/* ══════════════════════════════════════════════════════════════════════
   DAY별 날씨 카드 (출발지 / 도착지)  ·  Open-Meteo
   · 24시간 기온 선그래프 (일출~일몰 밝게 / 밤 어둡게)
   · WMO 날씨 코드 아이콘 + 코드 번호 · 최고 / 최저 기온
   · 🔒 라이딩 당일이 지나면 그날 실제 날씨로 확정 저장(lock) — 이후 다시 받지 않음
   · 🚴 주행기록(GPX) 첫 파일의 출발·도착 시각을 읽어 라이딩 시간대를 표시
        (기록을 새로 올리면 자동 갱신 · DAY 8 휴식일 제외)
   시간은 timezone=auto → 스페인·프랑스 현지시각(5월 = CEST, UTC+2)
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  /* ── 지점 좌표 ── */
  var L = {
    sjpp : {k:"생장",              o:"Saint-Jean-Pied-de-Port", la:43.1633, lo:-1.2372},
    zubi : {k:"수비리",            o:"Zubiri",                  la:42.9314, lo:-1.5044},
    este : {k:"에스떼야",          o:"Estella",                 la:42.6714, lo:-2.0299},
    nava : {k:"나베레테",          o:"Navarrete",               la:42.4297, lo:-2.5606},
    belo : {k:"벨로라도",          o:"Belorado",                la:42.4200, lo:-3.1919},
    cast : {k:"키스트로헤리스",    o:"Castrojeriz",             la:42.2886, lo:-4.1383},
    saha : {k:"사아군",            o:"Sahagún",                 la:42.3713, lo:-5.0296},
    leon : {k:"레온",              o:"León",                    la:42.5987, lo:-5.5671},
    raba : {k:"라바날 델 까미노",  o:"Rabanal del Camino",      la:42.4817, lo:-6.2839},
    vega : {k:"베가 데 발까르세",  o:"Vega de Valcarce",        la:42.6597, lo:-6.9250},
    sarr : {k:"사리아",            o:"Sarria",                  la:42.7776, lo:-7.4144},
    arzu : {k:"아르수아",          o:"Arzúa",                   la:42.9296, lo:-8.1620},
    sant : {k:"산티아고 데 콤포스텔라", o:"Santiago de Compostela", la:42.8805, lo:-8.5457},
    /* 고개 — 도시 사이 최고점. 산 날씨는 도시와 크게 다릅니다 */
    p1   : {k:"DAY 1 최고점",   o:"우회로 · 1,240 m",          la:43.0299, lo:-1.2278, pass:true},
    p2   : {k:"페르돈 고개",    o:"Alto del Perdón · 770 m",   la:42.7397, lo:-1.7089, pass:true},
    p5   : {k:"오카 산",        o:"Montes de Oca · 1,150 m",   la:42.3860, lo:-3.3650, pass:true},
    p10  : {k:"철의 십자가",    o:"Cruz de Ferro · 1,500 m",   la:42.4899, lo:-6.3527, pass:true},
    p11  : {k:"오 세브레이로",  o:"O Cebreiro · 1,300 m",      la:42.7080, lo:-7.0430, pass:true}
  };
  var PASS = {1:"p1", 2:"p2", 5:"p5", 10:"p10", 11:"p11"};
  var DAY = {
    1:["sjpp","zubi"],  2:["zubi","este"],  3:["este","nava"], 4:["nava","belo"],
    5:["belo","cast"],  6:["cast","saha"],  7:["saha","leon"], 8:["leon","leon"],
    9:["leon","raba"], 10:["raba","vega"], 11:["vega","sarr"],12:["sarr","arzu"],
   13:["arzu","sant"]
  };
  var REST_DAY = 8;                                  /* 휴식일 — 라이딩 표시 제외 */
  var ORDER = Object.keys(L);
  var TRIP_Y = 2027, TRIP_M = 5, TRIP_D1 = 9, NDAYS = 13;

  /* ── WMO 날씨 코드 ── */
  function wmo(c){
    var m = {
      0:["☀️","맑음"], 1:["🌤️","대체로 맑음"], 2:["⛅","부분 흐림"], 3:["☁️","흐림"],
      45:["🌫️","안개"], 48:["🌫️","서리 안개"],
      51:["🌦️","약한 이슬비"], 53:["🌦️","이슬비"], 55:["🌦️","강한 이슬비"],
      56:["🌧️","어는 이슬비"], 57:["🌧️","강한 어는 이슬비"],
      61:["🌦️","약한 비"], 63:["🌧️","비"], 65:["🌧️","강한 비"],
      66:["🌧️","어는 비"], 67:["🌧️","강한 어는 비"],
      71:["🌨️","약한 눈"], 73:["🌨️","눈"], 75:["❄️","강한 눈"], 77:["🌨️","싸락눈"],
      80:["🌦️","소나기"], 81:["🌧️","강한 소나기"], 82:["⛈️","매우 강한 소나기"],
      85:["🌨️","소낙눈"], 86:["❄️","강한 소낙눈"],
      95:["⛈️","뇌우"], 96:["⛈️","우박 동반 뇌우"], 99:["⛈️","강한 우박 뇌우"]
    };
    return m[c] || ["🌡️","코드 "+c];
  }

  function pad(n){ return (n<10?"0":"")+n; }
  function dstr(y,m,d){ return y+"-"+pad(m)+"-"+pad(d); }
  function tripDate(i){ return new Date(TRIP_Y, TRIP_M-1, TRIP_D1+i); }
  function tripStr(i){ var d=tripDate(i); return dstr(d.getFullYear(), d.getMonth()+1, d.getDate()); }
  function esc(t){ return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function avg(a){ var s=0,i; for(i=0;i<a.length;i++)s+=a[i]; return s/a.length; }
  function mode(a){
    var m={}, best=a[0], bc=0;
    a.forEach(function(v){ m[v]=(m[v]||0)+1; if(m[v]>bc||(m[v]===bc&&v<best)){bc=m[v];best=v;} });
    return +best;
  }

  /* ══════ 저장소 ══════
     WX-       일반 캐시(만료 있음)
     WXLOCK-   지나간 날의 확정 날씨 — 만료 없음, 다시 받지 않음
     RIDELOCK- 그날의 라이딩 시간대 — 주행기록 파일이 바뀌면 갱신             */
  var K_CACHE = "caminoWx-v4", K_LOCK = "caminoWxLock-v1", K_RIDE = "caminoRideLock-v4";
  function ls(k){ try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
  function cacheGet(k,ttl){ var o=ls(K_CACHE+"-"+k); return (o && Date.now()-o.t<ttl) ? o.v : null; }
  function cacheSet(k,v){ lsSet(K_CACHE+"-"+k, {t:Date.now(), v:v}); }
  function lockGet(i){ return ls(K_LOCK+"-"+i); }
  function lockSet(i,v){ return lsSet(K_LOCK+"-"+i, v); }

  /* ══════ Open-Meteo 요청 ══════ */
  function fetchRange(kind, sDate, eDate, ndays, ttl){
    var key = kind+"-"+sDate+"-"+eDate;
    if(ttl){ var hit = cacheGet(key, ttl); if(hit) return Promise.resolve(hit); }
    var host = (kind==="archive")
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";
    var la = ORDER.map(function(i){return L[i].la;}).join(",");
    var lo = ORDER.map(function(i){return L[i].lo;}).join(",");
    var url = host
      + "?latitude=" + la + "&longitude=" + lo
      + "&start_date=" + sDate + "&end_date=" + eDate
      + "&hourly=temperature_2m,weather_code,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m"
      + (kind==="archive" ? "" : ",precipitation_probability")
      + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max"
      + "&timezone=auto";
    return fetch(url).then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(j){
        if(j && j.error) throw 0;
        var arr = Array.isArray(j) ? j : [j], out = {};
        arr.forEach(function(res,n){
          var id = ORDER[n]; if(!id || !res || !res.hourly) return;
          var Hh = res.hourly, D = res.daily || {}, days = [];
          for(var i=0;i<ndays;i++){
            days.push({
              t   : (Hh.temperature_2m||[]).slice(i*24,(i+1)*24),
              c   : (Hh.weather_code   ||[]).slice(i*24,(i+1)*24),
              p   : (Hh.precipitation  ||[]).slice(i*24,(i+1)*24),
              pp  : (Hh.precipitation_probability||[]).slice(i*24,(i+1)*24),
              ws  : (Hh.wind_speed_10m ||[]).slice(i*24,(i+1)*24),
              wg  : (Hh.wind_gusts_10m ||[]).slice(i*24,(i+1)*24),
              wd  : (Hh.wind_direction_10m||[]).slice(i*24,(i+1)*24),
              psum: D.precipitation_sum   ? D.precipitation_sum[i]   : null,
              wmax: D.wind_speed_10m_max  ? D.wind_speed_10m_max[i]  : null,
              gmax: D.wind_gusts_10m_max  ? D.wind_gusts_10m_max[i]  : null,
              hi  : D.temperature_2m_max ? D.temperature_2m_max[i] : null,
              lo  : D.temperature_2m_min ? D.temperature_2m_min[i] : null,
              code: D.weather_code      ? D.weather_code[i]        : null,
              sr  : D.sunrise ? D.sunrise[i] : null,
              ss  : D.sunset  ? D.sunset[i]  : null
            });
          }
          out[id] = {tz:res.timezone, ab:res.timezone_abbreviation,
                     off:(res.utc_offset_seconds!=null?res.utc_offset_seconds:7200), days:days};
        });
        if(ttl) cacheSet(key,out);
        return out;
      });
  }

  function pastYears(now){
    var ys=[], y=now.getFullYear(), lim=new Date(now.getTime()-6*86400000);
    while(ys.length<3 && y>1990){
      if(new Date(y, TRIP_M-1, TRIP_D1+NDAYS-1) < lim) ys.push(y);
      y--;
    }
    return ys;
  }

  function mergeYears(sets){
    var out = {};
    ORDER.forEach(function(id){
      var got = sets.filter(function(s){ return s && s[id]; });
      if(!got.length) return;
      var days = [];
      for(var i=0;i<NDAYS;i++){
        var t=[], c=[], p=[], ws=[], wg=[], wx=[], wy=[], hi=[], lo=[], codes=[], psum=[], wmax=[], gmax=[], sr=null, ss=null;
        got.forEach(function(s){
          var d = s[id].days[i]; if(!d) return;
          for(var h=0;h<24;h++){
            if(d.t[h]!=null) (t[h]=t[h]||[]).push(d.t[h]);
            if(d.c[h]!=null) (c[h]=c[h]||[]).push(d.c[h]);
            if(d.p &&d.p[h]!=null)  (p[h]=p[h]||[]).push(d.p[h]);
            if(d.ws&&d.ws[h]!=null) (ws[h]=ws[h]||[]).push(d.ws[h]);
            if(d.wg&&d.wg[h]!=null) (wg[h]=wg[h]||[]).push(d.wg[h]);
            if(d.wd&&d.wd[h]!=null){ var r=d.wd[h]*Math.PI/180; (wx[h]=wx[h]||[]).push(Math.sin(r)); (wy[h]=wy[h]||[]).push(Math.cos(r)); }
          }
          if(d.hi!=null) hi.push(d.hi);
          if(d.lo!=null) lo.push(d.lo);
          if(d.code!=null) codes.push(d.code);
          if(d.psum!=null) psum.push(d.psum);
          if(d.wmax!=null) wmax.push(d.wmax);
          if(d.gmax!=null) gmax.push(d.gmax);
          if(!sr && d.sr) sr=d.sr;
          if(!ss && d.ss) ss=d.ss;
        });
        var T=[], C=[], P=[], WS=[], WG=[], WD=[];
        for(var h=0;h<24;h++){
          T[h] = t[h] ? Math.round(avg(t[h])*10)/10 : null;
          C[h] = c[h] ? mode(c[h]) : null;
          P[h] = p[h] ? Math.round(avg(p[h])*10)/10 : null;
          WS[h]= ws[h]? Math.round(avg(ws[h])) : null;
          WG[h]= wg[h]? Math.round(avg(wg[h])) : null;
          WD[h]= wx[h]? Math.round((Math.atan2(avg(wx[h]),avg(wy[h]))*180/Math.PI+360)%360) : null;
        }
        days.push({ t:T, c:C, p:P, pp:[], ws:WS, wg:WG, wd:WD, src:"normal",
          hi: hi.length?Math.round(avg(hi)*10)/10:null,
          lo: lo.length?Math.round(avg(lo)*10)/10:null,
          psum: psum.length?Math.round(avg(psum)*10)/10:null,
          wmax: wmax.length?Math.round(avg(wmax)):null,
          gmax: gmax.length?Math.round(avg(gmax)):null,
          code: codes.length?mode(codes):null, sr:sr, ss:ss });
      }
      out[id] = {tz:got[0][id].tz, ab:got[0][id].ab, off:got[0][id].off, days:days};
    });
    return out;
  }

  /* ══════ 시각 유틸 ══════ */
  function hourOf(iso){
    if(!iso) return null;
    var m=String(iso).match(/T(\d{2}):(\d{2})/);
    return m ? (+m[1])+(+m[2])/60 : null;
  }
  function hhmm(iso){
    var m=String(iso||"").match(/T(\d{2}):(\d{2})/);
    return m ? m[1]+":"+m[2] : "—";
  }
  function hToStr(h){
    if(h==null) return "—";
    var hh=Math.floor(h), mm=Math.round((h-hh)*60);
    if(mm===60){ hh++; mm=0; }
    return pad(hh%24)+":"+pad(mm);
  }
  /* UTC 밀리초 → 현지(스페인) 시각의 소수 시간 */
  function localHour(ms, off){
    if(ms==null) return null;
    var s = Math.floor(ms/1000) + (off==null?7200:off);
    return (((s%86400)+86400)%86400)/3600;
  }

  /* ══════ 그래프 ══════ */
  var W=360, H=218, X0=32, X1=350,
      ICON_Y=12, CODE_Y=20, RIDE_TXT=30, RIDE_Y=37, BG_TOP=24,
      Y0=46, Y1=152, WIND_Y=166, WIND_TXT=178, AXIS_Y=194, SUN_Y=207;
  function windArrow(x,y,deg,col){   /* 바람이 "가는" 방향으로 화살표 (기상 방향은 불어오는 쪽이라 +180) */
    var a=(deg+180)%360;
    return '<g transform="translate('+x+' '+y+') rotate('+a+')"><line x1="0" y1="5" x2="0" y2="-5" stroke="'+col+'" stroke-width="1.5"/>'
         +'<polygon points="0,-6.5 -3.2,-1.5 3.2,-1.5" fill="'+col+'"/></g>';
  }
  function X(h){ return X0 + (Math.max(0,Math.min(24,h))/24)*(X1-X0); }

  function chart(day, uid, ride){
    var T=day.t.slice(), i;
    var vals=T.filter(function(v){return v!=null;});
    if(!vals.length) return '<p class="wxerr">기온 데이터가 없습니다</p>';
    var mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);
    var lo=Math.floor(mn-1.5), hi=Math.ceil(mx+1.5);
    if(hi-lo<6) hi=lo+6;

    /* 실측 기온이 기상값과 크게 벌어지면(자전거 센서는 복사열로 훨씬 높게 나옴)
       한 축에 같이 그리면 기상 곡선이 납작해집니다 → 오른쪽에 별도 축을 세웁니다. */
    var meas = (ride && ride.temp && ride.temp.pts && ride.temp.pts.length>1) ? ride.temp : null;
    var dual=false, mlo=lo, mhi=hi;
    if(meas){
      mlo=Math.floor(meas.mn-1.5); mhi=Math.ceil(meas.mx+1.5);
      if(mhi-mlo<6) mhi=mlo+6;
      var uLo=Math.min(lo,mlo), uHi=Math.max(hi,mhi);
      dual = (uHi-uLo) > (hi-lo)*1.7;
      if(!dual){ lo=uLo; hi=uHi; mlo=lo; mhi=hi; }
    }
    var XR = dual ? 320 : X1;
    function Xp(h){ return X0 + (Math.max(0,Math.min(24,h))/24)*(XR-X0); }
    function Y(t){  return Y1-((t-lo)/(hi-lo))*(Y1-Y0); }
    function Ym(t){ return dual ? Y1-((t-mlo)/(mhi-mlo))*(Y1-Y0) : Y(t); }

    var sr=hourOf(day.sr), ss=hourOf(day.ss);
    if(sr==null) sr=7;
    if(ss==null) ss=21.5;

    var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" '
        + 'aria-label="24시간 기온 그래프" preserveAspectRatio="xMidYMid meet">';
    s+='<defs>'
      +'<linearGradient id="wxf'+uid+'" x1="0" y1="0" x2="0" y2="1">'
      +'<stop offset="0" stop-color="#8E2C3A" stop-opacity=".30"/>'
      +'<stop offset="1" stop-color="#8E2C3A" stop-opacity="0"/></linearGradient>'
      +'<clipPath id="wxc'+uid+'"><rect x="'+X0+'" y="'+BG_TOP+'" width="'+(XR-X0)+'" height="'+(Y1-BG_TOP)+'"/></clipPath>'
      +'</defs>';

    /* 밤(어둡게) / 낮(밝게) 배경 */
    s+='<g clip-path="url(#wxc'+uid+')">';
    s+='<rect x="'+X0+'" y="'+BG_TOP+'" width="'+(XR-X0)+'" height="'+(Y1-BG_TOP)+'" fill="#28344F" opacity=".16"/>';
    s+='<rect x="'+Xp(sr)+'" y="'+BG_TOP+'" width="'+(Xp(ss)-Xp(sr))+'" height="'+(Y1-BG_TOP)+'" fill="#FFE9A8" opacity=".62"/>';
    s+='<rect x="'+Xp(Math.max(0,sr-0.9))+'" y="'+BG_TOP+'" width="'+(Xp(sr)-Xp(Math.max(0,sr-0.9)))+'" height="'+(Y1-BG_TOP)+'" fill="#F5B917" opacity=".18"/>';
    s+='<rect x="'+Xp(ss)+'" y="'+BG_TOP+'" width="'+(Xp(Math.min(24,ss+0.9))-Xp(ss))+'" height="'+(Y1-BG_TOP)+'" fill="#F5B917" opacity=".18"/>';
    if(ride && ride.sh!=null && ride.eh!=null && ride.eh>ride.sh){
      s+='<rect x="'+Xp(ride.sh)+'" y="'+BG_TOP+'" width="'+(Xp(ride.eh)-Xp(ride.sh))+'" height="'+(Y1-BG_TOP)+'" fill="#1E7A46" opacity=".13"/>';
    }
    s+='</g>';

    /* 일출·일몰 선 */
    s+='<line x1="'+Xp(sr)+'" y1="'+BG_TOP+'" x2="'+Xp(sr)+'" y2="'+Y1+'" stroke="#C79A17" stroke-width="1" stroke-dasharray="3 3"/>';
    s+='<line x1="'+Xp(ss)+'" y1="'+BG_TOP+'" x2="'+Xp(ss)+'" y2="'+Y1+'" stroke="#5B6270" stroke-width="1" stroke-dasharray="3 3"/>';

    /* 왼쪽 축(기상 기온) 격자 + 눈금 */
    [lo, Math.round((lo+hi)/2), hi].forEach(function(v){
      s+='<line x1="'+X0+'" y1="'+Y(v)+'" x2="'+XR+'" y2="'+Y(v)+'" stroke="#000" stroke-opacity=".08"/>';
      s+='<text x="'+(X0-5)+'" y="'+(Y(v)+3.5)+'" font-size="9" text-anchor="end" fill="#5B6270">'+v+'°</text>';
    });
    /* 오른쪽 축(실측 기온) */
    if(dual){
      s+='<line x1="'+XR+'" y1="'+BG_TOP+'" x2="'+XR+'" y2="'+Y1+'" stroke="#E2B99B"/>';
      [mlo, Math.round((mlo+mhi)/2), mhi].forEach(function(v){
        s+='<text x="'+(XR+4)+'" y="'+(Ym(v)+3.5)+'" font-size="8.4" text-anchor="start" fill="#C2410C">'+v+'°</text>';
      });
      s+='<text x="'+(XR+4)+'" y="'+(BG_TOP-5)+'" font-size="6.6" text-anchor="start" fill="#C2410C">실측</text>';
    }

    /* ☔ 강수 — 아래에서 올라오는 파란 막대 (막대 높이 = mm, 최대 34 px). 확률이 있으면 진하기로 */
    var PR=day.p||[], PP=day.pp||[], pmax=0;
    for(i=0;i<24;i++) if(PR[i]!=null && PR[i]>pmax) pmax=PR[i];
    if(pmax>0){
      var psc=Math.max(1.5,pmax), bw=(XR-X0)/24;
      for(i=0;i<24;i++){
        if(PR[i]==null || PR[i]<=0.05) continue;
        var bh=Math.min(34, PR[i]/psc*34), op = PP[i]!=null ? 0.25+0.55*(PP[i]/100) : 0.55;
        s+='<rect x="'+(Xp(i)+0.5)+'" y="'+(Y1-bh)+'" width="'+(bw-1)+'" height="'+bh+'" fill="#1E5FB4" opacity="'+op.toFixed(2)+'"/>';
      }
      s+='<text x="'+(XR-3)+'" y="'+(Y1-36)+'" font-size="7" text-anchor="end" fill="#1E5FB4">☔ '+psc.toFixed(1)+' mm/h</text>';
    }

    /* 기상 기온 면적 + 선 */
    var pts=[], first=null, last=null;
    for(i=0;i<24;i++){ if(T[i]!=null){ pts.push(Xp(i+0.5)+","+Y(T[i])); if(first===null)first=i; last=i; } }
    if(pts.length>1){
      s+='<polygon points="'+Xp(first+0.5)+','+Y1+' '+pts.join(" ")+' '+Xp(last+0.5)+','+Y1+'" fill="url(#wxf'+uid+')"/>';
      s+='<polyline points="'+pts.join(" ")+'" fill="none" stroke="#8E2C3A" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    var iMax=-1, iMin=-1;
    for(i=0;i<24;i++){ if(T[i]==null)continue;
      if(iMax<0||T[i]>T[iMax])iMax=i;
      if(iMin<0||T[i]<T[iMin])iMin=i; }
    [[iMax,"#8E2C3A"],[iMin,"#1E3A6E"]].forEach(function(p){
      if(p[0]<0) return;
      s+='<circle cx="'+Xp(p[0]+0.5)+'" cy="'+Y(T[p[0]])+'" r="3" fill="#fff" stroke="'+p[1]+'" stroke-width="2"/>';
      s+='<text x="'+Xp(p[0]+0.5)+'" y="'+(Y(T[p[0]])-7)+'" font-size="9" font-weight="700" text-anchor="middle" fill="'+p[1]+'">'+T[p[0]].toFixed(1)+'°</text>';
    });

    /* 날씨 코드 아이콘 (3시간 간격) */
    [2,5,8,11,14,17,20,23].forEach(function(h){
      var c=day.c[h]; if(c==null) return;
      var w=wmo(c);
      s+='<text x="'+Xp(h+0.5)+'" y="'+ICON_Y+'" font-size="11" text-anchor="middle">'+w[0]+'</text>';
      s+='<text x="'+Xp(h+0.5)+'" y="'+CODE_Y+'" font-size="6.6" text-anchor="middle" fill="#5B6270">'+c+'</text>';
    });

    /* 🌡 주행 중 실측 기온 */
    if(meas){
      var M="#C2410C";
      var mp = meas.pts.map(function(x){ return Xp(x[0])+","+Ym(x[1]); });
      s+='<polyline points="'+mp.join(" ")+'" fill="none" stroke="'+M+'" stroke-width="1.9" '
        +'stroke-dasharray="4 2.6" stroke-linejoin="round" stroke-linecap="round" opacity=".95"/>';
      var f0=meas.pts[0], fN=meas.pts[meas.pts.length-1];
      s+='<circle cx="'+Xp(f0[0])+'" cy="'+Ym(f0[1])+'" r="2.2" fill="'+M+'"/>';
      s+='<circle cx="'+Xp(fN[0])+'" cy="'+Ym(fN[1])+'" r="2.2" fill="'+M+'"/>';
      var mid = meas.pts[Math.floor(meas.pts.length/2)];
      var lx  = Math.min(XR-16, Math.max(X0+18, Xp(mid[0])));
      s+='<text x="'+lx+'" y="'+(Ym(meas.mx)-6)+'" font-size="7.4" font-weight="700" text-anchor="middle" '
        +'fill="'+M+'" stroke="#fff" stroke-width="2.2" paint-order="stroke" stroke-linejoin="round">🌡 실측</text>';
    }

    /* 🚴 라이딩 시간대 — 출발·도착 수직선 + 좌→우 화살표 */
    if(ride && ride.sh!=null && ride.eh!=null && ride.eh>ride.sh){
      var xs=Xp(ride.sh), xe=Xp(ride.eh), G="#146B3C";
      s+='<line x1="'+xs+'" y1="'+BG_TOP+'" x2="'+xs+'" y2="'+Y1+'" stroke="'+G+'" stroke-width="1.4"/>';
      if(!ride.next)
        s+='<line x1="'+xe+'" y1="'+BG_TOP+'" x2="'+xe+'" y2="'+Y1+'" stroke="'+G+'" stroke-width="1.4"/>';
      s+='<circle cx="'+xs+'" cy="'+RIDE_Y+'" r="2.4" fill="'+G+'"/>';
      s+='<line x1="'+(xs+10)+'" y1="'+RIDE_Y+'" x2="'+Math.max(xs+12,xe-5)+'" y2="'+RIDE_Y+'" stroke="'+G+'" stroke-width="1.6"'
        +(ride.next?' stroke-dasharray="3 2"':'')+'/>';
      s+='<polygon points="'+xe+','+RIDE_Y+' '+(xe-6.5)+','+(RIDE_Y-3.6)+' '+(xe-6.5)+','+(RIDE_Y+3.6)+'" fill="'+G+'"/>';
      s+='<text x="'+(xs+0.5)+'" y="'+(RIDE_Y+3.8)+'" font-size="10" text-anchor="middle">🚴</text>';
      var lbl='🚴 '+hToStr(ride.sh)+' → '+hToStr(ride.ehReal!=null?ride.ehReal:ride.eh)
              +(ride.next?'(＋1일)':'')+(ride.dur?'  '+ride.dur:'');
      var cxm=Math.min(XR-42, Math.max(X0+42, (xs+xe)/2));
      s+='<text x="'+cxm+'" y="'+RIDE_TXT+'" font-size="7.6" font-weight="700" text-anchor="middle" '
        +'fill="'+G+'" stroke="#fff" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round">'+lbl+'</text>';
    }

    /* 💨 바람 — 3시간마다 화살표(가는 방향) + 풍속. 돌풍 25 km/h 넘으면 주황, 40 넘으면 빨강 */
    var WS=day.ws||[], WG=day.wg||[], WD=day.wd||[], anyW=false;
    for(i=0;i<24;i++) if(WS[i]!=null){ anyW=true; break; }
    if(anyW){
      s+='<text x="'+(X0-5)+'" y="'+(WIND_Y+3)+'" font-size="8" text-anchor="end" fill="#5B6270">💨</text>';
      [1,4,7,10,13,16,19,22].forEach(function(h){
        if(WS[h]==null) return;
        var g=WG[h]!=null?WG[h]:WS[h], col = g>=40?"#B91C1C" : g>=25?"#D97706" : "#3F5C3A";
        if(WD[h]!=null) s+=windArrow(Xp(h+0.5), WIND_Y, WD[h], col);
        s+='<text x="'+Xp(h+0.5)+'" y="'+WIND_TXT+'" font-size="7.2" text-anchor="middle" fill="'+col+'"'+(g>=25?' font-weight="700"':'')+'>'
          +Math.round(WS[h])+(WG[h]!=null&&WG[h]-WS[h]>=8?'<tspan font-size="6">/'+Math.round(WG[h])+'</tspan>':'')+'</text>';
      });
      s+='<text x="'+(XR)+'" y="'+(WIND_TXT)+'" font-size="6" text-anchor="end" fill="#8A8A8A">km/h · /돌풍</text>';
    }

    /* 시간축 */
    s+='<line x1="'+X0+'" y1="'+Y1+'" x2="'+XR+'" y2="'+Y1+'" stroke="#D8D3C4"/>';
    [0,3,6,9,12,15,18,21,24].forEach(function(h){
      s+='<line x1="'+Xp(h)+'" y1="'+Y1+'" x2="'+Xp(h)+'" y2="'+(Y1+3)+'" stroke="#D8D3C4"/>';
      if(h%6===0) s+='<text x="'+Xp(h)+'" y="'+AXIS_Y+'" font-size="8.5" text-anchor="middle" fill="#5B6270">'+h+'시</text>';
    });
    s+='<text x="'+Xp(sr)+'" y="'+SUN_Y+'" font-size="8.5" text-anchor="middle" fill="#B08400">🌅 '+hhmm(day.sr)+'</text>';
    s+='<text x="'+Xp(ss)+'" y="'+SUN_Y+'" font-size="8.5" text-anchor="middle" fill="#41506E">🌇 '+hhmm(day.ss)+'</text>';
    s+='</svg>';
    return s;
  }

  /* ══════ 앞으로 7일 — 여행 7일 전부터 여행 끝까지만 뜹니다 ══════ */
  var FC7 = null;   /* {locId:{days:[7]}} · 오늘부터 */
  function stripHTML(d, locId){
    var now=new Date(); now.setHours(0,0,0,0);
    var t0=new Date(TRIP_Y,TRIP_M-1,TRIP_D1-7), t1=new Date(TRIP_Y,TRIP_M-1,TRIP_D1+NDAYS);
    if(now<t0 || now>t1){
      return '<div class="wx7 off" style="grid-column:1/-1"><small>📅 앞으로 7일 예보는 <b>'+(TRIP_M)+'/'+(TRIP_D1-7)+'</b> 부터 이 자리에 나타납니다 · '+esc(L[locId].k)+' 기준</small></div>';
    }
    var F=FC7 && FC7[locId]; if(!F) return '<div class="wx7 off" style="grid-column:1/-1"><small>📅 7일 예보를 불러오지 못했습니다</small></div>';
    var trip=tripDate(d).getTime(), h='<div class="wx7" style="grid-column:1/-1"><div class="wx7h">📅 앞으로 7일 · '+esc(L[locId].k)+'</div><div class="wx7r">';
    F.days.forEach(function(dy,k){
      var dt=new Date(now.getTime()+k*86400000), w=wmo(dy.code!=null?dy.code:2);
      var isTrip = Math.abs(dt.getTime()-trip)<43200000;
      var g=dy.gmax!=null?dy.gmax:dy.wmax, wc = g>=40?"#B91C1C":g>=25?"#D97706":"#3F5C3A";
      h+='<div class="wx7d'+(isTrip?" me":"")+'"><small>'+(dt.getMonth()+1)+'/'+dt.getDate()+'</small>'
        +'<span class="ic">'+w[0]+'</span>'
        +'<b>'+(dy.hi!=null?Math.round(dy.hi):"–")+'°</b><i>'+(dy.lo!=null?Math.round(dy.lo):"–")+'°</i>'
        +'<em style="color:#1E5FB4">☔'+(dy.psum!=null?dy.psum.toFixed(0):"–")+'</em>'
        +'<em style="color:'+wc+'">💨'+(dy.wmax!=null?Math.round(dy.wmax):"–")+'</em></div>';
    });
    return h+'</div></div>';
  }

  /* ══════ 카드 ══════ */
  function cardHTML(role, loc, day, uid, ride){
    var w = wmo(day.code!=null?day.code:2);
    var dayCodes = day.c.slice(6,21).filter(function(v){return v!=null;});
    var dom = dayCodes.length ? wmo(mode(dayCodes)) : w;
    var badge = role==="s" ? '<span class="wxb s">출발</span>'
              : role==="e" ? '<span class="wxb e">도착</span>'
              : role==="p" ? '<span class="wxb p" style="background:#6B21A8;color:#fff">고개</span>'
                           : '<span class="wxb r">휴식</span>';
    var tag = day.src==="locked"   ? '<span class="wxlk">🔒 확정 기록</span>'
            : day.src==="forecast" ? '<span class="wxfc">실제 예보</span>' : '';
    var rideLine = "";
    if(ride && ride.sh!=null && ride.eh!=null){
      rideLine = '<span class="wxride">🚴 '+hToStr(ride.sh)+'–'
        +hToStr(ride.ehReal!=null?ride.ehReal:ride.eh)+(ride.next?'(＋1일)':'')
        + (ride.dur?' · '+ride.dur:'')
        + (ride.km!=null?' · '+(+ride.km).toFixed(1)+'km':'')
        + (ride.tzn?' <i>('+esc(ride.tzn)+')</i>':'') + '</span>';
    }
    return '<div class="wxcard'+(day.src==="locked"?" lk":"")+'">'
      + '<div class="wxhead">'+badge
      + '<span class="wxnm"><b>'+esc(loc.k)+'</b><small>'+esc(loc.o)+'</small></span>'
      + '<span class="wxsum">'+dom[0]+' '+dom[1]+'</span>'+tag+'</div>'
      + '<div class="wxchart">'+chart(day, uid, ride)+'</div>'
      + '<div class="wxstats">'
      + '<span class="wxhi">최고 <b>'+(day.hi!=null?day.hi.toFixed(1):"–")+'°</b></span>'
      + '<span class="wxlo">최저 <b>'+(day.lo!=null?day.lo.toFixed(1):"–")+'°</b></span>'
      + '<span class="wxsun">🌅 '+hhmm(day.sr)+'</span>'
      + '<span class="wxsun">🌇 '+hhmm(day.ss)+'</span>'
      + (day.psum!=null ? '<span class="wxrain">☔ <b>'+day.psum.toFixed(1)+'</b> mm</span>' : '')
      + (day.wmax!=null ? '<span class="wxwind">💨 <b>'+Math.round(day.wmax)+'</b>'+(day.gmax!=null?' <i>돌풍 '+Math.round(day.gmax)+'</i>':'')+' km/h</span>' : '')
      + rideLine
      + (ride && ride.temp
          ? '<span class="wxmeas">🌡 실측 최고 <b>'+ride.temp.mx.toFixed(1)+'°</b> · 최저 <b>'
            +ride.temp.mn.toFixed(1)+'°</b><i>(자전거 센서)</i></span>'
          : '')
      + '</div></div>';
  }

  /* ══════ 상태 ══════ */
  var WX = null;        /* {locId:{off, days:[13]}} */
  var RIDE = {};        /* {day:{tid,name,sh,eh,km,gain,dur}} */
  var INFO = "", DAYKIND = {}, INFO_YEARS = "", INFO_TZ = "CEST";   /* DAYKIND[i] = "lock" | "fc" | "norm" */
  /* 날짜별 한 줄 — "5/9은 예년 평균(…)" 처럼 그 날 날짜로 씁니다 */
  function dayInfo(i){
    var d = tripDate(i), md = (d.getMonth()+1)+"/"+d.getDate()+"일은";
    var k = DAYKIND[i], t;
    if(k==="lock")      t = '🔒 '+md+' <b>그날의 실제 날씨로 확정 저장</b>(더 이상 다시 받지 않습니다)';
    else if(k==="fc")   t = '🔴 '+md+' <b>실제 예보</b>';
    else                t = md+' <b>예년 평균('+INFO_YEARS+'년 같은 날짜 실측 평균)</b>';
    return t + ' · Open-Meteo · 현지시각 '+esc(INFO_TZ)+'(UTC+2) 기준';
  }
  var uidN = 0;

  function renderDay(d){
    var box = document.querySelector('.dwx[data-day="'+d+'"]');
    if(!box || !WX) return;
    var grid = box.querySelector(".wxgrid");
    var i = d-1, pair = DAY[d];
    var a = WX[pair[0]], b = WX[pair[1]];
    if(!a || !a.days[i]){ grid.innerHTML='<p class="wxerr">날씨 데이터를 불러오지 못했습니다.</p>'; return; }
    var ride = (d===REST_DAY) ? null : RIDE[d];
    var pid=PASS[d], pw = pid && WX[pid] && WX[pid].days[i] ? WX[pid].days[i] : null;
    if(pair[0]===pair[1]){
      grid.classList.add("one");
      grid.innerHTML = cardHTML("r", L[pair[0]], a.days[i], ++uidN, null);
    }else{
      grid.classList.remove("one");
      grid.innerHTML = cardHTML("s", L[pair[0]], a.days[i], ++uidN, ride)
                     + (pw ? cardHTML("p", L[pid], pw, ++uidN, ride) : "")
                     + cardHTML("e", L[pair[1]], b.days[i], ++uidN, ride);
    }
    grid.insertAdjacentHTML("beforeend", stripHTML(d, pid||pair[1]));
    var note = box.querySelector(".wxnote");
    if(note){
      var extra = "";
      if(d!==REST_DAY){
        extra = ride
          ? ' · 🚴 주행기록 <b>'+esc(ride.name||"track_1.gpx")+'</b>의 출발·도착 시각'
            + (ride.tzn ? ' — 트랙 좌표가 스페인 밖(테스트 주행)이라 <b>기록한 곳의 현지시각</b>으로 표시했습니다'
                        : ' (스페인 현지시각)')
            + (ride.temp ? ' · 🌡 <b>주황 점선</b>은 주행 중 자전거 센서가 실제로 잰 기온입니다. 값이 기상 기온과 크게 다르면 <b>오른쪽에 별도 눈금</b>이 생깁니다(햇빛·실내·복사열 영향)' : '')
            + (ride.next ? ' · ⚠ 이 기록은 <b>자정을 넘어</b>서, 그래프에는 24시까지만 그렸습니다' : '')
          : ' · 🚴 주행기록(GPX)을 올리면 라이딩 시간대가 자동으로 표시됩니다';
      }
      note.innerHTML = dayInfo(i) + extra
        + ' <button type="button" class="wxreset" title="캐시와 확정 기록(🔒)을 지우고 다시 받습니다">↻ 초기화</button>';
      var rb = note.querySelector(".wxreset");
      if(rb) rb.addEventListener("click", resetAll);
    }
  }
  function renderAll(){ Object.keys(DAY).forEach(function(d){ renderDay(+d); }); }

  function resetAll(){
    if(!confirm("저장된 날씨 캐시와 확정 기록(🔒), 라이딩 시간대를 모두 지우고 다시 받습니다. 계속할까요?")) return;
    try{
      Object.keys(localStorage).forEach(function(k){
        if(k.indexOf(K_CACHE)===0 || k.indexOf(K_LOCK)===0 || k.indexOf(K_RIDE)===0)
          localStorage.removeItem(k);
      });
    }catch(e){}
    location.reload();
  }

  function fail(msg){
    document.querySelectorAll(".dwx .wxgrid").forEach(function(g){
      g.innerHTML = '<p class="wxerr">'+esc(msg)+' <button type="button" class="wxretry">다시 시도</button></p>';
    });
    document.querySelectorAll(".wxretry").forEach(function(b){
      b.addEventListener("click", function(){
        try{ Object.keys(localStorage).forEach(function(k){
          if(k.indexOf(K_CACHE)===0) localStorage.removeItem(k); }); }catch(e){}
        load();
      });
    });
  }

  /* ══════ 불러오기 ══════ */
  function load(){
    document.querySelectorAll(".dwx .wxgrid").forEach(function(g){
      g.innerHTML = '<p class="wxload">날씨 불러오는 중…</p>';
    });

    var now = new Date(); now.setHours(0,0,0,0);
    var todayMs = now.getTime();

    /* 날짜별 상태 구분 */
    var lockedIdx=[], needLock=[], fcIdx=[], normIdx=[], i;
    for(i=0;i<NDAYS;i++){
      var dt = tripDate(i).getTime();
      if(lockGet(i))                        lockedIdx.push(i);   /* 이미 확정됨 → 다시 안 받음 */
      else if(dt < todayMs)                 needLock.push(i);    /* 지나간 날 → 확정하고 잠금 */
      else if(dt <= todayMs+15*86400000)    fcIdx.push(i);       /* 예보 범위 */
      else                                  normIdx.push(i);     /* 예년 평균 */
    }

    var years = pastYears(now);

    /* ① 예년 평균 (지난 3년 같은 날짜) */
    var normJob = normIdx.length
      ? Promise.all(years.map(function(y){
          return fetchRange("archive", dstr(y,TRIP_M,TRIP_D1), dstr(y,TRIP_M,TRIP_D1+NDAYS-1),
                            NDAYS, 60*86400e3).catch(function(){ return null; });
        })).then(function(sets){
          var ok = sets.filter(Boolean);
          return ok.length ? mergeYears(ok) : null;
        })
      : Promise.resolve(null);

    /* ③ 앞으로 7일 (오늘부터) — 여행 7일 전부터만 */
    var t0w=new Date(TRIP_Y,TRIP_M-1,TRIP_D1-7), t1w=new Date(TRIP_Y,TRIP_M-1,TRIP_D1+NDAYS);
    if(now>=t0w && now<=t1w){
      var e7=new Date(now.getTime()+6*86400000);
      fetchRange("forecast", dstr(now.getFullYear(),now.getMonth()+1,now.getDate()), dstr(e7.getFullYear(),e7.getMonth()+1,e7.getDate()), 7, 3600e3)
        .then(function(r){ FC7=r; renderAll(); }).catch(function(){});
    }

    /* ② 예보 */
    var fcOff = fcIdx.length ? fcIdx[0] : 0;
    var fcJob = fcIdx.length
      ? fetchRange("forecast", tripStr(fcIdx[0]), tripStr(fcIdx[fcIdx.length-1]),
                   fcIdx[fcIdx.length-1]-fcIdx[0]+1, 2*3600e3).catch(function(){ return null; })
      : Promise.resolve(null);

    /* ③ 지나간 날 → 실제 관측치를 받아 영구 잠금 */
    var lkOff = needLock.length ? needLock[0] : 0;
    var lkJob = Promise.resolve(null);
    if(needLock.length){
      var m = needLock[needLock.length-1]-needLock[0]+1;
      var daysAgo = Math.round((todayMs - tripDate(needLock[needLock.length-1]).getTime())/86400000);
      var k1 = (daysAgo <= 88) ? "forecast" : "archive";      /* 92일 이내는 예보 API의 과거 구간 */
      var k2 = (k1==="forecast") ? "archive" : "forecast";
      lkJob = fetchRange(k1, tripStr(needLock[0]), tripStr(needLock[needLock.length-1]), m, 0)
        .catch(function(){
          return fetchRange(k2, tripStr(needLock[0]), tripStr(needLock[needLock.length-1]), m, 0)
                 .catch(function(){ return null; });
        });
    }

    Promise.all([normJob, fcJob, lkJob]).then(function(r){
      var norm=r[0], fc=r[1], lk=r[2], data={};
      function ensure(id, src){
        if(!data[id]) data[id] = {tz:src?src.tz:null, ab:src?src.ab:null,
                                  off:(src&&src.off!=null)?src.off:7200, days:[]};
        return data[id];
      }

      if(norm) ORDER.forEach(function(id){
        if(!norm[id]) return;
        var o=ensure(id,norm[id]);
        norm[id].days.forEach(function(d,n){ if(normIdx.indexOf(n)>=0) o.days[n]=d; });
      });

      if(fc) ORDER.forEach(function(id){
        if(!fc[id]) return;
        var o=ensure(id,fc[id]);
        fc[id].days.forEach(function(d,n){
          if(!d||!d.t||!d.t.length) return;
          d.src="forecast"; o.days[fcOff+n]=d;
        });
        o.ab=fc[id].ab; o.off=fc[id].off;
      });

      if(lk){
        var packs={};
        ORDER.forEach(function(id){
          if(!lk[id]) return;
          var o=ensure(id,lk[id]);
          lk[id].days.forEach(function(d,n){
            if(!d||!d.t||!d.t.length) return;
            d.src="locked";
            var gi=lkOff+n;
            o.days[gi]=d;
            (packs[gi]=packs[gi]||{})[id]=d;
          });
          o.ab=lk[id].ab; o.off=lk[id].off;
        });
        Object.keys(packs).forEach(function(gi){
          var day=(+gi)+1, pair=DAY[day]; if(!pair) return;
          var p=packs[gi];
          if(p[pair[0]] && p[pair[1]])
            lockSet(gi, {at:Date.now(), ab:(data[pair[0]]||{}).ab||null,
                         off:(data[pair[0]]||{}).off||7200,
                         s:p[pair[0]], e:p[pair[1]]});
        });
      }

      lockedIdx.forEach(function(gi){
        var v=lockGet(gi), pair=DAY[gi+1]; if(!v||!pair) return;
        [[pair[0],v.s],[pair[1],v.e]].forEach(function(x){
          if(!x[1]) return;
          var o=ensure(x[0],null);
          if(v.off!=null) o.off=v.off;
          if(v.ab && !o.ab) o.ab=v.ab;
          x[1].src="locked"; o.days[gi]=x[1];
        });
      });

      if(!Object.keys(data).length){ fail("날씨 데이터를 불러오지 못했습니다."); return; }
      WX = data;

      var any = data[ORDER[0]] || data[Object.keys(data)[0]];
      var tzab = (any && any.ab) ? any.ab : "CEST";
      var nLock = lockedIdx.length + needLock.length, parts=[];
      if(nLock)          parts.push('🔒 지난 '+nLock+'일은 <b>그날의 실제 날씨로 확정 저장</b>(더 이상 다시 받지 않습니다)');
      if(fcIdx.length)   parts.push('🔴 '+fcIdx.length+'일은 <b>실제 예보</b>');
      if(normIdx.length) parts.push((nLock||fcIdx.length?'나머지 ':'')+normIdx.length+'일은 <b>예년 평균('+years.slice().sort().join("·")+'년 같은 날짜 실측 평균)</b>');
      INFO = parts.join(' · ') + ' · Open-Meteo · 현지시각 '+esc(tzab)+'(UTC+2) 기준';
      DAYKIND = {}; lockedIdx.concat(needLock).forEach(function(i){ DAYKIND[i]="lock"; });
      fcIdx.forEach(function(i){ DAYKIND[i]="fc"; }); normIdx.forEach(function(i){ DAYKIND[i]="norm"; });
      INFO_YEARS = years.slice().sort().join("·"); INFO_TZ = tzab;
      renderAll();
      pullRides();
    }).catch(function(){ fail("날씨 데이터를 불러오지 못했습니다."); });
  }

  /* ══════ 🚴 주행기록 → 라이딩 시간대 ══════ */
  var pendingTracks = {};   /* 날씨보다 주행기록이 먼저 도착한 경우를 위해 보관 */

  function offOf(day){
    var pair=DAY[day], o = WX && pair && WX[pair[0]];
    return (o && o.off!=null) ? o.off : 7200;
  }
  /* ── 주행기록을 "탄 곳의 시각"으로 보여주기 위한 시간대 판별 ──
     GPX의 <time>은 UTC라 장소 정보가 없습니다. 트랙 좌표를 Open-Meteo에 물어
     IANA 시간대 이름(예: Asia/Seoul)을 받고, Intl로 그 날짜의 정확한 오프셋을 계산합니다.
     (기기 시간대를 쓰면 한국에서 탄 기록을 뉴욕 시각으로 보게 되므로 쓰지 않습니다) */
  var K_TZ = "caminoTz-v1";
  function lookupTz(la, lo){
    var key = (Math.round(la*10)/10)+","+(Math.round(lo*10)/10);
    var c = ls(K_TZ+"-"+key);
    if(c) return Promise.resolve(c);
    var url = "https://api.open-meteo.com/v1/forecast?latitude="+la+"&longitude="+lo
            + "&forecast_days=1&daily=sunrise&timezone=auto";
    return fetch(url).then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(j){
        if(!j || !j.timezone) throw 0;
        var v = {tz:j.timezone, off:(j.utc_offset_seconds!=null?j.utc_offset_seconds:0)};
        lsSet(K_TZ+"-"+key, v);
        return v;
      })
      .catch(function(){                       /* 조회 실패 → 경도로 대략 추정 */
        return {tz:null, off:Math.round(lo/15)*3600, approx:true};
      });
  }
  /* 그 시간대의 해당 시각 오프셋(초) — 서머타임까지 정확히 반영 */
  function tzOffsetAt(tzName, ms){
    try{
      var f = new Intl.DateTimeFormat("en-US", {timeZone:tzName, hour12:false,
        year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit", second:"2-digit"});
      var p={};
      f.formatToParts(new Date(ms)).forEach(function(x){ p[x.type]=x.value; });
      var asUTC = Date.UTC(+p.year, (+p.month)-1, +p.day, (+p.hour)%24, +p.minute, +p.second);
      return Math.round((asUTC-ms)/1000);
    }catch(e){ return null; }
  }
  function trackPos(pts){
    if(!pts || !pts.length) return null;
    var m = pts[Math.floor(pts.length/2)] || pts[0];
    return {la:m.la, lo:m.lo};
  }
  /* 주행기록의 실측 기온 → 5분 간격 평균 시계열 */
  function tempSeries(g, off, sh){
    if(!g || !g.hasTemp || !g.pts || g.t0ms==null) return null;
    var bins={}, keys=[];
    g.pts.forEach(function(p){
      if(p.tp==null || p.tt==null) return;
      var hh = localHour(g.t0ms + p.tt*1000, off);
      if(sh!=null && hh < sh-0.5) hh += 24;          /* 자정을 넘긴 뒤의 점 */
      if(hh > 24) return;                            /* 다음 날 구간은 이 차트에 그리지 않음
                                                        (24시에 몰아넣으면 그래프가 뾰족하게 왜곡됨) */
      var k = Math.round(hh*12)/12;                  /* 5분 버킷 */
      if(!bins[k]){ bins[k]=[0,0]; keys.push(k); }
      bins[k][0]+=p.tp; bins[k][1]++;
    });
    if(keys.length < 2) return null;
    keys.sort(function(a,b){ return a-b; });
    var pts = keys.map(function(k){ return [+k, Math.round(bins[k][0]/bins[k][1]*10)/10]; });
    var vs  = pts.map(function(x){ return x[1]; });
    return {pts:pts, mn:Math.min.apply(null,vs), mx:Math.max.apply(null,vs), n:g.nTemp};
  }
  function durStr(sec){
    var h=Math.floor(sec/3600), m=Math.round((sec%3600)/60);
    if(m===60){ h++; m=0; }
    return h+"시간"+(m?" "+m+"분":"");
  }

  function applyTracks(day, trks, authoritative){
    if(day===REST_DAY) return;                       /* 휴식일 제외 */
    pendingTracks[day] = {list:trks||[], auth:!!authoritative};
    if(!WX) return;                                  /* 날씨가 준비되면 pullRides가 다시 부름 */

    var first = (trks && trks.length) ? trks[0] : null;
    if(!first){
      /* 목록을 실제로 확인했을 때만 지움 — 오프라인·키오류로 못 읽은 경우엔 기존 표시 유지 */
      if(!authoritative) return;
      if(RIDE[day]){
        delete RIDE[day];
        try{ localStorage.removeItem(K_RIDE+"-"+day); }catch(e){}
        renderDay(day);
      }
      return;
    }
    var saved = ls(K_RIDE+"-"+day);
    if(saved && saved.tid === first.id){              /* 같은 파일이면 저장값 그대로 */
      RIDE[day]=saved; renderDay(day); return;
    }
    if(!window.CAMINO_GPX) return;
    window.CAMINO_GPX(first.id).then(function(g){
      if(!g || g.t0ms==null || g.t1ms==null || g.t1ms<=g.t0ms) return;

      /* ── 어느 시간대로 표시할지 ──
         ① 트랙 좌표가 카미노(이베리아 반도) 안 → 스페인 현지시각
         ② 그 밖(테스트 주행) → 트랙 좌표가 있는 곳의 시간대 = 실제로 시계에 찍혔던 시각 */
      var p = trackPos(g.pts);
      var inCamino = p && p.lo>=-9.8 && p.lo<=1.2 && p.la>=40.5 && p.la<=44.4;
      if(inCamino){ saveRide(day, first, g, offOf(day), null); return; }
      if(!p){ saveRide(day, first, g, offOf(day), null); return; }
      return lookupTz(p.la, p.lo).then(function(z){
        var off = z.tz ? tzOffsetAt(z.tz, g.t0ms) : null;
        if(off==null) off = z.off;
        var label = z.tz ? ("기록지 현지시각 · "+z.tz)
                         : ("기록지 추정 시각 · UTC"+(off>=0?"+":"−")+Math.abs(off/3600));
        saveRide(day, first, g, off, label);
      });
    }).catch(function(){});
  }

  function saveRide(day, file, g, off, tzn){
    var sh = localHour(g.t0ms, off), eh = localHour(g.t1ms, off);
    var next = false;
    if(eh <= sh){ eh = 24; next = true; }             /* 자정을 넘긴 기록 */
    var rec = { tid:file.id, name:file.name, sh:sh, eh:eh, next:next, tzn:tzn,
                ehReal: next ? localHour(g.t1ms, off) : eh,
                km:g.km, gain:g.gain, dur:durStr((g.t1ms-g.t0ms)/1000),
                temp: tempSeries(g, off, sh) };
    RIDE[day] = rec;
    lsSet(K_RIDE+"-"+day, rec);
    renderDay(day);
  }

  function pullRides(){
    Object.keys(DAY).forEach(function(k){
      var d=+k; if(d===REST_DAY) return;
      var saved=ls(K_RIDE+"-"+d);
      if(saved && saved.sh!=null){ RIDE[d]=saved; renderDay(d); }
    });
    Object.keys(pendingTracks).forEach(function(k){
      applyTracks(+k, pendingTracks[k].list, pendingTracks[k].auth); });
  }

  /* 사진·주행기록 모듈에서 호출하는 진입점 */
  window.CAMINO_RIDE = {
    tracks : function(day, trks, auth){ applyTracks(+day, trks, auth); },
    refresh: function(){ Object.keys(pendingTracks).forEach(function(k){
      applyTracks(+k, pendingTracks[k].list, pendingTracks[k].auth); }); }
  };

  /* ══════ 자리 만들기: 지도 다음, 명소 앞 ══════ */
  function mount(){
    document.querySelectorAll(".dextra").forEach(function(box){
      var d=+box.dataset.day; if(!DAY[d]) return;
      if(box.querySelector(".dwx")) return;
      var el=document.createElement("div");
      el.className="dwx"; el.dataset.day=d;
      el.innerHTML='<h4>🌤 DAY '+d+' 날씨 <small>· 출발지 &amp; 도착지 · 24시간 기온'
        + (d===REST_DAY ? '' : ' · 🚴 라이딩 시간대') + '</small></h4>'
        + '<div class="wxgrid"><p class="wxload">날씨 불러오는 중…</p></div>'
        + '<p class="wxnote"></p>';
      var spots=box.querySelector(".dspots");
      if(spots) box.insertBefore(el,spots); else box.appendChild(el);
    });
    load();
  }

  /* DAY 카드는 camino-days.html 에서 나중에 들어옵니다 */
  if(window.onCaminoDays) window.onCaminoDays(mount);
  else if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

/* ── 블록 5 ── */
/* ══════════════════════════════════════════════════════════════════════
   📕 디지털 순례자 여권 (Credencial del Peregrino)
   · 여권 페이지 사진 1장에 여러 도장이 찍히므로, 사진을 자르지 않고
     "도장 위치(사각형 좌표 %)"만 저장해 화면에서 잘라 보여줍니다.
   · 같은 자료를 두 곳에 표시합니다
       ① 날짜별 카드 안 — 그날 받은 세요 (여행 중 확인용)
       ② 별도 여권 섹션 — 전체 여권 · 갤러리 (여행 후 기념용)
   · 자료: Drive db/passport-bin.json · passport-jin.json
     (upload-camino.html 의 "📕 여권" 탭에서 등록)
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  if(typeof PHOTOS==="undefined") return;

  var PP = {
    dbFolder : "db",
    files    : { bin:"passport-bin.json", jin:"passport-jin.json" },
    people   : [ {k:"bin", n:"BIN"}, {k:"jin", n:"JIN"} ],
    dayCount : 13,
    /* 자전거 순례는 마지막 200km 구간에서 하루 2개의 세요가 필요합니다.
       이 일정에서는 DAY 10 시작 무렵 남은 거리가 200km 아래로 내려갑니다. */
    doubleFromDay : 10,
    certs : [
      {k:"compostela", n:"Compostela",               sub:"순례 완주 증서", icon:"📜",
       d:"산티아고 대성당 순례자 사무소에서 발급하는 라틴어 완주 증서입니다."},
      {k:"distancia",  n:"Certificado de Distancia", sub:"거리 인증서",   icon:"📏",
       d:"출발지와 완주 거리, 도착 날짜가 적힌 증서입니다."},
      {k:"registration", n:"Online Registration", sub:"온라인 등록 QR", icon:"",
       d:"도착 전 온라인 등록을 마치면 나오는 QR과 등록번호입니다. 사무소에서 제시합니다."}
    ],
    startDate : new Date(2027,4,9)
  };

  var DATA = {bin:null, jin:null}, who="bin", loaded=false;

  /* ── 날짜 · 도우미 ── */
  function pad(n){ return (n<10?"0":"")+n; }
  function dayDate(d){ var x=new Date(PP.startDate); x.setDate(x.getDate()+(d-1)); return x; }
  function dayLabel(d){ var x=dayDate(d); return (x.getMonth()+1)+"/"+x.getDate(); }
  function esc(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function imgUrl(id,w){ return "https://lh3.googleusercontent.com/d/"+id+"=w"+(w||1600); }
  function altUrl(id,w){ return "https://drive.google.com/thumbnail?id="+id+"&sz=w"+(w||1600); }

  /* 사진을 자르지 않고 화면에서만 잘라 보여주기 (스프라이트 방식) */
  function cropStyle(page, r, w){
    if(!page || !r) return "";
    var x=+r[0], y=+r[1], cw=Math.max(2,Math.min(100,+r[2])), ch=Math.max(2,Math.min(100,+r[3]));
    var px = (cw>=100) ? 50 : (x/(100-cw))*100;
    var py = (ch>=100) ? 50 : (y/(100-ch))*100;
    /* 틀의 가로세로 비율을 실제 잘린 영역과 똑같이 맞춥니다 */
    var iw=page.w||1000, ih=page.h||1400;
    /* 가느다랗거나 납작한 네모가 하나라도 있으면 타일이 화면을 뚫고 늘어나므로
       보이는 틀의 비율은 0.5~2.0 안으로 제한합니다 (약간 늘어나 보일 뿐 잘리지 않습니다) */
    var ratio=((cw*iw)/(ch*ih))||1;
    if(!isFinite(ratio)||ratio<=0) ratio=1;
    ratio=Math.max(0.5,Math.min(2.0,ratio));
    return "background-image:url('"+imgUrl(page.fileId,w||1200)+"');"
      + "background-size:"+(10000/cw)+"% "+(10000/ch)+"%;"
      + "background-position:"+px+"% "+py+"%;background-repeat:no-repeat;"
      + "aspect-ratio:"+ratio.toFixed(4)+";";
  }

  /* ── Drive 읽기 (텍스트는 CORS 때문에 프록시 우선) ── */
  function driveList(q){
    return fetch("https://www.googleapis.com/drive/v3/files?q="+encodeURIComponent(q)
      +"&fields="+encodeURIComponent("files(id,name,mimeType)")+"&pageSize=1000&key="+PHOTOS.apiKey)
      .then(function(r){ if(!r.ok) throw new Error("drive "+r.status); return r.json(); })
      .then(function(d){ return d.files||[]; });
  }
  function driveText(id){
    var uc="https://drive.google.com/uc?export=download&id="+id, c=[];
    if(PHOTOS.gpxProxy) c.push(PHOTOS.gpxProxy+(PHOTOS.gpxProxy.indexOf("?")<0?"?":"&")+"id="+id);
    c.push("https://www.googleapis.com/drive/v3/files/"+id+"?alt=media&key="+PHOTOS.apiKey);
    c.push("https://api.allorigins.win/raw?url="+encodeURIComponent(uc));
    c.push("https://corsproxy.io/?url="+encodeURIComponent(uc));
    function tryK(k){
      if(k>=c.length) return Promise.reject(new Error("여권 자료를 받을 수 없습니다"));
      var ac=("AbortController" in window)?new AbortController():null;
      var to=ac?setTimeout(function(){ac.abort();},8000):null;
      return fetch(c[k], ac?{signal:ac.signal}:{}).then(function(r){
        if(to)clearTimeout(to);
        if(!r.ok) throw 0; return r.text();
      }).catch(function(){ if(to)clearTimeout(to); return tryK(k+1); });
    }
    return tryK(0);
  }

  /* db 폴더의 파일 목록 — 할 일 모듈과 함께 씁니다 (한 번만 조회) */
  var _dbFiles=null;
  function dbFiles(){
    if(_dbFiles) return _dbFiles;
    _dbFiles = driveList("'"+PHOTOS.parentId+"' in parents and trashed=false")
      .then(function(items){
        var db=items.filter(function(f){
          return f.mimeType==="application/vnd.google-apps.folder"
              && f.name.toLowerCase()===PP.dbFolder; })[0];
        if(!db) throw new Error("db 폴더가 없습니다");
        return driveList("'"+db.id+"' in parents and trashed=false");
      });
    return _dbFiles;
  }
  window.CAMINO_DRIVE = { files:dbFiles, text:driveText };

  function load(){
    if(loaded) return Promise.resolve();
    loaded=true;
    return dbFiles()
      .then(function(files){
        return Promise.all(PP.people.map(function(p){
          var f=files.filter(function(x){ return x.name===PP.files[p.k]; })[0];
          if(!f) return null;
          return driveText(f.id).then(function(t){
            var j=null; try{ j=JSON.parse(t); }catch(e){}
            DATA[p.k]=normalize(j);
          }).catch(function(){});
        }));
      });
  }

  function normalize(j){
    var out={pages:{}, sellos:[], certs:{}};
    if(!j) return out;
    if(j.certs && typeof j.certs==="object") out.certs=j.certs;
    (j.pages||[]).forEach(function(p){ if(p&&p.id&&p.fileId) out.pages[p.id]=p; });
    (j.sellos||[]).forEach(function(s){
      if(!s||!s.id||s.del) return;
      out.sellos.push({
        id:s.id, pageId:s.pageId, rect:s.rect||[0,0,100,100],
        day:+s.day||0, date:s.date||"", time:s.time||"",
        place:s.place||"", town:s.town||"",
        lat:(s.lat!=null?+s.lat:null), lon:(s.lon!=null?+s.lon:null), note:s.note||""
      });
    });
    /* 날짜·시각 순으로 번호를 매깁니다 (#1, #2 …) */
    out.sellos.sort(function(a,b){
      if(a.day!==b.day) return a.day-b.day;
      return String(a.time).localeCompare(String(b.time));
    });
    out.sellos.forEach(function(s,i){ s.no=i+1; });
    return out;
  }
  /* "DAY 1 · 5/9 07:31" — 날짜별 카드 안에서도 어느 날 몇 시인지 바로 보이도록 */
  function whenLabel(s){
    var a=[];
    if(s.day) a.push("DAY "+s.day);
    var dt = s.day ? dayLabel(s.day) : (s.date||"").slice(5).replace("-","/");
    var tail = (dt?dt:"") + (s.time?(dt?" ":"")+s.time:"");
    if(tail) a.push(tail);
    return a.join(" · ");
  }
  function byDay(k,d){
    var o=DATA[k]; if(!o) return [];
    return o.sellos.filter(function(s){ return s.day===d; });
  }

  /* ══════════════ 상세 보기 ══════════════ */
  var lb=null, lbList=[], lbIdx=0;
  function makeLb(){
    if(lb) return;
    lb=document.createElement("div"); lb.className="pplb"; lb.id="ppLb";
    lb.innerHTML=
       '<div class="pplb-in">'
      +'<button class="pplb-x" type="button" aria-label="닫기">✕</button>'
      +'<button class="pplb-nav prev" type="button" aria-label="이전">‹</button>'
      +'<button class="pplb-nav next" type="button" aria-label="다음">›</button>'
      +'<div class="pplb-stamp"></div>'
      +'<div class="pplb-info">'
        +'<div class="pplb-no"></div>'
        +'<div class="pplb-place"></div>'
        +'<div class="pplb-town"></div>'
        +'<div class="pplb-when"></div>'
        +'<a class="pplb-gps" target="_blank" rel="noopener"></a>'
        +'<p class="pplb-note"></p>'
        +'<a class="pplb-page" target="_blank" rel="noopener">🖼 여권 페이지 원본 보기 ↗</a>'
      +'</div></div>';
    document.body.appendChild(lb);
    lb.querySelector(".pplb-x").addEventListener("click",closeLb);
    lb.addEventListener("click",function(e){ if(e.target===lb) closeLb(); });
    lb.querySelector(".prev").addEventListener("click",function(e){ e.stopPropagation(); showLb(lbIdx-1); });
    lb.querySelector(".next").addEventListener("click",function(e){ e.stopPropagation(); showLb(lbIdx+1); });
    document.addEventListener("keydown",function(e){
      if(!lb.classList.contains("show")) return;
      if(e.key==="Escape") closeLb();
      else if(e.key==="ArrowLeft") showLb(lbIdx-1);
      else if(e.key==="ArrowRight") showLb(lbIdx+1);
    });
  }
  function openLb(list,i){ makeLb(); lbList=list; lb.classList.add("show");
    document.body.style.overflow="hidden"; showLb(i); }
  function closeLb(){ if(lb){ lb.classList.remove("show"); document.body.style.overflow=""; } }
  function showLb(i){
    if(!lbList.length) return;
    lbIdx=(i+lbList.length)%lbList.length;
    var it=lbList[lbIdx], s=it.s, pg=it.page;
    lb.querySelector(".pplb-stamp").setAttribute("style", cropStyle(pg, s.rect, 1600));
    lb.querySelector(".pplb-no").textContent="📕 Sello #"+s.no;
    lb.querySelector(".pplb-place").textContent=s.place||"(장소 이름 없음)";
    var tw=lb.querySelector(".pplb-town");
    tw.textContent=(s.town&&s.town!==s.place)?s.town:"";
    tw.style.display=tw.textContent?"":"none";
    var dt=s.date||(s.day?dayDate(s.day).toISOString().slice(0,10):"");
    lb.querySelector(".pplb-when").textContent=
      (s.day?"DAY "+s.day+" · ":"")+dt+(s.time?"  "+s.time:"");
    var g=lb.querySelector(".pplb-gps");
    if(s.lat!=null&&s.lon!=null){
      g.textContent="📍 "+s.lat.toFixed(5)+", "+s.lon.toFixed(5)+"  — 지도에서 보기 ↗";
      g.href="https://www.google.com/maps/search/?api=1&query="+s.lat+","+s.lon;
      g.style.display="";
    } else g.style.display="none";
    var n=lb.querySelector(".pplb-note");
    n.textContent=s.note||""; n.style.display=s.note?"":"none";
    var pl=lb.querySelector(".pplb-page");
    if(pg){ pl.href=imgUrl(pg.fileId,2400); pl.style.display=""; } else pl.style.display="none";
    var many=lbList.length>1;
    lb.querySelector(".prev").hidden=!many;
    lb.querySelector(".next").hidden=!many;
  }
  function items(k, list){
    var o=DATA[k]||{pages:{}};
    return list.map(function(s){ return {s:s, page:o.pages[s.pageId]}; });
  }

  /* ══════════════ 세요 칩 ══════════════ */
  function chip(k,s,i,list,size){
    var o=DATA[k]||{pages:{}}, pg=o.pages[s.pageId];
    var b=document.createElement("button");
    b.type="button"; b.className="sello"+(size?" "+size:"");
    b.innerHTML='<span class="sello-img" style="'+cropStyle(pg,s.rect,800)+'"></span>'
      +'<span class="sello-cap"><b>'+esc(s.place||s.town||"세요")+'</b>'
      +'<small>'+esc(whenLabel(s))+'</small></span>'
      +'<span class="sello-no">#'+s.no+'</span>';
    b.addEventListener("click",function(){ openLb(items(k,list), i); });
    return b;
  }
  function emptySlot(txt){
    var d=document.createElement("span");
    d.className="sello empty"; d.innerHTML='<span class="sello-img"></span>'
      +'<span class="sello-cap">'+esc(txt||"아직 없음")+'</span>';
    return d;
  }

  /* ══════════════ ① 날짜별 카드 안의 세요 줄 ══════════════ */
  function mountDays(){
    for(var d=1;d<=PP.dayCount;d++) mountDay(d);
  }
  function mountDay(d){
    var card=document.getElementById("day"+d); if(!card) return;
    var foot=card.querySelector(".dfoot");
    var box=card.querySelector(".dsello");
    if(!box){
      box=document.createElement("div"); box.className="dsello"; box.dataset.day=d;
      card.insertBefore(box, foot||null);
    }
    var need=(d>=PP.doubleFromDay)?2:1;
    var mine=byDay(who,d), other=byDay(who==="bin"?"jin":"bin",d);
    var okTxt = mine.length>=need
      ? '<span class="ok">✓ 하루 기준 충족</span>'
      : '<span class="warn">하루 '+need+'개 필요 · '+mine.length+'개</span>';
    box.innerHTML='<h4>📕 DAY '+d+' 세요 <small>· '+dayLabel(d)+' · '
      +PP.people.map(function(p){
        return '<button type="button" class="ppwho'+(p.k===who?" on":"")+'" data-k="'+p.k+'">'+p.n+'</button>';
      }).join("")+' '+okTxt+'</small></h4><div class="sellorow"></div>';
    var row=box.querySelector(".sellorow");
    if(mine.length) mine.forEach(function(s,i){ row.appendChild(chip(who,s,i,mine,"sm")); });
    else{
      for(var i=0;i<need;i++) row.appendChild(emptySlot("세요 자리"));
      var t=document.createElement("span"); t.className="sellohint";
      t.textContent="여권 페이지를 촬영해 업로드 페이지의 📕 여권 탭에서 등록하면 여기에 나타납니다";
      row.appendChild(t);
    }
    if(other.length){
      var o=document.createElement("span"); o.className="sellohint alt";
      o.textContent=(who==="bin"?"JIN":"BIN")+"은 이 날 "+other.length+"개";
      row.appendChild(o);
    }
    box.querySelectorAll(".ppwho").forEach(function(b){
      b.addEventListener("click",function(){ who=b.dataset.k; render(); });
    });
  }

  /* ══════════════ ② 여권 섹션 ══════════════ */
  function mountSection(){
    var root=document.getElementById("ppRoot"); if(!root) return;
    var o=DATA[who];
    if(!o || !o.sellos.length){
      root.innerHTML=whoTabs()
        +'<div class="ppbook"><div class="ppcover">'+coverHTML()+'</div>'
        +'<p class="ppempty">아직 등록된 세요가 없습니다.<br>'
        +'여권 페이지를 사진으로 찍어 <b>upload-camino.html → 📕 여권</b> 탭에서 등록하면 '
        +'여기와 날짜별 카드에 자동으로 나타납니다.</p>'
        + guideHTML() + distHTML() + certHTML() +'</div>';
      bindWho(root); bindCerts(root); bindGuide(root); return;
    }
    var days=0, okDays=0;
    for(var d=1;d<=PP.dayCount;d++){
      var n=byDay(who,d).length, need=(d>=PP.doubleFromDay)?2:1;
      if(n) days++;
      if(n>=need) okDays++;
    }
    var h=whoTabs()
      +'<div class="ppbook">'
      +'<div class="ppcover">'+coverHTML()+'</div>'
      +'<div class="ppstat">'
        +'<div><b>'+o.sellos.length+'</b><small>전체 세요</small></div>'
        +'<div><b>'+days+' / '+PP.dayCount+'</b><small>세요 받은 날</small></div>'
        +'<div><b>'+okDays+' / '+PP.dayCount+'</b><small>기준 충족일</small></div>'
        +'<div><b>'+Object.keys(o.pages).length+'</b><small>여권 페이지</small></div>'
      +'</div>'
      +'<p class="pprule">🚲 자전거 순례는 <b>마지막 200km</b> 구간(이 일정에서는 <b>DAY '
      +PP.doubleFromDay+'부터</b>)에서 <b>하루 2개</b>의 세요가 필요합니다. 그 전에는 하루 1개면 됩니다.</p>'
      +'<div class="ppdays"></div>'
      +'<div class="ppgal"><h3>전체 세요 갤러리 <small>'+o.sellos.length+'개</small></h3>'
      +'<div class="ppgrid"></div></div>'
      + guideHTML() + distHTML() + certHTML()
      +'</div>';
    root.innerHTML=h;
    bindWho(root); bindCerts(root); bindGuide(root);

    var dw=root.querySelector(".ppdays");
    for(var d2=1;d2<=PP.dayCount;d2++){
      var list=byDay(who,d2), need2=(d2>=PP.doubleFromDay)?2:1;
      var sec=document.createElement("div"); sec.className="ppday"+(list.length?"":" none");
      sec.innerHTML='<div class="ppday-h"><b>DAY '+d2+'</b><span>'+dayLabel(d2)+'</span>'
        +(list.length>=need2?'<i class="ok">✓</i>':'<i class="warn">'+list.length+'/'+need2+'</i>')+'</div>'
        +'<div class="sellorow"></div>';
      var row=sec.querySelector(".sellorow");
      if(list.length) list.forEach(function(s,i){ row.appendChild(chip(who,s,i,list)); });
      else{ for(var q=0;q<need2;q++) row.appendChild(emptySlot("")); }
      dw.appendChild(sec);
    }
    var g=root.querySelector(".ppgrid");
    o.sellos.forEach(function(s,i){ g.appendChild(chip(who,s,i,o.sellos,"sm")); });
  }
  /* ── Compostela 안내 카드 (도착 때 필요한 것만) ── */
  var REG_URL="https://oficinadelperegrino.com/en/sigle-register/";
  function guideHTML(){
    return '<div class="cpg">'
      +'<h3>Compostela — 순례 완주 증서</h3>'

      +'<div class="cpg-b"><b>1. 자전거 순례자의 발급 조건</b>'
        +'<ul class="cpg-l">'
        +'<li><em>거리</em>Santiago까지 <b>마지막 200 km 이상</b> 자전거 주행 '
          +'<span class="ok">이번 일정 793.6 km — 충족</span></li>'
        +'<li><em>여권</em>Credencial(순례자 여권)에 경로를 따라 세요를 받을 것</li>'
        +'<li><em>세요</em>마지막 구간은 <b>하루 2개</b>를 받아 두는 것이 안전합니다 '
          +'<span class="sub">공식 규정문에는 개수가 명시되어 있지 않지만, 사무소 확인 관행입니다. '
          +'이 사이트는 DAY '+PP.doubleFromDay+'부터 2개 기준으로 표시합니다</span></li>'
        +'<li><em>도착</em>마지막 구간은 반드시 Santiago 대성당으로 들어오는 구간일 것</li>'
        +'<li><em>목적</em>종교적·영적 목적 또는 신앙적 탐구의 순례</li>'
        +'</ul></div>'

      +'<div class="cpg-b"><b>2. 온라인 등록</b>'
        +'<p class="cpg-p">도착 전에 미리 등록해 두면 사무소에서 훨씬 빠릅니다.</p>'
        +'<a class="cpg-btn" href="'+REG_URL+'" target="_blank" rel="noopener">'
        +'Pilgrim Office 온라인 등록 열기 &rarr;</a>'
        +'<div class="cpg-reg">'
          +'<figure class="cpg-fig">'
            +'<img src="images/pilgrim-registration.jpg" alt="Pilgrim registration 화면 예시" loading="lazy">'
            +'<figcaption>등록 화면 예시</figcaption></figure>'
          +'<table class="cpg-t"><tbody>'
            +'<tr><th>Way</th><td>French Way</td></tr>'
            +'<tr><th>Conveyance</th><td>Bicycle</td></tr>'
            +'<tr><th>Start of the way</th><td>Resto Europa</td></tr>'
            +'<tr><th>Start date</th><td>5/9/2027</td></tr>'
            +'<tr><th>Arrival date</th><td>5/21/2027</td></tr>'
            +'<tr><th>Print mileage certificate</th><td>체크 (거리 인증서 같이 신청)</td></tr>'
          +'</tbody></table>'
          +'<p class="cpg-note"><b>메모</b> Start of the way 목록에 '
          +'Saint-Jean-Pied-de-Port 가 없어 <b>Resto Europa</b>(스페인 밖 출발)를 골랐습니다. '
          +'실제 출발지와 거리는 거리 인증서에 기재됩니다.</p>'
        +'</div></div>'

      +'<div class="cpg-b warn"><b>3. 등록 후 반드시 저장</b>'
        +'<ul class="cpg-c">'
          +'<li>Registration Code 적어 두기</li>'
          +'<li>QR 화면 캡처</li>'
          +'<li>휴대폰 사진첩에 보관 + 아래 <b>온라인 등록 QR</b> 칸에 올려 두기</li>'
        +'</ul></div>'

      +'<div class="cpg-b"><b>4. Santiago 도착 후</b>'
        +'<ol class="cpg-s">'
          +'<li>마지막 세요 받기</li><li>Pilgrim Reception Office 이동</li>'
          +'<li>QR 또는 등록번호 제시</li><li>대기번호(QR 티켓) 받기</li>'
          +'<li>Credencial 확인</li><li>Compostela 수령</li>'
        +'</ol>'
        +'<p class="cpg-p"><b>Rúa Carretas 33</b>, 15705 Santiago de Compostela · '
        +'매일 <b>09:00–19:00</b> (12/25, 1/1 휴무)<br>'
        +'대기표의 QR로 현재 순번을 실시간 확인할 수 있고, 성수기에는 당일 수령이 보장되지 않습니다.</p></div>'

      +'</div>';
  }

  /* ── Certificate of Distance 안내 카드 ── */
  var DIST_URL="https://oficinadelperegrino.com/en/pilgrimage/certificate-of-distance/";
  function distHTML(){
    return '<div class="cpg dist">'
      +'<h3>Certificate of Distance — 주행거리 증명서</h3>'

      +'<div class="cpg-b"><b>1. 어떤 증서인가</b>'
        +'<p class="cpg-p">Compostela 가 <b>순례를 마쳤다</b>는 증서라면, 이것은 '
        +'<b>어디서 출발해 몇 km 를 갔는지</b>를 산티아고 대성당이 공식으로 기록해 주는 증서입니다. '
        +'양피지 느낌의 종이에 인쇄되며 Compostela 보다 조금 큽니다.</p>'
        +'<ul class="cpg-c">'
          +'<li>출발일</li><li>출발지</li><li>인정 거리 (km)</li>'
          +'<li>Santiago 도착일</li><li>이용한 Camino 경로</li>'
        +'</ul></div>'

      +'<div class="cpg-b"><b>2. 우리 여행이라면</b>'
        +'<table class="cpg-t"><tbody>'
          +'<tr><th>이동 수단</th><td>Bicycle</td></tr>'
          +'<tr><th>경로</th><td>Camino Francés (French Way)</td></tr>'
          +'<tr><th>출발</th><td>Saint-Jean-Pied-de-Port, France · 2027년 5월 9일</td></tr>'
          +'<tr><th>도착</th><td>Santiago de Compostela · 2027년 5월 21일</td></tr>'
          +'<tr><th>계획 거리</th><td>793.6 km</td></tr>'
        +'</tbody></table>'
        +'<p class="cpg-note" style="margin-top:10px">'
        +'<b>주의</b> 증서에 적히는 거리는 Pilgrim Office 가 크레덴시알과 인정 경로를 확인해 '
        +'<b>직접 결정</b>합니다. 793.6 km 는 우리 계획 거리일 뿐, 그대로 기재된다고 볼 수 없습니다.</p></div>'

      +'<div class="cpg-b"><b>3. 신청 방법</b>'
        +'<p class="cpg-p">따로 등록하는 곳은 없습니다. 앞의 <b>온라인 등록</b> 화면에서 '
        +'맨 아래 <b>Print mileage certificate</b> 를 체크하면 됩니다. '
        +'사무소에서 Compostela 와 <b>함께 신청</b>하는 것이 가장 간단합니다.</p>'
        +'<div class="cpg-chk">Print mileage certificate <i>체크</i></div></div>'

      +'<div class="cpg-b"><b>4. 비용과 수령</b>'
        +'<table class="cpg-t"><tbody>'
          +'<tr><th>비용</th><td>3 € <span class="sub2">Compostela 는 무료</span></td></tr>'
          +'<tr><th>수령</th><td>Pilgrim Reception Office · Rúa Carretas 33</td></tr>'
          +'<tr><th>문의</th><td>certificadodedistancia@catedraldesantiago.es</td></tr>'
        +'</tbody></table>'
        +'<figure class="cpg-fig dist"><img src="images/distance-certificate.jpg" '
          +'alt="Certificate of Distance 예시" loading="lazy">'
          +'<figcaption>증서 예시</figcaption></figure>'
        +'<a class="cpg-link" href="'+DIST_URL+'" target="_blank" rel="noopener">'
        +'공식 안내와 증서 사진 보기 &rarr;</a></div>'

      +'<div class="cpg-b"><b>5. 두 증서의 차이</b>'
        +'<div class="cpg-tw"><table class="cpg-t2"><thead><tr>'
          +'<th></th><th>Compostela</th><th>Distance Certificate</th></tr></thead><tbody>'
          +'<tr><th>의미</th><td>순례 완주 인증</td><td>순례 거리 인증</td></tr>'
          +'<tr><th>출발지</th><td class="no">없음</td><td class="yes">있음</td></tr>'
          +'<tr><th>출발일</th><td class="no">없음</td><td class="yes">있음</td></tr>'
          +'<tr><th>경로 이름</th><td class="no">없음</td><td class="yes">있음</td></tr>'
          +'<tr><th>주행 거리</th><td class="no">없음</td><td class="yes">있음</td></tr>'
          +'<tr><th>도착일</th><td class="yes">있음</td><td class="yes">있음</td></tr>'
          +'<tr><th>가격</th><td>무료</td><td>3 €</td></tr>'
        +'</tbody></table></div>'
        +'<p class="cpg-p">Compostela 에는 793.6 km 가 남지 않습니다. '
        +'이번 자전거 순례의 기록으로는 <b>두 가지를 함께 받는 편</b>을 권합니다.</p></div>'
      +'</div>';
  }

  /* ── 증서: Compostela → Certificado de Distancia 순서 ── */
  function certHTML(){
    var o=DATA[who]||{certs:{}}, C=o.certs||{};
    var any=PP.certs.some(function(c){ return C[c.k] && C[c.k].fileId; });
    var h='<div class="ppcerts"><h3>증서 <small>Compostela · Certificado de Distancia</small></h3>'
      +(any?'':'<p class="ppcert-hint">완주 후 받은 증서를 '
        +'<b>upload-camino.html → 📕 여권</b> 탭에서 올리면 여기에 표시됩니다.</p>')
      +'<div class="ppcertrow">';
    PP.certs.forEach(function(c){
      var v=C[c.k]||{};
      var meta=[];
      if(v.date) meta.push(v.date);
      if(c.k==="distancia"){
        if(v.km!=null&&v.km!=="") meta.push((+v.km).toFixed(1)+" km");
        if(v.from) meta.push(v.from+" 출발");
      }else if(c.k==="registration"){
        if(v.code) meta.push("Code "+v.code);
      }else if(v.latin) meta.push(v.latin);
      h+='<div class="ppcert'+(v.fileId?"":" none")+'" data-c="'+c.k+'">'
        +'<div class="ppcert-t">'+c.icon+' <b>'+esc(c.n)+'</b><span>'+esc(c.sub)+'</span></div>'
        +(v.fileId
          ? '<button type="button" class="ppcert-i"><img src="'+imgUrl(v.fileId,900)
            +'" alt="'+esc(c.n)+'" loading="lazy"><span class="ppcert-z">⤢ 크게 보기</span></button>'
          : '<div class="ppcert-e">아직 등록되지 않았습니다</div>')
        +'<p class="ppcert-d">'+esc(c.d)+'</p>'
        +(meta.length?'<div class="ppcert-m">'+meta.map(esc).join(' · ')+'</div>':'')
        +'</div>';
    });
    return h+'</div></div>';
  }
  function fallbackImg(im,cand){
    var i=0;
    im.onerror=function(){
      i++;
      if(i<cand.length){ im.src=cand[i]; return; }
      im.onerror=null;
      var f=im.closest("figure"); if(f) f.style.display="none";
    };
  }
  function bindGuide(root){
    var a=root.querySelector(".cpg-fig:not(.dist) img");
    if(a) fallbackImg(a,["images/pilgrim-registration.jpg","images/pilgram.jpg",
                         "images/pilgrim-registration.png"]);
    var b=root.querySelector(".cpg-fig.dist img");
    if(b) fallbackImg(b,["images/distance-certificate.jpg","images/distance-certificate.png",
                         "images/certificado-distancia.jpg"]);
  }
  function bindCerts(root){
    var o=DATA[who]||{certs:{}}, C=o.certs||{};
    root.querySelectorAll(".ppcert-i").forEach(function(b){
      b.addEventListener("click",function(){
        var ck=b.closest(".ppcert").dataset.c, v=C[ck]||{};
        var c=PP.certs.filter(function(x){return x.k===ck;})[0]||{};
        openCert(v,c);
      });
    });
  }
  /* 증서 크게 보기 */
  var clb=null;
  function openCert(v,c){
    if(!clb){
      clb=document.createElement("div"); clb.className="ppclb";
      clb.innerHTML='<button class="ppclb-x" type="button">✕</button>'
        +'<img alt=""><div class="ppclb-c"></div>';
      document.body.appendChild(clb);
      clb.querySelector(".ppclb-x").addEventListener("click",closeCert);
      clb.addEventListener("click",function(e){ if(e.target===clb) closeCert(); });
      document.addEventListener("keydown",function(e){
        if(clb.classList.contains("show")&&e.key==="Escape") closeCert(); });
    }
    clb.querySelector("img").src=imgUrl(v.fileId,2000);
    var m=[]; if(v.date)m.push(v.date);
    if(v.km!=null&&v.km!=="")m.push((+v.km).toFixed(1)+" km");
    if(v.from)m.push(v.from+" 출발");
    if(v.latin)m.push(v.latin);
    if(v.note)m.push(v.note);
    clb.querySelector(".ppclb-c").textContent=(c.n||"")+(m.length?"  ·  "+m.join("  ·  "):"");
    clb.classList.add("show"); document.body.style.overflow="hidden";
  }
  function closeCert(){ if(clb){ clb.classList.remove("show"); document.body.style.overflow=""; } }

  function coverHTML(){
    var p=PP.people.filter(function(x){return x.k===who;})[0]||PP.people[0];
    return '<div class="ppc-t">CREDENCIAL DEL PEREGRINO</div>'
      +'<div class="ppc-n">'+p.n+'</div>'
      +'<div class="ppc-s">Camino Francés · 2027</div>'
      +'<div class="ppc-d">Saint-Jean-Pied-de-Port → Santiago de Compostela · 793.6 km</div>';
  }
  function whoTabs(){
    return '<div class="ppwhobar">'+PP.people.map(function(p){
      return '<button type="button" class="ppwho'+(p.k===who?" on":"")+'" data-k="'+p.k+'">📕 '+p.n+' 여권</button>';
    }).join("")+'</div>';
  }
  function bindWho(root){
    root.querySelectorAll(".ppwho").forEach(function(b){
      b.addEventListener("click",function(){ who=b.dataset.k; render(); });
    });
  }

  function render(){ mountSection(); mountDays(); }

  /* ══════════════ 시작 ══════════════ */
  function boot(){
    render();                       /* 자료가 오기 전에도 빈 틀을 먼저 */
    load().then(render).catch(function(){ render(); });
  }
  if(window.onCaminoDays) window.onCaminoDays(boot);
  else if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

/* ── 블록 6 ── */
/* ══════════════════════════════════════════════════════════════════════
   ✅ 함께 쓰는 할 일 — Drive db/todo-{common,jin,bin}.json 을 읽어 보여줍니다
   · 주행 전 / 주행 중 / 주행 후  ×  공통 / Jin / Bin
   · 이 페이지에서는 보기만 하고, 고치는 것은 upload-camino.html 의 ✅ 할 일 탭입니다
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var TS = {
    files : { common:"todo-common.json", jin:"todo-jin.json", bin:"todo-bin.json" },
    owners: [ {k:"common", icon:"👥", label:"공통"},
              {k:"jin",    icon:"🟦", label:"Jin"},
              {k:"bin",    icon:"🟩", label:"Bin"} ],
    phases: [ {k:"pre",    icon:"🎒", label:"주행 전", desc:"출발 전에 끝내야 할 준비"},
              {k:"during", icon:"🚴", label:"주행 중", desc:"매일·구간마다 챙길 것"},
              {k:"post",   icon:"🏁", label:"주행 후", desc:"완주 후 마무리"} ]
  };
  var DATA={}, view="all", state="load";

  function esc(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function norm(raw){
    var d={pre:[],during:[],post:[]};
    if(!raw) return d;
    TS.phases.forEach(function(p){
      var a=(raw.items&&raw.items[p.k])||[];
      d[p.k]=a.filter(function(x){ return x&&x.id&&!x.del; })
              .map(function(x){ return {id:x.id, text:String(x.text||""),
                                        done:!!x.done, by:String(x.by||"")}; });
    });
    return d;
  }

  function load(){
    if(!window.CAMINO_DRIVE) return Promise.reject(new Error("Drive 설정이 없습니다"));
    return window.CAMINO_DRIVE.files().then(function(files){
      return Promise.all(TS.owners.map(function(o){
        var f=files.filter(function(x){ return x.name===TS.files[o.k]; })[0];
        if(!f) return null;
        return window.CAMINO_DRIVE.text(f.id).then(function(t){
          var j=null; try{ j=JSON.parse(t); }catch(e){}
          DATA[o.k]=norm(j);
        }).catch(function(){});
      }));
    });
  }

  function counts(k){
    var n=0, done=0;
    TS.phases.forEach(function(p){
      var a=(DATA[k]||{})[p.k]||[];
      n+=a.length; done+=a.filter(function(x){return x.done;}).length;
    });
    return {n:n, done:done};
  }

  function render(){
    var root=document.getElementById("tdSiteRoot"); if(!root) return;

    if(state==="load"){ root.innerHTML='<p class="tsload">함께 쓰는 할 일을 불러오는 중…</p>'; return; }
    if(state==="err"){
      root.innerHTML='<p class="tsload">할 일 목록을 불러오지 못했습니다. '
        +'Drive 의 <b>db</b> 폴더와 공유 설정을 확인해 주세요.</p>';
      return;
    }

    var shown=TS.owners.filter(function(o){ return view==="all"||o.k===view; });
    var tot=0, tdone=0;
    TS.owners.forEach(function(o){ var c=counts(o.k); tot+=c.n; tdone+=c.done; });

    var h='<div class="tsbar"><button type="button" data-o="all"'
      +(view==="all"?' class="on"':'')+'>전체</button>'
      + TS.owners.map(function(o){
          var c=counts(o.k);
          return '<button type="button" data-o="'+o.k+'"'+(view===o.k?' class="on"':'')+'>'
            +o.icon+' '+o.label+' <i>'+c.done+'/'+c.n+'</i></button>';
        }).join("")
      +'<span class="tstot">전체 '+tdone+' / '+tot+' 완료</span></div>';

    TS.phases.forEach(function(p){
      h+='<div class="tsphase"><h3>'+p.icon+' '+p.label+' <small>'+p.desc+'</small></h3>'
        +'<div class="tscols'+(shown.length===1?" one":"")+'">';
      shown.forEach(function(o){
        var items=((DATA[o.k]||{})[p.k]||[]);
        var done=items.filter(function(x){return x.done;}).length;
        var pct=items.length?Math.round(done/items.length*100):0;
        h+='<div class="tsbox" data-o="'+o.k+'">'
          +'<div class="tshead">'+o.icon+' '+o.label
          +'<span class="tscnt">'+done+' / '+items.length+'</span></div>'
          +'<div class="tsbarline"><i style="width:'+pct+'%"></i></div><ul>';
        if(!items.length) h+='<li class="tsnone">항목이 없습니다</li>';
        items.forEach(function(it){
          h+='<li class="'+(it.done?"done":"")+'"><span class="tsck">'
            +(it.done?"✓":"")+'</span><span class="tstx">'+esc(it.text)+'</span>'
            +(it.done&&it.by?'<span class="tsby">'+esc(it.by)+'</span>':'')+'</li>';
        });
        h+='</ul></div>';
      });
      h+='</div></div>';
    });
    h+='<p class="tsfoot">고치기는 <b>upload-camino.html → ✅ 할 일</b> 탭에서 합니다. '
      +'Bin·Jin 이 각자 <b>공통</b>과 <b>자기 목록</b>을 편집하면 여기에 반영됩니다.</p>';

    root.innerHTML=h;
    root.querySelectorAll(".tsbar button").forEach(function(b){
      b.addEventListener("click",function(){ view=b.dataset.o; render(); });
    });
  }

  function boot(){
    render();
    load().then(function(){ state="ok"; render(); })
          .catch(function(){ state="err"; render(); });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

/* ── 블록 9 ── */
/* ══════════════════════════════════════════════════════════════════════
   💶 비용 — Drive db/expense-*.json 을 읽어 보여 줍니다
   총비용 · 분류별 · 개인별 · 기간별 · 정산 현황
   기록은 upload-camino.html 의 💶 비용 탭에서 합니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var XF = { bin:"expense-bin.json", jin:"expense-jin.json", settle:"expense-settle.json" };
  var XC = [
    {k:"stay", n:"숙박",      c:"#8E2C3A"},
    {k:"food", n:"음식",      c:"#C79A17"},
    {k:"move", n:"교통",      c:"#1E3A6E"},
    {k:"bike", n:"자전거",    c:"#1E7A46"},
    {k:"pil",  n:"순례",      c:"#7A5EA8"},
    {k:"comm", n:"통신·보험", c:"#2F7F8F"},
    {k:"gear", n:"장비·의류", c:"#A0642A"},
    {k:"etc",  n:"기타",      c:"#8A8578"}
  ];
  var DAYS = 13;
  var DATA = {bin:[], jin:[]}, SET = null, state="load";

  function esc(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function eur(v){
    return "€" + (Math.round(v*100)/100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function eur0(v){ return "€" + Math.round(v).toLocaleString(); }
  function cat(k){ for(var i=0;i<XC.length;i++) if(XC[i].k===k) return XC[i]; return XC[XC.length-1]; }
  function dayName(d){ return d<=0 ? "출발 전" : (d>DAYS ? "완주 후" : "DAY "+d); }

  function norm(j){
    if(!j || !j.items) return [];
    return j.items.filter(function(x){ return x && x.id && !x.del; })
      .map(function(x){
        return { id:x.id, eur:+x.eur||0, amt:+x.amt||0, cur:x.cur||"EUR",
          cat:x.cat||"etc", sub:x.sub||"", payer:x.payer||"bin",
          split:x.split||"half", settle:(x.settle===undefined?true:!!x.settle),
          day:(x.day===undefined?0:+x.day), place:x.place||"", memo:x.memo||"",
          fileId:x.fileId||"" };
      });
  }

  function load(){
    if(!window.CAMINO_DRIVE) return Promise.reject(new Error("Drive 설정이 없습니다"));
    return window.CAMINO_DRIVE.files().then(function(files){
      var jobs=["bin","jin"].map(function(k){
        var f=files.filter(function(x){ return x.name===XF[k]; })[0];
        if(!f) return null;
        return window.CAMINO_DRIVE.text(f.id).then(function(t){
          var j=null; try{ j=JSON.parse(t); }catch(e){}
          DATA[k]=norm(j);
        }).catch(function(){});
      });
      var sf=files.filter(function(x){ return x.name===XF.settle; })[0];
      if(sf) jobs.push(window.CAMINO_DRIVE.text(sf.id).then(function(t){
        try{ SET=JSON.parse(t); }catch(e){}
      }).catch(function(){}));
      return Promise.all(jobs);
    });
  }

  function all(){
    return DATA.bin.concat(DATA.jin).sort(function(a,b){ return a.day-b.day; });
  }
  function totals(){
    var t={all:0,bin:0,jin:0,cat:{},day:{},sBin:0,sJin:0,pre:0,ride:0,post:0,n:0};
    all().forEach(function(x){
      var v=x.eur; t.all+=v; t.n++;
      t[x.payer]=(t[x.payer]||0)+v;
      t.cat[x.cat]=(t.cat[x.cat]||0)+v;
      t.day[x.day]=(t.day[x.day]||0)+v;
      if(x.day<=0) t.pre+=v; else if(x.day>DAYS) t.post+=v; else t.ride+=v;
      if(!x.settle) return;
      var owed = x.split==="half" ? v/2 : (x.split==="other" ? v : 0);
      if(x.payer==="bin") t.sBin+=owed; else t.sJin+=owed;
    });
    t.owe=t.sBin-t.sJin;
    return t;
  }

  function render(){
    var root=document.getElementById("exSiteRoot"); if(!root) return;
    if(state==="load"){ root.innerHTML='<p class="tsload">비용 자료를 불러오는 중…</p>'; return; }
    if(state==="err"){
      root.innerHTML='<p class="tsload">비용 자료를 불러오지 못했습니다. '
        +'Drive 의 <b>db</b> 폴더와 공유 설정을 확인해 주세요.</p>'; return;
    }
    var t=totals();
    if(!t.n){
      root.innerHTML='<p class="tsload">아직 기록된 비용이 없습니다.<br>'
        +'<b>upload-camino.html → 💶 비용</b> 탭에서 영수증을 올리면 여기에 나타납니다.</p>';
      return;
    }
    var rideDays=0;
    for(var d=1;d<=DAYS;d++) if(t.day[d]) rideDays++;

    var h='<div class="xsum">'
      + xc("총비용", eur0(t.all), t.n+"건")
      + xc("1인당", eur0(t.all/2), "단순 절반")
      + xc("여행 중 하루평균", rideDays?eur0(t.ride/rideDays):"—", rideDays+"일 기준")
      + xc("출발 전", eur0(t.pre), "항공·장비·예약금")
      + '</div>';

    /* 정산 */
    var closed = SET && SET.closed && SET.closed.length;
    var from = t.owe>0 ? "JIN" : "BIN", to = t.owe>0 ? "BIN" : "JIN";
    h+='<div class="xowe'+(closed?" done":"")+'">'
      +'<div class="xowe-h"><b>정산</b>'
      +(closed?'<span class="xdone">확정됨</span>':'<span class="xprov">여행 중 · 참고용</span>')+'</div>'
      +(Math.abs(t.owe)<0.01
        ? '<div class="xowe-v">지금은 <b>비긴 상태</b>입니다</div>'
        : '<div class="xowe-v"><b>'+from+'</b> 이 <b>'+to+'</b> 에게 <em>'+eur(Math.abs(t.owe))+'</em></div>')
      +'<div class="xowe-n">항공권과 보험은 각자 부담이라 정산에서 빠져 있습니다. '
      +'실제 정산은 산티아고 도착 후 확정하세요.</div></div>';

    /* 개인별 */
    var bp = t.all ? Math.round((t.bin||0)/t.all*100) : 50;
    h+='<h3 class="xh3">누가 얼마를 냈나</h3>'
      +'<div class="xpay"><div class="xpbar">'
        +'<i class="bin" style="width:'+bp+'%"></i><i class="jin" style="width:'+(100-bp)+'%"></i></div>'
      +'<div class="xpl"><span><b class="who bin">BIN</b> '+eur(t.bin||0)+'</span>'
        +'<span>'+eur(t.jin||0)+' <b class="who jin">JIN</b></span></div></div>';

    /* 분류별 */
    var cats=XC.map(function(c){ return {c:c, v:t.cat[c.k]||0}; })
      .sort(function(a,b){ return b.v-a.v; });
    h+='<h3 class="xh3">분류별</h3><div class="xcats">';
    cats.forEach(function(o){
      var pct=t.all?Math.round(o.v/t.all*100):0;
      h+='<div class="xcat'+(o.v?"":" off")+'">'
        +'<span class="xcn"><i style="background:'+o.c.c+'"></i>'+o.c.n+'</span>'
        +'<span class="xcb"><em style="width:'+pct+'%;background:'+o.c.c+'"></em></span>'
        +'<span class="xcv">'+(o.v?eur0(o.v):"—")+'</span>'
        +'<span class="xcp">'+(o.v?pct+"%":"")+'</span></div>';
    });
    h+='</div>';

    /* 기간별 */
    var max=0;
    for(var i=0;i<=DAYS+1;i++) if((t.day[i]||0)>max) max=t.day[i]||0;
    h+='<h3 class="xh3">기간별</h3><div class="xdays">';
    for(var d2=0;d2<=DAYS+1;d2++){
      var v=t.day[d2]||0, hh=max?Math.round(v/max*100):0;
      h+='<div class="xd'+(d2===0||d2>DAYS?" sp":"")+'" title="'+dayName(d2)+' '+eur(v)+'">'
        +'<span class="xdb"><i style="height:'+hh+'%"></i></span>'
        +'<span class="xdl">'+(d2===0?"전":(d2>DAYS?"후":d2))+'</span></div>';
    }
    h+='</div><p class="xdnote">막대에 손을 올리면 금액이 보입니다 · '
      +'<b>전</b> 출발 전 · <b>후</b> 완주 후</p>';

    h+='<p class="tsfoot">기록은 <b>upload-camino.html → 💶 비용</b> 탭에서 합니다. '
      +'금액은 모두 유로로 환산한 값이며, 원화·달러는 결제 당시 환율로 계산했습니다.</p>';

    root.innerHTML=h;
  }
  function xc(n,v,s){
    return '<div class="xc"><small>'+n+'</small><b>'+v+'</b><i>'+(s||"")+'</i></div>';
  }

  function boot(){
    render();
    load().then(function(){ state="ok"; render(); })
          .catch(function(){ state="err"; render(); });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

/* ── 블록 11 ── */
/* ══════════════════════════════════════════════════════════════════════
   숙소 예약 현황 — Drive db/lodging.json 을 읽어 보여 줍니다
   · 넓은 화면: 2027년 5월 달력
   · 좁은 화면: 날짜별 카드로 세로 나열
   기록은 upload-camino.html 의 🛏 숙소 탭에서 합니다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var FILE = "lodging.json";
  var ST = {
    none   : {n:"미예약",    c:"none",  i:"·"},
    asked  : {n:"문의 발송",  c:"asked", i:"✉"},
    waiting: {n:"오픈 대기",  c:"wait",  i:"⏳"},
    booked : {n:"예약 완료",  c:"book",  i:"✓"},
    paid   : {n:"결제 완료",  c:"paid",  i:"✓✓"},
    cancel : {n:"취소됨",     c:"canc",  i:"✕"}
  };
  /* 기본 일정 — 자료가 없어도 뼈대는 보입니다 */
  var PLAN = [
    ["2027-05-07", -1, "파리",              "몽파르나스 인근"],
    ["2027-05-08",  0, "생장피에드포르",     ""],
    ["2027-05-09",  1, "수비리",            "Zubiri"],
    ["2027-05-10",  2, "에스테야",          "Estella"],
    ["2027-05-11",  3, "나바레테",          "Navarrete"],
    ["2027-05-12",  4, "벨로라도",          "Belorado"],
    ["2027-05-13",  5, "카스트로헤리스",     "Castrojeriz"],
    ["2027-05-14",  6, "사아군",            "Sahagún"],
    ["2027-05-15",  7, "레온",              "León"],
    ["2027-05-16",  8, "레온 (휴식)",        "León"],
    ["2027-05-17",  9, "라바날 델 카미노",   "Rabanal"],
    ["2027-05-18", 10, "베가 데 발카르세",   "Las Herrerías"],
    ["2027-05-19", 11, "사리아",            "Sarria"],
    ["2027-05-20", 12, "아르수아",          "Arzúa"],
    ["2027-05-21", 13, "산티아고",          "Santiago"]
  ];
  var DATA = {}, state = "load";

  function esc(t){ return String(t==null?"":t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function st(k){ return ST[k] || ST.none; }
  function dow(iso){
    var d=new Date(iso+"T12:00:00");
    return ["일","월","화","수","목","금","토"][d.getDay()];
  }
  function md(iso){ return (+iso.slice(5,7))+"/"+(+iso.slice(8,10)); }

  function load(){
    if(!window.CAMINO_DRIVE) return Promise.reject(new Error("Drive 설정이 없습니다"));
    return window.CAMINO_DRIVE.files().then(function(files){
      var f=files.filter(function(x){ return x.name===FILE; })[0];
      if(!f) return null;
      return window.CAMINO_DRIVE.text(f.id).then(function(t){
        var j=null; try{ j=JSON.parse(t); }catch(e){}
        if(j && j.nights) j.nights.forEach(function(n){ if(n && n.date) DATA[n.date]=n; });
      });
    });
  }

  function row(iso){
    var p = PLAN.filter(function(x){ return x[0]===iso; })[0];
    var d = DATA[iso] || {};
    return {
      iso:iso, day:p?p[1]:null, city:d.city || (p?p[2]:""), area:p?p[3]:"",
      name:d.name||"", status:d.status||"none", ref:d.ref||"",
      by:d.by||"", price:d.price||"", memo:d.memo||"", url:d.url||""
    };
  }

  function render(){
    var root=document.getElementById("lodgeRoot"); if(!root) return;
    if(state==="load"){ root.innerHTML='<p class="tsload">예약 현황을 불러오는 중…</p>'; return; }

    var rows = PLAN.map(function(p){ return row(p[0]); });
    var cnt = {};
    rows.forEach(function(r){ cnt[r.status]=(cnt[r.status]||0)+1; });

    var h = '<div class="lsum">'
      + lc("전체", rows.length+"박", "5/7 ~ 5/21")
      + lc("예약 완료", (cnt.booked||0)+(cnt.paid||0)+"곳", "결제 포함", "book")
      + lc("문의 · 대기", (cnt.asked||0)+(cnt.waiting||0)+"곳", "답을 기다리는 중", "asked")
      + lc("미예약", (cnt.none||0)+"곳", "아직 손대지 않음", "none")
      + '</div>';

    if(state==="err"){
      h += '<p class="tsload">현황 자료를 불러오지 못했습니다 — 아래는 기본 일정입니다.<br>'
        + '<b>upload-camino.html → 🛏 숙소</b> 탭에서 기록하면 여기에 나타납니다.</p>';
    }

    /* ── 넓은 화면: 5월 달력 ── */
    h += '<div class="lcal"><div class="lcal-h">2027년 5월</div><div class="lcal-g">';
    ["월","화","수","목","금","토","일"].forEach(function(w){
      h += '<div class="lcw">'+w+'</div>';
    });
    /* 5/1 은 토요일 → 월요일 시작 격자에서 5칸 비움 */
    for(var b=0;b<5;b++) h += '<div class="lcd off"></div>';
    for(var day=1; day<=31; day++){
      var iso = "2027-05-" + (day<10?"0":"") + day;
      var r = rows.filter(function(x){ return x.iso===iso; })[0];
      if(!r){
        h += '<div class="lcd out"><span class="lcn">'+day+'</span></div>';
        continue;
      }
      var s = st(r.status);
      h += '<div class="lcd '+s.c+'" title="'+esc(r.city+" · "+s.n)+'">'
        + '<span class="lcn">'+day+'</span>'
        + '<span class="lct">'+esc(r.city)+'</span>'
        + '<span class="lcs">'+s.i+' '+s.n+'</span>'
        + (r.name?'<span class="lcm">'+esc(r.name)+'</span>':'')
        + '</div>';
    }
    h += '</div></div>';

    /* ── 좁은 화면: 세로 카드 ── */
    h += '<div class="llist">';
    rows.forEach(function(r){
      var s = st(r.status);
      h += '<div class="lrow '+s.c+'">'
        + '<div class="ld"><b>'+md(r.iso)+'</b><span>'+dow(r.iso)+'</span>'
          + (r.day>0?'<em>DAY '+r.day+'</em>':(r.day===0?'<em>생장</em>':'<em>파리</em>'))+'</div>'
        + '<div class="li"><b>'+esc(r.city)+'</b>'
          + (r.name?'<span>'+esc(r.name)+'</span>':'<span class="dim">숙소 미정</span>')
          + (r.memo?'<small>'+esc(r.memo)+'</small>':'')
          + '</div>'
        + '<div class="lz"><span class="lst '+s.c+'">'+s.i+' '+s.n+'</span>'
          + (r.ref?'<code>'+esc(r.ref)+'</code>':'')
          + (r.by?'<i class="who '+r.by+'">'+r.by.toUpperCase()+'</i>':'')
          + (r.price?'<em>'+esc(r.price)+'</em>':'')
          + '</div>'
        + '</div>';
    });
    h += '</div>';

    h += '<div class="lleg">'
      + Object.keys(ST).map(function(k){
          return '<span class="lst '+ST[k].c+'">'+ST[k].i+' '+ST[k].n+'</span>'; }).join("")
      + '</div>'
      + '<p class="tsfoot">기록은 <b>upload-camino.html → 🛏 숙소</b> 탭에서 합니다. '
      + 'Bin·Jin 둘 다 고칠 수 있고, 누가 예약했는지도 함께 남깁니다.</p>';

    root.innerHTML = h;
  }
  function lc(n,v,s,c){
    return '<div class="lsc'+(c?" "+c:"")+'"><small>'+n+'</small><b>'+v+'</b><i>'+(s||"")+'</i></div>';
  }

  function boot(){
    render();
    load().then(function(){ state="ok"; render(); })
          .catch(function(){ state="err"; render(); });
  }
  if(window.onCaminoParts) window.onCaminoParts(boot);
  else if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
