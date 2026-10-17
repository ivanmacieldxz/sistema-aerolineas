import { z } from "zod";

/**
 * Datos de un pasajero individual dentro de una compra.
 */
export const pasajeroSchema = z.object({
  nombre: z
    .string({ error: "El nombre del pasajero es requerido" })
    .trim()
    .min(1, { message: "El nombre del pasajero es requerido" }),
  apellido: z
    .string({ error: "El apellido del pasajero es requerido" })
    .trim()
    .min(1, { message: "El apellido del pasajero es requerido" }),
  documento: z
    .string({ error: "El documento del pasajero es requerido" })
    .trim()
    .min(1, { message: "El documento del pasajero es requerido" }),
  numeroAsiento: z.string().trim().min(1).nullish(),
});

/**
 * Clase de cabina seleccionada para la compra.
 */
export const claseSchema = z.enum(["ECONOMY", "PRIMERA"], {
  error: "La clase debe ser ECONOMY o PRIMERA",
});

/**
 * Lista de pasajeros de la compra: mínimo 1, máximo 9 (regla de negocio).
 */
export const pasajerosSchema = z
  .array(pasajeroSchema, { error: "La lista de pasajeros es requerida" })
  .min(1, { message: "Debe incluir al menos un pasajero" })
  .max(9, { message: "No se pueden comprar más de 9 pasajes por transacción" });

/**
 * Datos de facturación requeridos para emitir el comprobante legal.
 */
export const facturacionSchema = z.object({
  tipoFactura: z.enum(["A", "B", "C"], {
    error: "El tipo de factura debe ser A, B o C",
  }),
  nombreRazonSocial: z
    .string({ error: "El nombre o razón social es requerido" })
    .trim()
    .min(1, { message: "El nombre o razón social es requerido" }),
  identificacionFiscal: z
    .string({ error: "La identificación fiscal es requerida" })
    .trim()
    .min(1, { message: "La identificación fiscal es requerida" }),
});

/**
 * Cuerpo de `POST /api/v1/compras/preferencia`.
 */
export const preferenciaRequestSchema = z.object({
  instanciaVueloId: z
    .string({ error: "El identificador de la instancia de vuelo es requerido" })
    .regex(/^\d+$/, {
      message: "El identificador de la instancia de vuelo debe ser numérico",
    }),
  clase: claseSchema,
  emailContacto: z.email({ error: "El email de contacto es inválido" }),
  pasajeros: pasajerosSchema,
  facturacion: facturacionSchema,
});

/**
 * Subconjunto de la preferencia que define una reserva de pasajes.
 * Es la entrada del módulo de reserva (`modules/pasajes`).
 */
export const transaccionPasajesSchema = preferenciaRequestSchema.omit({
  facturacion: true,
});

/**
 * Notificación (webhook) enviada por Mercado Pago.
 * Se acepta la estructura mínima del evento; el `paymentId` puede llegar tanto
 * en el body (`data.id`) como en el query string, por lo que la ruta lo normaliza.
 */
export const webhookPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  action: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  external_reference: z.string().optional(),
});

export type PasajeroInput = z.infer<typeof pasajeroSchema>;
export type PreferenciaRequest = z.infer<typeof preferenciaRequestSchema>;
export type TransaccionPasajesInput = z.infer<typeof transaccionPasajesSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
