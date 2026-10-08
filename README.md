# Sistema Integral de Gestión de Aerolínea

Sistema web integral y plataforma de servicios para una aerolínea nacional, diseñado bajo una **arquitectura monolítica modular** que centraliza la administración operativa de vuelos, la venta de pasajes, el procesamiento de pagos, la facturación electrónica y el control de ocupación, ofreciendo soporte desacoplado para una futura aplicación móvil de pasajeros.

---

## 1. Visión General del Sistema

El sistema ofrece interfaces de usuario diferenciadas y adaptadas para tres perfiles de usuario, manteniendo una experiencia visual unificada:

1. **Pasajeros:**
   - Búsqueda de vuelos por origen, destino, fechas y horarios disponibles.
   - Selección de cabina (**Economy** y **Primera Clase**) y asignación interactiva de asientos.
   - Compra de **hasta un máximo de 9 pasajes por transacción** (tanto para usuarios registrados como en modalidad invitado).
   - Pago en línea con confirmación inmediata, emisión automática de factura fiscal y pasajes electrónicos (e-tickets).
   - Recepción de alertas por correo electrónico ante demoras o cancelaciones.
2. **Empleados de Mostrador:**
   - Búsqueda ágil de pasajeros por documento de identidad o código de pasaje.
   - Operaciones de check-in en terminal aeroportuaria y reasignación de butacas.
   - Control del estado de abordaje y confirmación de pasajeros.
3. **Administradores:**
   - Alta, modificación y cancelación de rutas y vuelos programados (origen, destino, horarios, días de la semana y capacidades por clase).
   - Configuración de vigencia anual para la comercialización y gestión de tarifas diferenciadas.
   - Consulta de reportes y métricas de **control de ocupación** por vuelo, clase y fecha.

---

## 2. Stack Tecnológico

El proyecto utiliza un stack moderno optimizado para entornos serverless, tipado estricto y alto rendimiento:

