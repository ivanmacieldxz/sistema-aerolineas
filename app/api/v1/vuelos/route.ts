import { NextRequest, NextResponse } from "next/server";
import { searchFlightInstances } from "@/modules/vuelos/service";
import { flightSearchSchema } from "@/modules/vuelos/schemas";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origen = searchParams.get("origen");
    const destino = searchParams.get("destino");
    const fecha = searchParams.get("fecha");

    if (!origen && !destino && !fecha) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "Especificá origen, destino y fecha para buscar salidas programadas.",
      });
    }

    const validationResult = flightSearchSchema.safeParse({
      origen,
      destino,
      fecha,
    });

    if (!validationResult.success) {
      const firstIssue = validationResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue?.message ?? "Parámetros de búsqueda inválidos.",
          },
        },
        { status: 400 }
      );
    }

    const instances = await searchFlightInstances(validationResult.data);

    return NextResponse.json({
      success: true,
      data: instances,
      count: instances.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al buscar vuelos";
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
