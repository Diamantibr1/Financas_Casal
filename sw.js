/**
 * ============================================================================
 *  SERVICE WORKER — Controle de Gastos (PWA)
 *  Atualização (set/2026): versão v5 — acompanha a reorganização do
 *  extrato (agrupamento por dia, data/hora, menu de ações rápidas) e o
 *  novo módulo de gastos recorrentes. O incremento de versão abaixo força
 *  a limpeza total do cache antigo, para que a atualização apareça já na
 *  próxima abertura do aplicativo instalado.
 * ============================================================================
 *
 *  COMO ATUALIZAR O APLICATIVO DAQUI PARA FRENTE:
 *  Sempre que o index.html for alterado de forma significativa,
 *  incremente o número da linha abaixo (por exemplo, de "v5" para "v6").
 * ============================================================================
 */

const CACHE_VERSION = 'v5'; // incrementar a cada atualização relevante
const CACHE_NAME = `controle-gastos-shell-${CACHE_VERSION}`;

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
        // Remove qualquer cache de versão anterior, incluindo os nomes
        // usados antes da simplificação do app (financas-casal-shell-*),
        // garantindo que nada desatualizado permaneça guardado.
        nomes
          .filter((nome) => (nome.startsWith('controle-gastos-shell-') || nome.startsWith('financas-casal-shell-')) && nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  event.waitUntil(
    self.clients.claim().then(() => {
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Regra crítica: nunca interceptar nem armazenar em cache as chamadas à API.
  if (url.includes('script.google.com')) {
    return;
  }

  // Bibliotecas de terceiros (Tailwind, Chart.js, Google Fonts):
  // estratégia "obsoleto-mas-revalidado" — responde rápido com o cache e
  // atualiza em segundo plano para a próxima visita.
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

  // Interface do aplicativo (HTML, ícones, manifesto): cache em primeiro
  // lugar, com atualização em segundo plano e retorno à rede quando não
  // houver nada em cache.
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
