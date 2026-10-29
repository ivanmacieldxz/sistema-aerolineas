import { prisma } from "@/lib/prisma";
import { formatTime, formatDate, formatDateShort } from "@/modules/vuelos/utils";
import { generarPasajePDF } from "./pdf/pasaje-pdf";
import { generarFacturaPDF } from "./pdf/factura-pdf";
import { getEmailTransporter } from "./email/client";
import { construirEmailConfirmacion } from "./email/templates";

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
