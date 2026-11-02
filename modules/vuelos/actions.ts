"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/modules/usuarios/auth";
import { flightSchema, airportSchema, type FlightFormValues, type AirportFormValues } from "./schemas";
import {
  createFlightWithBatchInstances,
  createAirport,
  toggleFlightStatus,
  softDeleteFlight,
  cancelFlightInstance,
  FlightInstanceCancellationError,
  updateFlightById,
  type SalidaCanceladaInfo,
} from "./service";
import {
  notificarCancelacionSalida,
  notificarCambioHorarioVuelo,
} from "@/modules/notificaciones";
import { prisma } from "@/lib/prisma";

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

export async function updateFlightAction(
  vueloIdStr: string,
  data: FlightFormValues
): Promise<ActionResponse> {
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
    const vueloId = BigInt(vueloIdStr);
    const { cambioHorario, instanciasCanceladas } = await updateFlightById(vueloId, validationResult.data);

    // Disparar notificaciones por email de forma asíncrona (no bloqueante)
    if (cambioHorario && cambioHorario.instanciasAfectadas.length > 0) {
      notificarCambioHorarioVuelo(cambioHorario).catch((err) => {
        console.error("[updateFlightAction] Error notificando cambio de horario:", err);
      });
    }

    for (const cancelada of instanciasCanceladas) {
      if (cancelada.pasajerosAfectados.length > 0) {
        notificarCancelacionSalida(cancelada).catch((err) => {
          console.error("[updateFlightAction] Error notificando salida cancelada:", err);
        });
      }
    }

    revalidatePath("/admin/vuelos");
    revalidatePath("/vuelos");

    const avisos: string[] = [];
    if (cambioHorario && cambioHorario.instanciasAfectadas.length > 0) {
      avisos.push("se detectó cambio de horario con pasajeros afectados");
    }
    if (instanciasCanceladas.length > 0) {
      avisos.push(`${instanciasCanceladas.length} salida(s) cancelada(s)`);
    }

    const detalle = avisos.length > 0 ? ` (${avisos.join(", ")})` : "";

    return {
      success: true,
      message: `El vuelo se actualizó exitosamente.${detalle}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "No se pudo actualizar el vuelo.";
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
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    // Recolectar pasajeros afectados antes de dar de baja
    const vuelo = await prisma.vuelo.findFirst({
      where: { id: vueloId, deleted: false },
      include: { origen: true, destino: true },
    });

    const instanciasFuturas = await prisma.instanciaVuelo.findMany({
      where: {
        vueloId,
        fechaSalida: { gte: hoy },
        deleted: false,
      },
      include: {
        pasajes: {
          where: { estado: { in: ["EMITIDO", "CHECK_IN"] } },
          include: { transaccion: { select: { id: true, emailContacto: true } } },
        },
      },
    });

    console.log("[deleteFlightAction] instancias futuras con pasajes:", instanciasFuturas.map(i => ({id: i.id.toString(), pasajes: i.pasajes.length})));

    const salidasCanceladasInfo: SalidaCanceladaInfo[] = instanciasFuturas
      .filter((inst) => inst.pasajes.length > 0)
      .map((inst) => {
        const horaSalidaStr = vuelo ? new Date(vuelo.horaSalida).toISOString().slice(11, 16) : "";
        const horaLlegadaStr = vuelo ? new Date(vuelo.horaLlegada).toISOString().slice(11, 16) : "";
        return {
          instanciaId: inst.id.toString(),
          numeroVuelo: vuelo?.numeroVuelo ?? "",
          origen: vuelo
            ? { iata: vuelo.origen.iataCode, ciudad: vuelo.origen.ciudad, nombre: vuelo.origen.nombre }
            : { iata: "", ciudad: "", nombre: "" },
          destino: vuelo
            ? { iata: vuelo.destino.iataCode, ciudad: vuelo.destino.ciudad, nombre: vuelo.destino.nombre }
            : { iata: "", ciudad: "", nombre: "" },
          fechaSalida: inst.fechaSalida.toISOString().slice(0, 10),
          horaSalida: horaSalidaStr,
          horaLlegada: horaLlegadaStr,
          pasajerosAfectados: inst.pasajes.map((p) => ({
            pasajeCodigo: p.codigo.toString(),
            pasajeroNombre: p.pasajeroNombre,
            pasajeroApellido: p.pasajeroApellido,
            pasajeroDocumento: p.pasajeroDocumento,
            numeroAsiento: p.numeroAsiento,
            clase: p.clase,
            transaccionId: p.transaccion.id.toString(),
            emailContacto: p.transaccion.emailContacto,
          })),
        };
      });

    await softDeleteFlight(vueloId);

    // Enviar notificaciones
    for (const salidaInfo of salidasCanceladasInfo) {
      if (salidaInfo.pasajerosAfectados.length > 0) {
        try {
          console.log("[deleteFlightAction] enviando notificación para", salidaInfo.instanciaId, salidaInfo.pasajerosAfectados.length);
          const res = await notificarCancelacionSalida(salidaInfo);
          console.log("[deleteFlightAction] resultado:", res);
        } catch (err) {
          console.error("[deleteFlightAction] Error notificando cancelación:", err);
        }
      }
    }

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

export async function cancelFlightInstanceAction(instanciaIdStr: string): Promise<ActionResponse> {
  await requireRole("admin");

  if (!/^[1-9]\d*$/.test(instanciaIdStr)) {
    return {
      success: false,
      message: "La salida seleccionada no es válida.",
    };
  }

  try {
    const { canceledTickets, salidaInfo } = await cancelFlightInstance(BigInt(instanciaIdStr));
    console.log("[cancelFlightInstanceAction] salidaInfo:", JSON.stringify({
      instanciaId: salidaInfo.instanciaId,
      numeroVuelo: salidaInfo.numeroVuelo,
      pasajerosAfectados: salidaInfo.pasajerosAfectados.length,
      emails: salidaInfo.pasajerosAfectados.map(p => p.emailContacto)
    }));
 
    // Disparar notificaciones a pasajeros afectados
    if (salidaInfo.pasajerosAfectados.length > 0) {
      try {
        console.log("[cancelFlightInstanceAction] Llamando notificarCancelacionSalida...");
        const res = await notificarCancelacionSalida(salidaInfo);
        console.log("[cancelFlightInstanceAction] notificación resultado:", res);
      } catch (err) {
        console.error("[cancelFlightInstanceAction] Error notificando cancelación:", err);
      }
    } else {
      console.log("[cancelFlightInstanceAction] Sin pasajeros afectados, no se envían mails");
    }

    revalidatePath("/admin/vuelos");
    revalidatePath("/vuelos");

    return {
      success: true,
      message: `Salida cancelada. ${canceledTickets} ${canceledTickets === 1 ? "pasaje fue marcado" : "pasajes fueron marcados"} como cancelado${canceledTickets === 1 ? "" : "s"}.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof FlightInstanceCancellationError
          ? error.message
          : "No se pudo cancelar la salida. Intentá nuevamente.",
    };
  }
}
