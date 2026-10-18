import { NextRequest, NextResponse } from "next/server";
import { errorResponse, validationErrorResponse } from "@/lib/api-response";
import { PagoError } from "@/modules/pagos/errors";
import {
  webhookPayloadSchema,
  type WebhookPayload,
} from "@/modules/pagos/schemas";
import { procesarNotificacionPago } from "@/modules/pagos/service";
import { validarFirmaWebhook } from "@/modules/pagos/webhook";

export const runtime = "nodejs";

/**
 * Log detallado de cada notificación (URL, headers y body). Solo se habilita
 * para diagnóstico local: en producción expone datos de la pasarela y del
 * comprador sin aportar valor operativo.
 */
const LOG_VERBOSO = process.env.MERCADOPAGO_WEBHOOK_VERBOSE_LOG === "true";

/**
 * Interruptor temporal para demos: con `SKIP_WEBHOOK_VALIDATION=true` se omite
 * la verificación de la firma `x-signature` y se acepta cualquier notificación
 * que traiga el payload esperado. Es un modo inseguro: mantener apagado fuera
 * de entornos locales/demo mientras se resuelven los problemas de validación.
 */
const SKIP_WEBHOOK_VALIDATION = process.env.SKIP_WEBHOOK_VALIDATION === "true";

/**
 * Acuse de recibo: es la única respuesta que evita los reintentos de Mercado
 * Pago, por lo que se usa para todo evento procesado, no aplicable o
 * definitivamente no recuperable.
 */
function recibido(): NextResponse {
  return NextResponse.json({ received: true });
}

/**
 * Normaliza la notificación a la estructura mínima de `webhookPayloadSchema`.
 * Mercado Pago puede enviar el `paymentId`/`type` tanto en el body como en el
 * query string, por lo que se aceptan ambas fuentes.
 */
function normalizarPayload(request: NextRequest, raw: string): WebhookPayload {
  let cuerpo: Record<string, unknown> = {};

  if (raw.trim().length > 0) {
    try {
      const parseado: unknown = JSON.parse(raw);

      if (typeof parseado === "object" && parseado !== null) {
        cuerpo = parseado as Record<string, unknown>;
      }
    } catch {
      // Cuerpo no parseable: se continúa con lo disponible en el query string.
      cuerpo = {};
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const data =
    typeof cuerpo.data === "object" && cuerpo.data !== null
      ? (cuerpo.data as Record<string, unknown>)
      : {};

  const idBruto =
    data.id ??
    searchParams.get("data.id") ??
    searchParams.get("id") ??
    undefined;
  const id =
    typeof idBruto === "string" || typeof idBruto === "number"
      ? idBruto
      : undefined;

  const typeBruto =
    cuerpo.type ??
    cuerpo.topic ??
    searchParams.get("type") ??
    searchParams.get("topic") ??
    undefined;
  const type = typeof typeBruto === "string" ? typeBruto : undefined;

  const actionBruto = cuerpo.action;
  const action = typeof actionBruto === "string" ? actionBruto : undefined;

  return {
    type,
    action,
    data: id !== undefined ? { id } : undefined,
  };
}

/**
 * `POST /api/v1/webhooks/mercadopago`
 *
 * Endpoint público que recibe las notificaciones asíncronas de Mercado Pago.
 * Orden de defensa:
 *
 * 1. Se descartan los eventos legacy de IPN (`?topic=`, `merchant_order`), que
 *    no son de pago y MP emite en paralelo a las notificaciones actuales.
 * 2. Se valida la firma `x-signature` contra `MERCADOPAGO_WEBHOOK_SECRET`. Si el
 *    secreto no está configurado se responde un error: sin él no hay forma de
 *    distinguir a Mercado Pago de un tercero (fail-closed).
 * 3. El módulo de pagos consulta el pago contra la API de MP antes de mutar la
 *    base de datos, de forma idempotente.
 *
 * Los fallos que un reintento podría resolver (base caída, pasarela 5xx o
 * timeout) se responden con error; el resto se acusa con `200 { received: true }`.
 */
export async function POST(request: NextRequest) {
  // El cuerpo se lee una única vez: se registra y se reutiliza para el parseo.
  const raw = await request.text();

  const searchParams = request.nextUrl.searchParams;
  const requestId = request.headers.get("x-request-id");

  // Los eventos legacy (`?topic=`) traen el id de una orden de compra, no de un
  // pago: procesarlos como pago siempre falla y genera reintentos perpetuos.
  if (searchParams.has("topic")) {
    return recibido();
  }

  const dataId = searchParams.get("data.id") ?? searchParams.get("id");

  if (!dataId) {
    return validationErrorResponse(
      "La notificación no incluye el identificador del pago (`data.id`)."
    );
  }

  if (!SKIP_WEBHOOK_VALIDATION) {
    const firma = validarFirmaWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId: requestId,
      dataId,
    });

    if (firma.estado === "sin-configurar") {
      console.error(
        "MERCADOPAGO_WEBHOOK_SECRET no está configurado: no es posible verificar la autenticidad de las notificaciones."
      );

      return errorResponse(
        new PagoError(
          "PAYMENT_GATEWAY_NOT_CONFIGURED",
          "El servicio de pagos no está configurado para verificar notificaciones."
        )
      );
    }

    if (firma.estado === "invalida") {
      console.warn(
        `Firma de webhook inválida (motivo: ${firma.motivo}, data.id: ${dataId}, x-request-id: ${requestId ?? "-"}); se rechaza la notificación.`
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SIGNATURE",
            message: "La firma del webhook no es válida.",
          },
        },
        { status: 401 }
      );
    }
  } else {
    console.warn(
      "SKIP_WEBHOOK_VALIDATION=true: se omite la validación de firma del webhook (modo demo)."
    );
  }

  if (LOG_VERBOSO) {
    console.log("Recibida notificación de Mercado Pago:", {
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body: raw,
    });
  }
  
  const payload = normalizarPayload(request, raw);

  // Evento no procesable (no es de pago): se confirma recepción sin mutar nada.
  if (payload.type !== "payment" || !webhookPayloadSchema.safeParse(payload).success) {
    console.warn(
      `Notificación de Mercado Pago no procesable (type: ${payload.type ?? "-"}); se ignora el evento.`
    );

    return recibido();
  }

  try {
    await procesarNotificacionPago(payload);

    return recibido();
  } catch (error: unknown) {
    // El pago no existe en la pasarela (id inválido o de otro comercio):
    // reintentar no cambia el resultado, se acusa recibo para cortar los envíos.
    if (error instanceof PagoError && error.code === "PAGO_NO_ENCONTRADO") {
      console.warn(
        `Mercado Pago no reconoce el pago ${String(payload.data?.id)}; se ignora la notificación.`
      );

      return recibido();
    }

    // Fallo transitorio: se responde error para que Mercado Pago reintente.
    // La idempotencia del módulo de pagos protege contra la duplicación.
    console.error("Fallo al procesar la notificación de Mercado Pago:", error);

    return errorResponse(error);
  }
}
