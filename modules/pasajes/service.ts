import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TransaccionPasajesInput } from "@/modules/pagos/schemas";
import { PasajeError } from "./errors";

/** Regla de negocio: entre 1 y 9 pasajes por transacción de compra. */
const MIN_PASAJES = 1;
const MAX_PASAJES = 9;

export type CrearTransaccionInput = TransaccionPasajesInput & {
  /** Usuario autenticado que compra, o `null` si opera como invitado. */
  usuarioId: bigint | null;
};

export type TransaccionConPasajes = Prisma.TransaccionCompraGetPayload<{
  include: { pasajes: true };
}>;

/**
 * Crea una orden de compra (`TransaccionCompra`) en estado `PENDIENTE` junto a
 * sus `Pasaje` en estado `EMITIDO` (que actúan como *hold* de cupo) dentro de
 * una transacción atómica `Serializable`.
 *
 * Verifica el cupo disponible por clase contra los pasajes activos
 * (`EMITIDO`/`CHECK_IN`) de la instancia para evitar la sobreventa.
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

  const instanciaVueloId = BigInt(input.instanciaVueloId);
  const clase = input.clase;

  return prisma.$transaction(
    async (tx) => {
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
          estado: { in: ["EMITIDO", "CHECK_IN"] },
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
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
