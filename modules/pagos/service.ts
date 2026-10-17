import { prisma } from "@/lib/prisma";
import {
  crearTransaccionConPasajes,
  cancelarTransaccionPendiente,
} from "@/modules/pasajes/service";
import { getPaymentClient, getPreferenceClient } from "./client";
import { PagoError } from "./errors";
import type { PreferenciaRequest, WebhookPayload } from "./schemas";

/** Moneda con la que opera la pasarela para este sistema. */
const CURRENCY_ID = "ARS";

type EstadoPago = "APROBADO" | "RECHAZADO" | "PENDIENTE";

type Facturacion = {
  tipoFactura: "A" | "B" | "C";
  nombreRazonSocial: string;
  identificacionFiscal: string;
};

export type CrearPreferenciaInput = PreferenciaRequest & {
  /** Usuario autenticado que compra, o `null` si opera como invitado. */
  usuarioId: bigint | null;
};

export type CrearPreferenciaResult = {
  transaccionId: string;
  preferenceId: string;
  initPoint: string;
  total: number;
};

/** URL base de la aplicación, sin barra final. */
function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

/**
 * Mapea `payment_type_id` de Mercado Pago al dominio de `Pago.metodoPago`.
 * @see docs/integracion_mercadopago.md §4.7
 */
export function mapearMetodoPago(paymentTypeId?: string | null): string {
  switch (paymentTypeId) {
    case "credit_card":
      return "TARJETA_CREDITO";
    case "debit_card":
      return "TARJETA_DEBITO";
    case "bank_transfer":
      return "TRANSFERENCIA";
    default:
      return "OTRO";
  }
}

/** Mapea el estado de Mercado Pago al dominio de `Pago.estado`. */
function mapearEstadoPago(status?: string | null): EstadoPago {
  switch (status) {
    case "approved":
      return "APROBADO";
    case "rejected":
    case "cancelled":
      return "RECHAZADO";
    default:
      return "PENDIENTE";
  }
}

/** Número fiscal determinista y único (la factura es 1:1 con la transacción). */
function construirNumeroFactura(tipo: "A" | "B" | "C", transaccionId: bigint): string {
  return `FC-${tipo}-0001-${transaccionId.toString().padStart(8, "0")}`;
}

/**
 * Extrae los datos de facturación propagados vía `metadata` de la preferencia.
 * Si faltaran (p. ej. una preferencia creada fuera de este flujo), se usan
 * valores por defecto no vacíos para no bloquear la emisión.
 */
function extraerFacturacion(metadata: unknown, emailContacto: string): Facturacion {
  const datos =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : {};

  const tipo = datos.tipoFactura;
  const nombre = datos.nombreRazonSocial;
  const identificacion = datos.identificacionFiscal;

  return {
    tipoFactura: tipo === "A" || tipo === "B" || tipo === "C" ? tipo : "B",
    nombreRazonSocial:
      typeof nombre === "string" && nombre.trim().length > 0
        ? nombre
        : emailContacto,
    identificacionFiscal:
      typeof identificacion === "string" && identificacion.trim().length > 0
        ? identificacion
        : "CONSUMIDOR FINAL",
  };
}

/**
 * Compensación de la reserva ante un fallo de la pasarela: nunca debe enmascarar
 * el error original, por eso se traga y registra cualquier fallo de la baja.
 */
async function compensarReserva(transaccionId: bigint): Promise<void> {
  try {
    await cancelarTransaccionPendiente(transaccionId);
  } catch (error) {
    console.error(
      `No se pudo compensar la reserva de la transacción ${transaccionId.toString()}:`,
      error
    );
  }
}

/**
 * Crea la orden de compra (reserva de pasajes) y la preferencia de Checkout Pro
 * en Mercado Pago. Si la pasarela falla, compensa la reserva y lanza
 * `PAYMENT_GATEWAY_UNAVAILABLE` (la transacción nunca queda `CONFIRMADA`).
 *
 * @throws {PasajeError} errores de cupo/disponibilidad de `modules/pasajes`.
 * @throws {PagoError} `PAYMENT_GATEWAY_UNAVAILABLE` o `PAYMENT_GATEWAY_NOT_CONFIGURED`.
 */
