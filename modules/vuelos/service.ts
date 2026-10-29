import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroPasajeOcupaCupo } from "@/modules/pasajes/service";
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

export type FlightClassOccupancySummary = {
  capacidad: number;
  vendidos: number;
  disponibles: number;
  ocupacion: number;
};

export type FlightOccupancyReportRow = {
  vueloId: string;
  numeroVuelo: string;
  origenIata: string;
  destinoIata: string;
  origenCiudad: string;
  destinoCiudad: string;
  totalCapacidad: number;
  totalVendidos: number;
  totalDisponibles: number;
  ocupacionTotal: number;
  economy: FlightClassOccupancySummary;
  primera: FlightClassOccupancySummary;
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

async function contarPasajesActivosPorClase(vueloId: bigint, clase: "ECONOMY" | "PRIMERA") {
  return prisma.pasaje.count({
    where: {
      clase,
      estado: { in: ["EMITIDO", "CHECK_IN"] },
      instanciaVuelo: {
        vueloId,
        deleted: false,
      },
      ...filtroPasajeOcupaCupo(),
    },
  });
}

export async function updateFlightById(vueloId: bigint, data: FlightFormValues) {
  const vueloActual = await prisma.vuelo.findFirst({
    where: { id: vueloId, deleted: false },
    include: { diasSemana: true },
  });

  if (!vueloActual) {
    throw new Error("El vuelo indicado no existe o fue dado de baja.");
  }

  const vueloConMismoNumero = await prisma.vuelo.findUnique({
    where: { numeroVuelo: data.numeroVuelo },
  });

  if (vueloConMismoNumero && vueloConMismoNumero.id !== vueloId) {
    throw new Error(`Ya existe otro vuelo con el número "${data.numeroVuelo}".`);
  }

  const ocupadosEconomy = await contarPasajesActivosPorClase(vueloId, "ECONOMY");
  const ocupadosPrimera = await contarPasajesActivosPorClase(vueloId, "PRIMERA");

  if (data.capacidadEconomy < ocupadosEconomy) {
    throw new Error(
      `La capacidad de Economy no puede quedar por debajo de los pasajes ya vendidos (${ocupadosEconomy}).`
    );
  }

  if (data.capacidadPrimera < ocupadosPrimera) {
    throw new Error(
      `La capacidad de Primera no puede quedar por debajo de los pasajes ya vendidos (${ocupadosPrimera}).`
    );
  }

  const horaSalidaDate = parseTimeStringToDate(data.horaSalida);
  const horaLlegadaDate = parseTimeStringToDate(data.horaLlegada);
  const fechasDeseadas = generarFechasPorDias(
    data.vigenciaDesde,
    data.vigenciaHasta,
    data.diasSemana
  );
  const fechasDeseadasKey = new Set(
    fechasDeseadas.map((fecha) => new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())).toISOString())
  );

  return prisma.$transaction(async (tx) => {
    const instanciasExistentes = await tx.instanciaVuelo.findMany({
      where: { vueloId },
      select: { id: true, fechaSalida: true, estado: true, deleted: true },
    });

    const instanciasEliminadas = instanciasExistentes.filter((instancia) => instancia.deleted);

    const instanciasExistentesKey = new Set(
      instanciasExistentes.map((instancia) =>
        new Date(Date.UTC(
          instancia.fechaSalida.getUTCFullYear(),
          instancia.fechaSalida.getUTCMonth(),
          instancia.fechaSalida.getUTCDate()
        )).toISOString()
      )
    );

    const nuevasFechas = fechasDeseadas.filter(
      (fecha) => !instanciasExistentesKey.has(new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())).toISOString())
    );

    const fechasAEliminar = instanciasExistentes.filter((instancia) => {
      if (instancia.deleted) return false;
      return !fechasDeseadasKey.has(new Date(Date.UTC(
        instancia.fechaSalida.getUTCFullYear(),
        instancia.fechaSalida.getUTCMonth(),
        instancia.fechaSalida.getUTCDate()
      )).toISOString());
    });

    const fechasReactivadas = instanciasEliminadas.filter((instancia) =>
      fechasDeseadasKey.has(new Date(Date.UTC(
        instancia.fechaSalida.getUTCFullYear(),
        instancia.fechaSalida.getUTCMonth(),
        instancia.fechaSalida.getUTCDate()
      )).toISOString())
    );

    await tx.vueloDiaSemana.deleteMany({
      where: { vueloId },
    });

    const vueloActualizado = await tx.vuelo.update({
      where: { id: vueloId },
      data: {
        numeroVuelo: data.numeroVuelo,
        horaSalida: horaSalidaDate,
        horaLlegada: horaLlegadaDate,
        vigenciaDesde: data.vigenciaDesde,
        vigenciaHasta: data.vigenciaHasta,
        capacidadEconomy: data.capacidadEconomy,
        capacidadPrimera: data.capacidadPrimera,
        precioEconomy: data.precioEconomy,
        precioPrimera: data.precioPrimera,
        activo: true,
        diasSemana: {
          create: data.diasSemana.map((dia) => ({ diaSemana: dia })),
        },
      },
    });

    if (fechasReactivadas.length > 0) {
      await Promise.all(
        fechasReactivadas.map((instancia) =>
          tx.instanciaVuelo.update({
            where: { id: instancia.id },
            data: {
              deleted: false,
              estado: instancia.estado === "CANCELADO" ? "PROGRAMADO" : instancia.estado,
            },
          })
        )
      );
    }

    if (nuevasFechas.length > 0) {
      await tx.instanciaVuelo.createMany({
        data: nuevasFechas.map((fecha) => ({
          vueloId,
          fechaSalida: fecha,
          estado: "PROGRAMADO",
          deleted: false,
        })),
        skipDuplicates: true,
      });
    }

    for (const instancia of fechasAEliminar) {
      if (instancia.estado === "CANCELADO" || instancia.deleted) {
        continue;
      }

      const tienePasajesActivos = await tx.pasaje.count({
        where: {
          instanciaVueloId: instancia.id,
          estado: { in: ["EMITIDO", "CHECK_IN"] },
        },
      });

      if (tienePasajesActivos > 0) {
        await tx.instanciaVuelo.update({
          where: { id: instancia.id },
          data: { estado: "CANCELADO", deleted: false },
        });
      } else {
        await tx.instanciaVuelo.update({
          where: { id: instancia.id },
          data: { deleted: true },
        });
      }
    }

    return vueloActualizado;
  });
}

