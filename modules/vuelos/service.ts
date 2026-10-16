import { prisma } from "@/lib/prisma";
import { parseTimeStringToDate, generarFechasPorDias } from "./utils";
import type { FlightFormValues, AirportFormValues } from "./schemas";

export type FlightInstanceSearchResult = {
  id: string;
  vueloId: string;
  numeroVuelo: string;
  fechaSalida: string;
  horaSalida: Date;
  horaLlegada: Date;
  origen: {
    iataCode: string;
    nombre: string;
    ciudad: string;
    provincia: string;
  };
  destino: {
    iataCode: string;
    nombre: string;
    ciudad: string;
    provincia: string;
  };
  capacidadEconomy: number;
  plazasDisponiblesEconomy: number;
  precioEconomy: number;
  capacidadPrimera: number;
  plazasDisponiblesPrimera: number;
  precioPrimera: number;
  estado: string;
};

export type AdminFlightInstance = {
  id: string;
  fechaSalida: string;
  estado: string;
  numeroVuelo: string;
  origenIata: string;
  destinoIata: string;
  origenCiudad: string;
  destinoCiudad: string;
  horaSalida: Date;
  horaLlegada: Date;
  pasajesActivos: number;
  cancelable: boolean;
};

export class FlightInstanceCancellationError extends Error {}

/**
 * Obtiene todos los aeropuertos registrados en el sistema ordenados por ciudad y código IATA.
 */
export async function getAirports() {
  return prisma.aeropuerto.findMany({
    select: {
      iataCode: true,
      nombre: true,
      ciudad: true,
      provincia: true,
    },
    orderBy: [{ ciudad: "asc" }, { iataCode: "asc" }],
  });
}

/**
 * Registra un nuevo aeropuerto real en la base de datos.
 */
export async function createAirport(data: AirportFormValues) {
  const existing = await prisma.aeropuerto.findUnique({
    where: { iataCode: data.iataCode },
  });

  if (existing) {
    throw new Error(`Ya existe un aeropuerto registrado con el código IATA "${data.iataCode}".`);
  }

  return prisma.aeropuerto.create({
    data: {
      iataCode: data.iataCode,
      nombre: data.nombre,
      ciudad: data.ciudad,
      provincia: data.provincia,
    },
  });
}

/**
 * Crea un vuelo y genera en lote todas sus instancias físicas (InstanciaVuelo)
 * para los días de operación dentro del período de vigencia configurado.
 */
export async function createFlightWithBatchInstances(data: FlightFormValues) {
  // 1. Validar que los aeropuertos existan realmente
  const [origen, destino] = await Promise.all([
    prisma.aeropuerto.findUnique({ where: { iataCode: data.origenIata } }),
    prisma.aeropuerto.findUnique({ where: { iataCode: data.destinoIata } }),
  ]);

  if (!origen) {
    throw new Error(`El aeropuerto de origen (${data.origenIata}) no está registrado.`);
  }

  if (!destino) {
    throw new Error(`El aeropuerto de destino (${data.destinoIata}) no está registrado.`);
  }

  // 2. Validar que el número de vuelo sea único
  const vueloExistente = await prisma.vuelo.findUnique({
    where: { numeroVuelo: data.numeroVuelo },
  });

  if (vueloExistente) {
    throw new Error(`Ya existe un vuelo con el número "${data.numeroVuelo}".`);
  }

  // 3. Generar las fechas para las instancias según vigencia y días de semana
  const fechasInstancias = generarFechasPorDias(
    data.vigenciaDesde,
    data.vigenciaHasta,
    data.diasSemana
  );

  const horaSalidaDate = parseTimeStringToDate(data.horaSalida);
  const horaLlegadaDate = parseTimeStringToDate(data.horaLlegada);

  // 4. Ejecutar la creación del vuelo, sus días y sus instancias en transacción atómica
  return prisma.$transaction(async (tx) => {
    const nuevoVuelo = await tx.vuelo.create({
      data: {
        numeroVuelo: data.numeroVuelo,
        origenIata: data.origenIata,
        destinoIata: data.destinoIata,
        horaSalida: horaSalidaDate,
        horaLlegada: horaLlegadaDate,
        vigenciaDesde: data.vigenciaDesde,
        vigenciaHasta: data.vigenciaHasta,
        capacidadEconomy: data.capacidadEconomy,
        capacidadPrimera: data.capacidadPrimera,
        precioEconomy: data.precioEconomy,
        precioPrimera: data.precioPrimera,
        diasSemana: {
          create: data.diasSemana.map((dia) => ({
            diaSemana: dia,
          })),
        },
      },
    });

    if (fechasInstancias.length > 0) {
      await tx.instanciaVuelo.createMany({
        data: fechasInstancias.map((fecha) => ({
          vueloId: nuevoVuelo.id,
          fechaSalida: fecha,
          estado: "PROGRAMADO",
          deleted: false,
        })),
      });
    }

    return {
      vuelo: nuevoVuelo,
      instanciasCreadas: fechasInstancias.length,
    };
  });
}

