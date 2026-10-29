import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/modules/vuelos/utils";
import { generarFacturaPDF } from "@/modules/notificaciones/pdf/factura-pdf";

export const runtime = "nodejs";

/**
 * `GET /api/v1/compras/:id/factura/pdf`
 *
 * Genera y descarga directamente la factura de compra en formato PDF.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Identificador de transacción inválido" }, { status: 400 });
    }

    const transaccionId = BigInt(id);
    const transaccion = await prisma.transaccionCompra.findUnique({
      where: { id: transaccionId },
      include: {
        factura: true,
        pago: true,
        pasajes: {
          include: {
            instanciaVuelo: {
              include: {
                vuelo: true,
              },
            },
          },
        },
      },
    });

    if (!transaccion || !transaccion.factura) {
      return NextResponse.json({ error: "Factura no encontrada para esta compra" }, { status: 404 });
    }

    const primerPasaje = transaccion.pasajes[0];
    const vuelo = primerPasaje.instanciaVuelo.vuelo;
    const totalNumero = Number(transaccion.total);
    const cantidadPasajes = transaccion.pasajes.length;
    const precioUnitario = Number((totalNumero / cantidadPasajes).toFixed(2));

    const buffer = await generarFacturaPDF({
      numeroFactura: transaccion.factura.numeroFactura,
      tipoFactura: transaccion.factura.tipoFactura,
      fechaEmision: transaccion.factura.fechaEmision.toLocaleDateString("es-AR"),
      receptor: {
        nombreRazonSocial: transaccion.factura.nombreRazonSocial,
        identificacionFiscal: transaccion.factura.identificacionFiscal,
        email: transaccion.emailContacto,
      },
      vuelo: {
        numeroVuelo: vuelo.numeroVuelo,
        origen: {
          iata: vuelo.origenIata,
          ciudad: vuelo.origenIata,
        },
        destino: {
          iata: vuelo.destinoIata,
          ciudad: vuelo.destinoIata,
        },
        fechaSalida: formatDate(primerPasaje.instanciaVuelo.fechaSalida),
      },
      clase: primerPasaje.clase,
      cantidadPasajes,
      precioUnitario,
      total: totalNumero,
      metodoPago: transaccion.pago?.metodoPago ?? "MERCADO_PAGO",
      idTransaccionPasarela: transaccion.pago?.idTransaccionPasarela,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Factura-${transaccion.factura.numeroFactura}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error al generar PDF de la factura:", error);
    return NextResponse.json({ error: "Error interno al generar el PDF de la factura" }, { status: 500 });
  }
}
