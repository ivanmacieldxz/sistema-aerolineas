/**
 * Errores de dominio del módulo de pagos.
 * Cada código lleva asociado un status HTTP semántico para que las rutas REST
 * (`app/api/v1/...`) puedan mapearlo sin duplicar lógica.
 */
export type PagoErrorCode =
  | "PAYMENT_GATEWAY_UNAVAILABLE"
  | "PAYMENT_GATEWAY_NOT_CONFIGURED"
  | "TRANSACCION_NO_ENCONTRADA"
  | "PAGO_NO_ENCONTRADO"
  | "MONTO_INCOHERENTE";

const HTTP_STATUS: Record<PagoErrorCode, number> = {
  PAYMENT_GATEWAY_UNAVAILABLE: 502,
  PAYMENT_GATEWAY_NOT_CONFIGURED: 500,
  TRANSACCION_NO_ENCONTRADA: 404,
  PAGO_NO_ENCONTRADO: 404,
  MONTO_INCOHERENTE: 409,
};

export class PagoError extends Error {
  readonly code: PagoErrorCode;
  readonly status: number;

  constructor(code: PagoErrorCode, message: string) {
    super(message);
    this.name = "PagoError";
    this.code = code;
    this.status = HTTP_STATUS[code];
  }
}