import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

/**
 * Obtiene o inicializa la instancia singleton del transporte de correo.
 * Si las variables de entorno de SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) están presentes,
 * utiliza dicho servidor para entregar los correos directamente a la bandeja de entrada real.
 * Si no están presentes, crea automáticamente una cuenta de prueba en Ethereal Email,
 * permitiendo previsualizar el correo y descargar los PDFs adjuntos mediante un enlace web.
 */
export async function getEmailTransporter(): Promise<Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user,
        pass,
      },
    });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      cachedTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.warn(
        "[Notificaciones] No se pudo crear cuenta de prueba Ethereal. Utilizando jsonTransport en memoria:",
        err
      );
      cachedTransporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return cachedTransporter;
}

/** Permite restablecer el transporter en tests automatizados. */
export function resetEmailTransporterForTesting(): void {
  cachedTransporter = null;
}
