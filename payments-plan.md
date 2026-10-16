# Plan: Integración de Pagos con Mercado Pago Checkout Pro (Sandbox)

> User Story: **US9** — *Como miembro del equipo de desarrollo, quiero integrar un proveedor de pagos (modo sandbox) al sistema de compra, de forma que los pasajeros puedan pagar sus pasajes de forma segura.*
>
> Estado: **planificado** (sin implementar).
> Rama: `feat/payments`
> Fecha: 2026-10-16

---

## 1. Contexto y hallazgos del repositorio

- **Stack:** Next.js `16.3.8` (App Router), React `19.2.8`, TypeScript estricto, Tailwind v4, Prisma 7 + Neon, Clerk, Zod, pnpm.
- **Documentación ya escrita:** `docs/integracion_mercadopago.md`, `ADR-007` en `docs/decisiones_diseno.md` y `AGENTS.md` §3.4 definen la modalidad **Checkout Pro** con confirmación por webhook. El último commit de la rama es `docs(pagos): documentar integracion con mercado pago checkout pro y contratos de api`.
- **No hay código de pagos:** no existe `modules/pagos`, ni `modules/pasajes`, ni endpoints de compra.
- **El link `/checkout?instanciaId=...` ya existe** en `app/(pasajero)/vuelos/page.tsx:251` pero la página no existe (hoy da 404). Está fuera del alcance de esta historia.
- **Rutas API existentes:** `app/api/v1/{vuelos, vuelos/[id], aeropuertos, usuarios/me}`.
- **SDK `mercadopago` NO instalado.**
- **`.env.local` ya tiene `MP_PUBLIC_KEY` y `MP_ACCESS_TOKEN`** (sandbox), pero **`.env.example` no documenta variables de MP** y no hay secreto de webhook.
- **No existe `prisma/migrations/`** ni nunca existió en el historial: el esquema se aplica con `prisma db push`.
- **Esquema ya listo:** `Pago` (1:1 con `TransaccionCompra`, con `estado`, `metodoPago`, `idTransaccionPasarela`, `monto`), `Factura` (1:1) y `Pasaje`.
- **Sin scripts `prisma`/`tsc`** en `package.json` (solo `dev`, `build`, `start`, `lint`).

### 1.1. Choque entre la user story y la documentación (resuelto)

La US9 dice *"crear cobro y consultar estado"* (lenguaje de Payments API / Checkout transparente), mientras que `ADR-007` y `AGENTS.md` §3.4 exigen **Checkout Pro** (preferencia + redirección + webhook). **Decisión: se mantiene Checkout Pro** (alineado con la normativa del repo).

---

## 2. Decisiones tomadas (confirmadas con el usuario)

| Tema | Decisión |
|---|---|
| Modalidad de integración | **Checkout Pro** (preferencia en backend + pago en la pasarela + confirmación por webhook). Coherente con ADR-007 y AGENTS.md §3.4. |
| Alcance de la entrega | **Backend + API REST v1**: módulo de pagos y de reserva + rutas `POST /api/v1/compras/preferencia`, `POST /api/v1/webhooks/mercadopago`, `GET /api/v1/compras/[id]/estado`. **Sin UI web.** |
| Esquema Prisma | **Sin cambios**: se usa la tabla `Pago` existente con upsert 1:1 (`PENDIENTE`/`RECHAZADO`/`APROBADO`) y `external_reference` para reconciliar. |
| Variables de entorno | **Estandarizar a los docs**: `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`. |

---

## 3. Criterios de aceptación y cómo se cubren

| Criterio | Cobertura |
|---|---|
| El sistema puede enviar un cobro a la pasarela y recibir su resultado (aprobado, rechazado o pendiente). | `crearPreferenciaDePago()` + webhook `procesarNotificacionPago()` que mapea el estado de MP a `Pago.estado`. |
| Los datos de la tarjeta no se almacenan en la BD del sistema. | El formulario de cobro vive en Mercado Pago (Checkout Pro); el backend solo maneja IDs y montos. Ningún dato de tarjeta pasa por el servidor. |
| Ante un error o caída de la pasarela, el sistema informa un mensaje claro y no registra la compra como confirmada. | `try/catch` alrededor de todo llamado a MP → `502 PAYMENT_GATEWAY_UNAVAILABLE` con mensaje claro; compensación de la reserva; la transacción nunca pasa a `CONFIRMADA` sin verificación inversa. |

