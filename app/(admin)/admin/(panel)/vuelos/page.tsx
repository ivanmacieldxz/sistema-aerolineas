import { PlusCircle, ListFilter } from "lucide-react";
import { getAirports, getAllFlights } from "@/modules/vuelos/service";
import { FlightForm } from "@/modules/vuelos/components/FlightForm";
import { FlightList } from "@/modules/vuelos/components/FlightList";

export const dynamic = "force-dynamic";

export default async function VuelosDashboardPage() {
  const [airports, flights] = await Promise.all([
    getAirports(),
    getAllFlights(),
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
    </div>
  );
}
