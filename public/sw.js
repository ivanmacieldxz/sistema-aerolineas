/*
 * Service worker de la PWA de Aerolínea.
 *
 * Política de caché:
 *  - Navegaciones: network-only. Si no hay red, se muestra /offline.html.
 *  - Assets estáticos con hash de Next.js y archivos de /icons: cache-first.
 *  - Nunca se cachean /api/*, /__clerk/*, el propio sw.js, respuestas
 *    autenticadas ni documentos PDF.
 *
 * Al cambiar la estrategia o los archivos precacheados, incrementar
 * CACHE_VERSION para invalidar las cachés anteriores.
 */

const CACHE_VERSION = "v1";
const CACHE_PREFIX = "aerolinea-pwa";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

const CACHEABLE_EXTENSIONS =
  /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== STATIC_CACHE &&
                key !== RUNTIME_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nunca interceptar mutaciones: pagos, check-in y Server Actions deben
  // fallar de forma explícita cuando no hay conexión.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Datos privados y endpoints de autenticación: siempre a la red.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/__clerk/") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

function isCacheableAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    CACHEABLE_EXTENSIONS.test(pathname)
  );
}

async function networkFirstNavigation(request) {
  try {
    // Las respuestas HTML/RSC pueden contener datos de la sesión de Clerk.
    // No se guardan en caché a propósito. `cache: "no-store"` también evita
    // que el navegador sirva HTML viejo desde su caché HTTP cuando no hay red.
    return await fetch(request, { cache: "no-store" });
  } catch {
    const offlinePage = await caches.match(OFFLINE_URL);

    if (offlinePage) {
      return offlinePage;
    }

    return new Response("Sin conexión", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}
