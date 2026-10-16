/**
 * Errores de dominio del módulo de reserva de pasajes.
 * Cada código lleva asociado un status HTTP semántico para que las rutas
 * REST (`app/api/v1/...`) puedan mapearlo sin duplicar lógica.
 */
export type PasajeErrorCode =
  | "PASAJEROS_INVALIDOS"
  | "INSTANCIA_NO_ENCONTRADA"
  | "VUELO_NO_DISPONIBLE"
  | "INSTANCIA_CANCELADA"
  | "SIN_CUPO"
  | "TRANSACCION_NO_ENCONTRADA";

const HTTP_STATUS: Record<PasajeErrorCode, number> = {
  PASAJEROS_INVALIDOS: 400,
  INSTANCIA_NO_ENCONTRADA: 404,
  VUELO_NO_DISPONIBLE: 409,
  INSTANCIA_CANCELADA: 409,
  SIN_CUPO: 409,
  TRANSACCION_NO_ENCONTRADA: 404,
};

export class PasajeError extends Error {
  readonly code: PasajeErrorCode;
  readonly status: number;

  constructor(code: PasajeErrorCode, message: string) {
    super(message);
    this.name = "PasajeError";
    this.code = code;
    this.status = HTTP_STATUS[code];
  }
}
