"use server";

import { PasajeError } from "@/modules/pasajes/errors";
import { getCurrentUsuario } from "@/modules/usuarios/service";
import { PagoError } from "./errors";
import { preferenciaRequestSchema } from "./schemas";
import { crearPreferenciaDePago } from "./service";

/**
 * Resultado de la Server Action de checkout. Nunca lanza: el cliente recibe un
 * discriminante `ok` para decidir entre redirigir a Mercado Pago o mostrar el
 * error por `code`.
 */
export type IniciarCompraResult =
  | {
      ok: true;
      transaccionId: string;
      preferenceId: string;
      initPoint: string;
      total: number;
    }
  | { ok: false; code: string; message: string };

/** Detecta un error de dominio de los módulos de pagos o de pasajes. */
function esErrorDeDominio(error: unknown): error is PagoError | PasajeError {
  return error instanceof PagoError || error instanceof PasajeError;
}

/**
 * Traduce cualquier excepción a un resultado tipado. Los errores de dominio
 * preservan su código (`SIN_CUPO`, `VUELO_NO_DISPONIBLE`, `INSTANCIA_CANCELADA`,
 * `PAYMENT_GATEWAY_UNAVAILABLE`, etc.); el resto se registra y degrada a
 * `INTERNAL_ERROR` sin filtrar detalles internos.
 */
function mapearError(error: unknown): IniciarCompraResult {
  if (esErrorDeDominio(error)) {
    return { ok: false, code: error.code, message: error.message };
  }

  console.error("Error no controlado en iniciarCompra:", error);

  return {
    ok: false,
    code: "INTERNAL_ERROR",
    message: "Ocurrió un error inesperado al iniciar la compra.",
  };
}

/**
 * Server Action que inicia la compra desde el checkout web: valida el
 * formulario, resuelve el usuario autenticado (o invitado) y crea la orden de
 * compra junto con la preferencia de Checkout Pro.
 *
 * El redirect a Mercado Pago lo realiza el cliente con `initPoint`; esta acción
 * no usa `redirect()` para no interferir con el manejo de errores.
 */
export async function iniciarCompra(
  input: unknown
): Promise<IniciarCompraResult> {
  const parsed = preferenciaRequestSchema.safeParse(input);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: firstIssue?.message ?? "Los datos de la compra son inválidos.",
    };
  }

  // La sesión es opcional: si Clerk falla o no hay usuario, se opera como
  // invitado (mismo criterio que `POST /api/v1/compras/preferencia`).
  let usuarioId: bigint | null = null;

  try {
    const usuario = await getCurrentUsuario();
    usuarioId = usuario?.id ?? null;
  } catch (error) {
    console.warn(
      "No se pudo resolver el usuario autenticado; se continúa como invitado:",
      error
    );
  }

  try {
    const resultado = await crearPreferenciaDePago({
      ...parsed.data,
      usuarioId,
    });

    return { ok: true, ...resultado };
  } catch (error) {
    return mapearError(error);
  }
}
