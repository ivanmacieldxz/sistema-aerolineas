"use server";

import prisma from "@/lib/prisma";
import { flightSchema, FlightFormValues } from "@/lib/schemas/flight";
import { revalidatePath } from "next/cache";

type ActionResponse = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function createFlight(data: FlightFormValues): Promise<ActionResponse> {
  // 1. Validar los datos de entrada usando Zod
  const validationResult = flightSchema.safeParse(data);

  if (!validationResult.success) {
    const fieldErrors = validationResult.error.flatten().fieldErrors;
    const firstKey = Object.keys(fieldErrors)[0];
    const firstError = firstKey && fieldErrors[firstKey] ? fieldErrors[firstKey][0] : "Revisa los campos.";
    
    return {
      success: false,
      message: `Error de validación del servidor: ${firstError} (Campo: ${firstKey})`,
      errors: fieldErrors,
    };
  }

  const validData = validationResult.data;

  try {
    // 2. COMPORTAMIENTO DE PRUEBA: Si el aeropuerto origen no existe, lo autoconstruye.
    const originAirport = await prisma.aeropuerto.findUnique({
      where: { iataCode: validData.origenIata },
    });

    if (!originAirport) {
      await prisma.aeropuerto.create({
        data: {
          iataCode: validData.origenIata,
          nombre: `Aeropuerto de Prueba (${validData.origenIata})`,
          ciudad: "Ciudad Prueba",
          provincia: "Provincia Prueba",
        }
      });
    }

    // 3. COMPORTAMIENTO DE PRUEBA: Si el aeropuerto destino no existe, lo autoconstruye.
    const destinationAirport = await prisma.aeropuerto.findUnique({
      where: { iataCode: validData.destinoIata },
    });

    if (!destinationAirport) {
      await prisma.aeropuerto.create({
        data: {
          iataCode: validData.destinoIata,
          nombre: `Aeropuerto de Prueba (${validData.destinoIata})`,
          ciudad: "Ciudad Prueba",
          provincia: "Provincia Prueba",
        }
      });
    }

    // 4. Formatear la hora de salida y llegada para Prisma (@db.Time)
    const baseDateString = "1970-01-01T";
    const horaSalidaDate = new Date(`${baseDateString}${validData.horaSalida}:00.000Z`);
    const horaLlegadaDate = new Date(`${baseDateString}${validData.horaLlegada}:00.000Z`);

    // 5. Insertar el vuelo en la base de datos
    await prisma.vuelo.create({
      data: {
        numeroVuelo: validData.numeroVuelo,
        origenIata: validData.origenIata,
        destinoIata: validData.destinoIata,
        horaSalida: horaSalidaDate,
        horaLlegada: horaLlegadaDate,
        vigenciaDesde: validData.vigenciaDesde,
        vigenciaHasta: validData.vigenciaHasta,
        capacidadEconomy: validData.capacidadEconomy,
        capacidadPrimera: validData.capacidadPrimera,
        precioEconomy: validData.precioEconomy,
        precioPrimera: validData.precioPrimera,
        diasSemana: {
          create: validData.diasSemana.map((dia) => ({
            diaSemana: dia,
          })),
        },
      },
    });

    revalidatePath("/admin/vuelos");

    return {
      success: true,
      message: "El vuelo se creó exitosamente.",
    };
  } catch (error: any) {
    console.error("Error al crear vuelo:", error);

    if (error?.code === "P2002") {
      return {
        success: false,
        message: "Ya existe un vuelo con ese número de vuelo.",
      };
    }

    return {
      success: false,
      message: `Error inesperado: ${error?.message || "No se pudo crear el vuelo."}`,
    };
  }
}
