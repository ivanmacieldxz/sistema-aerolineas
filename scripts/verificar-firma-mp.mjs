#!/usr/bin/env node
/**
 * Diagnóstico de firmas de webhook de Mercado Pago.
 *
 * Recalcula el HMAC-SHA256 de una notificación capturada y lo compara contra el
 * `v1` del header `x-signature`, probando:
 *   - la clave secreta de `.env.local` (tal como la carga Next.js y sin recortar),
 *   - las claves candidatas pasadas con `--secret` (repetible),
 *   - las variantes de manifest documentadas.
 *
 * Uso con una notificación puntual:
 *   node scripts/verificar-firma-mp.mjs \
 *     --data-id 184762152784 \
 *     --request-id 487957b8-bbad-4a87-8a43-d933b2d55c1b \
 *     --signature "ts=1792277103,v1=ae8dff0e5ae5e78d1cf80801c456272bdd57ee3f0f65944e4d2aaa8e0b5c89bf"
 *
 * Uso con la salida del log del servidor (una o varias notificaciones):
 *   node scripts/verificar-firma-mp.mjs --from-log salida.txt
 *
 * Nunca imprime la clave secreta: solo una máscara con su longitud.
 */

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/** Variantes del manifest firmado, en orden de probabilidad. */
const VARIANTES = [
  [
    "manifest oficial `id;request-id;ts;`",
    (m) => `id:${m.dataId};request-id:${m.requestId};ts:${m.ts};`,
  ],
  [
    "sin el par `id` (solo request-id y ts)",
    (m) => `request-id:${m.requestId};ts:${m.ts};`,
  ],
  ["sin el par `request-id` (id y ts)", (m) => `id:${m.dataId};ts:${m.ts};`],
  ["sin el punto y coma final", (m) => `id:${m.dataId};request-id:${m.requestId};ts:${m.ts}`],
  ["solo el timestamp", (m) => `ts:${m.ts};`],
  ["valores planos sin claves", (m) => `${m.dataId};${m.requestId};${m.ts};`],
];

function mascara(valor) {
  if (!valor) {
    return "(vacía)";
  }

  return `${valor.slice(0, 4)}…${valor.slice(-2)} (${valor.length} caracteres)`;
}

function leerArgumentos(argv) {
  const args = { secretos: [], env: ".env.local" };

  for (let i = 0; i < argv.length; i += 1) {
    const bandera = argv[i];
    const valor = argv[i + 1];

    switch (bandera) {
      case "--data-id":
        args.dataId = valor;
        i += 1;
        break;
      case "--request-id":
        args.requestId = valor;
        i += 1;
        break;
      case "--signature":
        args.signature = valor;
        i += 1;
        break;
      case "--secret":
        args.secretos.push(valor);
        i += 1;
        break;
      case "--env":
        args.env = valor;
        i += 1;
        break;
      case "--from-log":
        args.fromLog = valor;
        i += 1;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        break;
    }
  }

  return args;
}

