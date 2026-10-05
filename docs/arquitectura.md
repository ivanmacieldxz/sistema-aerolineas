# Documento de Arquitectura del Sistema (SAD)

## 1. Visión General del Sistema y Objetivos Arquitectónicos

El sistema integral de la aerolínea nacional digitaliza y centraliza la operativa comercial de vuelos, pasajes, pagos y control de ocupación. Provee interfaces diferenciadas para tres perfiles de usuario:
- **Pasajeros:** Búsqueda de vuelos por origen/destino/fechas, selección de asientos, compra de hasta 9 pasajes, pago en línea, descarga de e-tickets y facturas, y notificaciones.
- **Empleados de Mostrador:** Búsqueda rápida de pasajeros por DNI/código, check-in en terminal, reasignación de butacas y estado de embarque.
- **Administradores:** Gestión de rutas y vuelos (horarios, tarifas, vigencia y capacidad), reprogramaciones/cancelaciones y reportes analíticos de ocupación por vuelo, clase y fecha.

### Atributos de Calidad Principales:
1. **Escalabilidad y Rendimiento:** Capacidad de absorber picos de tráfico en temporadas altas y promociones mediante base de datos Serverless (Neon) y renderizado híbrido (SSR + Streaming) en Next.js.
2. **Modularidad y Mantenibilidad:** Separación estricta de módulos de negocio con límites definidos, facilitando la evolución independiente de módulos sin deuda técnica.
3. **Consistencia Transaccional (ACID):** Vital para evitar sobreventa de plazas en vuelos concurrentes y garantizar la integridad entre la compra, el pago y la facturación.
4. **Interoperabilidad Omnicanal:** Soporte nativo para el frontend web monolítico y desacoplamiento mediante API REST para la futura aplicación móvil de pasajeros.

---

## 2. Estilo Arquitectónico: Monolito Modular

Se adopta una **Arquitectura Monolítica Modular** implementada sobre **Next.js (App Router)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SISTEMA AEROLÍNEA                               │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │     FRONTEND WEB      │             │       API REST v1          │  │
│  │  (RSC, Client UI,     │             │     (Route Handlers        │  │
│  │   Server Actions)     │             │   para App Móvil / Ext)    │  │
│  └───────────┬───────────┘             └─────────────┬──────────────┘  │
│              │                                       │                 │
│              ▼                                       ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    CAPA DE SERVICIOS / DOMINIO                   │  │
│  │                                                                  │  │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐ │  │
│  │  │   Módulo   │ │    Módulo    │ │   Módulo   │ │    Módulo    │ │  │
│  │  │   Vuelos   │ │   Pasajes    │ │   Pagos    │ │  Usuarios y  │ │  │
│  │  │ y Rutas    │ │  y Reservas  │ │ y Facturas │ │    Roles     │ │  │
│  │  └──────┬─────┘ └──────┬───────┘ └──────┬─────┘ └──────┬───────┘ │  │
│  └─────────┼──────────────┼────────────────┼──────────────┼─────────┘  │
│            ▼              ▼                ▼              ▼            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   CAPA DE ACCESO A DATOS (DAL)                   │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │   Neon Serverless RDBMS   │
                        │    (PostgreSQL Engine)    │
                        └───────────────────────────┘
