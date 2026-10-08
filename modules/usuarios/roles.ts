/**
 * Constantes y utilidades de roles del sistema.
 *
 * Módulo puro (sin dependencias de servidor ni de base de datos) para poder
 * importarlo tanto desde `proxy.ts` (borde de red) como desde los guards y
 * servicios que corren en el servidor de Next.js.
 *
 * Existen dos vocabularios de rol:
 *  - **Rol de sesión (JWT):** claim `role` del session token de Clerk
 *    (`"pasajero" | "mostrador" | "admin"`).
 *  - **Rol en base de datos:** valor de `rol.nombre` en la tabla `rol`
 *    (`PASAJERO`, `EMPLEADO_MOSTRADOR`, `ADMINISTRADOR`).
 */
export const ROLES = ["pasajero", "mostrador", "admin"] as const;

export type RolUsuario = (typeof ROLES)[number];

/** Rol efectivo cuando el claim `role` no existe en el session token. */
export const ROL_POR_DEFECTO: RolUsuario = "pasajero";

/** Vocabulario de la tabla `rol` (`docs/entidades.md` §3.1). */
export const NOMBRE_ROL_EN_DB: Record<RolUsuario, string> = {
  pasajero: "PASAJERO",
  mostrador: "EMPLEADO_MOSTRADOR",
  admin: "ADMINISTRADOR",
};

/** Home de cada rol, usado por los redirects de `proxy.ts` y por los guards. */
export const HOME_POR_ROL: Record<RolUsuario, string> = {
  pasajero: "/",
  mostrador: "/mostrador",
  admin: "/admin",
};

/** Página de login de cada rol. */
export const LOGIN_POR_ROL: Record<RolUsuario, string> = {
  pasajero: "/login",
  mostrador: "/mostrador/login",
  admin: "/admin/login",
};

export function esRolUsuario(valor: unknown): valor is RolUsuario {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

/**
 * Normaliza cualquier valor proveniente del claim `role`.
 * Un claim ausente o inválido degrada siempre a `pasajero`, de modo que un
 * usuario creado por sign-up público nunca puede escalar privilegios.
 */
export function normalizarRol(valor: unknown): RolUsuario {
  return esRolUsuario(valor) ? valor : ROL_POR_DEFECTO;
}
