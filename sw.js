// 網路優先讀取 index.html，避免舊快取蓋掉新部署。版本升級會清掉舊快取。
const CACHE_NAME = 'inventory-pwa-cache-v4';
const urlsToCache = [
    './index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

function mustBypassCache(url) {
    return /firestore\.googleapis\.com|googleapis\.com|firebaseio\.com|firebase\.google|identitytoolkit|securetoken|accounts\.google\.com|gstatic\.com\/firebasejs/i.test(url);
}

function isAppShell(request) {
    if (request.mode === 'navigate') return true;
    const path = new URL(request.url).pathname;
    return path.endsWith('/index.html') || path.endsWith('/');
}

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(urlsToCache.map(async (url) => {
            try { await cache.add(url); } catch (err) { console.warn('略過無法預先快取的資源', url, err); }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('fetch', event => {
    const url = event.request.url;
    if (mustBypassCache(url)) return;

    if (isAppShell(event.request)) {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(event.request);
                if (fresh.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put('./index.html', fresh.clone());
                }
                return fresh;
            } catch (err) {
                const cached = await caches.match('./index.html');
                if (cached) return cached;
                throw err;
            }
        })());
        return;
    }

    event.respondWith(
        fetch(event.request).then(response => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
            }
            return response;
        }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});
