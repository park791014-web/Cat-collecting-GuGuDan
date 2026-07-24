var CACHE_NAME = "nyanko-auth-fix-20260724-01";
var ASSETS = [
  "/Cat-collecting-GuGuDan/",
  "/Cat-collecting-GuGuDan/index.html",
  "/Cat-collecting-GuGuDan/css/style.css?v=2.0.41",
  "/Cat-collecting-GuGuDan/css/phase56.css",
  "/Cat-collecting-GuGuDan/css/phase561.css",
  "/Cat-collecting-GuGuDan/css/phase562.css",
  "/Cat-collecting-GuGuDan/css/releasePatch.css?v=2.0.41",
  "/Cat-collecting-GuGuDan/js/app.js?v=2.0.41",
  "/Cat-collecting-GuGuDan/js/game/modeEngine.js?v=2.0.41",
  "/Cat-collecting-GuGuDan/js/game/adventureEngine.js?v=2.0.41",
  "/Cat-collecting-GuGuDan/js/data/worlds.js",
  "/Cat-collecting-GuGuDan/js/data/adventureStoryData.js",
  "/Cat-collecting-GuGuDan/js/services/rankingService.js",
  "/Cat-collecting-GuGuDan/js/services/storageService.js",
  "/Cat-collecting-GuGuDan/js/services/userStorageService.js"
];

self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(e) {
  e.respondWith(
    caches.match(e.request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).catch(function() {
        // 네트워크 실패 시 오프라인 Fallback으로 root index 제공
        if (e.request.mode === "navigate") {
          return caches.match("/Cat-collecting-GuGuDan/");
        }
      });
    })
  );
});
