import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";

async function main() {
  const vuelos = await prisma.vuelo.findMany({
    select: { id: true, numeroVuelo: true, activo: true, deleted: true },
  });
  console.log("Vuelos:", JSON.stringify(vuelos, (key, value) => typeof value === "bigint" ? value.toString() : value, 2));

  const canceladas = await prisma.instanciaVuelo.findMany({
    where: { estado: "CANCELADO" },
    include: { pasajes: { include: { transaccion: true } }, vuelo: true },
  });
  console.log("Instancias CANCELADAS:", JSON.stringify(canceladas, (key, value) => typeof value === "bigint" ? value.toString() : value, 2));

  const pasajes = await prisma.pasaje.findMany({
    take: 10,
    orderBy: { codigo: "desc" },
    include: { transaccion: true, instanciaVuelo: { include: { vuelo: true } } },
  });
  console.log("Últimos 10 pasajes:", JSON.stringify(pasajes.map(p => ({
    codigo: p.codigo.toString(),
    estado: p.estado,
    email: p.transaccion.emailContacto,
    transaccionEstado: p.transaccion.estado,
    vuelo: p.instanciaVuelo.vuelo.numeroVuelo,
    vueloDeleted: p.instanciaVuelo.vuelo.deleted,
    vueloActivo: p.instanciaVuelo.vuelo.activo,
    instanciaId: p.instanciaVueloId.toString(),
    instanciaEstado: p.instanciaVuelo.estado,
    instanciaFecha: p.instanciaVuelo.fechaSalida,
  })), null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
