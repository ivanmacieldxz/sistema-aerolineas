# Plan: Sistema de Autenticación con Clerk (3 roles)

> Estado: **plan implementado** (pendiente sólo la configuración externa de §6 y las pruebas manuales de §7).
> Fecha: 2026-10-05

---

## 1. Contexto y hallazgos del repositorio

- **Stack actual:** Next.js `16.3.8` (App Router), React `19.2.8`, TypeScript estricto, Tailwind v4, Prisma 7 + Neon, pnpm.
- **Estado del código:** scaffold inicial únicamente (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`). No existe ninguna lógica de autenticación implementada.
- **Sin `middleware.ts`:** en Next.js 16 la convención de red *middleware* fue renombrada a **`proxy.ts`** (mismo código, distinto nombre de archivo y export). Clerk v7 soporta explícitamente `proxy.ts`.
- **SDK:** `@clerk/nextjs@7.9.11` (latest) declara soporte de peer para `next@^16.0.10 || ^16.1.0-0` y `react@~19.2.3` → compatible con el proyecto.
- **Base de datos:** el esquema ya contempla `Usuario.clerkId` (unique) y la tabla `Rol` (ver `prisma/schema.prisma` y `docs/entidades.md`).
- **Documentación existente:** `docs/decisiones_diseno.md` ADR-004 especifica actualmente **Neon Auth** para RBAC → se reescribirá para registrar el cambio a Clerk.
- **Componentes UI:** no existe `components/ui` ni `components.json` (shadcn sin inicializar); las páginas de login se estilizarán con Tailwind puro siguiendo la estética del scaffold.

## 2. Decisiones tomadas (confirmadas con el usuario)

| Tema | Decisión |
|---|---|
| Creación de cuentas admin/mostrador | **Clerk Dashboard / invitaciones** (sin código de provisioning en la app) |
| Sincronización con tabla `usuario` | **Lazy upsert** en la primera request autenticada (sin webhooks) |
| Credenciales Clerk | **Aún no existen**; se deja placeholder en `.env.example`, el usuario las creará después |
| Documentación | **Actualizar ADR-004** (Neon Auth → Clerk) |

## 3. Requisitos funcionales

1. Autenticación 100% gestionada por **Clerk** (sesiones, credenciales, verificación de email).
2. Tres perfiles: `PASAJERO` (end-user), `MOSTRADOR` (counter-clerk), `ADMIN`.
3. **Los usuarios admin y de mostrador no pueden registrarse (sign-up)**; sólo los pasajeros tienen página de registro.
4. **Login en páginas separadas por rol:**
   - Pasajero → `/login`
   - Mostrador → `/mostrador/login`
   - Admin → `/admin/login`
5. **El rol viaja en el JWT de sesión**, en un claim llamado **`role`**, leído de `user.public_metadata.role`.
6. Protección de rutas en dos capas: `proxy.ts` (borde de red) + guards server-side en layouts/actions.

## 4. Diseño de la solución

### 4.1 Rol en el JWT (session token)

- **Fuente de verdad:** `publicMetadata.role` del usuario en Clerk (`"pasajero" | "mostrador" | "admin"`).
  - `publicMetadata` sólo es escribible desde el Backend API/Dashboard → un cliente **no puede autoasignarse** un rol (sin escalada de privilegios).
- **Claim:** en el Clerk Dashboard → *Sessions → Customize session token → Claims editor* se agrega:

  ```json
  { "role": "{{user.public_metadata.role}}" }
  ```

  Equivalente por CLI (evita mano de obra manual):
  ```bash
  npx clerk@latest config patch --json '{"session":{"claims":{"role":"{{user.public_metadata.role}}"}}}'
  ```
- **Semántica de lectura:** si el claim está ausente (usuarios registrados por sign-up público que nunca recibieron metadata), el rol efectivo es **`pasajero`**.
- **Anotación TypeScript global** para tipar `sessionClaims`.

> Nota: el token v2 de Clerk trae por defecto un claim `rol` (rol de organización, siglas). No se usan organizaciones en este proyecto, por lo que `role` no colisiona en la práctica; se documenta la distinción.

### 4.2 Provisionamiento de cuentas (sin sign-up para staff)

- Access mode de la instancia se mantiene en **Open** (los pasajeros deben poder registrarse libremente).
- Las cuentas `admin` y `mostrador` se crean **manualmente** en el Clerk Dashboard (botón *Create user* o *Invitation*), seteando `publicMetadata.role` en el mismo momento.
- La única superficie de sign-up en la app es `<SignUp>` en `/registro`, que **no** envía metadata de rol ⇒ siempre cae en el default `pasajero`.
- Defensa en profundidad: aunque alguien llamara a la API pública de sign-up de Clerk, obtendría un usuario sin metadata ⇒ rol efectivo `pasajero`, jamás accede a `/admin` ni `/mostrador`.

### 4.3 Protección de rutas (proxy.ts)

Capa de borde en `proxy.ts` (raíz del proyecto):

- **Rutas públicas:** `/`, `/login(.*)`, `/registro(.*)`, `/mostrador/login(.*)`, `/admin/login(.*)`, `/api/v1(.*)`.
- **Sin sesión:**
  - `/admin/*` (excepto su login) → redirect a `/admin/login`
  - `/mostrador/*` (excepto su login) → redirect a `/mostrador/login`
- **Con sesión** (rol desde `sessionClaims.role`, default `pasajero`):
  - `admin` intenta entrar a un área que no le corresponde → redirect a su home `/admin`
  - `mostrador` → home `/mostrador`
  - `pasajero` en `/admin` o `/mostrador` → redirect a `/`
  - Ya autenticado visitando **su propia** página de login → redirect a su home (evita bucles)
- **Matcher:** excluye estáticos (`_next`, imágenes, fuentes…) e incluye `/(api|trpc)(.*)` y `/__clerk/(.*)`.

### 4.4 Capa de servidor (guards + sync a BD)

Módulo nuevo `modules/usuarios/`:

- `modules/usuarios/auth.ts`
  - `getSessionRole(): Promise<RolUsuario>` → lee `auth().sessionClaims.role`, normaliza (`undefined ⇒ 'pasajero'`).
  - `requireRole(role)` → guard para layouts/server actions; usa `redirect()` de Next hacia la página de login/ home correspondiente si el rol no coincide.
- `modules/usuarios/service.ts`
  - `getCurrentUsuario()` → **lazy upsert**: busca `usuario` por `clerkId` (soft-delete `deleted: false`); si no existe:
    1. asegura que exista la fila `rol` (`PASAJERO` / `MOSTRADOR` / `ADMIN`) — get-or-create,
    2. crea el `usuario` con `name`, `apellido`, `email` provistos por `currentUser()` de Clerk,
    3. devuelve el registro.
  - Se invoca desde los layouts de área protegida (una sola vez por request que renderiza) y desde las server actions que necesiten `usuarioId`.

### 4.5 Estructura de rutas (grupos según AGENTS.md)

```
app/
├── (pasajero)/
│   ├── login/[[...login]]/page.tsx        # <SignIn>  path="/login"
│   ├── registro/[[...registro]]/page.tsx  # <SignUp>  path="/registro"  ← única superficie de sign-up
│   └── page.tsx (movida desde la raíz de `app/`)
├── (mostrador)/
│   └── mostrador/
│       ├── login/[[...login]]/page.tsx     # <SignIn> path="/mostrador/login" withSignUp={false}
│       └── (panel)/
│           ├── layout.tsx                  # requireRole('mostrador') + sync
│           └── page.tsx                    # placeholder protegido
├── (admin)/
│   └── admin/
│       ├── login/[[...login]]/page.tsx     # <SignIn> path="/admin/login" withSignUp={false}
│       └── (panel)/
│           ├── layout.tsx                  # requireRole('admin') + sync
│           └── page.tsx                    # placeholder protegido
├── layout.tsx                              # <ClerkProvider> dentro de <body>
proxy.ts                                    # clerkMiddleware + lógica de rol
modules/usuarios/roles.ts                   # constantes de rol (claim JWT <-> tabla `rol`)
types/globals.d.ts                          # CustomJwtSessionClaims
```

> Los route groups `(…)` no afectan la URL: las URLs finales son `/login`, `/registro`, `/mostrador/login`, `/admin/login`, `/mostrador`, `/admin`.
>
> **Detalle de implementación:** el `layout.tsx` con `requireRole(…)` vive en el grupo anidado `(panel)`, no en la raíz de `(admin)`/`(mostrador)`. De otro modo envolvería también la página de login del mismo segmento (`/admin/login`, `/mostrador/login`) y redirigiría a los usuarios sin sesión justo antes de que pudieran autenticarse.

Detalle crítico: definir `NEXT_PUBLIC_CLERK_SIGN_IN_URL` hace que `<SignIn>` active `withSignUp` **por defecto** ⇒ en las páginas de login de staff se pasa explícitamente **`withSignUp={false}`** y **no** se define `signUpUrl`, para que no aparezca ningún enlace "Don't have an account? Sign up".

## 5. Pasos de implementación (orden)

1. **Dependencias:** `pnpm add @clerk/nextjs`
2. **Entorno:** agregar a `.env.example`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/registro
   ```
3. **Tipos:** crear `types/globals.d.ts` con la interfaz global `CustomJwtSessionClaims { role?: 'pasajero' | 'mostrador' | 'admin' }`.
4. **Provider:** envolver `app/layout.tsx` con `<ClerkProvider>` (dentro de `<body>`, según docs Clerk v7).
5. **Proxy:** crear `proxy.ts` en la raíz con `clerkMiddleware` + `createRouteMatcher` y toda la lógica de redirección por rol (§4.3).
6. **Módulo de usuarios:** crear `modules/usuarios/auth.ts` (guards) y `modules/usuarios/service.ts` (lazy upsert), con constantes de rol alineadas a los nombres de la tabla `rol`.
7. **Páginas:** crear las 4 páginas de login/registro y las 2 áreas placeholder protegidas con sus `layout.tsx` (§4.5), incluyendo `UserButton` / cerrar sesión en las áreas protegidas.
8. **Documentación:** reescribir **ADR-004** en `docs/decisiones_diseno.md` (Neon Auth → Clerk, claim `role` en JWT, RBAC en dos capas) y actualizar el índice.
9. **Verificación** (§7).

## 6. Checklist de configuración externa (manual, fuera del repo)

- [ ] Crear instancia de aplicación en Clerk (modo dev).
- [ ] Copiar *Publishable Key* y *Secret Key* a `.env.local`.
- [ ] Dashboard → Sessions → Customize session token → agregar claim `"role": "{{user.public_metadata.role}}"` (o `npx clerk@latest config patch …`).
- [ ] Crear usuario admin con `publicMetadata: { "role": "admin" }`.
- [ ] Crear usuario de mostrador con `publicMetadata: { "role": "mostrador" }`.
- [ ] Verificar que el sign-up de pasajero (`/registro`) queda sin metadata y recibe rol efectivo `pasajero`.

## 7. Verificación

```bash
pnpm prisma validate   # esquema intacto
pnpm tsc --noEmit      # tipos (incluye anotación de sessionClaims)
pnpm lint              # eslint
pnpm build             # requiere claves Clerk en .env.local
```

- Sin claves Clerk, `ClerkProvider` falla en runtime/build ⇒ en ese caso la verificación se limita a `tsc --noEmit` + `lint`, y se dejará constancia en el PR.
- Pruebas manuales (cuando haya claves): accesos cruzados entre roles, sign-up sólo visible en `/login`, y redirects de `proxy.ts`.

## 8. Fuera de alcance (declarado)

- Verificación de tokens **Bearer** para la API REST móvil (`app/api/v1`) — requiere `clerkClient.verifyToken` en route handlers; se abordará aparte.
- UI real de admin/mostrador (sólo placeholders protegidos).
- Webhook de sincronización `usuario` (se eligió lazy upsert).
