import Link from "next/link";
import { ArrowLeft, CalendarDays, PlaneTakeoff, Search } from "lucide-react";
import { getAirports, searchFlightsForPassengerLookup } from "@/modules/vuelos/service";
import { formatDate, formatTime } from "@/modules/vuelos/utils";

type PassengerLookupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function PassengerLookupPage({
  searchParams: searchParamsPromise,
}: PassengerLookupPageProps) {
  const searchParams = await searchParamsPromise;
  const airports = await getAirports();

  const filters = {
    numeroVuelo:
      typeof searchParams.numeroVuelo === "string" ? searchParams.numeroVuelo.trim() : "",
    origen:
      typeof searchParams.origen === "string" ? searchParams.origen.trim().toUpperCase() : "",
    destino:
      typeof searchParams.destino === "string" ? searchParams.destino.trim().toUpperCase() : "",
    fecha: typeof searchParams.fecha === "string" ? searchParams.fecha : "",
  };

  const hasFilters = Object.values(filters).some((value) => value.length > 0);

  const flightResults = hasFilters
    ? await searchFlightsForPassengerLookup(filters)
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-muted">
            MOSTRADOR
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Lista de pasajeros por vuelos
          </h1>
        </div>

        <Link
          href="/mostrador"
          className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft size={16} />
          Volver al panel
        </Link>
      </header>

      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <form action="/mostrador/pasajeros" method="get" className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_0.9fr_auto] lg:items-end">
          <label className="block text-sm font-medium text-ink">
            Número o ID del vuelo
            <input
              type="text"
              name="numeroVuelo"
              defaultValue={filters.numeroVuelo}
              placeholder="Ej: AR6767 o 24"
              className="mt-2 h-10 w-full rounded-md border border-line-strong bg-page px-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Origen
            <select
              name="origen"
              defaultValue={filters.origen}
              className="mt-2 h-10 w-full rounded-md border border-line-strong bg-page px-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Todos</option>
              {airports.map((airport) => (
                <option key={airport.iataCode} value={airport.iataCode}>
                  {airport.ciudad} · {airport.iataCode}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-ink">
            Destino
            <select
              name="destino"
              defaultValue={filters.destino}
              className="mt-2 h-10 w-full rounded-md border border-line-strong bg-page px-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Todos</option>
              {airports.map((airport) => (
                <option key={`${airport.iataCode}-destino`} value={airport.iataCode}>
                  {airport.ciudad} · {airport.iataCode}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-ink">
            Fecha
            <span className="relative mt-2 block">
              <CalendarDays
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="date"
                name="fecha"
                defaultValue={filters.fecha}
                className="h-10 w-full rounded-md border border-line-strong bg-page pl-10 pr-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </span>
          </label>

          <button
            type="submit"
            className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Search size={16} />
            Buscar
          </button>
        </form>
      </section>

      {!hasFilters ? (
        <div className="rounded-lg border border-dashed border-line bg-page px-4 py-8 text-center text-sm text-muted">
          Ingresá al menos un criterio para consultar la lista de pasajeros de los vuelos.
        </div>
      ) : flightResults.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-page px-4 py-8 text-center text-sm text-muted">
          No se encontraron vuelos con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-5">
          {flightResults.map((flight) => (
            <section key={flight.id} className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
              <div className="flex flex-col gap-3 border-b border-line bg-page px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-soft p-2 text-accent">
                    <PlaneTakeoff size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-muted">
                      VUELO {flight.numeroVuelo}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-ink">
                      {flight.origenCiudad} → {flight.destinoCiudad}
                    </h2>
                  </div>
                </div>

                <div className="text-sm text-muted">
                  {flight.origenIata} → {flight.destinoIata}
                  <span className="mx-2">•</span>
                  {formatTime(flight.horaSalida)} hs
                </div>
              </div>

              <div className="space-y-4 p-5">
                {flight.instancias.length === 0 ? (
                  <p className="text-sm text-muted">
                    No existen salidas vigentes para este vuelo con los filtros aplicados.
                  </p>
                ) : (
                  flight.instancias.map((instancia) => (
                    <div key={instancia.id} className="rounded-lg border border-line bg-page p-4">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                            Salida programada
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-ink">
                            {formatDate(instancia.fechaSalida)}
                          </h3>
                        </div>

                        <span className="inline-flex w-fit rounded-full border border-line-strong bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {instancia.estado}
                        </span>
                      </div>

                      {instancia.pasajeros.length === 0 ? (
                        <p className="text-sm text-muted">
                          No hay pasajeros registrados para esta salida.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-line text-muted">
                                <th className="py-2 pr-4 font-medium">Pasajero</th>
                                <th className="py-2 pr-4 font-medium">Documento</th>
                                <th className="py-2 pr-4 font-medium">Clase</th>
                                <th className="py-2 pr-4 font-medium">Asiento</th>
                                <th className="py-2 pr-4 font-medium">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {instancia.pasajeros.map((pasajero) => (
                                <tr key={pasajero.codigo} className="border-b border-line last:border-b-0">
                                  <td className="py-3 pr-4 font-medium text-ink">
                                    {pasajero.apellido}, {pasajero.nombre}
                                  </td>
                                  <td className="py-3 pr-4 text-muted">{pasajero.documento}</td>
                                  <td className="py-3 pr-4 text-muted">{pasajero.clase}</td>
                                  <td className="py-3 pr-4 text-muted">
                                    {pasajero.asiento ?? "Sin asignar"}
                                  </td>
                                  <td className="py-3 pr-4">
                                    <span className="inline-flex rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                                      {pasajero.estado}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
