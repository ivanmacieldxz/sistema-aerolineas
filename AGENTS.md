<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Guía para Agentes de IA - Sistema de Aerolínea

Este documento establece las directrices de arquitectura, reglas de negocio, convenciones de código y buenas prácticas para cualquier agente de IA o desarrollador que opere en este repositorio.

---

## 1. Contexto del Negocio y Dominio

El sistema digitaliza la gestión operativa y comercial de una aerolínea nacional. Toda tarea de desarrollo debe respetar las siguientes definiciones:

- **Perfiles y Roles de Usuario:**
  - `PASAJERO`: Búsqueda de vuelos, selección de cabina/asientos, compra de pasajes y consulta de pases de abordar. Puede operar autenticado o como **invitado** (`usuario_id = null` en `transaccion_compra`).
  - `EMPLEADO_MOSTRADOR`: Terminal de check-in en aeropuerto, búsqueda de pasajeros por documento/código y reasignación de asientos.
  - `ADMINISTRADOR`: Gestión troncal de vuelos (rutas, horarios, vigencia anual, capacidades y precios) y reportes de **control de ocupación**.
- **Reglas de Negocio Fundamentales:**
  - **Límite de Pasajes:** Máximo de **9 pasajes por transacción de compra** (`1 <= COUNT(pasajes) <= 9`).
  - **Control de Ocupación:** La cantidad de pasajes activos (`EMITIDO` o `CHECK_IN`) en una instancia de vuelo jamás debe superar la capacidad configurada en el vuelo para esa clase (`capacidad_economy` o `capacidad_primera`).
  - **Soft Delete Obligatorio:** Las entidades cuyo identificador es clave foránea (`rol`, `usuario`, `vuelo`, `instancia_vuelo`, `transaccion_compra`) poseen el campo `deleted BOOLEAN NOT NULL DEFAULT FALSE`.
    - **Nunca ejecutar `DELETE` físico** sobre estas tablas.
    - Siempre filtrar por `{ deleted: false }` en consultas de lectura estándar.
    - La baja lógica de un vuelo o transacción está condicionada a la ausencia de pasajes o pagos activos dependientes.
  - **Coherencia Tarifaria:** El `total` de la transacción debe ser igual a la suma de los pasajes adquiridos, y el monto del pago aprobado debe coincidir exactamente con el total.

---

## 2. Arquitectura de Software y Estructura del Código

Se utiliza una **Arquitectura Monolítica Modular** sobre **Next.js (App Router)**:

```
sistema-aerolinea/
├── app/                      # Rutas de Next.js (App Router)
│   ├── (auth)/               # Rutas de autenticación (Login, Registro)
│   ├── (pasajero)/           # Interfaz pública y flujo de compra de pasajeros
│   ├── (mostrador)/          # Interfaz operativa para empleados de mostrador
│   ├── (admin)/              # Panel de administración de vuelos y reportes
│   ├── api/v1/               # Route Handlers REST (Exclusivos para App Móvil)
│   ├── layout.tsx            # Layout raíz
│   └── page.tsx              # Landing page principal
├── components/               # Componentes React
│   └── ui/                   # Primitivas de UI (shadcn/ui basados en Radix + Tailwind v4)
├── docs/                     # Documentación de arquitectura y diseño
│   ├── arquitectura.md       # Software Architecture Document (SAD)
│   ├── entidades.md          # Diccionario de datos exhaustivo
│   ├── decisiones_diseno.md  # ADRs arquitectónicos
│   └── diagrama_relacional.mmd # Esquema ER en Mermaid
├── lib/                      # Utilidades transversales y clientes
│   ├── prisma.ts             # Cliente singleton de Prisma ORM configurado con Neon adapter
│   └── utils.ts              # Helper cn() para Tailwind CSS
├── modules/ (o lib/modules/) # Módulos de lógica de negocio (Monolito Modular)
│   ├── vuelos/               # Servicios y acciones de rutas, horarios y vigencia
│   ├── pasajes/              # Servicios de reservas, asientos, cupos y check-in
│   ├── pagos/                # Procesamiento de cobro y emisión de facturas
│   ├── usuarios/             # Perfiles y sincronización de roles
│   └── notificaciones/       # Envíos de emails automáticos y alertas de vuelo
├── prisma/
│   ├── schema.prisma         # Esquema relacional Prisma (10 entidades)
│   └── migrations/           # Historial de migraciones SQL
├── neon.ts                   # Configuración Neon Config-as-Code (Neon Auth habilitado)
└── prisma.config.ts          # Configuración de datasource para Prisma 7
```

