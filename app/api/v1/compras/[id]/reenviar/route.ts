import { NextRequest, NextResponse } from "next/server";
import { enviarComprobantesCompra } from "@/modules/notificaciones/service";

export const runtime = "nodejs";

function mensajeReenvio(reason: string): string {
  switch (reason) {
    case "TRANSACCION_NO_ENCONTRADA":
      return "La transacción no existe o fue dada de baja.";
    case "ESTADO_NO_CONFIRMADO":
      return "La transacción todavía no está confirmada.";
    case "FACTURA_INEXISTENTE":
      return "La transacción no tiene factura emitida.";
    case "SIN_PASAJES":
      return "La transacción no tiene pasajes emitidos.";
    default:
      return "No se pudieron reenviar los comprobantes.";
  }
}

/**
 * `POST /api/v1/compras/:id/reenviar`
 *
 * Reenvía por email los pasajes y la factura de una compra ya confirmada.
 * Pensado como recuperación operativa cuando el envío automático falló (por
 * ejemplo, por una caída o mala configuración del SMTP).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Identificador de transacción inválido.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const resultado = await enviarComprobantesCompra(id);

    if (!resultado.success) {
      const status = resultado.reason === "TRANSACCION_NO_ENCONTRADA" ? 404 : 409;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: resultado.reason,
            message: mensajeReenvio(resultado.reason),
          },
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: resultado.messageId ?? null,
        pasajesEnviados: resultado.pasajesEnviados,
      },
    });
  } catch (error) {
    console.error(
      `Error al reenviar comprobantes de la transacción #${id}:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "No se pudieron reenviar los comprobantes.",
        },
      },
      { status: 500 }
    );
  }
}
