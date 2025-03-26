const CACHE_NAME = 'inventory-manager-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/qr.html',
  '/qr-fixed.js',
  '/styles.css',
  '/sounds/beep.mp3',
  '/sounds/in.mp3',
  '/sounds/out.mp3',
  '/sounds/defect.mp3',
  '/sounds/return.mp3',
  '/sounds/new.mp3',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// 앱 설치 시 리소스 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 생성됨');
        return cache.addAll(urlsToCache);
      })
  );
});

// 캐시된 리소스 사용 및 네트워크 요청 처리
self.addEventListener('fetch', event => {
  // Google Sheets API 호출은 네트워크로 직접 전달
  if (event.request.url.includes('sheets.googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에서 응답을 찾았으면 반환
        if (response) {
          return response;
        }
        
        // 캐시에 없으면 네트워크에서 가져옴
        return fetch(event.request)
          .then(response => {
            // 유효한 응답이 아니면 그대로 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 네트워크 응답을 복제해서 캐시에 저장
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          });
      })
  );
});

// 오래된 캐시 정리
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // 화이트리스트에 없는 캐시 삭제
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
