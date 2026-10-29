import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { enviarComprobantesCompra } from "@/modules/notificaciones/service";

const EMAIL_TEST = "jereet31@gmail.com";

async function runTestSuite() {
  console.log("===============================================================");
  console.log("   SUITE DE PRUEBAS - USER STORY 11: EMISIÓN Y ENVÍO AUTOMÁTICO");
  console.log("   Destinatario de pruebas:", EMAIL_TEST);
  console.log("===============================================================\n");

  // Buscar una instancia de vuelo real en la base de datos
  const instancia = await prisma.instanciaVuelo.findFirst({
    where: { deleted: false },
    include: { vuelo: true },
  });

  if (!instancia) {
    throw new Error("No se encontró ninguna instancia de vuelo activa para ejecutar las pruebas.");
  }

  console.log(`[Setup] Utilizando instancia de vuelo #${instancia.id.toString()} (${instancia.vuelo.numeroVuelo} ${instancia.vuelo.origenIata} -> ${instancia.vuelo.destinoIata})`);

  let transaccionAprobadaId: bigint | null = null;
  let transaccionRechazadaId: bigint | null = null;

  try {
    // -------------------------------------------------------------------------
    // ESCENARIO 1: Pago Aprobado (Happy Path con 2 pasajeros)
    // Criterio 1: Un pasaje por pasajero y una factura
    // Criterio 2: Envío en menos de 2 minutos
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 1: Compra Confirmada (2 Pasajeros) -> Emisión y Envío");
    console.log("-------------------------------------------------------------");

    const inicioTest1 = Date.now();

    const transaccionAprobada = await prisma.transaccionCompra.create({
      data: {
        emailContacto: EMAIL_TEST,
        estado: "CONFIRMADA",
        total: 150000.0,
        pasajes: {
          create: [
            {
              instanciaVueloId: instancia.id,
              clase: "ECONOMY",
              pasajeroNombre: "Jeremías",
              pasajeroApellido: "TestUser",
              pasajeroDocumento: "40123456",
              numeroAsiento: "12A",
              estado: "EMITIDO",
            },
            {
              instanciaVueloId: instancia.id,
              clase: "ECONOMY",
              pasajeroNombre: "Sofía",
              pasajeroApellido: "Acompañante",
              pasajeroDocumento: "41987654",
              numeroAsiento: "12B",
              estado: "EMITIDO",
            },
          ],
        },
        pago: {
          create: {
            metodoPago: "TARJETA_CREDITO",
            idTransaccionPasarela: "MP-TEST-998877",
            monto: 150000.0,
            estado: "APROBADO",
          },
        },
      },
    });

    transaccionAprobadaId = transaccionAprobada.id;

    // Crear Factura legal 1:1
    await prisma.factura.create({
      data: {
        transaccionId: transaccionAprobada.id,
        numeroFactura: `FC-B-0001-${transaccionAprobada.id.toString().padStart(8, "0")}`,
        tipoFactura: "B",
        nombreRazonSocial: "Jeremías TestUser",
        identificacionFiscal: "40123456",
        total: 150000.0,
      },
    });

    console.log(`[Test 1] Transacción #${transaccionAprobada.id.toString()} creada con 2 pasajes y Factura B.`);

    // Invocar servicio de notificaciones
    const resultadoEnvio = await enviarComprobantesCompra(transaccionAprobada.id);

    const duracionMs = Date.now() - inicioTest1;
    console.log(`[Test 1] Tiempo total de ejecución: ${duracionMs} ms (${(duracionMs / 1000).toFixed(2)} segundos).`);

    if (!resultadoEnvio.success) {
      throw new Error(`[Test 1] Falló el envío de comprobantes: ${resultadoEnvio.reason}`);
    }

    if (resultadoEnvio.pasajesEnviados !== 2) {
      throw new Error(`[Test 1] Se esperaban 2 pasajes adjuntos pero se enviaron: ${resultadoEnvio.pasajesEnviados}`);
    }

    if (duracionMs > 120_000) {
      throw new Error(`[Test 1] El envío superó el SLA de 2 minutos (duró ${duracionMs} ms).`);
    }

    console.log("✔ TEST 1 SUPERADO: Se emitieron 2 pasajes, 1 factura y se despachó el email en < 2 minutos.");

    // -------------------------------------------------------------------------
    // ESCENARIO 2: Pago Rechazado (Criterio 3: No emitir comprobantes)
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 2: Pago Rechazado -> No emisión de pasajes ni factura");
    console.log("-------------------------------------------------------------");

    const transaccionRechazada = await prisma.transaccionCompra.create({
      data: {
        emailContacto: EMAIL_TEST,
        estado: "RECHAZADA",
        total: 75000.0,
        pasajes: {
          create: [
            {
              instanciaVueloId: instancia.id,
              clase: "ECONOMY",
              pasajeroNombre: "Pasajero",
              pasajeroApellido: "Cancelado",
              pasajeroDocumento: "33111222",
              estado: "CANCELADO",
            },
          ],
        },
        pago: {
          create: {
            metodoPago: "TARJETA_CREDITO",
            idTransaccionPasarela: "MP-TEST-REJECTED",
            monto: 75000.0,
            estado: "RECHAZADO",
          },
        },
      },
    });

    transaccionRechazadaId = transaccionRechazada.id;

    const resultadoRechazado = await enviarComprobantesCompra(transaccionRechazada.id);

    if (resultadoRechazado.success !== false || resultadoRechazado.reason !== "ESTADO_NO_CONFIRMADO") {
      throw new Error(`[Test 2] Se esperaba bloqueo por no estar confirmada, pero devolvió: ${JSON.stringify(resultadoRechazado)}`);
    }

    console.log("✔ TEST 2 SUPERADO: Transacción rechazada previene correctamente la emisión y el envío.");

    // -------------------------------------------------------------------------
    // ESCENARIO 3: Transacción Inexistente
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 3: Transacción Inexistente -> Validación defensiva");
    console.log("-------------------------------------------------------------");

    const resultadoInexistente = await enviarComprobantesCompra(BigInt(999999999999));
    if (resultadoInexistente.success !== false || resultadoInexistente.reason !== "TRANSACCION_NO_ENCONTRADA") {
      throw new Error("[Test 3] No manejó adecuadamente la transacción inexistente.");
    }
    console.log("✔ TEST 3 SUPERADO: Validación defensiva contra IDs inválidos correcta.");

    // -------------------------------------------------------------------------
    // ESCENARIO 4: Transacción Confirmada pero sin Factura
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 4: Transacción Confirmada sin Factura -> Criterio 3");
    console.log("-------------------------------------------------------------");

    const transaccionSinFactura = await prisma.transaccionCompra.create({
      data: {
        emailContacto: EMAIL_TEST,
        estado: "CONFIRMADA",
        total: 50000.0,
      },
    });

    const resultadoSinFactura = await enviarComprobantesCompra(transaccionSinFactura.id);
    if (resultadoSinFactura.success !== false || resultadoSinFactura.reason !== "FACTURA_INEXISTENTE") {
      throw new Error("[Test 4] Debería rechazar si la factura legal no fue generada.");
    }

    // Limpiar transacción auxiliar
    await prisma.transaccionCompra.delete({ where: { id: transaccionSinFactura.id } });
    console.log("✔ TEST 4 SUPERADO: No se envían comprobantes incompletos sin factura.");

    console.log("\n===============================================================");
    console.log("   🎉 TODOS LOS TEST DE LA USER STORY 11 FUERON SUPERADOS CON ÉXITO");
    console.log("===============================================================");
  } finally {
    // Soft delete o limpieza de registros de prueba
    if (transaccionAprobadaId) {
      await prisma.transaccionCompra.update({
        where: { id: transaccionAprobadaId },
        data: { deleted: true },
      });
      console.log(`[Cleanup] Transacción de prueba #${transaccionAprobadaId.toString()} marcada como deleted: true (Soft delete).`);
    }

    if (transaccionRechazadaId) {
      await prisma.transaccionCompra.update({
        where: { id: transaccionRechazadaId },
        data: { deleted: true },
      });
      console.log(`[Cleanup] Transacción de prueba #${transaccionRechazadaId.toString()} marcada como deleted: true (Soft delete).`);
    }

    await prisma.$disconnect();
  }
}

runTestSuite().catch((err) => {
  console.error("❌ Error en la ejecución de la suite de pruebas:", err);
  process.exit(1);
});
