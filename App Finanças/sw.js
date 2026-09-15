/**
 * ============================================================================
 *  SERVICE WORKER — Finanças do Casal (PWA)
 *  Fase 3 · Item 3: Empacotamento como PWA instalável
 * ============================================================================
 *
 *  Responsabilidade deste Service Worker:
 *   - Cachear o "app shell" (HTML, ícones e bibliotecas de CDN) para que o
 *     aplicativo abra instantaneamente e continue funcionando mesmo sem
 *     internet, ou com internet instável.
 *   - NUNCA cachear chamadas à API do Google Apps Script — essas sempre
 *     devem ir direto à rede, pois o app já possui sua própria lógica de
 *     cache/fila offline (LocalStorage) específica para dados financeiros,
 *     implementada desde a v1.1. Este Service Worker cuida apenas do
 *     "invólucro" do aplicativo (a interface), não dos dados.
 *
 *  Estratégia de cache: "Cache First, fallback to Network" para o app shell,
 *  e "Network Only" (sempre rede, nunca cache) para qualquer requisição que
 *  contenha "script.google.com" (a API).
 * ============================================================================
 */

const CACHE_NAME = 'financas-casal-shell-v1';

const APP_SHELL_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL_URLS.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Regra crítica: nunca interceptar/cachear chamadas à API financeira.
  if (url.includes('script.google.com')) {
    return;
  }

  // Bibliotecas de terceiros (Tailwind, Chart.js, Google Fonts):
  // "stale-while-revalidate" — responde rápido com cache, atualiza em segundo plano.
  if (url.includes('cdn.tailwindcss.com') || url.includes('cdn.jsdelivr.net') || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cachedResp) => {
          const fetchPromise = fetch(event.request)
            .then((networkResp) => {
              if (networkResp && networkResp.status === 200) {
                cache.put(event.request, networkResp.clone());
              }
              return networkResp;
            })
            .catch(() => cachedResp);
          return cachedResp || fetchPromise;
        })
      )
    );
    return;
  }

  // App shell (HTML, ícones, manifest): "cache first", com atualização em
  // segundo plano e fallback de rede se não estiver em cache.
  event.respondWith(
    caches.match(event.request).then((cachedResp) => {
      const fetchPromise = fetch(event.request)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200 && event.request.method === 'GET') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResp.clone()));
          }
          return networkResp;
        })
        .catch(() => cachedResp);
      return cachedResp || fetchPromise;
    })
  );
});
