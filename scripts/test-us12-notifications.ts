import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import {
  createFlightWithBatchInstances,
  updateFlightById,
  cancelFlightInstance,
  FlightInstanceCancellationError,
} from "@/modules/vuelos/service";
import {
  notificarCancelacionSalida,
  notificarCambioHorarioVuelo,
} from "@/modules/notificaciones/service";

const EMAIL_TEST = "jereet31@gmail.com";

async function runTestSuite() {
  console.log("=======================================================================");
  console.log("   SUITE DE PRUEBAS - USER STORY 12: NOTIFICACIONES AUTOMÁTICAS");
  console.log("   Destinatario de pruebas:", EMAIL_TEST);
  console.log("=======================================================================\n");

  const vueloIdsParaLimpiar: bigint[] = [];
  const transaccionIdsParaLimpiar: bigint[] = [];

  try {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    const en30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const en30DiasStr = en30Dias.toISOString().slice(0, 10);
    const fechaSalida10Dias = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    fechaSalida10Dias.setUTCHours(0, 0, 0, 0);

    const numeroVuelo1 = `T12-${Date.now().toString().slice(-4)}`;

    console.log(`[Setup] Creando vuelo de prueba ${numeroVuelo1} (EZE ➔ MIA) con vigencia futura...`);

    const { vuelo: vuelo1 } = await createFlightWithBatchInstances({
      numeroVuelo: numeroVuelo1,
      origenIata: "EZE",
      destinoIata: "MIA",
      horaSalida: "09:00",
      horaLlegada: "17:30",
      vigenciaDesde: new Date(`${hoyStr}T00:00:00.000Z`),
      vigenciaHasta: new Date(`${en30DiasStr}T00:00:00.000Z`),
      diasSemana: [1, 2, 3, 4, 5, 6, 7],
      capacidadEconomy: 100,
      precioEconomy: 120000,
      capacidadPrimera: 10,
      precioPrimera: 250000,
    });
    vueloIdsParaLimpiar.push(vuelo1.id);

    // Obtener una de las salidas futuras generadas
    const salida1 = await prisma.instanciaVuelo.findFirst({
      where: {
        vueloId: vuelo1.id,
        fechaSalida: { gte: fechaSalida10Dias },
        deleted: false,
      },
    });

    if (!salida1) {
      throw new Error("[Setup] No se generaron instancias para el vuelo de prueba.");
    }

    console.log(`[Setup] Creando reserva confirmada con 2 pasajeros (Email: ${EMAIL_TEST})...`);
    const transaccion1 = await prisma.transaccionCompra.create({
      data: {
        emailContacto: EMAIL_TEST,
        estado: "CONFIRMADA",
        total: 240000,
        pasajes: {
          create: [
            {
              instanciaVueloId: salida1.id,
              clase: "ECONOMY",
              pasajeroNombre: "Martín",
              pasajeroApellido: "Palermo",
              pasajeroDocumento: "23456789",
              numeroAsiento: "14A",
              estado: "EMITIDO",
            },
            {
              instanciaVueloId: salida1.id,
              clase: "ECONOMY",
              pasajeroNombre: "Román",
              pasajeroApellido: "Riquelme",
              pasajeroDocumento: "24567890",
              numeroAsiento: "14B",
              estado: "EMITIDO",
            },
          ],
        },
        pago: {
          create: {
            metodoPago: "MERCADO_PAGO",
            monto: 240000,
            estado: "APROBADO",
            idTransaccionPasarela: "MP-TEST-US12-A",
          },
        },
      },
    });
    transaccionIdsParaLimpiar.push(transaccion1.id);

    // -------------------------------------------------------------------------
    // TEST 1: Modificación de Horario de Vuelo (Detección y Notificación)
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 1: Modificación de Horario (09:00 -> 11:30) con pasajeros");
    console.log("-------------------------------------------------------------");

    const inicioTest1 = Date.now();
    const resultadoUpdate = await updateFlightById(vuelo1.id, {
      numeroVuelo: numeroVuelo1,
      origenIata: "EZE",
      destinoIata: "MIA",
      horaSalida: "11:30",
      horaLlegada: "20:00",
      vigenciaDesde: new Date(`${hoyStr}T00:00:00.000Z`),
      vigenciaHasta: new Date(`${en30DiasStr}T00:00:00.000Z`),
      diasSemana: [1, 2, 3, 4, 5, 6, 7],
      capacidadEconomy: 100,
      precioEconomy: 120000,
      capacidadPrimera: 10,
      precioPrimera: 250000,
    });

    if (!resultadoUpdate.cambioHorario) {
      throw new Error("[Test 1] Falló la detección: cambioHorario no debió ser null.");
    }

    if (resultadoUpdate.cambioHorario.nuevoHorario.horaSalida !== "11:30") {
      throw new Error(`[Test 1] Nuevo horario de salida incorrecto: ${resultadoUpdate.cambioHorario.nuevoHorario.horaSalida}`);
    }

    if (resultadoUpdate.cambioHorario.instanciasAfectadas.length !== 1) {
      throw new Error(`[Test 1] Se esperaba 1 instancia afectada, se obtuvieron: ${resultadoUpdate.cambioHorario.instanciasAfectadas.length}`);
    }

    const pasajerosAfectados1 = resultadoUpdate.cambioHorario.instanciasAfectadas[0].pasajerosAfectados;
    if (pasajerosAfectados1.length !== 2) {
      throw new Error(`[Test 1] Se esperaban 2 pasajeros afectados, se obtuvieron: ${pasajerosAfectados1.length}`);
    }

    console.log(`[Test 1] Detección exitosa: Horario anterior ${resultadoUpdate.cambioHorario.horarioAnterior.horaSalida} -> Nuevo horario ${resultadoUpdate.cambioHorario.nuevoHorario.horaSalida}.`);
    console.log(`[Test 1] Despachando notificación automática de cambio de horario...`);

    const envioCambio = await notificarCambioHorarioVuelo(resultadoUpdate.cambioHorario);
    const duracionTest1 = Date.now() - inicioTest1;

    console.log(`[Test 1] Resultado de envío:`, envioCambio);
    console.log(`[Test 1] Tiempo transcurrido: ${duracionTest1} ms`);

    if (envioCambio.emailsEnviados !== 1 || envioCambio.totalAfectados !== 2 || envioCambio.errores !== 0) {
      throw new Error("[Test 1] Error en el despacho del correo de cambio de horario.");
    }
    console.log("✔ TEST 1 SUPERADO: Notificación de cambio de horario enviada exitosamente.");

    // -------------------------------------------------------------------------
    // TEST 2: Cancelación de Salida con Pasajeros (Detección y Notificación)
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 2: Cancelación de Salida con Pasajeros Activos");
    console.log("-------------------------------------------------------------");

    const inicioTest2 = Date.now();
    const { canceledTickets, salidaInfo } = await cancelFlightInstance(salida1.id);

    if (canceledTickets !== 2) {
      throw new Error(`[Test 2] Se esperaba cancelar 2 pasajes, se cancelaron: ${canceledTickets}`);
    }

    if (salidaInfo.pasajerosAfectados.length !== 2) {
      throw new Error(`[Test 2] salidaInfo debió contener 2 pasajeros afectados.`);
    }

    // Verificar en DB que la salida y los pasajes estén CANCELADO
    const salidaEnDb = await prisma.instanciaVuelo.findUnique({ where: { id: salida1.id } });
    if (salidaEnDb?.estado !== "CANCELADO") {
      throw new Error(`[Test 2] El estado de la salida en DB no es CANCELADO.`);
    }

    const pasajesEnDb = await prisma.pasaje.findMany({ where: { instanciaVueloId: salida1.id } });
    const todosCancelados = pasajesEnDb.every((p) => p.estado === "CANCELADO");
    if (!todosCancelados) {
      throw new Error(`[Test 2] No todos los pasajes quedaron en estado CANCELADO.`);
    }

    console.log(`[Test 2] Salida y pasajes marcados como CANCELADO en BD.`);
    console.log(`[Test 2] Despachando notificación automática de cancelación...`);

    const envioCancelacion = await notificarCancelacionSalida(salidaInfo);
    const duracionTest2 = Date.now() - inicioTest2;

    console.log(`[Test 2] Resultado de envío:`, envioCancelacion);
    console.log(`[Test 2] Tiempo transcurrido: ${duracionTest2} ms`);

    if (envioCancelacion.emailsEnviados !== 1 || envioCancelacion.totalAfectados !== 2 || envioCancelacion.errores !== 0) {
      throw new Error("[Test 2] Error en el despacho del correo de cancelación.");
    }
    console.log("✔ TEST 2 SUPERADO: Notificación de cancelación de vuelo enviada exitosamente.");

    // -------------------------------------------------------------------------
    // TEST 3: Modificación SIN cambio de horario (No debe generar emails)
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 3: Modificación sin cambio de horario (Tarifas / Cupo)");
    console.log("-------------------------------------------------------------");

    const resultadoSinCambioHorario = await updateFlightById(vuelo1.id, {
      numeroVuelo: numeroVuelo1,
      origenIata: "EZE",
      destinoIata: "MIA",
      horaSalida: "11:30", // Misma hora que la actual
      horaLlegada: "20:00", // Misma hora que la actual
      vigenciaDesde: new Date(`${hoyStr}T00:00:00.000Z`),
      vigenciaHasta: new Date(`${en30DiasStr}T00:00:00.000Z`),
      diasSemana: [1, 2, 3, 4, 5, 6, 7],
      capacidadEconomy: 120, // Cambió cupo
      precioEconomy: 135000, // Cambió precio
      capacidadPrimera: 15,
      precioPrimera: 280000,
    });

    if (resultadoSinCambioHorario.cambioHorario !== null) {
      throw new Error("[Test 3] cambioHorario debió ser null ya que los horarios eran idénticos.");
    }
    console.log("✔ TEST 3 SUPERADO: No se detecta cambio de horario ni se envían correos espurios.");

    // -------------------------------------------------------------------------
    // TEST 4: Cancelación de Salida Vacía (Sin pasajeros)
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 4: Cancelación de Salida Vacía (0 pasajeros)");
    console.log("-------------------------------------------------------------");

    const salidaVacia = await prisma.instanciaVuelo.findFirst({
      where: {
        vueloId: vuelo1.id,
        id: { not: salida1.id },
        fechaSalida: { gt: salida1.fechaSalida },
        estado: "PROGRAMADO",
        deleted: false,
      },
    });

    if (!salidaVacia) {
      throw new Error("[Test 4] No se encontró una salida vacía para probar.");
    }

    const { canceledTickets: tVacio, salidaInfo: infoVacia } = await cancelFlightInstance(salidaVacia.id);

    if (tVacio !== 0 || infoVacia.pasajerosAfectados.length !== 0) {
      throw new Error("[Test 4] Se esperaba 0 pasajeros afectados en una salida vacía.");
    }

    const envioVacio = await notificarCancelacionSalida(infoVacia);
    if (envioVacio.emailsEnviados !== 0 || envioVacio.totalAfectados !== 0) {
      throw new Error("[Test 4] No debió enviarse ningún correo en una salida vacía.");
    }
    console.log("✔ TEST 4 SUPERADO: Cancelación de salida vacía ejecutada sin envíos innecesarios.");

    // -------------------------------------------------------------------------
    // TEST 5: Control de Errores - Re-cancelación rechazada
    // -------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------");
    console.log("▶ TEST 5: Control de Errores (Re-cancelación no permitida)");
    console.log("-------------------------------------------------------------");

    let errorAtrapado = false;
    try {
      await cancelFlightInstance(salida1.id);
    } catch (e: unknown) {
      if (e instanceof FlightInstanceCancellationError) {
        errorAtrapado = true;
        console.log(`[Test 5] Error esperado capturado correctamente: "${e.message}"`);
      }
    }

    if (!errorAtrapado) {
      throw new Error("[Test 5] Debió arrojar FlightInstanceCancellationError al re-cancelar.");
    }
    console.log("✔ TEST 5 SUPERADO: El sistema rechaza re-cancelaciones de salidas ya canceladas.");

    console.log("\n=======================================================================");
    console.log("   🎉 TODOS LOS TEST DE LA USER STORY 12 FUERON SUPERADOS CON ÉXITO");
    console.log("=======================================================================\n");
  } finally {
    console.log("[Cleanup] Limpiando registros de prueba generados...");

    for (const tId of transaccionIdsParaLimpiar) {
      try {
        await prisma.pasaje.deleteMany({ where: { transaccionId: tId } });
        await prisma.pago.deleteMany({ where: { transaccionId: tId } });
        await prisma.factura.deleteMany({ where: { transaccionId: tId } });
        await prisma.transaccionCompra.delete({ where: { id: tId } });
      } catch (err) {
        console.warn(`[Cleanup] Error limpiando transacción #${tId}:`, err);
      }
    }

    for (const vId of vueloIdsParaLimpiar) {
      try {
        await prisma.pasaje.deleteMany({ where: { instanciaVuelo: { vueloId: vId } } });
        await prisma.instanciaVuelo.deleteMany({ where: { vueloId: vId } });
        await prisma.vueloDiaSemana.deleteMany({ where: { vueloId: vId } });
        await prisma.vuelo.delete({ where: { id: vId } });
      } catch (err) {
        console.warn(`[Cleanup] Error limpiando vuelo #${vId}:`, err);
      }
    }

    await prisma.$disconnect();
    console.log("[Cleanup] Base de datos desconectada y limpia.");
  }
}

runTestSuite().catch((err) => {
  console.error("❌ Error en la ejecución de la suite de pruebas US 12:", err);
  process.exit(1);
});
