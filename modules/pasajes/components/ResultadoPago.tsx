"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { formatFare } from "@/modules/vuelos/utils";

/** Intervalo y tope del *polling* del estado comercial. */
const INTERVALO_MS = 2500;
const LIMITE_MS = 60_000;

/** Clave compartida con el checkout para ofrecer el reintento. */
const CLAVE_INSTANCIA = "checkout:instanciaId";

type PasajeEstado = {
  codigo: string;
  pasajero: string;
  clase: string;
  estado: string;
  numeroAsiento: string | null;
};

/** Respuesta serializada de `GET /api/v1/compras/:id/estado`. */
type EstadoTransaccion = {
  transaccionId: string;
  estado: string;
  total: number;
  emailContacto: string;
  fechaCreacion: string;
  pago: {
    estado: string;
    metodoPago: string;
    idTransaccionPasarela: string;
    monto: number;
    fechaPago: string;
  } | null;
  factura: {
    numeroFactura: string;
    tipoFactura: string;
    total: number;
    fechaEmision: string;
  } | null;
  pasajes: PasajeEstado[];
};

const ETIQUETA_CLASE: Record<string, string> = {
  ECONOMY: "Economy",
  PRIMERA: "Primera clase",
};

/**
 * El checkout guarda la salida elegida en `sessionStorage` antes de redirigir a
 * Mercado Pago. Se lee como store externo (sin `setState` en efectos) para poder
 * ofrecer "Reintentar compra" sin romper la hidratación del RSC.
 */
function suscribirInstanciaGuardada() {
  return () => {};
}

function leerInstanciaGuardada(): string | null {
  try {
    return window.sessionStorage.getItem(CLAVE_INSTANCIA);
  } catch {
    return null;
  }
}

function leerInstanciaEnServidor(): string | null {
  return null;
}

function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <div
      suppressHydrationWarning
      className="rounded-lg border border-line bg-surface p-6 text-center sm:p-8"
    >
      {children}
    </div>
  );
}

/**
 * Pantalla de resultado del checkout: consulta el estado comercial de la compra
 * hasta que el *webhook* la confirme o rechace. El retorno del navegador desde
 * Mercado Pago es solo informativo; la fuente de verdad es el webhook (ADR-007).
 */
