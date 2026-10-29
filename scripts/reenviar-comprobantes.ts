import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

/**
 * Reenvía los comprobantes (pasajes + factura) de compras ya confirmadas.
 *
 * Uso:
 *   pnpm dlx tsx scripts/reenviar-comprobantes.ts            # todas las confirmadas
 *   pnpm dlx tsx scripts/reenviar-comprobantes.ts 27 31 40   # solo esas transacciones
 */
async function main() {
  // Imports dinámicos: `dotenv.config` debe ejecutarse antes de que
  // `@/lib/prisma` lea `DATABASE_URL` para crear el adapter de Neon.
  const { prisma } = await import("../lib/prisma");
  const { enviarComprobantesCompra } = await import(
    "../modules/notificaciones/service"
  );

  try {
    const ids = process.argv.slice(2);

    for (const id of ids) {
      if (!/^\d+$/.test(id)) {
        throw new Error(`Identificador de transacción inválido: ${id}`);
      }
    }

    const transacciones =
      ids.length > 0
        ? ids.map((id) => ({ id: BigInt(id) }))
        : await prisma.transaccionCompra.findMany({
            where: {
              estado: "CONFIRMADA",
              deleted: false,
              factura: { isNot: null },
            },
            orderBy: { id: "desc" },
            select: { id: true },
          });

    if (transacciones.length === 0) {
      console.log("No hay transacciones confirmadas para reenviar.");
      return;
    }

    let errores = 0;

    for (const { id } of transacciones) {
      try {
        const resultado = await enviarComprobantesCompra(id);

        if (resultado.success) {
          console.log(
            `OK #${id.toString()}: enviado (${resultado.pasajesEnviados} pasajes). MessageId: ${resultado.messageId ?? "-"}`
          );
        } else {
          errores += 1;
          console.error(`ERROR #${id.toString()}: ${resultado.reason}`);
        }
      } catch (error) {
        errores += 1;
        console.error(`ERROR #${id.toString()}: fallo inesperado`, error);
      }
    }

    if (errores > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error en el reenvío de comprobantes:", error);
  process.exitCode = 1;
});
