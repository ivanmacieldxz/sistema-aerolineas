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
