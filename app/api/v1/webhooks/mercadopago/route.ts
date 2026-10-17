import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { webhookPayloadSchema, type WebhookPayload } from "@/modules/pagos/schemas";
import { procesarNotificacionPago } from "@/modules/pagos/service";

export const runtime = "nodejs";

/**
 * Valida la firma del webhook (`x-signature` / `x-request-id`) contra
 * `MERCADOPAGO_WEBHOOK_SECRET`, según el manifest oficial
 * `id:{data.id};request-id:{x-request-id};ts:{ts};`.
 *
 * @returns `null` si el secreto no está configurado (no se valida),
 * `true` si la firma es correcta y `false` si es inválida o faltan datos.
 */
function validarFirma(request: NextRequest, dataId: string): boolean | null {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    return null;
  }

  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");

  if (!signature || !requestId) {
    return false;
  }

  let ts: string | undefined;
  let v1: string | undefined;

  for (const parte of signature.split(",")) {
    const separador = parte.indexOf("=");

    if (separador === -1) {
      continue;
    }

    const clave = parte.slice(0, separador).trim();
    const valor = parte.slice(separador + 1).trim();

    if (clave === "ts") ts = valor;
    if (clave === "v1") v1 = valor;
  }

  if (!ts || !v1) {
    return false;
  }

  // Mercado Pago exige `data.id` en minúsculas cuando es alfanumérico.
  const idNormalizado = /^\d+$/.test(dataId) ? dataId : dataId.toLowerCase();
  const manifest = `id:${idNormalizado};request-id:${requestId};ts:${ts};`;
  const firmaEsperada = createHmac("sha256", secret).update(manifest).digest("hex");

  const bufferEsperado = Buffer.from(firmaEsperada, "utf8");
  const bufferRecibido = Buffer.from(v1, "utf8");

  if (bufferEsperado.length !== bufferRecibido.length) {
    return false;
  }

  return timingSafeEqual(bufferEsperado, bufferRecibido);
}

/**
 * Normaliza la notificación a la estructura mínima de `webhookPayloadSchema`.
 * Mercado Pago puede enviar el `paymentId`/`type` tanto en el body como en el
 * query string, por lo que se aceptan ambas fuentes.
 */
function normalizarPayload(request: NextRequest, body: unknown): WebhookPayload {
  const searchParams = request.nextUrl.searchParams;
  const cuerpo =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
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
 * Verifica la firma (si hay secreto configurado) y delega el procesamiento
 * idempotente al módulo de pagos, que consulta el pago contra la API de MP antes
 * de mutar la base de datos.
 */
export async function POST(request: NextRequest) {
  const dataId =
    request.nextUrl.searchParams.get("data.id") ??
    request.nextUrl.searchParams.get("id") ??
    "";

  if (validarFirma(request, dataId) === false) {
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

  let body: unknown = {};

  try {
    const raw = await request.text();

    if (raw.trim().length > 0) {
      body = JSON.parse(raw);
    }
  } catch {
    // Cuerpo no parseable: se intenta continuar con lo disponible en el query.
    body = {};
  }

  const payload = normalizarPayload(request, body);

  // Evento no procesable (no es de pago): se confirma recepción sin mutar nada.
  if (!webhookPayloadSchema.safeParse(payload).success) {
    console.warn("Notificación de Mercado Pago no procesable; se ignora el evento.");
    return NextResponse.json({ received: true });
  }

  try {
    await procesarNotificacionPago(payload);

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    // Fallo transitorio: se responde 500 para que Mercado Pago reintente.
    // La idempotencia del módulo de pagos protege contra la duplicación.
    console.error("Fallo al procesar la notificación de Mercado Pago:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "No se pudo procesar la notificación.",
        },
      },
      { status: 500 }
    );
  }
}