---

## 3. Directrices de Implementación para Agentes

### 3.1. Frontend Web (React Server Components + Server Actions)
- Priorizar **React Server Components (RSC)** por defecto para la carga de datos y renderizado inicial.
- Utilizar `'use client'` únicamente cuando el componente requiera estado local (`useState`), efectos (`useEffect`) o interactividad directa (ej. `SeatMap`, selector de aeropuertos interactivo).
- **Mutaciones:** Implementar las operaciones de escritura como **Server Actions** fuertemente tipadas y validadas con **Zod**, ubicadas dentro de sus respectivos módulos o carpetas `actions`.
- **UI:** Emplear la librería **shadcn/ui** combinada con **Tailwind CSS v4** y **Lucide React**. Utilizar siempre el helper `cn()` de `@/lib/utils` para combinar clases de Tailwind.

### 3.2. Endpoints REST (Soporte Móvil)
- Los endpoints REST se ubican exclusivamente en `app/api/v1/...`.
- Deben invocar exactamente la misma capa de servicios de dominio que utilizan los Server Actions, evitando duplicación de lógica.
- Manejar respuestas JSON uniformes y códigos HTTP semánticos (200, 201, 400, 401, 403, 404, 409, 500).

### 3.3. Base de Datos y Persistencia (Prisma + Neon)
- Siempre importar la instancia de base de datos desde `@/lib/prisma`:
  ```ts
  import { prisma } from "@/lib/prisma";
  ```
- **Concurrencia en Reservas:** Siempre que se compre o emita un pasaje, ejecutar la operación dentro de una transacción atómica `prisma.$transaction(...)` para garantizar el bloqueo y verificación de cupos sin sobreventa.
- **Soft Delete:** Asegurar que las consultas estándar incluyan `{ where: { deleted: false } }`.

---

## 4. Metodología Git y Convención de Commits

Todo cambio o propuesta de código debe respetar la metodología **GitFlow** y **Conventional Commits**:

- **Ramas:**
  - `main`: Producción estable.
  - `develop`: Rama de integración activa.
  - `feature/<nombre>`: Nuevas funcionalidades derivadas de `develop`.
  - `bugfix/<nombre>`: Correcciones en desarrollo.
  - `hotfix/<nombre>`: Correcciones urgentes de producción.
- **Formato de Commits:**
  - `feat(<módulo>): <descripción>` para nuevas funcionalidades.
  - `fix(<módulo>): <descripción>` para corrección de bugs.
  - `docs: <descripción>` para documentación.
  - `refactor(<módulo>): <descripción>` para mejoras estructurales de código.
  - `test(<módulo>): <descripción>` para pruebas.

---

## 5. Comandos de Verificación Requeridos

Antes de dar por concluida cualquier tarea o modificación, el agente debe verificar que no se introdujeron regresiones ejecutando:

```bash
# 1. Validar esquema de base de datos
pnpm prisma validate

# 2. Verificar tipos de TypeScript
pnpm tsc --noEmit

# 3. Analizar código con el linter
pnpm lint

# 4. Probar compilación del proyecto
pnpm build
```

---

## 6. Documentos de Referencia Obligatoria

Antes de implementar modificaciones en entidades, rutas o modelos, consultar:
- [docs/entidades.md](docs/entidades.md): Definición detallada de columnas, tipos, claves y restricciones.
- [docs/arquitectura.md](docs/arquitectura.md): Especificación de capas y flujo de datos.
- [docs/decisiones_diseno.md](docs/decisiones_diseno.md): Decisiones arquitectónicas registradas (ADRs).
- [docs/diagrama_relacional.mmd](docs/diagrama_relacional.mmd): Modelo ER visual.
