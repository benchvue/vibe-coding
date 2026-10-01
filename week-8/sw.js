/* Camino 2027 — 지도 타일 오프라인 캐시 (Service Worker)
   · tile.openstreetmap.org 요청은 캐시에 있으면 캐시에서, 없으면 인터넷에서 받고 캐시에 넣어 둡니다
   · 그 밖의 요청은 손대지 않습니다 (앱스 스크립트·Drive·Cesium 지형 등 전부 그대로)
   · 미리 받기는 페이지(camino-route-compare.html 설정 → 오프라인 타일)가 같은 캐시 이름으로 넣습니다 */
var TILE_CACHE = "camino-tiles-v1";
var TILE_HOSTS = ["tile.openstreetmap.org", "a.tile.openstreetmap.org", "b.tile.openstreetmap.org", "c.tile.openstreetmap.org"];

self.addEventListener("install", function(e){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", function(e){
  var u;
  try{ u = new URL(e.request.url); }catch(err){ return; }
  if(TILE_HOSTS.indexOf(u.hostname) < 0) return;
  /* 서브도메인(a/b/c)이 섞여 와도 같은 타일이면 같은 키로 */
  var key = "https://tile.openstreetmap.org" + u.pathname;
  e.respondWith(
    caches.open(TILE_CACHE).then(function(c){
      return c.match(key).then(function(hit){
        if(hit) return hit;
        return fetch(e.request).then(function(res){
          if(res && res.ok) c.put(key, res.clone()).catch(function(){});
          return res;
        });
      });
    })
  );
});

/* 페이지가 보내는 메시지: 캐시 비우기 */
self.addEventListener("message", function(e){
  if(e.data && e.data.type === "clear-tiles"){
    e.waitUntil(caches.delete(TILE_CACHE).then(function(){ if(e.source) e.source.postMessage({type:"tiles-cleared"}); }));
  }
});
