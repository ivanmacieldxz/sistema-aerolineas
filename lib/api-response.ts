import { NextResponse } from "next/server";

/**
 * Contrato uniforme de respuestas de la API REST v1 (`app/api/v1/...`).
 *
 * Éxito:  `{ success: true, data: ... }`
 * Error:  `{ success: false, error: { code, message } }`
 *
 * Los errores de dominio (`PagoError`, `PasajeError`) ya declaran su código y su
 * status HTTP semántico, por lo que este helper los detecta por forma y los
 * expone tal cual, sin acoplar `lib/` a la capa de módulos.
 */

type ErrorDeDominio = {
  code: string;
  status: number;
  message: string;
};

/**
 * Detecta un error de dominio sin `instanceof`: los módulos (`modules/pagos`,
 * `modules/pasajes`) importan de `lib/`, por lo que hacerlo al revés invertiría
 * la dirección de dependencias.
 */
function esErrorDeDominio(error: unknown): error is ErrorDeDominio {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidato = error as Record<string, unknown>;

  return (
    typeof candidato.code === "string" &&
    typeof candidato.status === "number" &&
    typeof candidato.message === "string"
  );
}

/**
 * Respuesta de error. Si el error viene de la capa de dominio preserva su
 * `code` y su status HTTP; en cualquier otro caso responde `500 INTERNAL_ERROR`
 * sin filtrar detalles internos (se registran en el servidor).
 */
export function errorResponse(error: unknown): NextResponse {
  if (esErrorDeDominio(error)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: error.code, message: error.message },
      },
      { status: error.status }
    );
  }

  console.error("Error no controlado en la API v1:", error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error inesperado al procesar la solicitud.",
      },
    },
    { status: 500 }
  );
}

/** Respuesta `400 VALIDATION_ERROR` con un mensaje legible para el cliente. */
export function validationErrorResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    },
    { status: 400 }
  );
}