export async function crearPreferenciaDePago(
  input: CrearPreferenciaInput
): Promise<CrearPreferenciaResult> {
  const transaccion = await crearTransaccionConPasajes({
    instanciaVueloId: input.instanciaVueloId,
    clase: input.clase,
    emailContacto: input.emailContacto,
    pasajeros: input.pasajeros,
    usuarioId: input.usuarioId,
  });

  const cantidad = input.pasajeros.length;
  const total = Number(transaccion.total);
  // El total es exactamente precio * cantidad, por lo que redondear a 2
  // decimales recupera el precio unitario original.
  const precioUnitario = Number((total / cantidad).toFixed(2));
  const urlRetorno = `${getBaseUrl()}/checkout/resultado`;

  let preference;
  try {
    preference = await getPreferenceClient().create({
      body: {
        external_reference: transaccion.id.toString(),
        notification_url: `${getBaseUrl()}/api/v1/webhooks/mercadopago`,
        back_urls: {
          success: urlRetorno,
          pending: urlRetorno,
          failure: urlRetorno,
        },
        items: [
          {
            id: input.instanciaVueloId,
            title: `${cantidad} pasaje(s) clase ${input.clase}`,
            quantity: cantidad,
            unit_price: precioUnitario,
            currency_id: CURRENCY_ID,
          },
        ],
        payer: { email: input.emailContacto },
        metadata: {
          tipoFactura: input.facturacion.tipoFactura,
          nombreRazonSocial: input.facturacion.nombreRazonSocial,
          identificacionFiscal: input.facturacion.identificacionFiscal,
        },
      },
    });
  } catch (error) {
    console.error("Fallo al crear la preferencia de Mercado Pago:", error);
    await compensarReserva(transaccion.id);
    throw new PagoError(
      "PAYMENT_GATEWAY_UNAVAILABLE",
      "No se pudo iniciar el pago con Mercado Pago. Intentá nuevamente en unos minutos."
    );
  }

  const initPoint = preference.sandbox_init_point ?? preference.init_point;

  if (!preference.id || !initPoint) {
    console.error("Mercado Pago devolvió una preferencia sin id o init_point.");
    await compensarReserva(transaccion.id);
    throw new PagoError(
      "PAYMENT_GATEWAY_UNAVAILABLE",
      "Mercado Pago no devolvió una preferencia de pago válida."
    );
  }

  return {
    transaccionId: transaccion.id.toString(),
    preferenceId: preference.id,
    initPoint,
    total,
  };
}

/**
 * Consulta inversa de autenticidad: recupera un pago directamente desde la API
 * de Mercado Pago (`GET /v1/payments/{id}`).
 *
 * @throws {PagoError} `PAYMENT_GATEWAY_UNAVAILABLE` si la consulta falla.
 */
export async function consultarPagoEnPasarela(paymentId: string | number) {
  try {
    return await getPaymentClient().get({ id: paymentId });
  } catch (error) {
    console.error("Fallo al consultar el pago en Mercado Pago:", error);
    throw new PagoError(
      "PAYMENT_GATEWAY_UNAVAILABLE",
      "No se pudo consultar el pago en Mercado Pago."
    );
  }
}

/**
 * Procesa una notificación (webhook) de Mercado Pago de forma idempotente.
 *
 * - Los eventos que no son de pago se ignoran sin mutar la base.
 * - Verifica el pago contra la API antes de mutar.
 * - Resuelve la transacción por `external_reference` y aplica:
 *   `Pago` upsert 1:1, `TransaccionCompra` y `Factura`/pasajes según el estado.
 */