/** Claves candidatas leídas del archivo de entorno, sin exponer su valor. */
function leerClavesDelEnv(ruta) {
  if (!existsSync(ruta)) {
    return [];
  }

  const linea = readFileSync(ruta, "utf8")
    .split(/\r?\n/)
    .find((l) => l.trimStart().startsWith("MERCADOPAGO_WEBHOOK_SECRET"));

  if (!linea) {
    return [];
  }

  const bruto = linea.slice(linea.indexOf("=") + 1);
  const sinComillas = (v) => v.trim().replace(/^["']|["']$/g, "");
  const candidatas = [
    { origen: `${ruta} (recortada, como la carga Next.js)`, valor: sinComillas(bruto) },
    { origen: `${ruta} (sin recortar)`, valor: bruto.replace(/^["']|["']$/g, "") },
  ];

  return candidatas.filter((c) => c.valor.length > 0);
}

function separarFirma(signature) {
  const partes = { ts: undefined, hash: undefined };

  for (const trozo of (signature ?? "").split(",")) {
    const separador = trozo.indexOf("=");

    if (separador === -1) {
      continue;
    }

    const clave = trozo.slice(0, separador).trim().toLowerCase();
    const valor = trozo.slice(separador + 1).trim();

    if (clave === "ts") {
      partes.ts = valor;
    } else if (/^v\d+$/.test(clave)) {
      partes.hash = valor;
    }
  }

  return partes;
}

/** Extrae las notificaciones registradas por el log del servidor. */
function muestrasDesdeLog(ruta) {
  if (!existsSync(ruta)) {
    console.error(`No existe el archivo de log: ${ruta}`);
    process.exit(1);
  }

  const bloques = readFileSync(ruta, "utf8").split("Recibida notificación de Mercado Pago:");

  return bloques
    .slice(1)
    .map((bloque) => ({
      dataId:
        bloque.match(/mercadopago\?data\.id=([^&'\s]+)/)?.[1] ??
        bloque.match(/[?&]id=([^&'\s]+)/)?.[1],
      requestId: bloque.match(/'x-request-id':\s*'([^']+)'/)?.[1],
      signature: bloque.match(/'x-signature':\s*'([^']+)'/)?.[1],
    }))
    .filter((muestra) => muestra.dataId && muestra.signature);
}

function verificar(muestra, claves) {
  const firma = separarFirma(muestra.signature);
  const datos = { dataId: muestra.dataId, requestId: muestra.requestId, ts: firma.ts };

  console.log(
    `\ndata.id: ${datos.dataId} | x-request-id: ${datos.requestId ?? "(ausente)"} | ts: ${datos.ts ?? "(ausente)"}`
  );

  if (!firma.ts || !firma.hash) {
    console.error("  El header `x-signature` no tiene el formato `ts=...,v1=...`.");
    return false;
  }

  const coincidencias = [];

  for (const clave of claves) {
    for (const [nombre, construir] of VARIANTES) {
      const calculado = createHmac("sha256", clave.valor)
        .update(construir(datos))
        .digest("hex");

      if (calculado === firma.hash) {
        coincidencias.push({ clave, nombre });
      }
    }
  }

  if (coincidencias.length === 0) {
    console.log("  ❌ Ninguna clave ni variante reproduce la firma recibida.");
    console.log(
      "  → La notificación está firmada con OTRA clave secreta. Verificá que la clave sea la de la MISMA aplicación que el `MERCADOPAGO_ACCESS_TOKEN` (Tus integraciones → esa app → Webhooks → Clave secreta) y pasala con `--secret` para confirmar."
    );
    return false;
  }

  for (const { clave, nombre } of coincidencias) {
    console.log(`  ✅ Coincide | clave: ${clave.origen} ${mascara(clave.valor)} | ${nombre}`);
  }

  if (coincidencias.every((c) => c.nombre !== VARIANTES[0][0])) {
    console.log(
      "  ⚠️  La coincidencia usa una variante distinta a la documentada: revisá si Mercado Pago cambió el formato del manifest."
    );
  }

  return true;
}

function main() {
  const args = leerArgumentos(process.argv.slice(2));

  if (args.help || (!args.fromLog && !args.signature)) {
    console.log(
      "Uso:\n" +
        "  node scripts/verificar-firma-mp.mjs --data-id <id> --request-id <rid> --signature \"ts=...,v1=...\"\n" +
        "  node scripts/verificar-firma-mp.mjs --from-log <archivo.txt>\n" +
        "Opciones: --secret <clave> (repetible para probar candidatas), --env <archivo> (default .env.local)"
    );
    return;
  }

  const claves = [
    ...leerClavesDelEnv(args.env),
    ...args.secretos.map((valor, i) => ({
      origen: `--secret #${i + 1}`,
      valor: valor.trim(),
    })),
  ];

  if (claves.length === 0) {
    console.error(
      `No se encontró MERCADOPAGO_WEBHOOK_SECRET en ${args.env} ni se pasó ninguna clave con --secret.`
    );
    process.exit(1);
  }

  console.log("Claves candidatas:");
  for (const clave of claves) {
    console.log(`  - ${clave.origen}: ${mascara(clave.valor)}`);
  }

  const muestras = args.fromLog
    ? muestrasDesdeLog(args.fromLog)
    : [
        {
          dataId: args.dataId,
          requestId: args.requestId,
          signature: args.signature,
        },
      ];

  if (muestras.length === 0) {
    console.error("No se encontraron notificaciones con firma en el origen indicado.");
    process.exit(1);
  }

  const resultados = muestras.map((muestra) => verificar(muestra, claves));
  const exitos = resultados.filter(Boolean).length;

  console.log(
    `\nResumen: ${exitos}/${resultados.length} notificación(es) verificada(s) correctamente.`
  );

  process.exit(exitos === resultados.length ? 0 : 1);
}

main();