---

## 4. Diseño de la solución

### 4.1. Flujo end-to-end

```
1. Cliente → POST /api/v1/compras/preferencia
2. Backend  → prisma.$transaction (Serializable):
                - valida 1..9 pasajes
                - valida cupo por clase en la instancia
                - crea TransaccionCompra (PENDIENTE, total = Σ pasajes)
                - crea Pasajes (EMITIDO = hold de cupo)
3. Backend  → MP: crear Preferencia (external_reference, items, notification_url, back_urls)
4. Backend  ← MP: { id: preferenceId, init_point }
5. Backend  → Cliente: { transaccionId, preferenceId, initPoint, total }
6. Pasajero paga en Checkout Pro
7. MP       → POST /api/v1/webhooks/mercadopago (data.id = paymentId)
8. Backend  → MP: GET /v1/payments/{paymentId} (verificación de autenticidad)
9. Backend  → prisma.$transaction:
                - idempotencia
                - coherencia de monto
                - upsert Pago (APROBADO/RECHAZADO/PENDIENTE)
                - si APROBADO: TransaccionCompra → CONFIRMADA + Factura
                - si RECHAZADO: Pasajes → CANCELADO + TransaccionCompra → RECHAZADA
10. Cliente → GET /api/v1/compras/{id}/estado (polling hasta CONFIRMADA)
```

### 4.2. Estructura de archivos

```
modules/pagos/
├── client.ts        # singleton MercadoPagoConfig + Preference/Payment; falla si falta el token
├── schemas.ts       # Zod: request de preferencia y payload del webhook
├── service.ts       # crearPreferenciaDePago, consultarPagoEnPasarela,
│                    # procesarNotificacionPago, consultarEstadoTransaccion
└── errors.ts        # errores de dominio (PagoError) con código HTTP semántico

modules/pasajes/
└── service.ts       # crearTransaccionConPasajes (cupo, 1..9, total), cancelarTransaccionPendiente

app/api/v1/compras/preferencia/route.ts    # POST
app/api/v1/compras/[id]/estado/route.ts    # GET
app/api/v1/webhooks/mercadopago/route.ts   # POST (público)
```

> `compras/preferencia` (estático) y `compras/[id]/estado` (dinámico con subsegmento) no colisionan: el estático es una hoja `/compras/preferencia`, el dinámico requiere `/compras/:id/estado`.

### 4.3. `modules/pasajes/service.ts`

- **`crearTransaccionConPasajes(input)`**
  1. Valida `1 <= pasajeros.length <= 9` (regla de negocio del enunciado).
  2. Carga la `InstanciaVuelo` (con `deleted: false`) + `Vuelo` y resuelve el precio según `clase` (`ECONOMY`/`PRIMERA`).
  3. En `prisma.$transaction` con `isolationLevel: "Serializable"`:
     - Cuenta pasajes activos (`EMITIDO`/`CHECK_IN`) de la instancia por clase.
     - Verifica `capacidadClase - activos >= pedidos`; si no → error de dominio `SIN_CUPO` (HTTP 409).
     - Crea `TransaccionCompra` `PENDIENTE` con `total = cantidad * precio`, `emailContacto`, `usuarioId` (`null` si invitado).
     - Crea los `Pasaje` en estado `EMITIDO` como **hold** de cupo (`docs/integracion_mercadopago.md`).
  4. Devuelve la transacción creada con sus pasajes.
- **`cancelarTransaccionPendiente(transaccionId)`** (compensación): pasajes → `CANCELADO`, transacción → `RECHAZADA`.

### 4.4. `modules/pagos/client.ts`

- Singleton perezoso de `MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN })`.
- Expone `getPreferenceClient()` y `getPaymentClient()`.
- **Falla explícita** (`Error` con mensaje claro) si `MERCADOPAGO_ACCESS_TOKEN` no está definido → alimenta el criterio de "mensaje claro".

### 4.5. `modules/pagos/schemas.ts` (Zod)

