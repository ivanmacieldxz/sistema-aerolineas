import { NextResponse } from "next/server";
import { getAirports } from "@/modules/vuelos/service";

export async function GET() {
  try {
    const aeropuertos = await getAirports();
    return NextResponse.json({
      success: true,
      data: aeropuertos,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener aeropuertos";
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