```

### Justificación del Monolito Modular:
- **Despliegue unificado y simplicidad operacional:** Un solo repositorio y pipeline de CI/CD que reduce la sobrecarga de DevOps en comparación con una malla de microservicios prematura.
- **Límites de dominio claros:** Cada módulo (`flights`, `bookings`, `payments`, `users`, `notifications`) es autónomo a nivel de lógica y servicio. Si en el futuro un módulo específico (como la búsqueda de vuelos) requiere escalar independientemente, puede extraerse a un microservicio sin rediseñar el dominio.
- **Transacciones locales robustas:** La reserva de pasajes y el registro de pagos se benefician de transacciones ACID directas provistas por Prisma y PostgreSQL.

---

## 3. Descomposición en Capas del Sistema

### 3.1. Capa de Presentación Web (Next.js App Router)
- **React Server Components (RSC):** Renderizado en servidor por defecto para páginas de listado, detalles de vuelos y paneles administrativos, reduciendo el bundle de JavaScript en el cliente y mejorando los tiempos de carga inicial (LCP/FCP).
- **Client Components (`'use client'`):** Utilizados puntualmente en elementos con interactividad inmediata: selector interactivo de butacas (`SeatMap`), filtros dinámicos en vivo, modales y pasarelas de tarjeta.
- **Server Actions:** Mecanismo primario de mutación para la app web. Ejecutan validaciones del lado del servidor (con Zod), aplican autenticación/autorización y llaman directamente a la capa de servicios sin exponer rutas HTTP intermedias innecesarias para la web.

### 3.2. Capa de API REST Pública (Route Handlers para App Móvil)
- Ubicada bajo `app/api/v1/...`.
- Diseñada siguiendo estándares RESTful:
  - Formato JSON estándar para request y response.
  - Códigos de estado HTTP semánticos (200, 201, 400, 401, 403, 404, 409, 500).
  - Manejo estructurado de errores (`{ "error": { "code": "SEAT_UNAVAILABLE", "message": "..." } }`).
  - Autenticación basada en tokens JWT Bearer provistos por **Neon Auth**.
  - Versionado en URI (`/api/v1/`).

### 3.3. Capa de Servicios y Lógica de Negocio (Domain Services)
Estructurada en módulos independientes bajo `app/modules/` o `lib/modules/`:
1. **`vuelos` (Flight Module):**
   - Creación, modificación y cancelación de vuelos y rutas.
   - Generación automática de instancias de vuelo según días de la semana y vigencia.
   - Búsqueda de disponibilidad con filtros de fechas, aeropuertos y clases.
   - Regla de soft delete (`deleted = true`) impidiendo eliminar vuelos con pasajes activos.
2. **`pasajes` (Booking Module):**
   - Validación del límite máximo de **9 pasajes por transacción**.
   - Asignación y bloqueo de butacas en instancias concretas.
   - Control estricto de cupo por clase (Economy vs Primera Clase) mediante bloqueos pesimistas/transaccionales.
   - Generación de tickets electrónicos nominativos y proceso de check-in.
3. **`pagos` (Payment & Billing Module):**
   - Integración con pasarela de cobro.
   - Emisión automática correlativa de factura legal (tipo A/B/C).
   - Verificación de consistencia del total abonado frente a la tarifa de los pasajes.
4. **`usuarios` (User & Auth Module):**
   - Gestión de perfiles y sincronización con Neon Auth.
   - Control de acceso basado en roles (RBAC): Administrador, Empleado Mostrador, Pasajero.
5. **`notificaciones` (Notification Service):**
   - Envío asíncrono de emails con pasajes electrónicos y factura adjunta tras confirmación de compra.
   - Alertas automáticas por cambios de horario, demoras o cancelaciones de vuelo.

### 3.4. Capa de Persistencia y Acceso a Datos (DAL)
- **Prisma ORM:** Cliente fuertemente tipado que mapea las 10 entidades modeladas en [entidades.md](entidades.md).
- **Extensiones de Prisma / Middleware:** Inyección automática del filtro `where: { deleted: false }` para consultas estándar de lectura, garantizando la transparencia del patrón Soft Delete.
- **Neon Serverless PostgreSQL:** Configuración optimizada con pooling de conexiones para entornos Serverless y Edge Runtime de Next.js.

---

## 4. Arquitectura para Soporte de la App Móvil

La aplicación móvil de pasajeros consumirá la misma infraestructura central a través de la API REST:

```
┌──────────────────────────────────────┐
│       App Móvil Pasajeros            │
└──────────────────┬───────────────────┘
                   │
                   │ HTTPS / JSON / Bearer Token
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                 Next.js REST API (/api/v1)                  │
├─────────────────────────────────────────────────────────────┤
│  POST /api/v1/auth/login        → Autenticación Neon Auth   │
│  GET  /api/v1/vuelos/buscar     → Catálogo y disponibilidad │
│  POST /api/v1/compras           → Compra (hasta 9 pasajes)  │
│  POST /api/v1/compras/pago      → Confirmación de pago      │
│  GET  /api/v1/pasajes/mis-viajes→ Consulta de tickets       │
│  GET  /api/v1/pasajes/:id/pdf   → Descarga ticket digital   │
│  POST /api/v1/pasajes/check-in  → Check-in y asignación     │
└──────────────────────────┬──────────────────────────────────┘
                           │ Invoca mismos servicios de dominio
                           ▼
              ┌─────────────────────────┐
              │ Capa de Lógica Modular  │
              └─────────────────────────┘
```

### Ventajas de este desacoplamiento:
1. **Reutilización del 100% de la lógica de negocio:** La app web y la app móvil invocan exactamente las mismas funciones de validación, cálculos tarifarios y persistencia en base de datos.
2. **Seguridad homogénea:** Mismas políticas de autenticación y autorización mediante Neon Auth.
3. **Mantenibilidad:** Una modificación en una regla comercial (por ejemplo, el control de cupos o cálculo de impuestos) impacta automáticamente en ambos canales.