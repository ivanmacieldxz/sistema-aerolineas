import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatTime, formatDateShort } from "@/modules/vuelos/utils";
import { generarPasajePDF } from "@/modules/notificaciones/pdf/pasaje-pdf";

export const runtime = "nodejs";

/**
 * `GET /api/v1/pasajes/:id/pdf`
 *
 * Genera y descarga directamente el pase de abordaje electrónico en formato PDF.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Identificador de pasaje inválido" }, { status: 400 });
    }

    const codigo = BigInt(id);
    const pasaje = await prisma.pasaje.findUnique({
      where: { codigo },
      include: {
        instanciaVuelo: {
          include: {
            vuelo: {
              include: {
                origen: true,
                destino: true,
              },
            },
          },
        },
      },
    });

    if (!pasaje) {
      return NextResponse.json({ error: "Pasaje no encontrado" }, { status: 404 });
    }

    if (pasaje.estado === "CANCELADO") {
      return NextResponse.json({ error: "El pasaje se encuentra cancelado" }, { status: 400 });
    }

    const vuelo = pasaje.instanciaVuelo.vuelo;
    const buffer = await generarPasajePDF({
      codigoPasaje: pasaje.codigo.toString(),
      transaccionId: pasaje.transaccionId.toString(),
      pasajero: {
        nombre: pasaje.pasajeroNombre,
        apellido: pasaje.pasajeroApellido,
        documento: pasaje.pasajeroDocumento,
      },
      vuelo: {
        numeroVuelo: vuelo.numeroVuelo,
        origen: {
          iata: vuelo.origenIata,
          ciudad: vuelo.origen.ciudad,
          nombre: vuelo.origen.nombre,
        },
        destino: {
          iata: vuelo.destinoIata,
          ciudad: vuelo.destino.ciudad,
          nombre: vuelo.destino.nombre,
        },
        fechaSalida: formatDateShort(pasaje.instanciaVuelo.fechaSalida),
        horaSalida: formatTime(vuelo.horaSalida),
        horaLlegada: formatTime(vuelo.horaLlegada),
      },
      clase: pasaje.clase,
      numeroAsiento: pasaje.numeroAsiento,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Pasaje-${pasaje.pasajeroApellido}-${pasaje.codigo}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error al generar PDF del pasaje:", error);
    return NextResponse.json({ error: "Error interno al generar el PDF del pasaje" }, { status: 500 });
  }
}
