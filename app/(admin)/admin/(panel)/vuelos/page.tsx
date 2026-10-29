import { CalendarDays, ListFilter, PlusCircle, Search, TrendingUp } from "lucide-react";
import {
  getAirports,
  getAllFlights,
  getFlightInstancesByDate,
  getFlightOccupancyReport,
} from "@/modules/vuelos/service";
import { flightInstanceDateSchema } from "@/modules/vuelos/schemas";
import { FlightForm } from "@/modules/vuelos/components/FlightForm";
import { FlightDepartureList } from "@/modules/vuelos/components/FlightDepartureList";
import { FlightList } from "@/modules/vuelos/components/FlightList";

export const dynamic = "force-dynamic";

type VuelosDashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VuelosDashboardPage({
  searchParams: searchParamsPromise,
}: VuelosDashboardPageProps) {
  const searchParams = await searchParamsPromise;
  const today = new Date().toISOString().slice(0, 10);
  const rawDate = searchParams.fecha;
  const rawDateFrom = searchParams.fechaDesde;
  const rawDateTo = searchParams.fechaHasta;

  const dateValue = rawDate === undefined ? today : typeof rawDate === "string" ? rawDate : "";
  const parsedDate = flightInstanceDateSchema.safeParse(dateValue);

  const reportFromValue =
    typeof rawDateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDateFrom)
      ? rawDateFrom
      : today;
  const reportToValue =
    typeof rawDateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDateTo)
      ? rawDateTo
      : today;

  const [airports, flights, departures, occupancyReport] = await Promise.all([
    getAirports(),
    getAllFlights(),
    parsedDate.success
      ? getFlightInstancesByDate(new Date(`${parsedDate.data}T00:00:00.000Z`))
      : Promise.resolve([]),
    getFlightOccupancyReport({
      desde: new Date(`${reportFromValue}T00:00:00.000Z`),
      hasta: new Date(`${reportToValue}T23:59:59.999Z`),
    }),
  ]);

  const totalSeats = occupancyReport.reduce((sum, flight) => sum + flight.totalCapacidad, 0);
  const totalSold = occupancyReport.reduce((sum, flight) => sum + flight.totalVendidos, 0);
  const totalAvailable = Math.max(0, totalSeats - totalSold);
  const globalOccupancy = totalSeats > 0 ? (totalSold / totalSeats) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <p className="text-xs font-semibold tracking-[0.12em] text-muted">
          ADMINISTRACIÓN
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">Gestión de Vuelos</h1>
        <p className="mt-2 text-muted">
          Administrá las rutas, horarios, tarifas y salidas programadas de la aerolínea.
        </p>
      </header>

      {/* Sección 1: Crear Vuelo */}
      <section className="overflow-hidden rounded-lg border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <div className="rounded-lg bg-soft p-2.5 text-accent">
            <PlusCircle size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">Crear Nuevo Vuelo</h2>
            <p className="text-xs text-muted">
              Define la ruta troncal y genera en lote todas sus salidas programadas.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <FlightForm initialAirports={airports} />
        </div>
      </section>

      {/* Sección 2: Vuelos Existentes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-soft p-2.5 text-brand">
              <ListFilter size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Vuelos y Salidas Configuradas</h2>
              <p className="text-xs text-muted">
                {flights.length} rutas troncales registradas en el sistema.
              </p>
            </div>
          </div>
        </div>

        <FlightList flights={flights} initialAirports={airports} />
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-soft p-2.5 text-brand">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-muted">
              REPORTES
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Ocupación por vuelo</h2>
          </div>
        </div>

        <form
          action="/admin/vuelos"
          method="get"
          className="grid gap-3 rounded-lg border border-line bg-page p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <label className="block text-sm font-medium text-ink">
            Fecha desde
            <span className="relative mt-1.5 block">
              <CalendarDays
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="date"
                name="fechaDesde"
                defaultValue={reportFromValue}
                className="h-10 w-full rounded-md border border-line-strong bg-surface pl-10 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </span>
          </label>

          <label className="block text-sm font-medium text-ink">
            Fecha hasta
            <span className="relative mt-1.5 block">
              <CalendarDays
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="date"
                name="fechaHasta"
                defaultValue={reportToValue}
                className="h-10 w-full rounded-md border border-line-strong bg-surface pl-10 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </span>
          </label>

          <button
            type="submit"
            className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Search size={16} aria-hidden="true" />
            Generar reporte
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-line bg-page p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Asientos</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{totalSeats}</p>
          </div>
          <div className="rounded-lg border border-line bg-page p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Vendidos</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{totalSold}</p>
          </div>
          <div className="rounded-lg border border-line bg-page p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Disponibles</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{totalAvailable}</p>
          </div>
          <div className="rounded-lg border border-line bg-page p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Ocupación</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{globalOccupancy.toFixed(1)}%</p>
          </div>
        </div>

        {occupancyReport.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-page p-8 text-center text-sm text-muted">
            No hay vuelos con instancias activas para el período seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-page">
            <table className="w-full min-w-[900px] text-left text-sm text-ink">
              <thead className="border-b border-line bg-soft text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Vuelo</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Economy</th>
                  <th className="px-4 py-3">Primera</th>
                  <th className="px-4 py-3">Ocupación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {occupancyReport.map((flight) => (
                  <tr key={flight.vueloId} className="hover:bg-soft/40">
                    <td className="px-4 py-3 font-semibold text-brand">{flight.numeroVuelo}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{flight.origenIata}</span>
                      {" → "}
                      <span className="font-medium">{flight.destinoIata}</span>
                      <p className="text-xs text-muted">
                        {flight.origenCiudad} a {flight.destinoCiudad}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{flight.totalVendidos}/{flight.totalCapacidad}</p>
                      <p className="text-xs text-muted">{flight.totalDisponibles} libres</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{flight.economy.vendidos}/{flight.economy.capacidad}</p>
                      <p className="text-xs text-muted">{flight.economy.ocupacion.toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{flight.primera.vendidos}/{flight.primera.capacidad}</p>
                      <p className="text-xs text-muted">{flight.primera.ocupacion.toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#eaf4ee] px-2.5 py-1 text-xs font-semibold text-accent">
                        {flight.ocupacionTotal.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-muted">
            OPERACIÓN
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Salidas por fecha</h2>
          <p className="mt-1 text-xs text-muted">
            Cancelá una salida puntual sin modificar las demás fechas del vuelo.
          </p>
        </div>

        <form
          action="/admin/vuelos"
          method="get"
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-end"
        >
          <label className="block text-sm font-medium text-ink">
            Fecha de salida
            <span className="relative mt-1.5 block">
              <CalendarDays
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="date"
                name="fecha"
                required
                defaultValue={dateValue}
                className="h-10 rounded-md border border-line-strong bg-page pl-10 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </span>
          </label>
          <button
            type="submit"
            className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Search size={16} aria-hidden="true" />
            Ver salidas
          </button>
        </form>

        {!parsedDate.success ? (
          <p role="alert" className="text-sm text-danger">
            {parsedDate.error.issues[0]?.message ?? "Seleccioná una fecha válida."}
          </p>
        ) : (
          <FlightDepartureList departures={departures} />
        )}
      </section>
    </div>
  );
}
