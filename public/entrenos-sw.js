// Service Worker — Entre Nós (página pública).
// Rede primeiro (conteúdo sempre atualizado); o cache só entra quando está sem internet.
const CACHE = 'entrenos-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Materiais (PDF/vídeo), API e painel sempre direto da rede.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/admin')) return;

  e.respondWith(
    fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match(request, { ignoreSearch: request.mode === 'navigate' }))
  );
});
