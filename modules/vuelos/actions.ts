"use server";

import { revalidatePath } from "next/cache";
import { flightSchema, airportSchema, type FlightFormValues, type AirportFormValues } from "./schemas";
import {
  createFlightWithBatchInstances,
  createAirport,
  toggleFlightStatus,
  softDeleteFlight,
} from "./service";

type ActionResponse = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function createFlight(data: FlightFormValues): Promise<ActionResponse> {
  const validationResult = flightSchema.safeParse(data);

  if (!validationResult.success) {
    const fieldErrors = validationResult.error.flatten().fieldErrors;
    const firstIssue = validationResult.error.issues[0];
    const firstKey = firstIssue?.path.join(".");
    const firstError = firstIssue?.message ?? "Revisa los campos.";

    return {
      success: false,
      message: `Error de validación: ${firstError} (Campo: ${firstKey})`,
      errors: fieldErrors,
    };
  }

  try {
    const result = await createFlightWithBatchInstances(validationResult.data);

    revalidatePath("/admin/vuelos");
    revalidatePath("/vuelos");

    return {
      success: true,
      message: `El vuelo se creó exitosamente con ${result.instanciasCreadas} salidas programadas.`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el vuelo.";
    return {
      success: false,
      message: errorMessage,
    };
  }
}

export async function createAirportAction(data: AirportFormValues): Promise<ActionResponse> {
  const validationResult = airportSchema.safeParse(data);

  if (!validationResult.success) {
    const fieldErrors = validationResult.error.flatten().fieldErrors;
    const firstIssue = validationResult.error.issues[0];
    const firstError = firstIssue?.message ?? "Datos inválidos.";

    return {
      success: false,
      message: `Error de validación: ${firstError}`,
      errors: fieldErrors,
    };
  }

  try {
    await createAirport(validationResult.data);

    revalidatePath("/admin/vuelos");
    revalidatePath("/vuelos");

    return {
      success: true,
      message: `Aeropuerto ${validationResult.data.iataCode} registrado exitosamente.`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "No se pudo registrar el aeropuerto.";
    return {
      success: false,
      message: errorMessage,
    };
  }
}

export async function toggleFlightStatusAction(vueloIdStr: string, activo: boolean): Promise<ActionResponse> {
  try {
    const vueloId = BigInt(vueloIdStr);
    await toggleFlightStatus(vueloId, activo);

    revalidatePath("/admin/vuelos");
    revalidatePath("/vuelos");

    return {
      success: true,
      message: `El vuelo fue ${activo ? "activado" : "desactivado"} exitosamente.`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error al cambiar el estado del vuelo.";
    return {
      success: false,
      message: errorMessage,
    };
  }
}

export async function deleteFlightAction(vueloIdStr: string): Promise<ActionResponse> {
  try {
    const vueloId = BigInt(vueloIdStr);
    await softDeleteFlight(vueloId);

    revalidatePath("/admin/vuelos");
    revalidatePath("/vuelos");

    return {
      success: true,
      message: "El vuelo fue dado de baja exitosamente.",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error al eliminar el vuelo.";
    return {
      success: false,
      message: errorMessage,
    };
  }
}
