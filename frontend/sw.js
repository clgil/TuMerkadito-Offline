// Tu Merkadito - Service Worker para soporte offline

const CACHE_NAME = 'tu-merkadito-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/pos.js',
  '/js/turnos.js',
  '/js/inventario.js',
  '/js/reportes.js',
  '/manifest.json'
];

// Instalar Service Worker y cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activar Service Worker y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Interceptar solicitudes de red
self.addEventListener('fetch', (event) => {
  // Solo manejar solicitudes GET para navegación y assets
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Para solicitudes a la API, intentar red primero, luego caché
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clonar respuesta para guardar en caché
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Si falla la red, intentar caché
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Para assets estáticos, caché primero, luego red
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Guardar en caché si es exitoso
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Fallback para página principal
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// Soporte para sincronización en segundo plano (si está disponible)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-ventas') {
    event.waitUntil(syncVentasPendientes());
  }
});

async function syncVentasPendientes() {
  // Esta función se implementaría para enviar ventas pendientes guardadas en IndexedDB
  console.log('Sincronizando ventas pendientes...');
}
