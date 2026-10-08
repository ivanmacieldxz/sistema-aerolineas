import type { Rol, Usuario } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getSessionRole } from "./auth";
import { NOMBRE_ROL_EN_DB } from "./roles";

/**
 * Get-or-create de la fila `rol` (soft-delete incluido).
 * Si el rol existe pero está dado de baja, se reactiva.
 */
async function asegurarRol(nombre: string): Promise<Rol> {
  const existente = await prisma.rol.findUnique({ where: { nombre } });

  if (existente) {
    return existente.deleted
      ? prisma.rol.update({ where: { nombre }, data: { deleted: false } })
      : existente;
  }

  try {
    return await prisma.rol.create({ data: { nombre } });
  } catch (error) {
    // Carrera con otra request concurrente que ya insertó el rol.
    const enCarrera = await prisma.rol.findUnique({ where: { nombre } });

    if (!enCarrera) {
      throw error;
    }

    return enCarrera;
  }
}

/**
 * Sincronización *lazy* entre la identidad de Clerk y la tabla `usuario`.
 *
 * Se invoca desde los layouts de las áreas protegidas (una vez por request
 * que renderiza) y desde las server actions que necesiten `usuarioId`.
 * No hay webhook: si el usuario aún no existe en la BD, se crea en el momento.
 *
 * @returns El registro de `usuario` activo o `null` si no hay sesión.
 */
export async function getCurrentUsuario(): Promise<Usuario | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const existente = await prisma.usuario.findFirst({
    where: { clerkId: userId, deleted: false },
  });

  if (existente) {
    return existente;
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email =
    clerkUser.emailAddresses.find(
      (direccion) => direccion.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error(`El usuario de Clerk ${userId} no tiene una dirección de email asociada.`);
  }

  const rol = await getSessionRole();
  const filaRol = await asegurarRol(NOMBRE_ROL_EN_DB[rol]);

  try {
    return await prisma.usuario.create({
      data: {
        roleId: filaRol.id,
        name: clerkUser.firstName ?? clerkUser.username ?? "",
        apellido: clerkUser.lastName ?? "",
        email,
        clerkId: userId,
      },
    });
  } catch (error) {
    // Carrera con otra request concurrente que ya creó el usuario.
    const enCarrera = await prisma.usuario.findFirst({
      where: { clerkId: userId, deleted: false },
    });

    if (!enCarrera) {
      throw error;
    }

    return enCarrera;
  }
}