/**
 * Realiza la búsqueda de vuelos sobre la tabla `InstanciaVuelo`.
 * Calcula las plazas disponibles reales en base a los pasajes activos emitidos.
 */
export async function searchFlightInstances(params: {
  origen: string;
  destino: string;
  fecha: string;
}): Promise<FlightInstanceSearchResult[]> {
  const searchDate = new Date(`${params.fecha}T00:00:00.000Z`);

  const instancias = await prisma.instanciaVuelo.findMany({
    where: {
      deleted: false,
      fechaSalida: searchDate,
      estado: { not: "CANCELADO" },
      vuelo: {
        activo: true,
        deleted: false,
        origenIata: params.origen,
        destinoIata: params.destino,
      },
    },
    include: {
      vuelo: {
        include: {
          origen: true,
          destino: true,
        },
      },
      pasajes: {
        where: {
          estado: { in: ["EMITIDO", "CHECK_IN"] },
        },
        select: {
          clase: true,
        },
      },
    },
    orderBy: {
      vuelo: {
        horaSalida: "asc",
      },
    },
  });

  return instancias.map((instancia) => {
    const pasajesEconomy = instancia.pasajes.filter(
      (p) => p.clase.toUpperCase() === "ECONOMY"
    ).length;
    const pasajesPrimera = instancia.pasajes.filter(
      (p) => p.clase.toUpperCase() === "PRIMERA"
    ).length;

    const plazasDisponiblesEconomy = Math.max(
      0,
      instancia.vuelo.capacidadEconomy - pasajesEconomy
    );
    const plazasDisponiblesPrimera = Math.max(
      0,
      instancia.vuelo.capacidadPrimera - pasajesPrimera
    );

    return {
      id: instancia.id.toString(),
      vueloId: instancia.vueloId.toString(),
      numeroVuelo: instancia.vuelo.numeroVuelo,
      fechaSalida: params.fecha,
      horaSalida: instancia.vuelo.horaSalida,
      horaLlegada: instancia.vuelo.horaLlegada,
      origen: instancia.vuelo.origen,
      destino: instancia.vuelo.destino,
      capacidadEconomy: instancia.vuelo.capacidadEconomy,
      plazasDisponiblesEconomy,
      precioEconomy: Number(instancia.vuelo.precioEconomy),
      capacidadPrimera: instancia.vuelo.capacidadPrimera,
      plazasDisponiblesPrimera,
      precioPrimera: Number(instancia.vuelo.precioPrimera),
      estado: instancia.estado,
    };
  });
}

/**
 * Obtiene todos los vuelos configurados para el panel de administración.
 */
export async function getAllFlights() {
  const flights = await prisma.vuelo.findMany({
    where: { deleted: false },
    include: {
      origen: true,
      destino: true,
      diasSemana: { orderBy: { diaSemana: "asc" } },
      _count: {
        select: {
          instancias: { where: { deleted: false } },
        },
      },
    },
    orderBy: { numeroVuelo: "asc" },
  });

  return flights.map((flight) => ({
    ...flight,
    precioEconomy: Number(flight.precioEconomy),
    precioPrimera: Number(flight.precioPrimera),
  }));
}

/**
 * Obtiene el detalle de un vuelo por ID.
 */
export async function getFlightById(id: bigint) {
  return prisma.vuelo.findFirst({
    where: { id, deleted: false },
    include: {
      origen: true,
      destino: true,
      diasSemana: { orderBy: { diaSemana: "asc" } },
      instancias: {
        where: { deleted: false },
        orderBy: { fechaSalida: "asc" },
        take: 30,
      },
    },
  });
}

export async function getFlightInstancesByDate(fechaSalida: Date): Promise<AdminFlightInstance[]> {
  const instances = await prisma.instanciaVuelo.findMany({
    where: {
      fechaSalida,
      deleted: false,
      vuelo: { deleted: false },
    },
    include: {
      vuelo: {
        select: {
          numeroVuelo: true,
          origenIata: true,
          destinoIata: true,
          horaSalida: true,
          horaLlegada: true,
          origen: { select: { ciudad: true } },
          destino: { select: { ciudad: true } },
        },
      },
      _count: {
        select: {
          pasajes: {
            where: { estado: { in: ["EMITIDO", "CHECK_IN"] } },
          },
        },
      },
    },
    orderBy: { vuelo: { horaSalida: "asc" } },
  });

  const now = new Date();

  return instances.map((instance) => {
    const departureAt = new Date(instance.fechaSalida);
    departureAt.setUTCHours(
      instance.vuelo.horaSalida.getUTCHours(),
      instance.vuelo.horaSalida.getUTCMinutes(),
      instance.vuelo.horaSalida.getUTCSeconds(),
      0,
    );

    return {
      id: instance.id.toString(),
      fechaSalida: instance.fechaSalida.toISOString().slice(0, 10),
      estado: instance.estado,
      numeroVuelo: instance.vuelo.numeroVuelo,
      origenIata: instance.vuelo.origenIata,
      destinoIata: instance.vuelo.destinoIata,
      origenCiudad: instance.vuelo.origen.ciudad,
      destinoCiudad: instance.vuelo.destino.ciudad,
      horaSalida: instance.vuelo.horaSalida,
      horaLlegada: instance.vuelo.horaLlegada,
      pasajesActivos: instance._count.pasajes,
      cancelable:
        departureAt > now && ["PROGRAMADO", "DEMORADO"].includes(instance.estado),
    };
  });
}

