import Link from "next/link";
import { AlertCircle, ArrowLeft, Plane } from "lucide-react";
import { CheckoutForm } from "@/modules/pasajes/components/CheckoutForm";
import { getInstanciaVueloDetalle } from "@/modules/vuelos/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aerolínea | Checkout",
  description: "Completá los datos de los pasajeros y finalizá el pago.",
};

type CheckoutPageProps = {
  searchParams: Promise<{ instanciaId?: string }>;
};

/** Estado de error cuando la salida no existe, está de baja o no es válida. */
function SalidaNoDisponible() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-page font-sans text-ink">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-16 text-center sm:px-8">
        <span className="grid size-12 place-items-center rounded-full bg-soft text-accent">
          <AlertCircle size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Salida no disponible</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          El vuelo seleccionado no existe, fue cancelado o ya no está disponible
          para la venta. Elegí otra salida para continuar con tu compra.
        </p>
        <Link
          href="/vuelos"
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action px-6 font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          <Plane size={18} aria-hidden="true" />
          Volver a buscar vuelos
        </Link>
      </div>
    </main>
  );
}

export default async function CheckoutPage({
  searchParams: searchParamsPromise,
}: CheckoutPageProps) {
  const { instanciaId } = await searchParamsPromise;

  let detalle = null;

  try {
    detalle = instanciaId ? await getInstanciaVueloDetalle(instanciaId) : null;
  } catch (error) {
    console.error("Error al cargar la instancia de vuelo para el checkout:", error);
    return <SalidaNoDisponible />;
  }

  if (!detalle) {
    return <SalidaNoDisponible />;
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-page font-sans text-ink">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
        <Link
          href="/vuelos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-brand"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la búsqueda
        </Link>

        <div className="mt-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted">
            FINALIZÁ TU COMPRA
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">
            Completá los datos del viaje
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Revisá la salida, elegí la clase y cargá los datos de cada pasajero y
            de facturación. El pago se procesa con Mercado Pago.
          </p>
        </div>

        <div className="mt-8">
          <CheckoutForm detalle={detalle} />
        </div>
      </div>
    </main>
  );
}
