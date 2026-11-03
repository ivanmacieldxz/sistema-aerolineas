# Control de acceso y sesiones (US18)

> Alcance: sesiones, RBAC y acceso a funcionalidades críticas.
> Regla de negocio vigente: los **invitados pueden buscar y comprar** (`usuario_id = null`).
> La restricción de sesión/rol aplica a administración de vuelos, listado de pasajeros
> y acceso a los datos de una compra. Documentar esta excepción en ADR-004.

## Matriz de acceso

| Recurso | Anónimo | Invitado + token | Pasajero dueño | Mostrador | Admin |
|---|---|---|---|---|---|
| Buscar vuelos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checkout / crear preferencia | ✅ | ✅ | ✅ | ✅ | ✅ |
| Estado de compra | ❌ | ✅ | ✅ | ✅ | ✅ |
| Factura PDF | ❌ | ✅ | ✅ | ✅ | ✅ |
| Pasaje PDF | ❌ | ✅ | ✅ | ✅ | ✅ |
| Reenviar comprobantes | ❌ | ✅ | ✅ | ✅ | ✅ |
| Listado de pasajeros | ❌ | ❌ | ❌ | ✅ | ❌ |
| Administración de vuelos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Perfil (`/usuarios/me`) | ❌ | ❌ | ✅ | ✅ | ✅ |

Autorización por **propiedad** (`TransaccionCompra.usuarioId`), por **rol staff** o por
**token de la transacción**. Sin autorización → **404** (anti-enumeración).

## Cambios requeridos

### 1. Server Actions de administración
Agregar `await requireRole("admin")` en `modules/vuelos/actions.ts`:
`createFlight`, `updateFlightAction`, `createAirportAction`,
`toggleFlightStatusAction`, `deleteFlightAction`.

### 2. API v1
Crear `modules/usuarios/api-auth.ts` con:
- `requireApiActor()`: usa `auth({ acceptsToken: "session_token" })` (cookies web + Bearer móvil).
- `requireAccesoTransaccion(request, transaccionId)`: dueño, staff o token válido.

Aplicar en:
- `app/api/v1/compras/[id]/estado/route.ts`
- `app/api/v1/compras/[id]/factura/pdf/route.ts`
- `app/api/v1/pasajes/[id]/pdf/route.ts`
- `app/api/v1/compras/[id]/reenviar/route.ts`
- `app/api/v1/usuarios/me/route.ts` (quitar `clerkId` y `roleId` de la respuesta)

Públicos sin cambios: `compras/preferencia`, `vuelos`, `aeropuertos`, `webhooks/mercadopago`.

### 3. Token de invitado
- Nuevo `modules/pagos/access-token.ts`: HMAC-SHA256 sobre `{ v, t: transaccionId, exp }`.
- `CHECKOUT_ACCESS_SECRET` en `.env.example` (server-only, 32+ bytes).
- `crearPreferenciaDePago` devuelve `accessToken` y agrega `back_urls` a
  `/checkout/resultado?transaccionId=<id>&token=<token>`.
- `iniciarCompra` propaga `accessToken`.
- `CheckoutForm` lo guarda en `sessionStorage`; `ResultadoPago` lo envía en
  `x-checkout-token` y en los links de descarga (`?token=`).
- `checkout/resultado/page.tsx`: quitar `sincronizarPagoDesdeRetorno` antes de autorizar
  (la API ya sincroniza al consultar).
- Expiración sugerida: 30 días. `Referrer-Policy: no-referrer` en `/checkout/resultado`.

### 4. Proxy
- Públicas: `/`, `/offline.html`, `/manifest.webmanifest`, `/vuelos`, `/checkout`,
  `/login`, `/registro`, `/mostrador/login`, `/admin/login`.
- `/api/v1`: dejar pasar para que el handler responda JSON (mantener en el `matcher`
  para que `auth()` funcione).
- Eliminar el `return;` final: toda página no pública sin sesión redirige al login del área.

### 5. CSRF
Validar `Origin` en las mutaciones autenticadas por cookie.

## Errores
| Código | Uso |
|---|---|
| `401 UNAUTHORIZED` | Sin sesión ni token en endpoints que lo requieren |
| `403 FORBIDDEN` | Sesión con rol insuficiente |
| `404 ..._NO_ENCONTRADO` | Recurso inexistente o sin autorización |

## Pruebas mínimas
`scripts/security-smoke.mjs`: anónimo → 401/404; token válido → 200; token ajeno/vencido
→ 404; pasajero ajeno → 404; staff → 200; compra como invitado → 201; Bearer móvil → 200;
`Origin` ajeno → 403.
