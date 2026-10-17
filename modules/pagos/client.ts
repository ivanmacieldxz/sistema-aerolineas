import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { PagoError } from "./errors";

/** Timeout de cada request a la pasarela, en milisegundos. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Configuración perezosa; no se lee el token hasta el primer uso real. */
let configuracion: MercadoPagoConfig | null = null;

/**
 * Devuelve la configuración del SDK, creándola en el primer llamado.
 * Falla explícitamente si `MERCADOPAGO_ACCESS_TOKEN` no está definido, para
 * alimentar el criterio de "mensaje claro" ante errores de la pasarela.
 */
function getConfiguracion(): MercadoPagoConfig {
  if (configuracion) {
    return configuracion;
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new PagoError(
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Falta configurar MERCADOPAGO_ACCESS_TOKEN para operar con Mercado Pago."
    );
  }

  configuracion = new MercadoPagoConfig({
    accessToken,
    options: { timeout: REQUEST_TIMEOUT_MS },
  });

  return configuracion;
}

/** Cliente de preferencias de Checkout Pro. */
export function getPreferenceClient(): Preference {
  return new Preference(getConfiguracion());
}

/** Cliente de pagos (consulta inversa / verificación de autenticidad). */
export function getPaymentClient(): Payment {
  return new Payment(getConfiguracion());
}