export function ResultadoPago({
  transaccionId,
}: {
  transaccionId: string | null;
}) {
  const idValido = Boolean(transaccionId && /^\d+$/.test(transaccionId));

  const [estado, setEstado] = useState<EstadoTransaccion | null>(null);
  const [tiempoAgotado, setTiempoAgotado] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState(false);
  const [intento, setIntento] = useState(0);

  const instanciaId = useSyncExternalStore(
    suscribirInstanciaGuardada,
    leerInstanciaGuardada,
    leerInstanciaEnServidor
  );

  useEffect(() => {
    if (!idValido || !transaccionId) {
      return;
    }

    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inicio = Date.now();

    const consultar = async () => {
      try {
        const respuesta = await fetch(
          `/api/v1/compras/${transaccionId}/estado`,
          { cache: "no-store" }
        );
        const cuerpo = (await respuesta.json().catch(() => null)) as {
          success?: boolean;
          data?: EstadoTransaccion;
        } | null;

        if (cancelado) return;

        if (respuesta.ok && cuerpo?.success && cuerpo.data) {
          setErrorConsulta(false);
          setEstado(cuerpo.data);

          // Estado final: la pantalla deja de refrescarse sola.
          if (cuerpo.data.estado !== "PENDIENTE") {
            return;
          }
        } else {
          setErrorConsulta(true);
        }
      } catch {
        if (!cancelado) {
          setErrorConsulta(true);
        }
      }

      if (cancelado) return;

      if (Date.now() - inicio >= LIMITE_MS) {
        setTiempoAgotado(true);
        return;
      }

      timer = setTimeout(consultar, INTERVALO_MS);
    };

    void consultar();

    return () => {
      cancelado = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [idValido, transaccionId, intento]);

  const refrescar = () => {
    setTiempoAgotado(false);
    setErrorConsulta(false);
    setIntento((valor) => valor + 1);
  };

  if (!idValido) {
    return (
      <Tarjeta>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#fdece7] text-danger">
          <AlertCircle size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">No identificamos la compra</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          El enlace de retorno no incluye una transacción válida. Si realizaste
          un pago, revisá tu correo o volvé a buscarlo en la sección de vuelos.
        </p>
        <Link
          href="/vuelos"
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action px-6 font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          Volver a buscar vuelos
        </Link>
      </Tarjeta>
    );
  }
  if (estado?.estado === "CONFIRMADA") {
    return (
      <Tarjeta>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-soft text-accent">
          <CheckCircle2 size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">¡Pago confirmado!</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Tu compra quedó registrada. Enviamos los detalles a{" "}
          <span className="font-medium text-ink">{estado.emailContacto}</span>.
        </p>

        {estado.factura && (
          <div className="mt-6 rounded-md border border-line bg-page p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">
                Factura {estado.factura.tipoFactura}
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {estado.factura.numeroFactura}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted">Total</span>
              <span className="font-semibold tabular-nums text-ink">
                {formatFare(estado.factura.total)}
              </span>
            </div>
            <div className="mt-3 border-t border-line pt-2 text-right">
              <a
                href={`/api/v1/compras/${estado.transaccionId}/factura/pdf`}
                download={`Factura-${estado.factura.numeroFactura}.pdf`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-action hover:underline"
              >
                <Download size={14} aria-hidden="true" />
                Descargar Factura (PDF)
              </a>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3 text-left">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted">
            PASES DE ABORDAJE
          </p>
          {estado.pasajes.map((pasaje) => (
            <div
              key={pasaje.codigo}
              className="rounded-md border border-line p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{pasaje.pasajero}</span>
                <span className="tabular-nums text-muted">#{pasaje.codigo}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {ETIQUETA_CLASE[pasaje.clase] ?? pasaje.clase}
                {pasaje.numeroAsiento
                  ? ` · Asiento ${pasaje.numeroAsiento}`
                  : ""}
              </p>
              <div className="mt-3 border-t border-line pt-2 text-right">
                <a
                  href={`/api/v1/pasajes/${pasaje.codigo}/pdf`}
                  download={`Pasaje-${pasaje.pasajero}-${pasaje.codigo}.pdf`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-action hover:underline"
                >
                  <Download size={14} aria-hidden="true" />
                  Descargar Pase de Abordaje (PDF)
                </a>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/vuelos"
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line-strong px-6 font-semibold text-ink transition-colors hover:bg-soft"
        >
          Buscar otro vuelo
        </Link>
      </Tarjeta>
    );
  }

  if (estado?.estado === "RECHAZADA") {
    return (
      <Tarjeta>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#fdece7] text-danger">
          <XCircle size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">El pago no se completó</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          No pudimos confirmar el pago, por lo que liberamos las plazas
          reservadas. Podés intentarlo nuevamente o elegir otra salida.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={instanciaId ? `/checkout?instanciaId=${instanciaId}` : "/vuelos"}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action px-6 font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            Reintentar compra
          </Link>
          <Link
            href="/vuelos"
            className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong px-6 font-semibold text-ink transition-colors hover:bg-soft"
          >
            Buscar otro vuelo
          </Link>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-soft text-accent">
        {tiempoAgotado ? (
          <Clock3 size={24} aria-hidden="true" />
        ) : (
          <Loader2 size={24} aria-hidden="true" className="animate-spin" />
        )}
      </span>
      <h1 className="mt-4 text-2xl font-semibold">
        {tiempoAgotado
          ? "Estamos confirmando tu pago"
          : "Esperando la confirmación del pago"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        {tiempoAgotado
          ? "La confirmación puede demorar unos minutos en llegar. Refrescá para volver a consultar el estado."
          : "Mercado Pago está procesando el pago. Esta pantalla se actualiza automáticamente."}
      </p>

      {errorConsulta && (
        <p className="mt-3 text-xs text-muted">
          No pudimos consultar el estado en este momento; seguimos intentando.
        </p>
      )}

      <button
        type="button"
        onClick={refrescar}
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line-strong px-6 font-semibold text-ink transition-colors hover:bg-soft"
      >
        <RefreshCw size={16} aria-hidden="true" />
        Refrescar estado
      </button>
    </Tarjeta>
  );
}