- `preferenciaRequestSchema`:
  - `instanciaVueloId: string` (numérico, se convierte a `BigInt`).
  - `clase: "ECONOMY" | "PRIMERA"`.
  - `emailContacto: string` (email válido).
  - `pasajeros: array` de `{ nombre, apellido, documento, numeroAsiento? }` — `min(1)`, `max(9)`.
  - `facturacion: { tipoFactura: "A"|"B"|"C", nombreRazonSocial, identificacionFiscal }`.
- `webhookPayloadSchema`: estructura mínima del evento (`type`, `action`, `data.id`, `external_reference?`).

### 4.6. `modules/pagos/service.ts`

- **`crearPreferenciaDePago(input)`**
  1. `crearTransaccionConPasajes(input)`.
  2. Crea la preferencia en MP con:
     - `external_reference = transaccion.id.toString()`,
     - `notification_url = ${NEXT_PUBLIC_APP_URL}/api/v1/webhooks/mercadopago`,
     - `back_urls` success/failure/pending,
     - `items` (1 ítem por pasaje o ítem agregado con la cantidad y el precio unitario).
  3. **Si MP falla → `cancelarTransaccionPendiente()` + error `PAYMENT_GATEWAY_UNAVAILABLE`** (nunca queda `CONFIRMADA`).
  4. Devuelve `{ transaccionId, preferenceId, initPoint, total }` (enteros serializados a `string`).
- **`consultarPagoEnPasarela(paymentId)`** → `GET /v1/payments/{id}`. Es la verificación inversa de autenticidad y también la operación de *"consultar estado"* de la tarea.
- **`procesarNotificacionPago(payload)`**
  1. Obtiene `paymentId` (`data.id`); si el evento no es de pago → irrecuperable, responde OK sin mutar.
  2. `consultarPagoEnPasarela(paymentId)`.
  3. Resuelve la transacción por `external_reference` (`BigInt`).
  4. En `prisma.$transaction`:
     - **Idempotencia:** si ya existe `Pago` `APROBADO` para esa transacción → salir sin duplicar.
     - **Coherencia:** `payment.transaction_amount === Number(transaccion.total)` (si no coincide → `RECHAZADO` + log de advertencia).
     - **Upsert 1:1** de `Pago` (`where: { transaccionId }`): `estado` mapeado (`approved→APROBADO`, `rejected|cancelled→RECHAZADO`, resto→`PENDIENTE`), `metodoPago`, `idTransaccionPasarela`, `monto`.
     - Si **APROBADO**: `TransaccionCompra → CONFIRMADA`, crear `Factura` con número determinista `FC-{tipoFactura}-0001-{transaccionId padded 8}` (único por ser 1:1), pasajes permanecen `EMITIDO`.
     - Si **RECHAZADO**: pasajes → `CANCELADO`, `TransaccionCompra → RECHAZADA`.
     - Si **PENDIENTE**: `Pago` queda `PENDIENTE`, transacción y pasajes sin cambios (hold).
- **`consultarEstadoTransaccion(id)`** → lectura de BD (fuente de verdad = webhook) devolviendo transacción + pago + factura + pasajes serializados.

### 4.7. Mapeo de `metodoPago`

| `payment_type_id` (MP) | `Pago.metodoPago` |
|---|---|
| `credit_card` | `TARJETA_CREDITO` |
| `debit_card` | `TARJETA_DEBITO` |
| `bank_transfer` | `TRANSFERENCIA` |
| otro | `OTRO` |

### 4.8. Rutas REST v1 (`export const runtime = "nodejs"`)

- **`POST /api/v1/compras/preferencia`**
  - Auth opcional vía `getCurrentUsuario()` (invitado ⇒ `usuarioId = null`).
  - `201` → `{ success: true, data: { transaccionId, preferenceId, initPoint, total } }`.
  - `400 VALIDATION_ERROR` · `409 SIN_CUPO` · `502 PAYMENT_GATEWAY_UNAVAILABLE` · `500 INTERNAL_ERROR`.
- **`GET /api/v1/compras/[id]/estado`**
  - `200` → transacción, pago, factura y pasajes (para *polling*).
  - `404 TRANSACTION_NOT_FOUND`.
- **`POST /api/v1/webhooks/mercadopago`**
  - Público (ya listado en las rutas públicas de `proxy.ts`).
  - Valida la firma (`x-signature`/`x-request-id`) con `MERCADOPAGO_WEBHOOK_SECRET` si está configurado.
  - Verifica el pago contra MP antes de mutar.
  - `200 { received: true }` en procesamiento correcto o evento irrelevante.
  - `401` si la firma es inválida.
  - `500` ante fallo transitorio → MP reintenta (idempotencia protege contra duplicados).

