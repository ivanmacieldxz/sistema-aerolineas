import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TransaccionPasajesInput } from "@/modules/pagos/schemas";
import { PasajeError } from "./errors";

/** Regla de negocio: entre 1 y 9 pasajes por transacción de compra. */
const MIN_PASAJES = 1;
const MAX_PASAJES = 9;

/**
 * Tiempo de vida de un *hold* de cupo (transacción `PENDIENTE` sin pagar).
 * Pasado este lapso, la reserva se considera abandonada y deja de retener
 * capacidad.
 */
export const HOLD_TTL_MINUTOS = 15;

/** Cantidad de reintentos ante conflictos de serialización de Prisma (`P2034`). */
const MAX_INTENTOS_CONCURRENCIA = 3;

/** Instante de corte: todo *hold* creado antes de él se considera expirado. */
export function fechaCorteHold(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - HOLD_TTL_MINUTOS * 60_000);
}

/**
 * Condición Prisma que identifica un `Pasaje` que ocupa cupo real: está activo
 * (`EMITIDO`/`CHECK_IN`) y no pertenece a una transacción `PENDIENTE` cuyo
 * `fechaCreacion` supere el TTL de reserva (compra abandonada) y que además no
 * tenga un pago aprobado. Un hold con pago aprobado nunca debe liberar cupo,
 * porque la compra ya está pagada aunque el webhook todavía no la confirme.
 */
export function filtroPasajeOcupaCupo(
  corte: Date = fechaCorteHold()
): Prisma.PasajeWhereInput {
  return {
    estado: { in: ["EMITIDO", "CHECK_IN"] },
    NOT: {
      transaccion: {
        estado: "PENDIENTE",
        fechaCreacion: { lt: corte },
        OR: [
          { pago: { is: null } },
          { pago: { is: { estado: { not: "APROBADO" } } } },
        ],
      },
    },
  };
}

export type CrearTransaccionInput = TransaccionPasajesInput & {
  /** Usuario autenticado que compra, o `null` si opera como invitado. */
  usuarioId: bigint | null;
};

export type TransaccionConPasajes = Prisma.TransaccionCompraGetPayload<{
  include: { pasajes: true };
}>;

/** Contexto interno ya validado de una reserva. */
type CrearTransaccionContexto = {
  cantidad: number;
  instanciaVueloId: bigint;
  clase: TransaccionPasajesInput["clase"];
  input: CrearTransaccionInput;
};

