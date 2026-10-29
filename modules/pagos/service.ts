import { MercadoPagoError } from "mercadopago";
import { prisma } from "@/lib/prisma";
import {
  crearTransaccionConPasajes,
  cancelarTransaccionPendiente,
  reactivarPasajesDeTransaccion,
} from "@/modules/pasajes/service";
import { enviarComprobantesCompra } from "@/modules/notificaciones";
import { getPaymentClient, getPreferenceClient } from "./client";
import { PagoError } from "./errors";
import type { PreferenciaRequest, WebhookPayload } from "./schemas";

/** Moneda con la que opera la pasarela para este sistema. */
const CURRENCY_ID = "ARS";

type EstadoPago = "APROBADO" | "RECHAZADO" | "PENDIENTE";

export type ResultadoNotificacionPago = {
  processed: boolean;
  estado?: EstadoPago;
  yaProcesado?: boolean;
  /**
   * El pago fue aprobado, pero no se pudo emitir porque el vuelo o el cupo ya
   * no están disponibles. Requiere intervención manual (p. ej. reembolso).
   */
  emisionBloqueada?: boolean;
};

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
 * Lee el primer valor string no vacío entre varias claves posibles.
 * Mercado Pago devuelve la `metadata` de la preferencia con las claves en
 * snake_case (p. ej. `nombre_razon_social`), aunque se hayan enviado en
 * camelCase; por eso se aceptan ambas variantes.
 */