export async function procesarNotificacionPago(
  payload: WebhookPayload
): Promise<{ processed: boolean; estado?: EstadoPago }> {
  const paymentId = payload.data?.id;

  if (payload.type !== "payment" || paymentId === undefined || paymentId === null) {
    return { processed: false };
  }

  const payment = await consultarPagoEnPasarela(paymentId);

  const externalReference = payment.external_reference;

  if (!externalReference || !/^\d+$/.test(externalReference)) {
    console.warn(
      "Webhook de Mercado Pago sin external_reference válido; se ignora el evento."
    );
    return { processed: false };
  }

  const transaccionId = BigInt(externalReference);

  return prisma.$transaction(async (tx) => {
    const transaccion = await tx.transaccionCompra.findFirst({
      where: { id: transaccionId, deleted: false },
      select: { id: true, total: true, emailContacto: true },
    });

    if (!transaccion) {
      console.warn(
        `Webhook de Mercado Pago para una transacción inexistente (${externalReference}); se ignora.`
      );
      return { processed: false as const };
    }

    // Idempotencia: si ya está aprobado, no se duplica pago ni factura.
    const pagoExistente = await tx.pago.findUnique({
      where: { transaccionId },
      select: { estado: true },
    });

    if (pagoExistente?.estado === "APROBADO") {
      return { processed: true as const, estado: "APROBADO" as const };
    }

    // Coherencia contable: el monto cobrado debe igualar el total de la orden.
    const montoCoherente =
      payment.transaction_amount !== undefined &&
      Number(payment.transaction_amount) === Number(transaccion.total);

    if (!montoCoherente) {
      console.warn(
        `Monto incoherente en el pago de la transacción ${externalReference}; se marca como RECHAZADO.`
      );
    }

    const estadoPago: EstadoPago = montoCoherente
      ? mapearEstadoPago(payment.status)
      : "RECHAZADO";

    const idTransaccionPasarela =
      payment.id !== undefined ? payment.id.toString() : String(paymentId);
    const monto = payment.transaction_amount ?? Number(transaccion.total);

    await tx.pago.upsert({
      where: { transaccionId },
      create: {
        transaccionId,
        metodoPago: mapearMetodoPago(payment.payment_type_id),
        idTransaccionPasarela,
        monto,
        estado: estadoPago,
      },
      update: {
        metodoPago: mapearMetodoPago(payment.payment_type_id),
        idTransaccionPasarela,
        monto,
        estado: estadoPago,
        fechaPago: new Date(),
      },
    });

    if (estadoPago === "APROBADO") {
      await tx.transaccionCompra.update({
        where: { id: transaccionId },
        data: { estado: "CONFIRMADA" },
      });

      const facturacion = extraerFacturacion(
        payment.metadata,
        transaccion.emailContacto
      );

      await tx.factura.upsert({
        where: { transaccionId },
        create: {
          transaccionId,
          numeroFactura: construirNumeroFactura(
            facturacion.tipoFactura,
            transaccionId
          ),
          tipoFactura: facturacion.tipoFactura,
          nombreRazonSocial: facturacion.nombreRazonSocial,
          identificacionFiscal: facturacion.identificacionFiscal,
          total: transaccion.total,
        },
        update: {},
      });
    } else if (estadoPago === "RECHAZADO") {
      await tx.pasaje.updateMany({
        where: {
          transaccionId,
          estado: { in: ["EMITIDO", "CHECK_IN"] },
        },
        data: { estado: "CANCELADO" },
      });

      await tx.transaccionCompra.update({
        where: { id: transaccionId },
        data: { estado: "RECHAZADA" },
      });
    }

    return { processed: true as const, estado: estadoPago };
  });
}

/**
 * Estado comercial de una compra (fuente de verdad = webhook). Devuelve la
 * transacción, su pago, su factura y sus pasajes con los tipos serializados
 * (`BigInt` → `string`, `Decimal` → `number`, `Date` → ISO 8601).
 *
 * @throws {PagoError} `TRANSACCION_NO_ENCONTRADA`.
 */
export async function consultarEstadoTransaccion(id: bigint | string) {
  if (typeof id === "string" && !/^\d+$/.test(id)) {
    throw new PagoError(
      "TRANSACCION_NO_ENCONTRADA",
      "La transacción indicada no existe."
    );
  }

  const transaccionId = typeof id === "string" ? BigInt(id) : id;

  const transaccion = await prisma.transaccionCompra.findFirst({
    where: { id: transaccionId, deleted: false },
    include: { pago: true, factura: true, pasajes: true },
  });

  if (!transaccion) {
    throw new PagoError(
      "TRANSACCION_NO_ENCONTRADA",
      "La transacción indicada no existe."
    );
  }

  return {
    transaccionId: transaccion.id.toString(),
    estado: transaccion.estado,
    total: Number(transaccion.total),
    emailContacto: transaccion.emailContacto,
    fechaCreacion: transaccion.fechaCreacion.toISOString(),
    pago: transaccion.pago
      ? {
          estado: transaccion.pago.estado,
          metodoPago: transaccion.pago.metodoPago,
          idTransaccionPasarela: transaccion.pago.idTransaccionPasarela,
          monto: Number(transaccion.pago.monto),
          fechaPago: transaccion.pago.fechaPago.toISOString(),
        }
      : null,
    factura: transaccion.factura
      ? {
          numeroFactura: transaccion.factura.numeroFactura,
          tipoFactura: transaccion.factura.tipoFactura,
          total: Number(transaccion.factura.total),
          fechaEmision: transaccion.factura.fechaEmision.toISOString(),
        }
      : null,
    pasajes: transaccion.pasajes.map((pasaje) => ({
      codigo: pasaje.codigo.toString(),
      pasajero: `${pasaje.pasajeroNombre} ${pasaje.pasajeroApellido}`.trim(),
      clase: pasaje.clase,
      estado: pasaje.estado,
      numeroAsiento: pasaje.numeroAsiento,
    })),
  };
}