/** Instancia de vuelo con su vuelo, aeropuertos y pasajes que ocupan cupo. */
type InstanciaVueloConPasajes = Prisma.InstanciaVueloGetPayload<{
  include: {
    vuelo: { include: { origen: true; destino: true } };
    pasajes: { select: { clase: true } };
  };
}>;

/** Ficha de una salida concreta, usada por la búsqueda y por el checkout. */
export type InstanciaVueloDetalle = FlightInstanceSearchResult;

/**
 * Proyecta una `InstanciaVuelo` al resultado de búsqueda/detalle, aplicando el
 * mismo cálculo de plazas disponibles por clase (regla única de negocio).
 */
function mapearInstanciaVuelo(
  instancia: InstanciaVueloConPasajes
): FlightInstanceSearchResult {
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
    fechaSalida: instancia.fechaSalida.toISOString().slice(0, 10),
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
}

/**
 * Realiza la búsqueda de vuelos sobre la tabla `InstanciaVuelo`.
 * Calcula las plazas disponibles reales en base a los pasajes que ocupan cupo
 * (activos y no expirados por el TTL de reserva).
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
        where: filtroPasajeOcupaCupo(),
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

  return instancias.map(mapearInstanciaVuelo);
}

/**
 * Obtiene la ficha de una salida concreta por su id para alimentar el checkout.
 *
 * Devuelve `null` si el identificador no es numérico, la instancia no existe o
 * fue dada de baja, la salida está cancelada o el vuelo está inactivo.
 */
