import Link from "next/link";
import { ArrowRight, Luggage, Search, Ticket } from "lucide-react";

const features = [
  {
    icon: Search,
    titulo: "Encontrá tu vuelo",
    detalle:
      "Buscá por origen, destino y fecha entre vuelos nacionales e internacionales, con precios por clase.",
  },
  {
    icon: Ticket,
    titulo: "Hasta 9 pasajes",
    detalle:
      "Comprá en una sola transacción para todo tu grupo, con el total y el pago confirmados al instante.",
  },
  {
    icon: Luggage,
    titulo: "Pase de abordar",
    detalle:
      "Hacé check-in desde la web o en el mostrador del aeropuerto y consultá tu pase de abordar.",
  },
];

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-page font-sans text-ink">
      <section className="relative isolate overflow-hidden bg-brand-deep text-white">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-[center_42%]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=2200&q=85')",
          }}
          role="img"
          aria-label="Vista de un avión en vuelo"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#102e27]/95 via-[#102e27]/75 to-[#102e27]/25" />
        <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pb-28 sm:pt-16">
          <p className="mb-4 text-xs font-semibold tracking-[0.16em] text-[#b7d6c7]">
            VIAJÁ A TU MANERA
          </p>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
            El próximo destino está más cerca.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-white/80">
            Buscá tu vuelo, comprá pasajes para todo el grupo y guardá tu pase
            de abordar en un solo lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/vuelos"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action px-6 font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            >
              <Search size={18} aria-hidden="true" />
              Buscar vuelos
            </Link>
            <Link
              href="/registro"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/30 px-6 font-semibold text-white transition-colors hover:bg-white/10"
            >
              Crear cuenta
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14 pt-12 sm:px-8 sm:pb-16 sm:pt-14">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted">
          TODO PARA TU VIAJE
        </p>
        <h2 className="mt-1 text-2xl font-semibold capitalize">
          Comprá y viajá sin vueltas
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.titulo}
              className="rounded-lg border border-line bg-surface p-5"
            >
              <span className="grid size-11 place-items-center rounded-full bg-soft text-accent">
                <feature.icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{feature.titulo}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {feature.detalle}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">¿Ya tenés cuenta?</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Iniciá sesión para consultar tus compras y tus pases de abordar.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md bg-brand px-6 font-semibold text-white transition-colors hover:bg-accent"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong px-6 font-semibold text-ink transition-colors hover:bg-soft"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