### 4.9. Manejo de errores (criterio de aceptación 3)

- **Sin secretos ni datos sensibles en logs.**
- Errores uniformes: `{ success: false, error: { code, message } }`.
- Timeouts / 5xx / credenciales inválidas de MP ⇒ `PAYMENT_GATEWAY_UNAVAILABLE` (502) con mensaje claro y **compensación de la reserva**; la transacción nunca queda `CONFIRMADA`.
- Webhook: ante fallo de la verificación inversa se responde `500` (reintento) y no se muta nada.

---

## 5. Variables de entorno

`.env.example` (documentar):

```env
# Mercado Pago (Checkout Pro - Sandbox)
MERCADOPAGO_ACCESS_TOKEN="TEST-..."
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="TEST-..."
MERCADOPAGO_WEBHOOK_SECRET="..."
```

`.env.local` (gitignored, lo renombra el usuario):

- `MP_ACCESS_TOKEN` → `MERCADOPAGO_ACCESS_TOKEN`
- `MP_PUBLIC_KEY` → `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- Agregar `MERCADOPAGO_WEBHOOK_SECRET` (secreto de firma del panel de MP).

> `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` se documenta por fidelidad a `docs/integracion_mercadopago.md`, pero **Checkout Pro no la usa** (no hay SDK de cliente).

---

## 6. Supuestos firmes

- Los `Pasaje` se crean en estado `EMITIDO` como **hold** de cupo y pasan a `CANCELADO` si el pago es rechazado o si falla la creación de la preferencia.
- La **expiración / reconciliación de transacciones `PENDIENTE` abandonadas queda fuera de alcance** (barrido futuro).
- Sin cambios de esquema: se usa `Pago` con upsert 1:1 y `external_reference` para reconciliar.
- `GET /api/v1/compras/[id]/estado` reporta el estado de la BD (reconciliación activa contra MP queda opcional/no incluida).
- La verificación de Bearer JWT para la app móvil sigue fuera de alcance (`auth-plan.md` §8).

---

## 7. Pasos de implementación (orden)

1. **Dependencia:** `pnpm add mercadopago`.
2. **Entorno:** actualizar `.env.example` con las variables de §5.
3. **Módulo de reserva:** `modules/pasajes/service.ts` (`crearTransaccionConPasajes`, `cancelarTransaccionPendiente`).
4. **Módulo de pagos:** `modules/pagos/{client,schemas,errors,service}.ts`.
5. **Rutas REST v1:** `compras/preferencia`, `compras/[id]/estado`, `webhooks/mercadopago`.
6. **Documentación:** actualizar `docs/integracion_mercadopago.md` si cambia algún contrato; ampliar `.env.example`.
7. **Commit:** `feat(pagos): integrar mercado pago checkout pro en modo sandbox`.
8. **Verificación** (§8).

---

## 8. Verificación

```bash
pnpm exec prisma validate   # esquema intacto (sin migraciones)
pnpm exec tsc --noEmit      # tipos (incluye serialización de BigInt)
pnpm lint                   # eslint
pnpm build                  # requiere variables de MP en .env.local
```

- **Prueba manual end-to-end en sandbox:** requiere URL pública HTTPS para el webhook (ngrok / Cloudflare Tunnel); se documenta.
- Tarjetas de prueba del sandbox de Mercado Pago para forzar los 3 resultados (aprobado, rechazado, pendiente).
- Nota: `package.json` no tiene scripts `prisma`/`tsc`; se ejecutan con `pnpm exec`. Opcional: agregar `"typecheck": "tsc --noEmit"`.

---

## 9. Fuera de alcance (declarado)

- Página web de checkout (`/checkout`), hoy inexistente y con link ya presente en `app/(pasajero)/vuelos/page.tsx`.
- UI de resultado de pago (aprobado/rechazado/pendiente) en el navegador.
- Verificación de tokens Bearer para la app móvil.
- Expiración / barrido de transacciones `PENDIENTE` y holds de cupo abandonados.
- Módulo de notificaciones (envío de email con tickets/factura).
- Panel del mostrador / administración de pagos.
