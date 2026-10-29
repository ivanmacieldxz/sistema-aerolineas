import { CalendarDays, ListFilter, PlusCircle, Search } from "lucide-react";
import {
  getAirports,
  getAllFlights,
  getFlightInstancesByDate,
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
  const dateValue = rawDate === undefined ? today : typeof rawDate === "string" ? rawDate : "";
  const parsedDate = flightInstanceDateSchema.safeParse(dateValue);

  const [airports, flights, departures] = await Promise.all([
    getAirports(),
    getAllFlights(),
    parsedDate.success
      ? getFlightInstancesByDate(new Date(`${parsedDate.data}T00:00:00.000Z`))
      : Promise.resolve([]),
  ]);

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