- **Framework Fullstack:** [Next.js](https://nextjs.org/) (v16.x / React 19) con **App Router**.
  - **Frontend Web:** Renderizado híbrido con React Server Components (RSC) y Client Components interactivos.
  - **Mutaciones Web:** **Server Actions** para interacción directa, tipada y segura sin sobrecarga de controladores HTTP internos.
  - **API REST:** Route Handlers bajo `/api/v1/...` para el consumo desacoplado de la futura **app móvil** de pasajeros.
- **Base de Datos:** [Neon](https://neon.tech/) Serverless PostgreSQL.
  - Escalabilidad elástica automática y soporte de *database branching* para desarrollo y testing.
  - Conexión optimizada mediante pool serverless (`@neondatabase/serverless`).
- **Autenticación y Roles:** **Clerk** (`@clerk/nextjs`).
  - Control de Acceso Basado en Roles (RBAC): `ADMINISTRADOR`, `EMPLEADO_MOSTRADOR`, `PASAJERO`, con el rol viajando en el claim `role` del session token.
  - Protección en dos capas: `proxy.ts` (borde de red) + guards server-side (`requireRole`).
  - Los pasajeros se registran en `/registro`; las cuentas de staff se crean en el Clerk Dashboard.
- **ORM / Capa de Persistencia:** [Prisma ORM](https://www.prisma.io/) (v7.x).
  - Tipado de datos de extremo a extremo generado en TypeScript.
  - Mapeo relacional de 10 entidades con soporte integral para el patrón **Soft Delete** (`deleted: boolean`).
  - Transacciones atómicas ACID para evitar sobreventa de asientos.
- **Librería UI y Estilos:**
  - **shadcn/ui** (primitivas de Radix UI + Tailwind CSS v4): componentes accesibles WAI-ARIA, mapa de asientos (`SeatMap`), selector predictivo de aeropuertos IATA (`Combobox`) y selector de fechas (`DatePicker`).
  - **Lucide React:** Iconografía vectorial consistente.
  - **React Hook Form + Zod:** Validación estricta y compartida de formularios de compra y pasajeros.
- **Gestor de Paquetes:** [pnpm](https://pnpm.io/) (v12.x).

---

## 3. Metodología de Trabajo y Commits (GitFlow)

Para el desarrollo del proyecto se adopta la metodología **GitFlow** combinada con **Conventional Commits**:

### 3.1. Estructura de Ramas

```
main ──────────●────────────────────────●──────── (Producción estable)
               │                        ▲
release/v1.0   │            ┌───────────┘
               ▼            ▼
develop ───────●────────────●───────────●──────── (Integración continua)
               │            ▲           ▲
feature/*      └────●───●───┘           │
                                        │
bugfix/*       ─────────────────────────┘
```

- **`main`:** Contiene exclusivamente el código listo y desplegado en producción. Toda incorporación proviene de ramas `release/*` o `hotfix/*` mediante Pull Request validado.
- **`develop`:** Rama de integración para el sprint actual donde convergen las nuevas funcionalidades.
- **`feature/<nombre-funcionalidad>`:** Ramas creadas a partir de `develop` para desarrollar una historia de usuario o tarea específica (ej. `feature/buscador-vuelos`, `feature/seleccion-asientos`). Se integran de vuelta en `develop` vía PR.
- **`bugfix/<descripcion>`:** Corrección de incidencias detectadas en `develop`.
- **`release/<version>`:** Rama de estabilización previa a un paso a producción (pruebas finales y versionado).
- **`hotfix/<descripcion>`:** Correcciones urgentes aplicadas directamente sobre `main` y sincronizadas posteriormente con `develop`.

### 3.2. Convención de Commits (Conventional Commits)

Cada commit debe seguir el estándar:
```text
<tipo>(<alcance opcional>): <descripción concisa en minúsculas>

[cuerpo explicativo opcional]
```

**Tipos principales:**
- `feat`: Nueva característica o funcionalidad (ej. `feat(vuelos): agregar endpoint de búsqueda por código iata`).
- `fix`: Corrección de un error o bug (ej. `fix(pasajes): impedir selección de asiento ya ocupado`).
- `docs`: Cambios exclusivamente en documentación (ej. `docs: actualizar diagrama relacional`).
- `style`: Formateo, estilos o ajustes visuales sin cambios de lógica.
- `refactor`: Modificación de código que no agrega funcionalidad ni repara bugs.
- `perf`: Mejoras de rendimiento o consultas de base de datos.
- `test`: Incorporación o corrección de pruebas automatizadas.
- `chore`: Tareas de mantenimiento, dependencias o configuración del proyecto.

---

## 4. Guía de Setup y Puesta en Marcha

### 4.1. Requisitos Previos
- **Node.js:** Versión 20.x o superior LTS (recomendado 22.x).
- **pnpm:** Versión 12.x o superior (`npm install -g pnpm`).
- **Cuenta en Neon:** Proyecto creado en [neon.tech](https://neon.tech) con base de datos PostgreSQL activa.

### 4.2. Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/ivanmacieldxz/sistema-aerolineas.git
   cd sistema-aerolinea
   ```

2. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo de plantilla `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con las credenciales de tu proyecto Neon y de Clerk:
   ```env
   # Cadena de conexión provista por Neon Console
   DATABASE_URL="postgresql://usuario:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

   # Clerk (autenticación) - Clerk Dashboard -> API Keys
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"
   NEXT_PUBLIC_CLERK_SIGN_UP_URL="/registro"

   # URL base de la app
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```
   > **Nota:** además de las claves, hay que agregar el claim `role` al session
   > token en *Clerk Dashboard → Sessions → Customize session token* y crear las
   > cuentas de staff con `publicMetadata.role` (`admin` / `mostrador`).
4. **Añadir dependencias dependendencias dotenv**
   Añade dependencias necesarias:
   ```bash
   pnpm add dotenv
   ```
5. **Configurar y sincronizar la base de datos (Prisma):**
   Genera el cliente de Prisma fuertemente tipado:
   ```bash
   pnpm prisma generate
   ```
   Sincroniza el esquema relacional con la base de datos de Neon:
   ```bash
   pnpm prisma db push
   ```

6. **Iniciar el servidor de desarrollo:**
   ```bash
   pnpm dev
   ```
   La aplicación estará accesible en [http://localhost:3000](http://localhost:3000).

---

## 5. Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `pnpm dev` | Inicia el entorno de desarrollo local con Turbopack. |
| `pnpm build` | Compila y genera el paquete de producción optimizado. |
| `pnpm start` | Inicia el servidor Next.js en modo producción. |
| `pnpm lint` | Ejecuta el análisis estático de código con ESLint. |
| `pnpm prisma validate` | Valida la sintaxis del archivo `prisma/schema.prisma`. |
| `pnpm prisma generate` | Regenera el cliente `@prisma/client` con los tipos actualizados. |
| `pnpm prisma db push` | Aplica el estado del esquema Prisma directamente sobre la base de datos. |
| `pnpm prisma studio` | Abre la interfaz visual de administración de datos de Prisma en el navegador. |

---

## 6. Documentación Adicional

Para profundizar en el diseño del sistema, consultar los documentos en [`/docs`](docs/):
- **[docs/arquitectura.md](docs/arquitectura.md):** Documento de Arquitectura de Software (SAD), descomposición en capas y diseño del monolito modular.
- **[docs/entidades.md](docs/entidades.md):** Diccionario de datos completo con campos, tipos, claves, nulabilidad y restricciones de integridad (incluyendo reglas de Soft Delete).
- **[docs/diagrama_relacional.mmd](docs/diagrama_relacional.mmd):** Diagrama Entidad-Relación relacional formal en formato Mermaid.
- **[docs/decisiones_diseno.md](docs/decisiones_diseno.md):** Architecture Decision Records (ADRs) que justifican las decisiones técnicas tomadas.
