# Registro de Decisiones de Diseño Arquitectónico (ADRs)

Este documento registra formalmente las decisiones clave de arquitectura y diseño tomadas, siguiendo el estándar de *Architecture Decision Records* (ADR).

---

## Índice de Decisiones

- [ADR-001: Adopción del Estilo Arquitectónico Monolítico Modular](#adr-001-adopción-del-estilo-arquitectónico-monolítico-modular)
- [ADR-002: Dualidad de Comunicación: Server Actions para Web y Route Handlers (REST API) para App Móvil](#adr-002-dualidad-de-comunicación-server-actions-para-web-y-route-handlers-rest-api-para-app-móvil)
- [ADR-003: Persistencia de Datos con Neon Serverless PostgreSQL y Prisma ORM](#adr-003-persistencia-de-datos-con-neon-serverless-postgresql-y-prisma-orm)
- [ADR-004: Autenticación y Autorización basada en Roles (RBAC) con Clerk](#adr-004-autenticación-y-autorización-basada-en-roles-rbac-con-clerk)
- [ADR-005: Selección de Librería UI (shadcn/ui + Radix UI) y Visualización para el Dominio de Aerolíneas](#adr-005-selección-de-librería-ui-shadcnui--radix-ui-y-visualización-para-el-dominio-de-aerolíneas)
- [ADR-006: Estrategia de Soft Delete (deleted: boolean) y Control de Concurrencia en Reservas](#adr-006-estrategia-de-soft-delete-deleted-boolean-y-control-de-concurrencia-en-reservas)

---

### ADR-001: Adopción del Estilo Arquitectónico Monolítico Modular

- **Contexto:**
  El sistema de la aerolínea requiere gestionar vuelos, disponibilidad, compras de hasta 9 pasajes, cobros monetarios, facturación fiscal y reportes de ocupación. Se debe proveer interfaces diferenciadas para tres tipos de usuario (Pasajeros, Mostrador y Administradores) y preparar el soporte para una app móvil. Se evaluaron microservicios independientes versus un monolito clásico versus un monolito modular.
- **Decisión:**
  Se adopta un **Monolito Modular** construido sobre **Next.js (App Router)**. El código de la aplicación se divide internamente en módulos funcionales de dominio (`vuelos`, `pasajes`, `pagos`, `usuarios`, `notificaciones`), cada uno encapsulando sus reglas de negocio y modelos.
- **Consecuencias:**
  - *Positivas:* Simplificación drástica de la infraestructura y pipelines de CI/CD. Eliminación de latencia de red entre servicios. Consistencia transaccional ACID nativa en base de datos.
  - *Mitigación:* Si en el futuro un módulo específico (ej. motor de búsqueda de vuelos) sufre una demanda desproporcionada, sus límites desacoplados permitirán extraerlo a un microservicio independiente sin reescribir la lógica de dominio.

---

### ADR-002: Dualidad de Comunicación: Server Actions para Web y Route Handlers (REST API) para App Móvil

- **Contexto:**
  El frontend web requiere una experiencia fluida, rápida y segura sin exponer endpoints innecesarios. Sin embargo, el enunciado solicita explícitamente preparar el sistema para una **app móvil de pasajeros**, la cual operará en un runtime desacoplado (iOS/Android) que no puede invocar Server Actions directamente.
- **Decisión:**
  Implementar una estrategia híbrida:
  1. **Para la aplicación Web:** Utilizar **Server Actions** integradas en Next.js para formularios, reservas y check-in, invocando directamente los servicios de dominio con validación Zod en el servidor.
  2. **Para la App Móvil:** Exponer una **API RESTful versionada** bajo `app/api/v1/...` (Route Handlers) que reciba solicitudes JSON autenticadas mediante tokens Bearer JWT y delegue exactamente en la misma capa de servicios de dominio.
- **Consecuencias:**
  - *Positivas:* Máxima eficiencia y seguridad en la web; soporte móvil listo sin duplicar la lógica de negocio ni cálculos tarifarios.
  - *Negativas:* Requiere mantener contratos de API REST documentados (OpenAPI/Swagger) para el equipo móvil.

---

### ADR-003: Persistencia de Datos con Neon Serverless PostgreSQL y Prisma ORM

- **Contexto:**
  El tráfico aerocomercial es estacional y experimenta picos agudos durante promociones. Además, la compra de pasajes demanda transacciones ACID rigurosas para impedir sobreventa de asientos.
- **Decisión:**
  Utilizar **Neon Serverless PostgreSQL** como motor relacional gestionado, interactuando a través de **Prisma ORM**.
- **Consecuencias:**
  - *Positivas:*
    - Neon escala automáticamente el cómputo y ofrece pool de conexiones nativo para serverless.
    - La funcionalidad de *database branching* de Neon permite probar migraciones complejas de Prisma en ramas efímeras antes de producción.
    - Prisma brinda tipado seguro estricto (Type-Safe queries) alineado al esquema relacional de [diagrama_relacional.mmd](diagrama_relacional.mmd) y transacciones seguras con `prisma.$transaction()`.

---

### ADR-004: Autenticación y Autorización basada en Roles (RBAC) con Clerk

- **Contexto:**
  El sistema exige interfaces separadas y específicas para 3 roles: Pasajeros, Empleados de mostrador y Administradores. Además, los pasajeros deben poder comprar tanto como usuarios registrados como en modalidad "invitado" (indicando su email de contacto). El ADR original proponía **Neon Auth**; durante la implementación se determinó que se requiere un proveedor de identidad con control fino de claims en el session token, provisionamiento manual de cuentas de staff y componentes de UI de sign-in/sign-up listos para usar, por lo que se sustituye por **Clerk**.
- **Decisión:**
  Utilizar **Clerk** (`@clerk/nextjs`) para la gestión centralizada de identidades, sesiones y credenciales, junto a la tabla relacional de roles del esquema (`ROL` y `USUARIO`).
  1. **Rol viajando en el JWT:** el rol se expone en el session token de Clerk mediante el claim **`role`**, configurado en *Sessions → Customize session token → Claims editor* como `{ "role": "{{user.public_metadata.role}}" }`. La fuente de verdad es `user.public_metadata.role` (`"pasajero" | "mostrador" | "admin"`), que sólo es escribible desde el Backend API/Dashboard, por lo que un cliente no puede autoasignarse un rol. Si el claim no existe (usuarios creados por sign-up público), el rol efectivo es **`pasajero`** (`modules/usuarios/roles.ts`).
  2. **Provisionamiento de cuentas de staff:** la instancia permanece en modo *Open* para que los pasajeros se registren libremente en `/registro`, única superficie de sign-up de la aplicación. Las cuentas `admin` y `mostrador` se crean manualmente en el Clerk Dashboard (Create user / Invitation) seteando `publicMetadata.role`; sus páginas de login (`/admin/login`, `/mostrador/login`) renderizan `<SignIn withSignUp={false}>`.
  3. **Sincronización con la base de datos:** *lazy upsert* sin webhooks. En la primera request autenticada que renderiza un área protegida, `modules/usuarios/service.ts` busca `usuario` por `clerkId` y, si no existe, asegura la fila `rol` (get-or-create) y crea el registro con los datos de `currentUser()`.
  4. **Protección en dos capas:**
     - **Borde de red:** `proxy.ts` (convención renombrada desde `middleware.ts` en Next.js 16) con `clerkMiddleware` + `createRouteMatcher`, redirigiendo según sesión y rol.
     - **Servidor:** `requireRole()` de `modules/usuarios/auth.ts` en los layouts de las áreas protegidas y en las Server Actions que requieran un rol, más la verificación de autorización dentro de cada Server Action.
  5. **API Móvil:** se mantiene la dualidad del ADR-002; la verificación de tokens Bearer se hará con `clerkClient.verifyToken` en los route handlers de `/api/v1` (fuera del alcance de esta decisión).
- **Consecuencias:**
  - *Positivas:* Control de acceso robusto (RBAC) con verificación criptográfica de sesión y sin gestión propia de contraseñas ni cookies. Las rutas `/admin/*` y `/mostrador/*` quedan protegidas en el borde y en el servidor (defensa en profundidad). El claim `role` da un rol autoritativo y auditable por request sin consultas a la base de datos en el proxy. Se permite la compra a invitados almacenando `usuario_id = null` en `TRANSACCION_COMPRA`.
  - *Negativas / mitigación:* dependencia de un proveedor externo (mitigado: la tabla `usuario` conserva el rol local como dato de negocio y la lógica de dominio no depende de Clerk más allá de `clerkId`); configuración manual del claim y de las cuentas de staff en el Dashboard (mitigado con checklist en `auth-plan.md`); ausencia de sincronización por webhook, por lo que cambios de metadata tardan en reflejarse hasta la siguiente sesión (mitigado con *lazy upsert* y con el claim del token).

---

### ADR-005: Selección de Librería UI (shadcn/ui + Radix UI) y Visualización para el Dominio de Aerolíneas

- **Contexto:**
  El sistema de aerolínea requiere interfaces ricas y específicas: selección de vuelos con calendarios de vigencia, buscador predictivo de aeropuertos con códigos IATA, mapa interactivo de asientos (SeatMap) con diferenciación Economy/Primera, tablas avanzadas para el mostrador y gráficos de ocupación para los administradores. Las librerías de componentes monolíticas tradicionales (como MUI o AntD) introducen bundles pesados y fricciones con React Server Components de React 19.
- **Decisión:**
  Seleccionar **shadcn/ui** (basado en primitivas headless de Radix UI y Tailwind CSS v4), complementado con:
  - **Recharts / shadcn Charts:** Para los reportes de ocupación requeridos por los administradores.
  - **React Hook Form + Zod:** Para la orquestación y validación de compras de hasta 9 pasajes simultáneos.
  - **@tanstack/react-table:** Para la gestión de vuelos y listas de pasajeros de mostrador.
- **Consecuencias:**
  - *Positivas:*
    - Cero sobrepeso de bundle: los componentes residen en el propio código (`components/ui/`), permitiendo que el layout y páginas estáticas se rendericen en el servidor como RSC puros.
    - Máxima flexibilidad para construir el mapa interactivo de la aeronave (`SeatMap`) con accesibilidad WAI-ARIA garantizada por Radix UI.
    - Estética visual unificada moderna y responsiva entre las tres interfaces de usuario.

---

### ADR-006: Estrategia de Soft Delete (deleted: boolean) y Control de Concurrencia en Reservas

- **Contexto:**
  Las entidades clave del sistema cuyos IDs son usados como claves foráneas (`ROL`, `USUARIO`, `VUELO`, `INSTANCIA_VUELO` y `TRANSACCION_COMPRA`) no pueden eliminarse físicamente sin destruir la trazabilidad fiscal, contable y operativa. Adicionalmente, múltiples pasajeros podrían intentar comprar simultáneamente los últimos asientos disponibles de una instancia de vuelo.
- **Decisión:**
  1. **Soft Delete:** Incorporar el campo `deleted BOOLEAN NOT NULL DEFAULT FALSE` en las 5 tablas referenciadas. Aplicar índices únicos parciales (`WHERE deleted = FALSE`) en códigos de vuelo, emails e identificadores para no bloquear re-creaciones futuras. Inyectar filtros automáticos en Prisma para excluir registros con `deleted = true` en lecturas habituales.
  2. **Control de Concurrencia:** Utilizar transacciones atómicas serializables en PostgreSQL (`prisma.$transaction`) al momento de confirmar una compra:
     - Bloquear y verificar el cupo disponible en `INSTANCIA_VUELO` (`capacidad_economy` o `capacidad_primera` de `VUELO` menos los pasajes emitidos).
     - Si hay cupo suficiente, insertar los pasajes y registrar la transacción; si no, abortar la transacción con un error semántico de cupo agotado.
- **Consecuencias:**
  - *Positivas:* Garantía absoluta contra la sobreventa de vuelos (overbooking no controlado). Preservación histórica y legal de datos de facturación e instancias pasadas.
