import { NextRequest, NextResponse } from "next/server";
import { getFlightById } from "@/modules/vuelos/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const flightId = BigInt(id);

    const flight = await getFlightById(flightId);

    if (!flight) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FLIGHT_NOT_FOUND",
            message: `No se encontró el vuelo con id ${id}`,
          },
        },
        { status: 404 }
      );
    }

    const sanitizedFlight = {
      id: flight.id.toString(),
      numeroVuelo: flight.numeroVuelo,
      origenIata: flight.origenIata,
      destinoIata: flight.destinoIata,
      origen: flight.origen,
      destino: flight.destino,
      horaSalida: flight.horaSalida,
      horaLlegada: flight.horaLlegada,
      vigenciaDesde: flight.vigenciaDesde,
      vigenciaHasta: flight.vigenciaHasta,
      capacidadEconomy: flight.capacidadEconomy,
      capacidadPrimera: flight.capacidadPrimera,
      precioEconomy: Number(flight.precioEconomy),
      precioPrimera: Number(flight.precioPrimera),
      activo: flight.activo,
      diasSemana: flight.diasSemana.map((d) => d.diaSemana),
      proximasInstancias: flight.instancias.map((inst) => ({
        id: inst.id.toString(),
        fechaSalida: inst.fechaSalida,
        estado: inst.estado,
      })),
    };

    return NextResponse.json({
      success: true,
      data: sanitizedFlight,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener el vuelo";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
