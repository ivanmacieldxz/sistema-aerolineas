import PDFDocument from "pdfkit";

export interface DatosFacturaPDF {
  numeroFactura: string;
  tipoFactura: "A" | "B" | "C" | string;
  fechaEmision: string;
  receptor: {
    nombreRazonSocial: string;
    identificacionFiscal: string;
    email: string;
  };
  vuelo: {
    numeroVuelo: string;
    origen: {
      iata: string;
      ciudad: string;
    };
    destino: {
      iata: string;
      ciudad: string;
    };
    fechaSalida: string;
  };
  clase: string;
  cantidadPasajes: number;
  precioUnitario: number;
  total: number;
  metodoPago: string;
  idTransaccionPasarela?: string;
}

/** Mapea el código técnico del método de pago a una denominación amigable. */
function formatearMetodoPago(metodo: string): string {
  switch (metodo) {
    case "TARJETA_CREDITO":
      return "Mercado Pago (Tarjeta de Crédito)";
    case "TARJETA_DEBITO":
      return "Mercado Pago (Tarjeta de Débito)";
    case "TRANSFERENCIA":
      return "Mercado Pago (Transferencia / Débito Inmediato)";
    default:
      return "Mercado Pago";
  }
}

/** Devuelve el código oficial de comprobante según la normativa fiscal. */
function obtenerCodigoAfip(tipo: string): string {
  switch (tipo.toUpperCase()) {
    case "A":
      return "COD. 001";
    case "B":
      return "COD. 006";
    case "C":
      return "COD. 011";
    default:
      return "COD. 006";
  }
}

/**
 * Genera el documento PDF de la Factura de compra electrónica,
 * devolviendo un Buffer en memoria listo para adjuntar por correo.
 */
