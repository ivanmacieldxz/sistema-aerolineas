import { NextRequest, NextResponse } from "next/server";
import { errorResponse, validationErrorResponse } from "@/lib/api-response";
import { preferenciaRequestSchema } from "@/modules/pagos/schemas";
import { crearPreferenciaDePago } from "@/modules/pagos/service";
import { getCurrentUsuario } from "@/modules/usuarios/service";

export const runtime = "nodejs";

/**
 * `POST /api/v1/compras/preferencia`
 *
 * Inicia la orden de compra (reserva de pasajes con hold de cupo) y genera la
 * preferencia de Checkout Pro en Mercado Pago.
 *
 * La autenticación es opcional: con sesión se asocia `usuarioId`; sin sesión la
 * compra se registra como invitado (`usuarioId = null`).
 */
export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("El cuerpo de la solicitud debe ser JSON válido.");
  }

  const parsed = preferenciaRequestSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return validationErrorResponse(
      firstIssue?.message ?? "Los datos de la compra son inválidos."
    );
  }

  // La sesión es opcional: si Clerk falla o no hay usuario, se opera como invitado.
  let usuarioId: bigint | null = null;

  try {
    const usuario = await getCurrentUsuario();
    usuarioId = usuario?.id ?? null;
  } catch (error) {
    console.warn("No se pudo resolver el usuario autenticado; se continúa como invitado:", error);
  }

  try {
    const resultado = await crearPreferenciaDePago({ ...parsed.data, usuarioId });

    return NextResponse.json(
      { success: true, data: resultado },
      { status: 201 }
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
