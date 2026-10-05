import { CalendarDays, Clock3, Plane, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { flightSearchSchema } from "@/lib/schemas/flight-search";

type FlightSearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatFare(value: { toFixed: (digits: number) => string }) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(Number(value.toFixed(2)));
}

async function findMatchingFlights(
  origin: string,
  destination: string,
  searchDate: Date,
  isoWeekday: number,
) {
  return prisma.vuelo.findMany({
    where: {
      activo: true,
      deleted: false,
      origenIata: origin,
      destinoIata: destination,
      vigenciaDesde: { lte: searchDate },
      vigenciaHasta: { gte: searchDate },
      diasSemana: { some: { diaSemana: isoWeekday } },
    },
    include: {
      origen: { select: { iataCode: true, nombre: true, ciudad: true } },
      destino: { select: { iataCode: true, nombre: true, ciudad: true } },
    },
    orderBy: { horaSalida: "asc" },
  });
}

type SearchFlight = Awaited<ReturnType<typeof findMatchingFlights>>[number];

export default async function FlightSearchPage({
  searchParams: searchParamsPromise,
}: FlightSearchPageProps) {
  const searchParams = await searchParamsPromise;
  const searchSubmitted = ["origen", "destino", "fecha"].some(
    (key) => searchParams[key] !== undefined,
  );
  const parsedSearch = flightSearchSchema.safeParse({
    origen: searchParams.origen,
    destino: searchParams.destino,
    fecha: searchParams.fecha,
  });

  const searchDate = parsedSearch.success
    ? new Date(`${parsedSearch.data.fecha}T00:00:00.000Z`)
    : null;
  const isoWeekday = searchDate
    ? ((searchDate.getUTCDay() + 6) % 7) + 1
    : null;

  let airports: { iataCode: string; nombre: string; ciudad: string }[] = [];
  let flights: SearchFlight[] = [];
  let databaseError = false;

  try {
    airports = await prisma.aeropuerto.findMany({
      select: { iataCode: true, nombre: true, ciudad: true },
      orderBy: [{ ciudad: "asc" }, { iataCode: "asc" }],
    });

    if (parsedSearch.success && searchDate && isoWeekday) {
      flights = await findMatchingFlights(
        parsedSearch.data.origen,
        parsedSearch.data.destino,
        searchDate,
        isoWeekday,
      );
    }
  } catch {
    databaseError = true;
  }

  const formOrigin =
    typeof searchParams.origen === "string" ? searchParams.origen.toUpperCase() : "";
  const formDestination =
    typeof searchParams.destino === "string" ? searchParams.destino.toUpperCase() : "";
  const formDate = typeof searchParams.fecha === "string" ? searchParams.fecha : "";
  const searchError = searchSubmitted && !parsedSearch.success
    ? parsedSearch.error.issues[0]?.message ?? "Revisá los datos de búsqueda."
    : null;

  return (
    <main className="min-h-screen bg-[#f1f3ed] font-sans text-[#19332d]">
      <header className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="/vuelos" className="flex items-center gap-3" aria-label="Vuelos, inicio">
          <span className="grid size-10 place-items-center rounded-lg bg-[#174b3f] text-white">
            <Plane size={20} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-[0.08em]">AEROLÍNEA</span>
        </a>
        <span className="hidden text-sm text-[#64766f] sm:block">Vuelos nacionales e internacionales</span>
      </header>

      <section className="relative isolate overflow-hidden bg-[#12372e] text-white">
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
            Encontrá el vuelo que se adapta a tu viaje.
          </p>
        </div>
      </section>

      <section className="relative mx-auto -mt-12 max-w-7xl px-5 sm:px-8">
        <form
          action="/vuelos"
          method="get"
          className="grid gap-4 rounded-lg border border-[#dce2da] bg-white p-5 shadow-[0_16px_45px_-28px_rgba(16,46,39,0.42)] md:grid-cols-[1fr_1fr_0.9fr_auto] md:items-end md:p-6"
        >
          <label className="block text-sm font-medium text-[#314d44]">
            Origen
            <select
              name="origen"
              required
              defaultValue={formOrigin}
              className="mt-2 h-12 w-full rounded-md border border-[#ccd6ce] bg-white px-3 text-base text-[#19332d] outline-none transition focus:border-[#27715e] focus:ring-2 focus:ring-[#27715e]/20"
            >
              <option value="" disabled>Elegí un aeropuerto</option>
              {airports.map((airport) => (
                <option key={airport.iataCode} value={airport.iataCode}>
                  {airport.ciudad} · {airport.iataCode}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-[#314d44]">
            Destino
            <select
              name="destino"
              required
              defaultValue={formDestination}
              className="mt-2 h-12 w-full rounded-md border border-[#ccd6ce] bg-white px-3 text-base text-[#19332d] outline-none transition focus:border-[#27715e] focus:ring-2 focus:ring-[#27715e]/20"
            >
              <option value="" disabled>Elegí un aeropuerto</option>
              {airports.map((airport) => (
                <option key={airport.iataCode} value={airport.iataCode}>
                  {airport.ciudad} · {airport.iataCode}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-[#314d44]">
            Fecha
            <span className="relative mt-2 block">
              <CalendarDays
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#668078]"
              />
              <input
                type="date"
                name="fecha"
                required
                defaultValue={formDate}
                className="h-12 w-full rounded-md border border-[#ccd6ce] bg-white pl-10 pr-3 text-base text-[#19332d] outline-none transition focus:border-[#27715e] focus:ring-2 focus:ring-[#27715e]/20"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={airports.length < 2}
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#c04e32] px-6 font-semibold text-white transition hover:bg-[#a94129] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c04e32] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={18} aria-hidden="true" />
            Buscar vuelos
          </button>
        </form>
        {databaseError ? (
          <p role="alert" className="mt-3 text-sm text-[#963d2c]">
            No se pudo conectar con la base de datos. La búsqueda no está disponible temporalmente.
          </p>
        ) : airports.length < 2 && (
          <p className="mt-3 text-sm text-[#61756c]">
            Todavía no hay suficientes aeropuertos registrados para realizar una búsqueda.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-12">
        {searchError && (
          <p role="alert" className="mb-6 rounded-md border border-[#e9c7bc] bg-[#fff4ef] px-4 py-3 text-sm text-[#963d2c]">
            {searchError}
          </p>
        )}

        {databaseError ? null : parsedSearch.success ? (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#71827b]">RESULTADOS</p>
                <h2 className="mt-1 text-2xl font-semibold capitalize text-[#19332d]">
                  {formatDate(parsedSearch.data.fecha)}
                </h2>
              </div>
              <p className="text-sm text-[#62766e]">
                {flights.length} {flights.length === 1 ? "vuelo encontrado" : "vuelos encontrados"}
              </p>
            </div>

            {flights.length > 0 ? (
              <div className="space-y-3">
                {flights.map((flight) => (
                  <article
                    key={flight.id.toString()}
                    className="grid gap-6 rounded-lg border border-[#dce2da] bg-white p-5 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)] md:items-center md:p-6"
                  >
                    <div>
                      <div className="mb-5 flex items-center gap-2 text-sm font-medium text-[#61756c]">
                        <Plane size={16} aria-hidden="true" />
                        Vuelo {flight.numeroVuelo}
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="min-w-0">
                          <p className="text-2xl font-semibold tabular-nums text-[#19332d]">
                            {formatTime(flight.horaSalida)}
                          </p>
                          <p className="mt-1 truncate text-sm text-[#61756c]">
                            {flight.origen.ciudad} ({flight.origen.iataCode})
                          </p>
                        </div>
                        <div className="flex min-w-12 flex-1 items-center gap-2 text-[#a2b2aa]">
                          <span className="h-px flex-1 bg-[#d8e0da]" />
                          <Clock3 size={16} aria-hidden="true" />
                          <span className="h-px flex-1 bg-[#d8e0da]" />
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-2xl font-semibold tabular-nums text-[#19332d]">
                            {formatTime(flight.horaLlegada)}
                          </p>
                          <p className="mt-1 truncate text-sm text-[#61756c]">
                            {flight.destino.ciudad} ({flight.destino.iataCode})
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-[#e5eae5] pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-[0.08em] text-[#71827b]">ECONOMY</p>
                        {flight.capacidadEconomy > 0 ? (
                          <>
                            <p className="mt-2 text-lg font-semibold text-[#19332d]">{formatFare(flight.precioEconomy)}</p>
                            <p className="mt-1 text-xs leading-5 text-[#71827b]">
                              {flight.capacidadEconomy} plazas configuradas
                            </p>
                          </>
                        ) : <p className="mt-2 text-sm text-[#71827b]">No disponible</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-[0.08em] text-[#71827b]">PRIMERA CLASE</p>
                        {flight.capacidadPrimera > 0 ? (
                          <>
                            <p className="mt-2 text-lg font-semibold text-[#19332d]">{formatFare(flight.precioPrimera)}</p>
                            <p className="mt-1 text-xs leading-5 text-[#71827b]">
                              {flight.capacidadPrimera} plazas configuradas
                            </p>
                          </>
                        ) : <p className="mt-2 text-sm text-[#71827b]">No disponible</p>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border-y border-[#dce2da] py-12 text-center">
                <p className="text-lg font-medium text-[#314d44]">No hay vuelos para esta búsqueda.</p>
              </div>
            )}
            <p className="mt-5 text-xs text-[#71827b]">
              Las plazas indican la capacidad configurada del vuelo, no la disponibilidad actual.
            </p>
          </>
        ) : !searchError ? (
          <div className="flex min-h-24 items-center gap-4 border-y border-[#dce2da] py-6 text-[#61756c]">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e2ebe4] text-[#27715e]">
              <Plane size={20} aria-hidden="true" />
            </span>
            <p className="text-sm">Elegí origen, destino y fecha para ver los vuelos programados.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}