export async function getInstanciaVueloDetalle(
  instanciaId: string
): Promise<InstanciaVueloDetalle | null> {
  if (!/^\d+$/.test(instanciaId)) {
    return null;
  }

  const instancia = await prisma.instanciaVuelo.findFirst({
    where: {
      id: BigInt(instanciaId),
      deleted: false,
      estado: { not: "CANCELADO" },
      vuelo: { activo: true, deleted: false },
    },
    include: {
      vuelo: { include: { origen: true, destino: true } },
      pasajes: { where: filtroPasajeOcupaCupo(), select: { clase: true } },
    },
  });

  return instancia ? mapearInstanciaVuelo(instancia) : null;
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

export type PassengerLookupFlightInstance = {
  id: string;
  fechaSalida: string;
  estado: string;
  pasajeros: Array<{
    codigo: string;
    nombre: string;
    apellido: string;
    documento: string;
    clase: string;
    asiento: string | null;
    estado: string;
  }>;
};

export type PassengerLookupFlight = {
  id: string;
  numeroVuelo: string;
  origenIata: string;
  destinoIata: string;
  origenCiudad: string;
  destinoCiudad: string;
  horaSalida: Date;
  horaLlegada: Date;
  instancias: PassengerLookupFlightInstance[];
};

export async function searchFlightsForPassengerLookup(params: {
  numeroVuelo?: string;
  origen?: string;
  destino?: string;
  fecha?: string;
}): Promise<PassengerLookupFlight[]> {
  const numeroVuelo = params.numeroVuelo?.trim();
  const origen = params.origen?.trim().toUpperCase();
  const destino = params.destino?.trim().toUpperCase();
  const fecha = params.fecha ? new Date(`${params.fecha}T00:00:00.000Z`) : undefined;
  const vueloId = numeroVuelo && /^\d+$/.test(numeroVuelo) ? BigInt(numeroVuelo) : undefined;

  const flights = await prisma.vuelo.findMany({
    where: {
      deleted: false,
      activo: true,
      ...(vueloId ? { id: vueloId } : numeroVuelo ? { numeroVuelo: { contains: numeroVuelo, mode: "insensitive" } } : {}),
      ...(origen ? { origenIata: origen } : {}),
      ...(destino ? { destinoIata: destino } : {}),
    },
    include: {
      origen: true,
      destino: true,
      instancias: {
        where: {
          deleted: false,
          ...(fecha ? { fechaSalida: fecha } : {}),
        },
        orderBy: { fechaSalida: "asc" },
        include: {
          pasajes: {
            where: {
              estado: { in: ["EMITIDO", "CHECK_IN"] },
            },
            orderBy: [{ pasajeroApellido: "asc" }, { pasajeroNombre: "asc" }],
            select: {
              codigo: true,
              clase: true,
              pasajeroNombre: true,
              pasajeroApellido: true,
              pasajeroDocumento: true,
              numeroAsiento: true,
              estado: true,
            },
          },
        },
      },
    },
    orderBy: { numeroVuelo: "asc" },
  });

  return flights.flatMap((vuelo) => {
    const instancias = vuelo.instancias.map((instancia) => ({
      id: instancia.id.toString(),
      fechaSalida: instancia.fechaSalida.toISOString().slice(0, 10),
      estado: instancia.estado,
      pasajeros: instancia.pasajes.map((pasaje) => ({
        codigo: pasaje.codigo.toString(),
        nombre: pasaje.pasajeroNombre,
        apellido: pasaje.pasajeroApellido,
        documento: pasaje.pasajeroDocumento,
        clase: pasaje.clase,
        asiento: pasaje.numeroAsiento,
        estado: pasaje.estado,
      })),
    }));

    return instancias.length > 0 || fecha
      ? [{
          id: vuelo.id.toString(),
          numeroVuelo: vuelo.numeroVuelo,
          origenIata: vuelo.origenIata,
          destinoIata: vuelo.destinoIata,
          origenCiudad: vuelo.origen.ciudad,
          destinoCiudad: vuelo.destino.ciudad,
          horaSalida: vuelo.horaSalida,
          horaLlegada: vuelo.horaLlegada,
          instancias,
        }]
      : [];
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

export async function getFlightOccupancyReport(filters?: {
  desde?: Date;
  hasta?: Date;
}): Promise<FlightOccupancyReportRow[]> {
  const rangeFrom = filters?.desde
    ? new Date(filters.desde)
    : new Date(Date.now());
  const rangeTo = filters?.hasta
    ? new Date(filters.hasta)
    : new Date(rangeFrom);

  const start = new Date(Date.UTC(rangeFrom.getUTCFullYear(), rangeFrom.getUTCMonth(), rangeFrom.getUTCDate()));
  const end = new Date(Date.UTC(rangeTo.getUTCFullYear(), rangeTo.getUTCMonth(), rangeTo.getUTCDate(), 23, 59, 59, 999));

  const instances = await prisma.instanciaVuelo.findMany({
    where: {
      deleted: false,
      estado: { not: "CANCELADO" },
      fechaSalida: {
        gte: start,
        lte: end,
      },
      vuelo: {
        activo: true,
        deleted: false,
      },
    },
    include: {
      vuelo: {
        select: {
          id: true,
          numeroVuelo: true,
          origenIata: true,
          destinoIata: true,
          capacidadEconomy: true,
          capacidadPrimera: true,
          origen: { select: { ciudad: true } },
          destino: { select: { ciudad: true } },
        },
      },
      pasajes: {
        where: {
          estado: { in: ["EMITIDO", "CHECK_IN"] },
        },
        select: { clase: true },
      },
    },
    orderBy: {
      vuelo: {
        numeroVuelo: "asc",
      },
    },
  });

  const reportByFlight = new Map<string, FlightOccupancyReportRow>();

  for (const instance of instances) {
    const vueloId = instance.vuelo.id.toString();
    const current = reportByFlight.get(vueloId) ?? {
      vueloId,
      numeroVuelo: instance.vuelo.numeroVuelo,
      origenIata: instance.vuelo.origenIata,
      destinoIata: instance.vuelo.destinoIata,
      origenCiudad: instance.vuelo.origen.ciudad,
      destinoCiudad: instance.vuelo.destino.ciudad,
      totalCapacidad: 0,
      totalVendidos: 0,
      totalDisponibles: 0,
      ocupacionTotal: 0,
      economy: { capacidad: 0, vendidos: 0, disponibles: 0, ocupacion: 0 },
      primera: { capacidad: 0, vendidos: 0, disponibles: 0, ocupacion: 0 },
    };

    const economyCapacity = Number(instance.vuelo.capacidadEconomy ?? 0);
    const primeraCapacity = Number(instance.vuelo.capacidadPrimera ?? 0);
    const economySold = instance.pasajes.filter((pasaje) => pasaje.clase === "ECONOMY").length;
    const primeraSold = instance.pasajes.filter((pasaje) => pasaje.clase === "PRIMERA").length;

    current.economy.capacidad += economyCapacity;
    current.economy.vendidos += economySold;
    current.economy.disponibles += Math.max(0, economyCapacity - economySold);

    current.primera.capacidad += primeraCapacity;
    current.primera.vendidos += primeraSold;
    current.primera.disponibles += Math.max(0, primeraCapacity - primeraSold);

    current.totalCapacidad += economyCapacity + primeraCapacity;
    current.totalVendidos += economySold + primeraSold;
    current.totalDisponibles += Math.max(0, economyCapacity - economySold) + Math.max(0, primeraCapacity - primeraSold);

    reportByFlight.set(vueloId, current);
  }

  return Array.from(reportByFlight.values())
    .map((entry) => {
      const economyOcupacion = entry.economy.capacidad > 0
        ? (entry.economy.vendidos / entry.economy.capacidad) * 100
        : 0;
      const primeraOcupacion = entry.primera.capacidad > 0
        ? (entry.primera.vendidos / entry.primera.capacidad) * 100
        : 0;
      const ocupacionTotal = entry.totalCapacidad > 0
        ? (entry.totalVendidos / entry.totalCapacidad) * 100
        : 0;

      return {
        ...entry,
        ocupacionTotal,
        economy: {
          ...entry.economy,
          ocupacion: economyOcupacion,
        },
        primera: {
          ...entry.primera,
          ocupacion: primeraOcupacion,
        },
      };
    })
    .sort((a, b) => a.numeroVuelo.localeCompare(b.numeroVuelo));
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