/** Identifica un conflicto de escritura/serialización de Prisma. */
function esConflictoDeSerializacion(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/**
 * Reintenta una operación ante conflictos de serialización (`P2034`, dos
 * compras simultáneas por el mismo cupo). Si se agotan los intentos, degrada a
 * `SIN_CUPO` (HTTP 409) en lugar de propagar un `500` genérico.
 *
 * @throws {PasajeError} `SIN_CUPO` cuando el conflicto persiste.
 */
async function conReintentoDeSerializacion<T>(
  operacion: () => Promise<T>
): Promise<T> {
  for (let intento = 1; intento <= MAX_INTENTOS_CONCURRENCIA; intento++) {
    try {
      return await operacion();
    } catch (error) {
      if (!esConflictoDeSerializacion(error)) {
        throw error;
      }

      if (intento === MAX_INTENTOS_CONCURRENCIA) {
        console.warn(
          `Conflicto de serialización (P2034) persistente tras ${MAX_INTENTOS_CONCURRENCIA} intentos:`,
          error
        );
        throw new PasajeError(
          "SIN_CUPO",
          "El último lugar acaba de venderse. Probá con otra clase o salida."
        );
      }

      // Backoff corto (~50/100 ms) para dejar terminar a la transacción rival.
      await new Promise((resolver) => setTimeout(resolver, 50 * intento));
    }
  }

  throw new PasajeError(
    "SIN_CUPO",
    "El último lugar acaba de venderse. Probá con otra clase o salida."
  );
}

/**
 * Cuerpo de la reserva, ejecutado dentro de una transacción `Serializable`.
 *
 * Antes de validar cupo libera los *holds* de compras abandonadas (barrido
 * *lazy*) y luego cuenta únicamente los pasajes que ocupan cupo real.
 */
async function intentarCrearTransaccion(
  tx: Prisma.TransactionClient,
  contexto: CrearTransaccionContexto
): Promise<TransaccionConPasajes> {
  const { cantidad, instanciaVueloId, clase, input } = contexto;
  const corte = fechaCorteHold();

  // Barrido *lazy* de reservas abandonadas. El orden importa: primero los
  // pasajes (su filtro depende de que la transacción siga `PENDIENTE`) y luego
  // las transacciones, para no dejar cabeceras `PENDIENTE` sin pasajes activos.
  await tx.pasaje.updateMany({
    where: {
      estado: { in: ["EMITIDO", "CHECK_IN"] },
      transaccion: {
        estado: "PENDIENTE",
        fechaCreacion: { lt: corte },
        OR: [
          { pago: { is: null } },
          { pago: { is: { estado: { not: "APROBADO" } } } },
        ],
      },
    },
    data: { estado: "CANCELADO" },
  });

  // Nunca expirar un hold cuyo pago ya fue aprobado: el dinero está cobrado y
  // la transacción debe poder confirmarse aunque el webhook llegue tarde.
  await tx.transaccionCompra.updateMany({
    where: {
      estado: "PENDIENTE",
      fechaCreacion: { lt: corte },
      OR: [
        { pago: { is: null } },
        { pago: { is: { estado: { not: "APROBADO" } } } },
      ],
    },
    data: { estado: "RECHAZADA" },
  });

  const instancia = await tx.instanciaVuelo.findFirst({
    where: { id: instanciaVueloId, deleted: false },
    include: { vuelo: true },
  });

  if (!instancia) {
    throw new PasajeError(
      "INSTANCIA_NO_ENCONTRADA",
      "La instancia de vuelo indicada no existe o fue dada de baja."
    );
  }

  if (instancia.vuelo.deleted || !instancia.vuelo.activo) {
    throw new PasajeError(
      "VUELO_NO_DISPONIBLE",
      "El vuelo seleccionado no está disponible para la venta."
    );
  }

  if (instancia.estado === "CANCELADO") {
    throw new PasajeError(
      "INSTANCIA_CANCELADA",
      "La salida seleccionada fue cancelada."
    );
  }

  const capacidad =
    clase === "ECONOMY"
      ? instancia.vuelo.capacidadEconomy
      : instancia.vuelo.capacidadPrimera;

  const precio =
    clase === "ECONOMY"
      ? instancia.vuelo.precioEconomy
      : instancia.vuelo.precioPrimera;

  const pasajesActivos = await tx.pasaje.count({
    where: {
      instanciaVueloId,
      clase,
      ...filtroPasajeOcupaCupo(corte),
    },
  });

  if (capacidad - pasajesActivos < cantidad) {
    throw new PasajeError(
      "SIN_CUPO",
      `No hay suficiente cupo disponible en clase ${clase}.`
    );
  }

  const total = precio.mul(cantidad);

  return tx.transaccionCompra.create({
    data: {
      usuarioId: input.usuarioId,
      emailContacto: input.emailContacto,
      estado: "PENDIENTE",
      total,
      pasajes: {
        create: input.pasajeros.map((pasajero) => ({
          instanciaVueloId,
          clase,
          pasajeroNombre: pasajero.nombre,
          pasajeroApellido: pasajero.apellido,
          pasajeroDocumento: pasajero.documento,
          numeroAsiento: pasajero.numeroAsiento ?? null,
          estado: "EMITIDO",
        })),
      },
    },
    include: { pasajes: true },
  });
}

/**
 * Crea una orden de compra (`TransaccionCompra`) en estado `PENDIENTE` junto a
 * sus `Pasaje` en estado `EMITIDO` (que actúan como *hold* de cupo) dentro de
 * una transacción atómica `Serializable`.
 *
 * Verifica el cupo disponible por clase contra los pasajes que ocupan cupo real
 * (`EMITIDO`/`CHECK_IN` no expirados) para evitar la sobreventa. Ante
 * conflictos de serialización reintenta y, si persisten, responde `SIN_CUPO`.
 *
 * @throws {PasajeError} `PASAJEROS_INVALIDOS`, `INSTANCIA_NO_ENCONTRADA`,
 * `VUELO_NO_DISPONIBLE`, `INSTANCIA_CANCELADA` o `SIN_CUPO`.
 */
export async function crearTransaccionConPasajes(
  input: CrearTransaccionInput
): Promise<TransaccionConPasajes> {
  const cantidad = input.pasajeros.length;

  if (cantidad < MIN_PASAJES || cantidad > MAX_PASAJES) {
    throw new PasajeError(
      "PASAJEROS_INVALIDOS",
      `La compra debe contener entre ${MIN_PASAJES} y ${MAX_PASAJES} pasajes.`
    );
  }

  const contexto: CrearTransaccionContexto = {
    cantidad,
    instanciaVueloId: BigInt(input.instanciaVueloId),
    clase: input.clase,
    input,
  };

  return conReintentoDeSerializacion(() =>
    prisma.$transaction(
      (tx) => intentarCrearTransaccion(tx, contexto),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

/**
 * Compensación de una reserva fallida: marca los pasajes activos como
 * `CANCELADO` y la transacción como `RECHAZADA`.
 *
 * Es idempotente y seguro: si la transacción ya no está `PENDIENTE` (p. ej.
 * `CONFIRMADA`), no se modifica nada para no revertir una compra pagada.
 *
 * @throws {PasajeError} `TRANSACCION_NO_ENCONTRADA`.
 */
export async function cancelarTransaccionPendiente(
  transaccionId: bigint | string
): Promise<void> {
  const id =
    typeof transaccionId === "string" ? BigInt(transaccionId) : transaccionId;

  await prisma.$transaction(async (tx) => {
    const transaccion = await tx.transaccionCompra.findFirst({
      where: { id, deleted: false },
      select: { id: true, estado: true },
    });

    if (!transaccion) {
      throw new PasajeError(
        "TRANSACCION_NO_ENCONTRADA",
        "La transacción indicada no existe o fue dada de baja."
      );
    }

    // Idempotente: no revertir una compra ya confirmada o finalizada.
    if (transaccion.estado !== "PENDIENTE") {
      return;
    }

    await tx.pasaje.updateMany({
      where: {
        transaccionId: id,
        estado: { in: ["EMITIDO", "CHECK_IN"] },
      },
      data: { estado: "CANCELADO" },
    });

    await tx.transaccionCompra.update({
      where: { id },
      data: { estado: "RECHAZADA" },
    });
  });
}

export type ResultadoReactivacionPasajes =
  | { ok: true }
  | { ok: false; motivo: string };

/**
 * Reactiva los pasajes `CANCELADO` de una transacción cuyo pago fue aprobado
 * después de que la reserva expirara por TTL (o tras un rechazo previo).
 *
 * Antes de reactivar valida que el cupo siga disponible, para no superar la
 * capacidad configurada del vuelo. Debe ejecutarse dentro de la misma
 * transacción atómica que confirma el pago.
 *
 * @returns `ok: false` si el vuelo ya no está disponible o no hay cupo: en ese
 *   caso la compra requiere intervención manual (p. ej. reembolso).
 */
export async function reactivarPasajesDeTransaccion(
  tx: Prisma.TransactionClient,
  transaccionId: bigint,
  corte: Date = fechaCorteHold()
): Promise<ResultadoReactivacionPasajes> {
  const cancelados = await tx.pasaje.findMany({
    where: { transaccionId, estado: "CANCELADO" },
    select: { instanciaVueloId: true, clase: true },
  });

  if (cancelados.length === 0) {
    return { ok: true };
  }

  const grupos = new Map<
    string,
    { instanciaVueloId: bigint; clase: string; cantidad: number }
  >();

  for (const pasaje of cancelados) {
    const clave = `${pasaje.instanciaVueloId.toString()}:${pasaje.clase}`;
    const grupo = grupos.get(clave);

    if (grupo) {
      grupo.cantidad += 1;
    } else {
      grupos.set(clave, {
        instanciaVueloId: pasaje.instanciaVueloId,
        clase: pasaje.clase,
        cantidad: 1,
      });
    }
  }

  for (const grupo of grupos.values()) {
    const instancia = await tx.instanciaVuelo.findFirst({
      where: { id: grupo.instanciaVueloId, deleted: false },
      include: { vuelo: true },
    });

    if (
      !instancia ||
      instancia.vuelo.deleted ||
      !instancia.vuelo.activo ||
      instancia.estado === "CANCELADO"
    ) {
      return {
        ok: false,
        motivo: "El vuelo de la reserva ya no está disponible para la venta.",
      };
    }

    const capacidad =
      grupo.clase === "ECONOMY"
        ? instancia.vuelo.capacidadEconomy
        : instancia.vuelo.capacidadPrimera;

    const pasajesOcupados = await tx.pasaje.count({
      where: {
        instanciaVueloId: grupo.instanciaVueloId,
        clase: grupo.clase,
        transaccionId: { not: transaccionId },
        ...filtroPasajeOcupaCupo(corte),
      },
    });

    if (capacidad - pasajesOcupados < grupo.cantidad) {
      return {
        ok: false,
        motivo: `Sin cupo en clase ${grupo.clase}: la reserva expiró y los asientos fueron reasignados.`,
      };
    }
  }

  await tx.pasaje.updateMany({
    where: { transaccionId, estado: "CANCELADO" },
    data: { estado: "EMITIDO" },
  });

  return { ok: true };
}
