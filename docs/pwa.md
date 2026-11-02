# PWA de Aerolínea

La aplicación web puede instalarse como PWA en Android, iOS/iPadOS y escritorio.
El alcance actual es **instalación + shell offline seguro**. La búsqueda de
vuelos, la compra, el pago y el check-in siguen siendo operaciones
server-authoritative que requieren conexión.

## Archivos

| Archivo | Función |
|---|---|
| `app/manifest.ts` | Manifiesto instalable (nombre, iconos, colores, `start_url`, shortcut). |
| `app/layout.tsx` | Metadatos PWA, `viewport` y montaje de componentes. |
| `app/icon.png` / `app/apple-icon.png` | Iconos de pestaña y de inicio en iOS. |
| `public/icons/*` | Iconos 192/512 y variante maskable para Android. |
| `public/sw.js` | Service worker con precache y fallback offline. |
| `public/offline.html` | Página estática sin Clerk ni Next, usada cuando falla una navegación. |
| `components/pwa/ServiceWorkerRegistrar.tsx` | Registro del service worker. |
| `components/pwa/OfflineBanner.tsx` | Aviso global cuando `navigator.onLine` es `false`. |
| `components/pwa/InstallPrompt.tsx` | Invitación a instalar (Chromium) e instrucciones para iOS. |
| `next.config.ts` | Headers de `sw.js` y hardening básico. |
| `proxy.ts` | Excluye del middleware de Clerk los assets de la PWA. |

## Política de caché

| Recurso | Estrategia |
|---|---|
| Navegaciones HTML/RSC | `network-only`; si falla la red se sirve `/offline.html`. |
| `/_next/static/*` | `cache-first` (assets con hash inmutable). |
| `/icons/*` y extensiones estáticas | `cache-first`. |
| `/api/*` | Nunca se intercepta ni se cachea. |
| `/__clerk/*` | Nunca se intercepta. |
| PDFs, respuestas autenticadas, `POST`/Server Actions | Nunca se cachean. |

No se guardan páginas autenticadas ni respuestas con datos del pasajero. Esto
evita exponer información de una sesión de Clerk en un dispositivo compartido.

## Instalación

- **Chromium/Android:** `InstallPrompt` captura `beforeinstallprompt` y muestra
  un botón que abre el instalador nativo.
- **iOS/iPadOS:** Safari no expone `beforeinstallprompt`; se muestran las
  instrucciones "Compartir → Agregar a inicio". El icono y el modo standalone
  funcionan con `appleWebApp` y `apple-touch-icon`.
- La invitación se oculta en modo standalone y durante 30 días si se descarta
  (clave `aerolinea:pwa-install-dismissed-at` en `localStorage`).
- Solo aparece en rutas de pasajero: `/`, `/vuelos` y `/checkout`.

## Desarrollo y pruebas

El service worker se registra **solo en producción** por defecto. Para probarlo
con `next dev`:

```bash
# .env.local
NEXT_PUBLIC_PWA_DEV="true"
pnpm dev
```

Para una prueba representativa de producción:

```bash
pnpm build
pnpm start
```

Recomendaciones:

1. Usar HTTPS. El proyecto ya contempla el dev tunnel en
   `experimental.serverActions.allowedOrigins`. En local también sirve
   `next dev --experimental-https`.
2. Chrome/Edge: DevTools → Application → Manifest y Service Workers.
3. Probar "Offline" en DevTools y recargar: debe aparecer `/offline.html`.
4. Verificar que las entradas de Cache Storage no incluyan `/api/*`, `/__clerk/*`
   ni PDFs.
5. iOS: abrir en Safari, Compartir → Agregar a inicio, y comprobar que se abre
   sin la barra del navegador.

## Actualización y versionado

`public/sw.js` contiene `CACHE_VERSION`. Al cambiar la estrategia de caché, los
archivos precacheados o el contenido de `offline.html`:

1. Incrementar `CACHE_VERSION`.
2. Volver a compilar y desplegar.
3. La nueva versión se activa en la siguiente visita; `activate` elimina las
   cachés `aerolinea-pwa-*` anteriores.

El service worker se sirve con `Cache-Control: no-cache` y `updateViaCache:
"none"` para que el navegador siempre busque actualizaciones.

## Fuera de alcance

- Búsqueda de vuelos offline con disponibilidad real.
- Compra, pago o check-in offline.
- Caché de pases de abordar o facturas PDF.
- Notificaciones push (requeriría una entidad de suscripciones, claves VAPID y
  disparadores desde `modules/notificaciones`).

Estas funciones pueden agregarse en fases posteriores, con controles explícitos
de privacidad y de idempotencia para las mutaciones.
