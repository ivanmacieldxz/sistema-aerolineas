import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from "mercadopago";

/**
 * Ventana opcional de tolerancia, en segundos, para el `ts` de la firma.
 *
 * Mercado Pago firma cada entrega (incluidos los reintentos) con un timestamp
 * nuevo, por lo que una ventana corta es segura y protege contra replay. Si la
 * variable no está definida (o no es un entero positivo) no se controla la
 * antigüedad del timestamp.
 */
function getToleranciaSegundos(): number | undefined {
  const bruto = process.env.MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS?.trim();

  if (!bruto) {
    return undefined;
  }

  const segundos = Number(bruto);

  return Number.isInteger(segundos) && segundos > 0 ? segundos : undefined;
}

/** Datos de la notificación necesarios para validar su firma. */
export type EntradaFirmaWebhook = {
  /** Header `x-signature`, con el formato `ts=...,v1=...`. */
  xSignature: string | null;
  /** Header `x-request-id`, que forma parte del manifest firmado. */
  xRequestId: string | null;
  /** Query param `data.id`: el identificador del recurso notificado. */
  dataId: string;
};

/**
 * Resultado de la validación.
 *
 * `sin-configurar` se informa por separado para que la ruta pueda **fallar
 * cerrada**: sin secreto no hay forma de distinguir a Mercado Pago de un tercero.
 */
export type ResultadoFirmaWebhook =
  | { estado: "valida" }
  | { estado: "invalida"; motivo: string }
  | { estado: "sin-configurar" };

/**
 * Valida la autenticidad de una notificación de Mercado Pago.
 *
 * Delega en el `WebhookSignatureValidator` oficial del SDK, que reconstruye el
 * manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`, calcula su
 * HMAC-SHA256 con `MERCADOPAGO_WEBHOOK_SECRET` y lo compara en tiempo constante
 * contra el `v1` del header.
 *
 * @see docs/integracion_mercadopago.md §4.2
 */
export function validarFirmaWebhook(
  entrada: EntradaFirmaWebhook
): ResultadoFirmaWebhook {
  // El secreto se recorta porque suele copiarse del panel con espacios finales.
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return { estado: "sin-configurar" };
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature: entrada.xSignature,
      xRequestId: entrada.xRequestId,
      dataId: entrada.dataId,
      secret,
      toleranceSeconds: getToleranciaSegundos(),
    });

    return { estado: "valida" };
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return { estado: "invalida", motivo: error.reason };
    }

    // Cualquier otro fallo (p. ej. un error de programación) no debe
    // interpretarse como firma inválida: se propaga.
    throw error;
  }
}
