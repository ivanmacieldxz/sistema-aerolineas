import PDFDocument from "pdfkit";

export interface DatosPasajePDF {
  codigoPasaje: string;
  transaccionId: string;
  pasajero: {
    nombre: string;
    apellido: string;
    documento: string;
  };
  vuelo: {
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
    horaLlegada: string;
  };
  clase: string;
  numeroAsiento: string | null;
}

/**
 * Genera el documento PDF del pase de abordaje electrónico (e-ticket)
 * para un pasajero específico, devolviendo un Buffer en memoria.
 */
export async function generarPasajePDF(datos: DatosPasajePDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 36,
      info: {
        Title: `Pase de Abordaje - ${datos.vuelo.numeroVuelo} - ${datos.pasajero.apellido}`,
        Author: "Sistema Aerolínea",
        Subject: `Billete electrónico #${datos.codigoPasaje}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 36;
    const top = 36;
    const cardWidth = 523;
    const cardHeight = 310;
    const stubWidth = 140;
    const mainWidth = cardWidth - stubWidth;

    // --- Tarjeta Principal (Boarding Pass) ---
    doc.roundedRect(left, top, cardWidth, cardHeight, 8).stroke("#cbd5e1");

    // Cabecera superior
    doc.roundedRect(left, top, cardWidth, 48, 8).fill("#0f172a");
    // Parche para esquinas inferiores rectas en la cabecera
    doc.rect(left, top + 38, cardWidth, 10).fill("#0f172a");

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(14).text("AEROLÍNEA NACIONAL", left + 16, top + 14);
    doc.font("Helvetica").fontSize(9).fillColor("#94a3b8").text("PASE DE ABORDAJE / BOARDING PASS", left + 16, top + 30);

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#38bdf8").text(`TICKET #${datos.codigoPasaje}`, left + cardWidth - 160, top + 18, {
      width: 144,
      align: "right",
    });

    // Línea vertical punteada divisoria entre cuerpo y talón (stub)
    const dividerX = left + mainWidth;
    doc
      .save()
      .strokeColor("#94a3b8")
      .dash(4, { space: 3 })
      .moveTo(dividerX, top + 52)
      .lineTo(dividerX, top + cardHeight - 8)
      .stroke()
      .restore();

    // --- SECCIÓN PRINCIPAL (IZQUIERDA) ---
    // Ruta (Origen -> Destino)
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(26).text(datos.vuelo.origen.iata, left + 16, top + 60);
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(datos.vuelo.origen.ciudad, left + 16, top + 90, { width: 120 });

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0284c7").text("➔", left + 140, top + 64);

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(26).text(datos.vuelo.destino.iata, left + 175, top + 60);
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(datos.vuelo.destino.ciudad, left + 175, top + 90, { width: 120 });

    // Datos del pasajero
    const paxTop = top + 115;
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("PASAJERO / PASSENGER", left + 16, paxTop);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text(`${datos.pasajero.apellido.toUpperCase()}, ${datos.pasajero.nombre.toUpperCase()}`, left + 16, paxTop + 10);
    doc.fillColor("#475569").font("Helvetica").fontSize(9).text(`DOC: ${datos.pasajero.documento}`, left + 16, paxTop + 25);

    // Vuelo y Fecha
    const flightTop = top + 160;
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("VUELO / FLIGHT", left + 16, flightTop);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text(datos.vuelo.numeroVuelo, left + 16, flightTop + 10);

    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("FECHA / DATE", left + 110, flightTop);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(datos.vuelo.fechaSalida, left + 110, flightTop + 10);

    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("HORA / TIME", left + 225, flightTop);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(`${datos.vuelo.horaSalida} hs`, left + 225, flightTop + 10);

    // Clase y Asiento
    const seatTop = top + 205;
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("CLASE / CABIN", left + 16, seatTop);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(datos.clase.toUpperCase(), left + 16, seatTop + 10);

    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("ASIENTO / SEAT", left + 110, seatTop);
    doc.fillColor(datos.numeroAsiento ? "#0284c7" : "#d97706").font("Helvetica-Bold").fontSize(14).text(datos.numeroAsiento ?? "POR CHECK-IN", left + 110, seatTop + 8);

    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("EMBARQUE / BOARDING", left + 225, seatTop);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text("45 min antes", left + 225, seatTop + 10);

    // Código de barras simulado / Pie de tarjeta
    const barTop = top + 255;
    doc.rect(left + 16, barTop, 335, 40).fillAndStroke("#f8fafc", "#e2e8f0");
    // Dibujo de barras representativas
    let barX = left + 26;
    const barPattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 1, 3, 2, 4, 1, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1];
    doc.fillColor("#1e293b");
    for (const w of barPattern) {
      doc.rect(barX, barTop + 6, w, 20).fill();
      barX += w + 2;
    }
    doc.fillColor("#64748b").font("Courier").fontSize(8).text(`*ETK-${datos.codigoPasaje}-TR-${datos.transaccionId}*`, left + 26, barTop + 28);

    // --- TALÓN DE CONTROL (STUB DERECHO) ---
    const stubLeft = dividerX + 14;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(datos.vuelo.numeroVuelo, stubLeft, top + 60);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(`${datos.vuelo.origen.iata} ➔ ${datos.vuelo.destino.iata}`, stubLeft, top + 74);

    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text("PASAJERO", stubLeft, top + 95);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9).text(`${datos.pasajero.apellido}`, stubLeft, top + 105, { width: 115 });
    doc.font("Helvetica").fontSize(8).text(`${datos.pasajero.nombre}`, stubLeft, top + 117, { width: 115 });

    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text("ASIENTO", stubLeft, top + 140);
    doc.fillColor("#0284c7").font("Helvetica-Bold").fontSize(12).text(datos.numeroAsiento ?? "CHK-IN", stubLeft, top + 150);

    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text("CLASE", stubLeft, top + 175);
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8).text(datos.clase, stubLeft, top + 185);

    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text("FECHA", stubLeft, top + 205);
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8).text(datos.vuelo.fechaSalida, stubLeft, top + 215);

    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text("TICKET ID", stubLeft, top + 235);
    doc.fillColor("#0f172a").font("Courier-Bold").fontSize(8).text(`#${datos.codigoPasaje}`, stubLeft, top + 245);

    // --- AVISOS GENERALES AL PASAJERO (FUERA DE LA TARJETA) ---
    const infoTop = top + cardHeight + 25;
    doc.rect(left, infoTop, cardWidth, 130).fillAndStroke("#f8fafc", "#e2e8f0");

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text("INFORMACIÓN IMPORTANTE PARA EL VIAJE", left + 16, infoTop + 14);
    
    doc.fillColor("#475569").font("Helvetica").fontSize(8.5).text(
      "• Presentación en aeropuerto: Para vuelos de cabotaje, presentate al menos 90 minutos antes del horario programado de salida.\n" +
      "• Documentación obligatoria: Todos los pasajeros deben presentar DNI vigente o Pasaporte para abordar el avión.\n" +
      "• Equipaje de mano: Permitido una pieza de hasta 8 kg que quepa en el compartimento superior o bajo el asiento delantero.\n" +
      "• Asignación de asiento: Si tu billete indica 'POR CHECK-IN', recordá que podés seleccionar o reasignar tu butaca en nuestra terminal de mostrador o mediante el check-in web hasta 2 horas antes de la partida.\n" +
      "• Modificaciones y cancelaciones: Sujetas a las condiciones tarifarias de la clase seleccionada.",
      left + 16,
      infoTop + 32,
      { width: cardWidth - 32, lineGap: 3 }
    );

    // Pie de página
    doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(
      "Sistema de Gestión Aerocomercial · Documento emitido electrónicamente con validez legal para el embarque.",
      left,
      top + cardHeight + 175,
      { align: "center", width: cardWidth }
    );

    doc.end();
  });
}