export async function generarFacturaPDF(datos: DatosFacturaPDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 36,
      info: {
        Title: `Factura ${datos.numeroFactura}`,
        Author: "Sistema Aerolínea S.A.",
        Subject: `Comprobante fiscal electrónico para ${datos.receptor.nombreRazonSocial}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 36;
    const top = 36;
    const width = 523;

    // --- RECTÁNGULO CONTENEDOR DE CABECERA ---
    const headerHeight = 115;
    doc.roundedRect(left, top, width, headerHeight, 4).stroke("#cbd5e1");

    // Recuadro central de la Letra de Comprobante (A, B, C)
    const boxLetterWidth = 36;
    const boxLetterHeight = 36;
    const boxLetterX = left + width / 2 - boxLetterWidth / 2;
    doc.rect(boxLetterX, top, boxLetterWidth, boxLetterHeight).fillAndStroke("#ffffff", "#0f172a");

    const tipoLetra = datos.tipoFactura.toUpperCase();
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(22).text(tipoLetra, boxLetterX, top + 6, {
      width: boxLetterWidth,
      align: "center",
    });
    doc.font("Helvetica").fontSize(6.5).fillColor("#475569").text(obtenerCodigoAfip(tipoLetra), boxLetterX - 5, top + boxLetterHeight + 3, {
      width: boxLetterWidth + 10,
      align: "center",
    });

    // Línea vertical que divide emisor y datos del comprobante
    doc
      .strokeColor("#cbd5e1")
      .moveTo(left + width / 2, top + boxLetterHeight + 14)
      .lineTo(left + width / 2, top + headerHeight)
      .stroke();

    // --- DATOS DEL EMISOR (IZQUIERDA) ---
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("AEROLÍNEA NACIONAL S.A.", left + 14, top + 14);
    doc.font("Helvetica").fontSize(8).fillColor("#475569").text(
      "Razón Social: Aerolínea Nacional S.A.\n" +
      "Domicilio Comercial: Av. del Libertador 1000, CABA\n" +
      "Condición frente al IVA: IVA Responsable Inscripto",
      left + 14,
      top + 34,
      { width: width / 2 - 40, lineGap: 3 }
    );

    // --- DATOS DEL COMPROBANTE (DERECHA) ---
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(14).text("FACTURA", left + width / 2 + 25, top + 14);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0284c7").text(datos.numeroFactura, left + width / 2 + 25, top + 32);
    doc.font("Helvetica").fontSize(8).fillColor("#475569").text(
      `Fecha de Emisión: ${datos.fechaEmision}\n` +
      "CUIT: 30-71445566-9\n" +
      "Ingresos Brutos: 901-234567-8\n" +
      "Inicio de Actividades: 01/01/2020",
      left + width / 2 + 25,
      top + 48,
      { width: width / 2 - 35, lineGap: 3 }
    );

    // --- DATOS DEL RECEPTOR (CLIENTE / COMPRADOR) ---
    const receptorTop = top + headerHeight + 10;
    const receptorHeight = 65;
    doc.roundedRect(left, receptorTop, width, receptorHeight, 4).fillAndStroke("#f8fafc", "#cbd5e1");

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9).text("DATOS DEL CLIENTE / RECEPTOR", left + 14, receptorTop + 10);

    const condIva = tipoLetra === "A" ? "IVA Responsable Inscripto" : "Consumidor Final";

    doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(
      `Nombre / Razón Social: ${datos.receptor.nombreRazonSocial}\n` +
      `Identificación Fiscal (CUIT/DNI): ${datos.receptor.identificacionFiscal}\n` +
      `Email de Contacto: ${datos.receptor.email}`,
      left + 14,
      receptorTop + 24,
      { width: 280, lineGap: 3 }
    );

    doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(
      `Condición IVA: ${condIva}\n` +
      `Condición de Venta: Contado / Digital\n` +
      `Medio de Pago: ${formatearMetodoPago(datos.metodoPago)}`,
      left + 300,
      receptorTop + 24,
      { width: 210, lineGap: 3 }
    );

    // --- TABLA DE DETALLE DE PASAJES ---
    const tableTop = receptorTop + receptorHeight + 15;
    const tableHeaderHeight = 22;

    // Encabezado tabla
    doc.roundedRect(left, tableTop, width, tableHeaderHeight, 2).fill("#0f172a");

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
    doc.text("DESCRIPCIÓN DEL CONCEPTO", left + 12, tableTop + 6, { width: 220 });
    doc.text("CLASE", left + 240, tableTop + 6, { width: 75 });
    doc.text("CANTIDAD", left + 325, tableTop + 6, { width: 55, align: "center" });
    doc.text("P. UNITARIO", left + 390, tableTop + 6, { width: 60, align: "right" });
    doc.text("SUBTOTAL", left + 455, tableTop + 6, { width: 56, align: "right" });

    // Fila del ítem facturado
    const rowTop = tableTop + tableHeaderHeight + 8;
    const rowHeight = 35;
    doc.rect(left, rowTop - 4, width, rowHeight).fillAndStroke("#ffffff", "#e2e8f0");

    const descripcion = `Servicio de transporte aéreo de pasajeros\nVuelo ${datos.vuelo.numeroVuelo} (${datos.vuelo.origen.iata} - ${datos.vuelo.destino.iata}) · Salida: ${datos.vuelo.fechaSalida}`;

    doc.fillColor("#0f172a").font("Helvetica").fontSize(8).text(descripcion, left + 12, rowTop, {
      width: 220,
      lineGap: 2,
    });

    const claseTexto = datos.clase.toUpperCase() === "PRIMERA" ? "Primera Clase" : "Economy";
    doc.font("Helvetica").fontSize(8.5).text(claseTexto, left + 240, rowTop + 4);
    doc.text(datos.cantidadPasajes.toString(), left + 325, rowTop + 4, { width: 55, align: "center" });
    doc.text(`$${datos.precioUnitario.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, left + 390, rowTop + 4, {
      width: 60,
      align: "right",
    });
    doc.font("Helvetica-Bold").text(`$${datos.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, left + 455, rowTop + 4, {
      width: 56,
      align: "right",
    });

    // --- BLOQUE DE LIQUIDACIÓN Y TOTALES ---
    const totalBlockTop = rowTop + rowHeight + 15;
    const totalBlockHeight = tipoLetra === "A" ? 75 : 55;
    const totalBoxWidth = 240;
    const totalBoxX = left + width - totalBoxWidth;

    doc.roundedRect(totalBoxX, totalBlockTop, totalBoxWidth, totalBlockHeight, 4).fillAndStroke("#f8fafc", "#cbd5e1");

    if (tipoLetra === "A") {
      // Discriminación formal para Factura A
      const netoGravado = Number((datos.total / 1.21).toFixed(2));
      const iva21 = Number((datos.total - netoGravado).toFixed(2));

      doc.fillColor("#475569").font("Helvetica").fontSize(8.5);
      doc.text("Subtotal Neto Gravado:", totalBoxX + 12, totalBlockTop + 10);
      doc.text(`$${netoGravado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalBoxX + 130, totalBlockTop + 10, { width: 98, align: "right" });

      doc.text("IVA (21%):", totalBoxX + 12, totalBlockTop + 26);
      doc.text(`$${iva21.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalBoxX + 130, totalBlockTop + 26, { width: 98, align: "right" });

      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11);
      doc.text("IMPORTE TOTAL:", totalBoxX + 12, totalBlockTop + 46);
      doc.fillColor("#0284c7").text(`$${datos.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`, totalBoxX + 110, totalBlockTop + 46, { width: 118, align: "right" });
    } else {
      // Factura B / C para consumidor final (IVA no discriminado)
      doc.fillColor("#475569").font("Helvetica").fontSize(8.5);
      doc.text("Subtotal:", totalBoxX + 12, totalBlockTop + 10);
      doc.text(`$${datos.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalBoxX + 110, totalBlockTop + 10, { width: 118, align: "right" });

      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11);
      doc.text("IMPORTE TOTAL:", totalBoxX + 12, totalBlockTop + 30);
      doc.fillColor("#0284c7").text(`$${datos.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`, totalBoxX + 110, totalBlockTop + 30, { width: 118, align: "right" });
    }

    // --- PIE FISCAL Y REFERENCIA ELECTRÓNICA ---
    const footerTop = totalBlockTop + totalBlockHeight + 30;
    doc.roundedRect(left, footerTop, width, 55, 4).stroke("#cbd5e1");

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text("COMPROBANTE ELECTRÓNICO AUTORIZADO", left + 14, footerTop + 10);
    
    const pasarelaInfo = datos.idTransaccionPasarela ? ` · Operación Mercado Pago #${datos.idTransaccionPasarela}` : "";
    doc.fillColor("#64748b").font("Helvetica").fontSize(7.5).text(
      `Comprobante emitido de forma automática conforme a las disposiciones fiscales vigentes${pasarelaInfo}.\n` +
      "La constancia de recepción de este documento digital acredita el pago y perfecciona el contrato de transporte aéreo.",
      left + 14,
      footerTop + 24,
      { width: width - 28, lineGap: 2 }
    );

    doc.end();
  });
}
