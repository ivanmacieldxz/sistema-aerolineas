import { getCurrentUsuario } from "../service";

/**
 * Componente Server Side invisible que ejecuta la sincronización lazy
 * del usuario autenticado en Clerk hacia la base de datos PostgreSQL.
 */
export async function AuthSync() {
  try {
    await getCurrentUsuario();
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      (error as { digest: string }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      throw error;
    }
    console.warn("AuthSync: error en sincronización:", error);
  }

  return null;
}
