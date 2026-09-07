const CACHE_NAME = 'inventory-pwa-cache-v2';
const urlsToCache = [
    './index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js'
];

// 安裝 Service Worker，預先快取靜態資源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// 攔截網路請求，若無網路則從快取讀取
self.addEventListener('fetch', event => {
    // 若為 Firebase API 請求，直接放行 (Firestore 會自己處理離線 IndexedDB 快取)
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('firebase')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 如果快取裡有，回傳快取；沒有就走網路
                return response || fetch(event.request);
            })
            .catch(() => {
                // 若兩者都失敗 (例如離線時請求其他資源)
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});

// 啟動時清除舊快取
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
