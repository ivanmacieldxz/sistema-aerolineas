import { prisma } from "@/lib/prisma";
import { getPaymentClient } from "./client";
import { procesarNotificacionPago } from "./service";

const INTERVALO_MS = Number(
  process.env.PAYMENT_RECONCILIATION_INTERVAL_MS ?? 30_000
);
const VENTANA_MS = 2 * 60 * 60 * 1000;
const TAMANO_LOTE = 20;

let iniciado = false;
let ejecutando = false;

/**
 * Concilia compras pendientes o rechazadas consultando Mercado Pago por
 * `external_reference`. Cubre el caso local donde el webhook no puede alcanzar
 * `localhost` y el comprador no vuelve al sitio: si el pago fue aprobado, se
 * confirma la transacción y se envían los comprobantes.
 */
export async function conciliarPagosPendientes(): Promise<void> {
  if (ejecutando) {
    return;
  }

  ejecutando = true;

  try {
    const transacciones = await prisma.transaccionCompra.findMany({
      where: {
        deleted: false,
        estado: { in: ["PENDIENTE", "RECHAZADA"] },
        fechaCreacion: { gte: new Date(Date.now() - VENTANA_MS) },
      },
      select: {
        id: true,
        pago: { select: { estado: true } },
      },
      orderBy: { fechaCreacion: "asc" },
      take: TAMANO_LOTE,
    });

    for (const transaccion of transacciones) {
      if (transaccion.pago?.estado === "APROBADO") {
        continue;
      }

      try {
        const busqueda = await getPaymentClient().search({
          options: {
            external_reference: transaccion.id.toString(),
            sort: "date_created",
            criteria: "desc",
            limit: 1,
          },
        });

        const pago = busqueda.results?.[0];

        if (!pago?.id || pago.status !== "approved") {
          continue;
        }

        await procesarNotificacionPago({
          type: "payment",
          data: { id: pago.id },
        });
      } catch (error) {
        console.warn(
          `[Conciliación] No se pudo conciliar la transacción #${transaccion.id.toString()}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      "[Conciliación] Error al buscar transacciones pendientes:",
      error
    );
  } finally {
    ejecutando = false;
  }
}

/** Arranca el ciclo de conciliación una sola vez por proceso. */
export function iniciarConciliacionPagos(): void {
  if (iniciado) {
    return;
  }

  iniciado = true;

  if (process.env.PAYMENT_RECONCILIATION_DISABLED === "true") {
    return;
  }

  void conciliarPagosPendientes();

  const timer = setInterval(() => {
    void conciliarPagosPendientes();
  }, INTERVALO_MS);

  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref();
  }
}
