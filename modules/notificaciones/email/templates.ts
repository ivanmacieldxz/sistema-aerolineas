export interface DatosEmailConfirmacion {
  transaccionId: string;
  numeroFactura: string;
  total: number;
  pasajeros: Array<{
    nombre: string;
    apellido: string;
    asiento: string | null;
    codigoPasaje: string;
  }>;
  vuelo: {
    numeroVuelo: string;
    origen: string;
    destino: string;
    fechaSalida: string;
    horaSalida: string;
  };
  clase: string;
}

export function construirEmailConfirmacion(datos: DatosEmailConfirmacion): {
  asunto: string;
  html: string;
  textoPlano: string;
} {
  const asunto = `¡Tu vuelo está confirmado! Pasajes y Factura - Vuelo ${datos.vuelo.numeroVuelo}`;

  const listaPasajerosHtml = datos.pasajeros
    .map(
      (p) => `
      <li style="margin-bottom: 8px; color: #334155;">
        <strong>${p.apellido.toUpperCase()}, ${p.nombre.toUpperCase()}</strong> 
        (Billete #${p.codigoPasaje}) · Asiento: <span style="color: #0284c7; font-weight: bold;">${p.asiento ?? "A asignar en mostrador"}</span>
      </li>`
    )
    .join("");

  const listaPasajerosTexto = datos.pasajeros
    .map((p) => `- ${p.apellido.toUpperCase()}, ${p.nombre.toUpperCase()} (Billete #${p.codigoPasaje}) - Asiento: ${p.asiento ?? "Por Check-in"}`)
    .join("\n");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background-color: #0f172a; color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0; color: #94a3b8; font-size: 13px; }
    .content { padding: 28px 24px; }
    .alert-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; }
    .alert-box h2 { margin: 0 0 6px; font-size: 15px; color: #166534; }
    .alert-box p { margin: 0; font-size: 13px; color: #15803d; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .info-card h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #64748b; }
    .badge { display: inline-block; padding: 4px 10px; background-color: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: 600; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AEROLÍNEA NACIONAL</h1>
      <p>Confirmación formal de compra y emisión de pasajes</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <h2>¡Tu pago fue aprobado exitosamente!</h2>
        <p>Adjunto a este correo encontrarás tus pases de abordaje electrónicos y la Factura legal de tu compra.</p>
      </div>

      <div class="info-card">
        <h3>Detalle del Vuelo</h3>
        <p style="font-size: 18px; font-weight: bold; margin: 4px 0; color: #0f172a;">
          ${datos.vuelo.origen} ➔ ${datos.vuelo.destino}
        </p>
        <p style="margin: 4px 0; font-size: 13px; color: #475569;">
          <strong>Vuelo:</strong> ${datos.vuelo.numeroVuelo} &nbsp;|&nbsp; 
          <strong>Fecha:</strong> ${datos.vuelo.fechaSalida} &nbsp;|&nbsp; 
          <strong>Hora:</strong> ${datos.vuelo.horaSalida} hs
        </p>
        <p style="margin: 6px 0 0;"><span class="badge">Cabina: ${datos.clase}</span></p>
      </div>

      <div class="info-card">
        <h3>Pasajeros (${datos.pasajeros.length})</h3>
        <ul style="padding-left: 20px; margin: 0; font-size: 13px;">
          ${listaPasajerosHtml}
        </ul>
      </div>

      <div class="info-card">
        <h3>Resumen Comercial</h3>
        <p style="margin: 4px 0; font-size: 13px; color: #475569;">
          <strong>Transacción:</strong> #${datos.transaccionId}<br>
          <strong>Comprobante Fiscal:</strong> Factura ${datos.numeroFactura}<br>
          <strong>Total Abonado:</strong> $${datos.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS
        </p>
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        * Recordá presentar tu documento de identidad vigente al momento de embarcar. Podés imprimir los pasajes adjuntos o exhibirlos directamente desde tu teléfono móvil.
      </p>
    </div>
    <div class="footer">
      Sistema Aerolínea S.A. · Todos los derechos reservados · Email generado automáticamente.
    </div>
  </div>
</body>
</html>
  `.trim();

  const textoPlano = `
¡Tu pago fue aprobado exitosamente!
Vuelo: ${datos.vuelo.numeroVuelo} (${datos.vuelo.origen} -> ${datos.vuelo.destino})
Fecha de salida: ${datos.vuelo.fechaSalida} a las ${datos.vuelo.horaSalida} hs
Cabina: ${datos.clase}

Pasajeros:
${listaPasajerosTexto}

Resumen de Compra:
- Transacción: #${datos.transaccionId}
- Factura: ${datos.numeroFactura}
- Total Abonado: $${datos.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS

En los archivos adjuntos de este correo encontrarás los pases de abordaje en PDF y tu comprobante fiscal.
  `.trim();

  return { asunto, html, textoPlano };
}

function formatearFecha(fecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [year, month, day] = fecha.split("-");
    return `${day}/${month}/${year}`;
  }
  return fecha;
}

export interface PasajeroNotificacion {
  nombre: string;
  apellido: string;
  documento?: string;
  codigoPasaje: string;
  asiento: string | null;
  clase: string;
}

export interface DatosEmailCancelacionVuelo {
  emailDestinatario?: string;
  numeroVuelo: string;
  origen: {
    iata: string;
    ciudad: string;
    nombre: string;
  };
  destino: {
    iata: string;
    ciudad: string;
    nombre: string;
  };
  fechaSalida: string;
  horaSalida: string;
  pasajeros: PasajeroNotificacion[];
  motivo?: string;
}

export function construirEmailCancelacionVuelo(datos: DatosEmailCancelacionVuelo): {
  asunto: string;
  html: string;
  textoPlano: string;
} {
  const fechaLegible = formatearFecha(datos.fechaSalida);
  const asunto = `⚠️ Cancelación de vuelo ${datos.numeroVuelo} (${datos.origen.iata} ➔ ${datos.destino.iata}) - ${fechaLegible}`;

  const listaPasajerosHtml = datos.pasajeros
    .map(
      (p) => `
      <li style="margin-bottom: 8px; color: #334155;">
        <strong>${p.apellido.toUpperCase()}, ${p.nombre.toUpperCase()}</strong>
        ${p.documento ? `· DNI: ${p.documento}` : ""}
        · Billete: <span style="font-weight: 600;">#${p.codigoPasaje}</span>
        · Cabina: <span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${p.clase}</span>
        ${p.asiento ? `· Asiento: <span style="color: #0284c7; font-weight: 600;">${p.asiento}</span>` : ""}
      </li>`
    )
    .join("");

  const listaPasajerosTexto = datos.pasajeros
    .map(
      (p) =>
        `- ${p.apellido.toUpperCase()}, ${p.nombre.toUpperCase()}${
          p.documento ? ` (DNI: ${p.documento})` : ""
        } - Billete #${p.codigoPasaje} - Cabina: ${p.clase}${
          p.asiento ? ` - Asiento: ${p.asiento}` : ""
        }`
    )
    .join("\n");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; color: #94a3b8; font-size: 13px; }
    .content { padding: 24px; }
    .alert-box { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 24px; }
    .alert-box h2 { margin: 0 0 8px; font-size: 16px; color: #991b1b; }
    .alert-box p { margin: 0; font-size: 14px; color: #b91c1c; line-height: 1.5; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .info-card h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #64748b; }
    .badge-danger { display: inline-block; padding: 4px 10px; background-color: #fee2e2; color: #b91c1c; border-radius: 4px; font-weight: 700; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AEROLÍNEA NACIONAL</h1>
      <p>Notificación Oficial de Operaciones</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <h2>⚠️ Aviso de Cancelación de Vuelo</h2>
        <p>Lamentamos informarte que el vuelo <strong>${datos.numeroVuelo}</strong> programado para el <strong>${fechaLegible}</strong> ha sido cancelado por razones operativas.</p>
      </div>

      <div class="info-card">
        <h3>Detalle del Vuelo Cancelado</h3>
        <p style="font-size: 18px; font-weight: bold; margin: 4px 0; color: #0f172a;">
          ${datos.origen.ciudad} (${datos.origen.iata}) ➔ ${datos.destino.ciudad} (${datos.destino.iata})
        </p>
        <p style="margin: 4px 0; font-size: 13px; color: #475569;">
          <strong>Vuelo:</strong> ${datos.numeroVuelo} &nbsp;|&nbsp; 
          <strong>Fecha programada:</strong> ${fechaLegible} &nbsp;|&nbsp; 
          <strong>Hora programada:</strong> ${datos.horaSalida} hs
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #64748b;">
          <strong>Origen:</strong> ${datos.origen.nombre} &nbsp;➔&nbsp; <strong>Destino:</strong> ${datos.destino.nombre}
        </p>
        <p style="margin: 8px 0 0;"><span class="badge-danger">ESTADO: CANCELADO</span></p>
      </div>

      <div class="info-card">
        <h3>Billetes y Pasajeros Afectados (${datos.pasajeros.length})</h3>
        <ul style="padding-left: 20px; margin: 0; font-size: 13px;">
          ${listaPasajerosHtml}
        </ul>
      </div>

      <div class="info-card" style="background-color: #fdfaf6; border-color: #fde68a;">
        <h3 style="color: #92400e;">Opciones disponibles para tu viaje</h3>
        <ul style="padding-left: 20px; margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">
          <li><strong>Reubicación sin cargo:</strong> Podés solicitar el cambio sin penalidad ni diferencia de tarifa para la próxima salida disponible en esta ruta.</li>
          <li><strong>Reembolso total:</strong> Si preferís no reprogramar tu viaje, contás con la devolución del 100% del importe abonado a través del medio de pago original.</li>
        </ul>
        <p style="margin: 12px 0 0; font-size: 12px; color: #92400e;">
          Para gestionar tu preferencia, por favor contactá a nuestro centro de atención al pasajero o presentate en el mostrador de la aerolínea en el aeropuerto.
        </p>
      </div>
    </div>
    <div class="footer">
      Sistema Aerolínea S.A. · Todos los derechos reservados · Email generado automáticamente por el sistema de operaciones.
    </div>
  </div>
</body>
</html>
  `.trim();

  const textoPlano = `
⚠️ AVISO IMPORTANTE: VUELO CANCELADO
Vuelo: ${datos.numeroVuelo} (${datos.origen.iata} -> ${datos.destino.iata})
Ruta: ${datos.origen.ciudad} -> ${datos.destino.ciudad}
Fecha de salida: ${fechaLegible} a las ${datos.horaSalida} hs

Lamentamos informarte que la salida programada de este vuelo ha sido cancelada por razones operativas.

Billetes y Pasajeros Afectados:
${listaPasajerosTexto}

Opciones para tu viaje:
1. Reubicación sin costo: Podés solicitar el cambio sin penalidad ni diferencia de tarifa para la próxima salida disponible.
2. Reembolso total: Tenés derecho a la devolución del 100% del importe abonado a través del medio de pago original.

Para gestionar tu opción preferida, por favor comunicate con el centro de atención al pasajero o acércate al mostrador de la aerolínea en el aeropuerto.
  `.trim();

  return { asunto, html, textoPlano };
}

export interface DatosEmailCambioHorario {
  emailDestinatario?: string;
  numeroVuelo: string;
  origen: {
    iata: string;
    ciudad: string;
    nombre: string;
  };
  destino: {
    iata: string;
    ciudad: string;
    nombre: string;
  };
  fechaSalida: string;
  horarioAnterior: {
    horaSalida: string;
    horaLlegada: string;
  };
  nuevoHorario: {
    horaSalida: string;
    horaLlegada: string;
  };
  pasajeros: PasajeroNotificacion[];
}

export function construirEmailCambioHorario(datos: DatosEmailCambioHorario): {
  asunto: string;
  html: string;
  textoPlano: string;
} {
  const fechaLegible = formatearFecha(datos.fechaSalida);
  const asunto = `🕒 Notificación de Cambio de Horario: Vuelo ${datos.numeroVuelo} (${datos.origen.iata} ➔ ${datos.destino.iata}) - ${fechaLegible}`;

  const listaPasajerosHtml = datos.pasajeros
    .map(
      (p) => `
      <li style="margin-bottom: 8px; color: #334155;">
        <strong>${p.apellido.toUpperCase()}, ${p.nombre.toUpperCase()}</strong>
        ${p.documento ? `· DNI: ${p.documento}` : ""}
        · Billete: <span style="font-weight: 600;">#${p.codigoPasaje}</span>
        · Cabina: <span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${p.clase}</span>
        ${p.asiento ? `· Asiento: <span style="color: #0284c7; font-weight: 600;">${p.asiento}</span>` : ""}
      </li>`
    )
    .join("");

  const listaPasajerosTexto = datos.pasajeros
    .map(
      (p) =>
        `- ${p.apellido.toUpperCase()}, ${p.nombre.toUpperCase()}${
          p.documento ? ` (DNI: ${p.documento})` : ""
        } - Billete #${p.codigoPasaje} - Cabina: ${p.clase}${
          p.asiento ? ` - Asiento: ${p.asiento}` : ""
        }`
    )
    .join("\n");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; color: #94a3b8; font-size: 13px; }
    .content { padding: 24px; }
    .alert-box { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin-bottom: 24px; }
    .alert-box h2 { margin: 0 0 8px; font-size: 16px; color: #1e40af; }
    .alert-box p { margin: 0; font-size: 14px; color: #1d4ed8; line-height: 1.5; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .info-card h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #64748b; }
    .schedule-box { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 12px 0; }
    .schedule-col-prev { background-color: #f1f5f9; border-radius: 6px; padding: 12px 14px; }
    .schedule-col-new { background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AEROLÍNEA NACIONAL</h1>
      <p>Notificación Oficial de Operaciones</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <h2>🕒 Reprogramación de Horario de Vuelo</h2>
        <p>Te informamos que por ajustes operativos en la programación aérea, el vuelo <strong>${datos.numeroVuelo}</strong> del día <strong>${fechaLegible}</strong> ha modificado su horario.</p>
      </div>

      <div class="info-card">
        <h3>Comparativa de Itinerario</h3>
        <table class="schedule-box">
          <tr>
            <td class="schedule-col-prev" style="width: 48%; vertical-align: top;">
              <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 6px;">
                Horario Anterior
              </div>
              <div style="font-size: 13px; color: #64748b; text-decoration: line-through; margin-bottom: 4px;">
                Salida: ${datos.horarioAnterior.horaSalida} hs
              </div>
              <div style="font-size: 13px; color: #64748b; text-decoration: line-through;">
                Llegada: ${datos.horarioAnterior.horaLlegada} hs
              </div>
            </td>
            <td style="width: 4%;"></td>
            <td class="schedule-col-new" style="width: 48%; vertical-align: top;">
              <div style="font-size: 11px; text-transform: uppercase; color: #065f46; font-weight: bold; margin-bottom: 6px;">
                Nuevo Horario Confirmado
              </div>
              <div style="font-size: 15px; color: #047857; font-weight: bold; margin-bottom: 4px;">
                Salida: ${datos.nuevoHorario.horaSalida} hs
              </div>
              <div style="font-size: 15px; color: #047857; font-weight: bold;">
                Llegada: ${datos.nuevoHorario.horaLlegada} hs
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 12px; font-size: 13px; color: #475569;">
          <strong>Ruta:</strong> ${datos.origen.ciudad} (${datos.origen.iata}) ➔ ${datos.destino.ciudad} (${datos.destino.iata})<br>
          <strong>Fecha:</strong> ${fechaLegible}
        </div>
      </div>

      <div class="info-card">
        <h3>Billetes y Pasajeros Confirmados (${datos.pasajeros.length})</h3>
        <ul style="padding-left: 20px; margin: 0; font-size: 13px;">
          ${listaPasajerosHtml}
        </ul>
        <p style="margin: 10px 0 0; font-size: 12px; color: #047857; font-weight: 500;">
          ✓ Tus billetes y asientos asignados se mantienen válidos para el nuevo horario sin necesidad de trámites adicionales.
        </p>
      </div>

      <div class="info-card" style="background-color: #f8fafc;">
        <h3 style="color: #334155;">Recomendaciones para tu viaje</h3>
        <ul style="padding-left: 20px; margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
          <li>Presentate en el mostrador del aeropuerto con al menos <strong>2 horas de anticipación</strong> al nuevo horario de despegue (${datos.nuevoHorario.horaSalida} hs).</li>
          <li>Recordá llevar tu documento de identidad (DNI o Pasaporte) vigente.</li>
          <li>Podés consultar las pantallas de información del aeropuerto a tu llegada para conocer la puerta de embarque asignada.</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      Sistema Aerolínea S.A. · Todos los derechos reservados · Email generado automáticamente por el sistema de operaciones.
    </div>
  </div>
</body>
</html>
  `.trim();

  const textoPlano = `
🕒 NOTIFICACIÓN DE CAMBIO DE HORARIO
Vuelo: ${datos.numeroVuelo} (${datos.origen.iata} -> ${datos.destino.iata})
Ruta: ${datos.origen.ciudad} -> ${datos.destino.ciudad}
Fecha: ${fechaLegible}

ITINERARIO ANTERIOR:
- Salida: ${datos.horarioAnterior.horaSalida} hs
- Llegada: ${datos.horarioAnterior.horaLlegada} hs

NUEVO ITINERARIO CONFIRMADO:
- Salida: ${datos.nuevoHorario.horaSalida} hs
- Llegada: ${datos.nuevoHorario.horaLlegada} hs

Billetes y Pasajeros:
${listaPasajerosTexto}

✓ Tus billetes y asientos asignados se mantienen válidos para el nuevo horario sin necesidad de reemisión.
Por favor presentate en el aeropuerto con 2 horas de anticipación al nuevo horario de salida (${datos.nuevoHorario.horaSalida} hs) portando tu DNI vigente.
  `.trim();

  return { asunto, html, textoPlano };
}