function leerDatoFacturacion(
  datos: Record<string, unknown>,
  claves: string[]
): string | undefined {
  for (const clave of claves) {
    const valor = datos[clave];

    if (typeof valor === "string" && valor.trim().length > 0) {
      return valor.trim();
    }
  }

  return undefined;
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

  const tipo = leerDatoFacturacion(datos, ["tipoFactura", "tipo_factura"]);
  const nombre = leerDatoFacturacion(datos, [
    "nombreRazonSocial",
    "nombre_razon_social",
  ]);
  const identificacion = leerDatoFacturacion(datos, [
    "identificacionFiscal",
    "identificacion_fiscal",
  ]);

  return {
    tipoFactura: tipo === "A" || tipo === "B" || tipo === "C" ? tipo : "B",
    nombreRazonSocial: nombre ?? emailContacto,
    identificacionFiscal: identificacion ?? "CONSUMIDOR FINAL",
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
  const baseUrl = getBaseUrl();

  let preference;
  try {
    preference = await getPreferenceClient().create({
      body: {
        external_reference: transaccion.id.toString(),
        notification_url: `${baseUrl}/api/v1/webhooks/mercadopago`,
        // Sin `back_urls` ni `auto_return`: el comprador permanece en Mercado
        // Pago. La confirmación y el envío de comprobantes se resuelven por
        // webhook o por el proceso de conciliación en segundo plano.
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
 * Distingue el `404` (el pago no existe o es de otro comercio: reintentar nunca
 * cambia el resultado) del resto de fallos, que sí son transitorios.
 *
 * @throws {PagoError} `PAGO_NO_ENCONTRADO` si Mercado Pago no reconoce el pago.
 * @throws {PagoError} `PAYMENT_GATEWAY_UNAVAILABLE` ante un fallo transitorio
 *   (timeout, 5xx, credenciales inválidas, etc.).
 */
export async function consultarPagoEnPasarela(paymentId: string | number) {
  try {
    return await getPaymentClient().get({ id: paymentId });
  } catch (error) {
    if (error instanceof MercadoPagoError && error.status === 404) {
      throw new PagoError(
        "PAGO_NO_ENCONTRADO",
        `Mercado Pago no reconoce el pago ${paymentId}.`
      );
    }

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
 *
 * @throws {PagoError} `PAGO_NO_ENCONTRADO` si Mercado Pago no reconoce el pago.
 * @throws {PagoError} `PAYMENT_GATEWAY_UNAVAILABLE` si la consulta inversa falla.
 */

export async function procesarNotificacionPago(
  payload: WebhookPayload
): Promise<ResultadoNotificacionPago> {
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

  const resultado = await prisma.$transaction(async (tx) => {
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
      return { processed: true as const, estado: "APROBADO" as const, yaProcesado: true as const };
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
      // Si la reserva había expirado por TTL (o un rechazo previo canceló los
      // pasajes), se reactivan solo si el cupo sigue disponible. El pago queda
      // registrado igualmente para no perder el cobro.
      const reactivacion = await reactivarPasajesDeTransaccion(tx, transaccionId);

      if (!reactivacion.ok) {
        console.error(
          `[Pagos] Pago aprobado de la transacción ${externalReference}, pero no se pudo emitir: ${reactivacion.motivo} Requiere intervención manual (posible reembolso).`
        );

        return {
          processed: true as const,
          estado: "APROBADO" as const,
          yaProcesado: false as const,
          emisionBloqueada: true as const,
        };
      }

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

    return { processed: true as const, estado: estadoPago, yaProcesado: false as const };
  });

  // Emisión automática de pasajes y factura (User Story 11)
  // Criterio de Aceptación 1: Se emite un pasaje por pasajero y la factura correspondiente
  // Criterio de Aceptación 2: El pasajero recibe el email en 2 minutos o menos
  // Criterio de Aceptación 3: No se emite ningún comprobante si el pago no fue aprobado
  if (
    resultado.processed &&
    resultado.estado === "APROBADO" &&
    !resultado.yaProcesado &&
    !resultado.emisionBloqueada
  ) {
    try {
      await enviarComprobantesCompra(transaccionId);
    } catch (error) {
      console.error(
        `[Notificaciones] Error en envío automático de comprobantes para transacción #${transaccionId.toString()}:`,
        error
      );
    }
  }

  return { processed: resultado.processed, estado: resultado.estado };
}

/**
 * Sincroniza el estado del pago directamente con Mercado Pago cuando el usuario
 * retorna a la pantalla de resultado en entornos donde el webhook no puede
 * impactar directamente (como desarrollo local sin túnel público).
 */
export async function sincronizarPagoDesdeRetorno(params: {
  transaccionId?: string | null;
  paymentId?: string | null;
  status?: string | null;
}): Promise<void> {
  const transaccionIdStr = params.transaccionId;
  if (!transaccionIdStr || !/^\d+$/.test(transaccionIdStr)) {
    return;
  }

  const transaccionId = BigInt(transaccionIdStr);

  const transaccion = await prisma.transaccionCompra.findFirst({
    where: { id: transaccionId, deleted: false },
    select: { estado: true },
  });

  // Se sincroniza tanto un hold vigente como uno rechazado por TTL: el pago
  // pudo aprobarse después del vencimiento y la compra todavía es recuperable.
  if (
    !transaccion ||
    (transaccion.estado !== "PENDIENTE" && transaccion.estado !== "RECHAZADA")
  ) {
    return;
  }

  const paymentId = params.paymentId;
  if (paymentId && /^\d+$/.test(paymentId)) {
    try {
      await procesarNotificacionPago({
        type: "payment",
        data: { id: paymentId },
      });
      return;
    } catch (error) {
      console.warn(
        `[Pagos] Error al sincronizar pago con ID ${paymentId} en retorno:`,
        error
      );
    }
  }

  // Fallback: Si no vino el paymentId en URL, consultar a Mercado Pago por external_reference
  try {
    const search = await getPaymentClient().search({
      options: {
        external_reference: transaccionId.toString(),
        sort: "date_created",
        criteria: "desc",
        limit: 1,
      },
    });

    const ultimoPago = search.results?.[0];
    if (ultimoPago?.id && ultimoPago.status === "approved") {
      await procesarNotificacionPago({
        type: "payment",
        data: { id: ultimoPago.id },
      });
    }
  } catch (error) {
    console.warn(
      `[Pagos] No se pudo buscar el pago de la transacción #${transaccionId.toString()} en Mercado Pago:`,
      error
    );
  }
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

  let transaccion = await prisma.transaccionCompra.findFirst({
    where: { id: transaccionId, deleted: false },
    include: { pago: true, factura: true, pasajes: true },
  });

  if (!transaccion) {
    throw new PagoError(
      "TRANSACCION_NO_ENCONTRADA",
      "La transacción indicada no existe."
    );
  }

  // Si la transacción sigue PENDIENTE o fue rechazada por expiración del hold
  // (ej. en desarrollo local donde el webhook de MP no puede llegar),
  // intentamos sincronizar con Mercado Pago para confirmar automáticamente y
  // despachar los comprobantes.
  if (transaccion.estado === "PENDIENTE" || transaccion.estado === "RECHAZADA") {
    await sincronizarPagoDesdeRetorno({ transaccionId: transaccionId.toString() });

    const recargada = await prisma.transaccionCompra.findFirst({
      where: { id: transaccionId, deleted: false },
      include: { pago: true, factura: true, pasajes: true },
    });
    if (recargada) {
      transaccion = recargada;
    }
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
