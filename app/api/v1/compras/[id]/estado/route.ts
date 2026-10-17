import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { consultarEstadoTransaccion } from "@/modules/pagos/service";

export const runtime = "nodejs";

/**
 * `GET /api/v1/compras/:id/estado`
 *
 * Consulta el estado comercial de una compra (transacción, pago, factura y
 * pasajes) para *polling* o pantalla de resultado. La fuente de verdad es la
 * base de datos, confirmada asíncronamente por el webhook de Mercado Pago.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await consultarEstadoTransaccion(id);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
