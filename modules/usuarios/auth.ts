import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HOME_POR_ROL, LOGIN_POR_ROL, normalizarRol, type RolUsuario } from "./roles";

/**
 * Rol efectivo del usuario de la sesión actual, leído del claim `role`
 * del session token de Clerk (`user.public_metadata.role`).
 * Un claim ausente o inválido degrada a `pasajero`.
 */
export async function getSessionRole(): Promise<RolUsuario> {
  const { sessionClaims } = await auth();
  return normalizarRol(sessionClaims?.role);
}

/**
 * Guard de rol para layouts, Server Components y Server Actions.
 *
 * - Sin sesión → redirige al login del rol requerido.
 * - Con sesión pero de otro rol → redirige al home de su propio rol.
 *
 * Debe usarse junto con la protección de borde de `proxy.ts` (defensa en
 * profundidad): el proxy corta el acceso de red y este guard corta el render.
 */
export async function requireRole(role: RolUsuario): Promise<void> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect(LOGIN_POR_ROL[role]);
  }

  const rolActual = normalizarRol(sessionClaims?.role);

  if (rolActual !== role) {
    redirect(HOME_POR_ROL[rolActual]);
  }
}