export async function cancelFlightInstance(instanciaId: bigint): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const instance = await tx.instanciaVuelo.findFirst({
      where: {
        id: instanciaId,
        deleted: false,
        vuelo: { deleted: false },
      },
      select: {
        id: true,
        fechaSalida: true,
        estado: true,
        vuelo: { select: { horaSalida: true } },
      },
    });

    if (!instance) {
      throw new FlightInstanceCancellationError("No se encontró la salida seleccionada.");
    }

    if (!["PROGRAMADO", "DEMORADO"].includes(instance.estado)) {
      throw new FlightInstanceCancellationError(
        instance.estado === "CANCELADO"
          ? "Esta salida ya está cancelada."
          : "Solo se pueden cancelar salidas programadas o demoradas.",
      );
    }

    const departureAt = new Date(instance.fechaSalida);
    departureAt.setUTCHours(
      instance.vuelo.horaSalida.getUTCHours(),
      instance.vuelo.horaSalida.getUTCMinutes(),
      instance.vuelo.horaSalida.getUTCSeconds(),
      0,
    );

    if (departureAt <= new Date()) {
      throw new FlightInstanceCancellationError("No se pueden cancelar salidas que ya comenzaron.");
    }

    const updated = await tx.instanciaVuelo.updateMany({
      where: {
        id: instanciaId,
        deleted: false,
        estado: instance.estado,
      },
      data: { estado: "CANCELADO" },
    });

    if (updated.count !== 1) {
      throw new FlightInstanceCancellationError("La salida cambió de estado. Actualizá la página e intentá otra vez.");
    }

    const canceledTickets = await tx.pasaje.updateMany({
      where: {
        instanciaVueloId: instanciaId,
        estado: { in: ["EMITIDO", "CHECK_IN"] },
      },
      data: { estado: "CANCELADO" },
    });

    return canceledTickets.count;
  });
}

/**
 * Activa o desactiva un vuelo.
 * Regla de negocio para instancias:
 * - Instancias futuras sin pasajes: soft delete (deleted: true).
 * - Instancias futuras con pasajes emitidos: canceladas (estado: "CANCELADO").
 */
export async function toggleFlightStatus(vueloId: bigint, activo: boolean) {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);

  return prisma.$transaction(async (tx) => {
    const vuelo = await tx.vuelo.update({
      where: { id: vueloId },
      data: { activo },
    });

    if (!activo) {
      // Buscar instancias futuras de este vuelo
      const instanciasFuturas = await tx.instanciaVuelo.findMany({
        where: {
          vueloId,
          fechaSalida: { gte: hoy },
          deleted: false,
        },
        include: {
          pasajes: {
            where: {
              estado: { in: ["EMITIDO", "CHECK_IN"] },
            },
          },
        },
      });

      for (const inst of instanciasFuturas) {
        if (inst.pasajes.length === 0) {
          // Sin pasajes: soft delete
          await tx.instanciaVuelo.update({
            where: { id: inst.id },
            data: { deleted: true },
          });
        } else {
          // Con pasajes: marcar como cancelado para trazabilidad
          await tx.instanciaVuelo.update({
            where: { id: inst.id },
            data: { estado: "CANCELADO" },
          });
        }
      }
    } else {
      // Al reactivar el vuelo, reactivar las instancias que estaban en soft-delete
      await tx.instanciaVuelo.updateMany({
        where: {
          vueloId,
          fechaSalida: { gte: hoy },
          deleted: true,
        },
        data: { deleted: false },
      });
    }

    return vuelo;
  });
}

/**
 * Baja lógica de un vuelo troncal.
 */
export async function softDeleteFlight(vueloId: bigint) {
  // Primero desactivar y gestionar instancias
  await toggleFlightStatus(vueloId, false);

  // Marcar vuelo como deleted = true
  return prisma.vuelo.update({
    where: { id: vueloId },
    data: { deleted: true, activo: false },
  });
}
