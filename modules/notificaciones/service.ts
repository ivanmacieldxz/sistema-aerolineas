import { prisma } from "@/lib/prisma";
import { formatTime, formatDate, formatDateShort } from "@/modules/vuelos/utils";
import { generarPasajePDF } from "./pdf/pasaje-pdf";
import { generarFacturaPDF } from "./pdf/factura-pdf";
import { getEmailTransporter } from "./email/client";
import nodemailer from "nodemailer";
import {
  construirEmailConfirmacion,
  construirEmailCancelacionVuelo,
  construirEmailCambioHorario,
} from "./email/templates";
import type {
  SalidaCanceladaInfo,
  CambioHorarioInfo,
  PasajeroAfectado,
} from "@/modules/vuelos/service";

export type ResultadoEnvioComprobantes =
  | { success: true; messageId?: string; pasajesEnviados: number }
  | { success: false; reason: string };


export async function enviarComprobantesCompra(
  transaccionIdInput: bigint | string
): Promise<ResultadoEnvioComprobantes> {
  const transaccionId =
    typeof transaccionIdInput === "string"
      ? BigInt(transaccionIdInput)
      : transaccionIdInput;

  const transaccion = await prisma.transaccionCompra.findFirst({
    where: { id: transaccionId, deleted: false },
    include: {
      factura: true,
      pago: true,
      pasajes: {
        include: {
          instanciaVuelo: {
            include: {
              vuelo: {
                include: {
                  origen: true,
                  destino: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Criterio de Aceptación 3: No emitir comprobantes si no está aprobada y confirmada
  if (!transaccion) {
    return { success: false, reason: "TRANSACCION_NO_ENCONTRADA" };
  }

  if (transaccion.estado !== "CONFIRMADA") {
    return { success: false, reason: "ESTADO_NO_CONFIRMADO" };
  }

  if (!transaccion.factura) {
    return { success: false, reason: "FACTURA_INEXISTENTE" };
  }

  if (transaccion.pasajes.length === 0) {
    return { success: false, reason: "SIN_PASAJES" };
  }

  const primerPasaje = transaccion.pasajes[0];
  const vuelo = primerPasaje.instanciaVuelo.vuelo;
  const fechaSalidaFormateada = formatDate(primerPasaje.instanciaVuelo.fechaSalida);
  const fechaSalidaCorta = formatDateShort(primerPasaje.instanciaVuelo.fechaSalida);
  const horaSalidaFormateada = formatTime(vuelo.horaSalida);
  const horaLlegadaFormateada = formatTime(vuelo.horaLlegada);

  // 1. Criterio de Aceptación 1: Generar un PDF por cada pasajero en memoria
  const promesasPasajes = transaccion.pasajes.map(async (pasaje) => {
    const buffer = await generarPasajePDF({
      codigoPasaje: pasaje.codigo.toString(),
      transaccionId: transaccion.id.toString(),
      pasajero: {
        nombre: pasaje.pasajeroNombre,
        apellido: pasaje.pasajeroApellido,
        documento: pasaje.pasajeroDocumento,
      },
      vuelo: {
        numeroVuelo: vuelo.numeroVuelo,
        origen: {
          iata: vuelo.origenIata,
          ciudad: vuelo.origen.ciudad,
          nombre: vuelo.origen.nombre,
        },
        destino: {
          iata: vuelo.destinoIata,
          ciudad: vuelo.destino.ciudad,
          nombre: vuelo.destino.nombre,
        },
        fechaSalida: fechaSalidaCorta,
        horaSalida: horaSalidaFormateada,
        horaLlegada: horaLlegadaFormateada,
      },
      clase: pasaje.clase,
      numeroAsiento: pasaje.numeroAsiento,
    });

    return {
      filename: `Pasaje-${pasaje.pasajeroApellido}-${pasaje.codigo.toString()}.pdf`,
      content: buffer,
      contentType: "application/pdf",
    };
  });

  // 2. Criterio de Aceptación 1: Generar la Factura de compra (PDF)
  const totalNumero = Number(transaccion.total);
  const cantidadPasajes = transaccion.pasajes.length;
  const precioUnitario = Number((totalNumero / cantidadPasajes).toFixed(2));

  const promesaFactura = generarFacturaPDF({
    numeroFactura: transaccion.factura.numeroFactura,
    tipoFactura: transaccion.factura.tipoFactura,
    fechaEmision: transaccion.factura.fechaEmision.toLocaleDateString("es-AR"),
    receptor: {
      nombreRazonSocial: transaccion.factura.nombreRazonSocial,
      identificacionFiscal: transaccion.factura.identificacionFiscal,
      email: transaccion.emailContacto,
    },
    vuelo: {
      numeroVuelo: vuelo.numeroVuelo,
      origen: {
        iata: vuelo.origenIata,
        ciudad: vuelo.origen.ciudad,
      },
      destino: {
        iata: vuelo.destinoIata,
        ciudad: vuelo.destino.ciudad,
      },
      fechaSalida: fechaSalidaFormateada,
    },
    clase: primerPasaje.clase,
    cantidadPasajes,
    precioUnitario,
    total: totalNumero,
    metodoPago: transaccion.pago?.metodoPago ?? "MERCADO_PAGO",
    idTransaccionPasarela: transaccion.pago?.idTransaccionPasarela,
  }).then((buffer) => ({
    filename: `Factura-${transaccion.factura!.numeroFactura}.pdf`,
    content: buffer,
    contentType: "application/pdf",
  }));

  // Generación simultánea en paralelo de todos los documentos (ultra-rápido: ~100-200ms)
  const [adjuntosPasajes, adjuntoFactura] = await Promise.all([
    Promise.all(promesasPasajes),
    promesaFactura,
  ]);

  const attachments = [...adjuntosPasajes, adjuntoFactura];

  // 3. Componer y enviar el correo electrónico
  const { asunto, html, textoPlano } = construirEmailConfirmacion({
    transaccionId: transaccion.id.toString(),
    numeroFactura: transaccion.factura.numeroFactura,
    total: totalNumero,
    pasajeros: transaccion.pasajes.map((p) => ({
      nombre: p.pasajeroNombre,
      apellido: p.pasajeroApellido,
      asiento: p.numeroAsiento,
      codigoPasaje: p.codigo.toString(),
    })),
    vuelo: {
      numeroVuelo: vuelo.numeroVuelo,
      origen: `${vuelo.origenIata} (${vuelo.origen.ciudad})`,
      destino: `${vuelo.destinoIata} (${vuelo.destino.ciudad})`,
      fechaSalida: fechaSalidaFormateada,
      horaSalida: horaSalidaFormateada,
    },
    clase: primerPasaje.clase,
  });

  const transporter = await getEmailTransporter();
  const remitente =
    process.env.SMTP_FROM ?? '"Sistema Aerolínea" <no-reply@aerolineas.com>';

  const info = await transporter.sendMail({
    from: remitente,
    to: transaccion.emailContacto,
    subject: asunto,
    text: textoPlano,
    html,
    attachments,
  });

  return {
    success: true,
    messageId: info.messageId,
    pasajesEnviados: adjuntosPasajes.length,
  };
}

export type ResultadoNotificacionMasiva = {
  totalAfectados: number;
  emailsEnviados: number;
  errores: number;
};

  /**
   * Notifica por email a todos los pasajeros afectados por la cancelación de una salida.
   * Agrupa pasajeros por `emailContacto` para enviar un único correo consolidado por compra.
   */
  export async function notificarCancelacionSalida(
    salidaInfo: SalidaCanceladaInfo
  ): Promise<ResultadoNotificacionMasiva> {
    const totalAfectados = salidaInfo.pasajerosAfectados.length;
    if (totalAfectados === 0) {
      return { totalAfectados: 0, emailsEnviados: 0, errores: 0 };
    }
  
    // Agrupar pasajes por el email de contacto del comprador
    const gruposPorEmail = new Map<string, PasajeroAfectado[]>();
    for (const pasajero of salidaInfo.pasajerosAfectados) {
      const emailRaw = pasajero.emailContacto;
      if (!emailRaw || typeof emailRaw !== "string") {
        console.error("[notificarCancelacionSalida] emailContacto inválido para pasaje:", pasajero.pasajeCodigo);
        continue;
      }
      const email = emailRaw.trim().toLowerCase();
      if (!email) {
        console.error("[notificarCancelacionSalida] emailContacto vacío para pasaje:", pasajero.pasajeCodigo);
        continue;
      }
      const lista = gruposPorEmail.get(email) ?? [];
      lista.push(pasajero);
      gruposPorEmail.set(email, lista);
    }
  
    if (gruposPorEmail.size === 0) {
      console.error("[notificarCancelacionSalida] No hay emails válidos para notificar. totalAfectados:", totalAfectados);
      return { totalAfectados, emailsEnviados: 0, errores: totalAfectados };
    }
  
    const transporter = await getEmailTransporter();
    const remitente =
      process.env.SMTP_FROM ?? '"Sistema Aerolínea" <no-reply@aerolineas.com>';
  
    const envios = Array.from(gruposPorEmail.entries()).map(
      async ([email, pasajeros]) => {
        const { asunto, html, textoPlano } = construirEmailCancelacionVuelo({
          emailDestinatario: email,
          numeroVuelo: salidaInfo.numeroVuelo,
          origen: salidaInfo.origen,
          destino: salidaInfo.destino,
          fechaSalida: salidaInfo.fechaSalida,
          horaSalida: salidaInfo.horaSalida,
          pasajeros: pasajeros.map((p) => ({
            nombre: p.pasajeroNombre,
            apellido: p.pasajeroApellido,
            documento: p.pasajeroDocumento,
            codigoPasaje: p.pasajeCodigo,
            asiento: p.numeroAsiento,
            clase: p.clase,
          })),
        });
  
      const info = await transporter.sendMail({
        from: remitente,
        to: email,
        subject: asunto,
        text: textoPlano,
        html,
      });
      console.log("[notificarCancelacionSalida] enviado a", email, "messageId:", info.messageId);
      try {
        // @ts-ignore
        const url = nodemailer.getTestMessageUrl?.(info);
        if (url) console.log("[notificarCancelacionSalida] preview:", url);
      } catch {}
      return info;
      }
    );

  const resultados = await Promise.allSettled(envios);
  let emailsEnviados = 0;
  let errores = 0;

  for (const res of resultados) {
    if (res.status === "fulfilled") {
      emailsEnviados++;
    } else {
      errores++;
      console.error(
        "[notificarCancelacionSalida] Error enviando correo de cancelación:",
        res.reason
      );
    }
  }

  return { totalAfectados, emailsEnviados, errores };
}

/**
 * Notifica por email a todos los pasajeros de salidas futuras afectadas por un cambio de horario.
 * Agrupa por comprador/email por cada fecha de vuelo.
 */
export async function notificarCambioHorarioVuelo(
  cambioHorario: CambioHorarioInfo
): Promise<ResultadoNotificacionMasiva> {
  let totalAfectados = 0;
  const transporter = await getEmailTransporter();
  const remitente =
    process.env.SMTP_FROM ?? '"Sistema Aerolínea" <no-reply@aerolineas.com>';

  const tareasEnvio: Array<Promise<unknown>> = [];

  for (const instancia of cambioHorario.instanciasAfectadas) {
    totalAfectados += instancia.pasajerosAfectados.length;
    if (instancia.pasajerosAfectados.length === 0) continue;

    // Agrupar pasajes de esta salida por comprador/email
    const gruposPorEmail = new Map<string, PasajeroAfectado[]>();
    for (const pasajero of instancia.pasajerosAfectados) {
      const email = pasajero.emailContacto.trim().toLowerCase();
      const lista = gruposPorEmail.get(email) ?? [];
      lista.push(pasajero);
      gruposPorEmail.set(email, lista);
    }

    for (const [email, pasajeros] of gruposPorEmail.entries()) {
      const { asunto, html, textoPlano } = construirEmailCambioHorario({
        emailDestinatario: email,
        numeroVuelo: cambioHorario.numeroVuelo,
        origen: cambioHorario.origen,
        destino: cambioHorario.destino,
        fechaSalida: instancia.fechaSalida,
        horarioAnterior: cambioHorario.horarioAnterior,
        nuevoHorario: cambioHorario.nuevoHorario,
        pasajeros: pasajeros.map((p) => ({
          nombre: p.pasajeroNombre,
          apellido: p.pasajeroApellido,
          documento: p.pasajeroDocumento,
          codigoPasaje: p.pasajeCodigo,
          asiento: p.numeroAsiento,
          clase: p.clase,
        })),
      });

      tareasEnvio.push(
        transporter.sendMail({
          from: remitente,
          to: email,
          subject: asunto,
          text: textoPlano,
          html,
        })
      );
    }
  }

  if (tareasEnvio.length === 0) {
    return { totalAfectados: 0, emailsEnviados: 0, errores: 0 };
  }

  const resultados = await Promise.allSettled(tareasEnvio);
  let emailsEnviados = 0;
  let errores = 0;

  for (const res of resultados) {
    if (res.status === "fulfilled") {
      emailsEnviados++;
    } else {
      errores++;
      console.error(
        "[notificarCambioHorarioVuelo] Error enviando correo de cambio de horario:",
        res.reason
      );
    }
  }

  return { totalAfectados, emailsEnviados, errores };
}
