"use client";

import { useState } from "react";
import { Plane, Power, Trash2, PencilLine } from "lucide-react";
import { toggleFlightStatusAction, deleteFlightAction } from "../actions";
import { formatTime, formatDate, formatFare } from "../utils";
import { FlightForm } from "./FlightForm";

const diasMap: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

type FlightItem = {
  id: bigint;
  numeroVuelo: string;
  origenIata: string;
  destinoIata: string;
  origen: { ciudad: string; nombre: string };
  destino: { ciudad: string; nombre: string };
  horaSalida: Date;
  horaLlegada: Date;
  vigenciaDesde: Date;
  vigenciaHasta: Date;
  capacidadEconomy: number;
  capacidadPrimera: number;
  precioEconomy: number;
  precioPrimera: number;
  activo: boolean;
  diasSemana: { diaSemana: number }[];
  _count: { instancias: number };
};

const toTimeInput = (value: Date): string =>
  new Date(value).toISOString().slice(11, 16);

const toDateInput = (value: Date): string =>
  new Date(value).toISOString().slice(0, 10);

function buildFlightFormValues(flight: FlightItem) {
  return {
    numeroVuelo: flight.numeroVuelo,
    origenIata: flight.origenIata,
    destinoIata: flight.destinoIata,
    horaSalida: toTimeInput(flight.horaSalida),
    horaLlegada: toTimeInput(flight.horaLlegada),
    vigenciaDesde: toDateInput(flight.vigenciaDesde),
    vigenciaHasta: toDateInput(flight.vigenciaHasta),
    capacidadEconomy: flight.capacidadEconomy,
    capacidadPrimera: flight.capacidadPrimera,
    precioEconomy: Number(flight.precioEconomy),
    precioPrimera: Number(flight.precioPrimera),
    diasSemana: flight.diasSemana.map((d) => d.diaSemana),
  };
}

export function FlightList({
  flights,
  initialAirports,
}: {
  flights: FlightItem[];
  initialAirports: { iataCode: string; nombre: string; ciudad: string }[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingFlight = flights.find((flight) => flight.id.toString() === editingId) ?? null;

  const handleToggle = async (id: bigint, currentActivo: boolean) => {
    const idStr = id.toString();
    setLoadingId(idStr);
    await toggleFlightStatusAction(idStr, !currentActivo);
    setLoadingId(null);
  };

  const handleDelete = async (id: bigint, numeroVuelo: string) => {
    if (!confirm(`¿Estás seguro de que deseas dar de baja el vuelo ${numeroVuelo}?`)) {
      return;
    }
    const idStr = id.toString();
    setLoadingId(idStr);
    await deleteFlightAction(idStr);
    setLoadingId(null);
  };

  if (flights.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
        No hay vuelos registrados en el sistema. Creá el primero arriba.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {editingFlight && (
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                EDITAR VUELO
              </p>
              <h3 className="mt-1 text-xl font-semibold text-ink">
                {editingFlight.numeroVuelo}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:bg-soft"
            >
              Cancelar
            </button>
          </div>

          <FlightForm
            initialAirports={initialAirports}
            mode="edit"
            flightId={editingFlight.id.toString()}
            initialValues={buildFlightFormValues(editingFlight)}
            onFlightUpdated={() => setEditingId(null)}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm text-ink">
          <thead className="border-b border-line bg-soft text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Vuelo</th>
              <th className="px-4 py-3">Ruta</th>
              <th className="px-4 py-3">Horario</th>
              <th className="px-4 py-3">Días</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3">Capacidad</th>
              <th className="px-4 py-3">Tarifas</th>
              <th className="px-4 py-3">Salidas</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {flights.map((flight) => {
              const isLoading = loadingId === flight.id.toString();
              return (
                <tr key={flight.id.toString()} className="hover:bg-soft/50">
                  <td className="px-4 py-3 font-semibold text-brand">
                    <div className="flex items-center gap-1.5">
                      <Plane size={15} />
                      {flight.numeroVuelo}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{flight.origenIata}</span> →{" "}
                    <span className="font-medium">{flight.destinoIata}</span>
                    <p className="text-xs text-muted">
                      {flight.origen.ciudad} a {flight.destino.ciudad}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatTime(flight.horaSalida)} - {formatTime(flight.horaLlegada)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {flight.diasSemana.map((d) => (
                        <span
                          key={d.diaSemana}
                          className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-medium text-ink"
                        >
                          {diasMap[d.diaSemana]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                    {formatDate(flight.vigenciaDesde)} al<br />
                    {formatDate(flight.vigenciaHasta)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p>Eco: <span className="font-semibold">{flight.capacidadEconomy}</span></p>
                    <p>Pri: <span className="font-semibold">{flight.capacidadPrimera}</span></p>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {flight.capacidadEconomy > 0 && (
                      <p>Eco: {formatFare(flight.precioEconomy)}</p>
                    )}
                    {flight.capacidadPrimera > 0 && (
                      <p>Pri: {formatFare(flight.precioPrimera)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-center font-medium">
                    {flight._count.instancias}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        flight.activo
                          ? "bg-[#eaf4ee] text-accent"
                          : "bg-[#fff4ef] text-danger"
                      }`}
                    >
                      {flight.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => setEditingId(flight.id.toString())}
                        title="Editar vuelo"
                        className="rounded p-1.5 text-muted hover:bg-soft hover:text-accent disabled:opacity-50"
                      >
                        <PencilLine size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleToggle(flight.id, flight.activo)}
                        title={flight.activo ? "Desactivar vuelo" : "Activar vuelo"}
                        className={`rounded p-1.5 transition ${
                          flight.activo
                            ? "text-muted hover:bg-[#fff4ef] hover:text-danger"
                            : "text-muted hover:bg-[#eaf4ee] hover:text-accent"
                        } disabled:opacity-50`}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleDelete(flight.id, flight.numeroVuelo)}
                        title="Dar de baja vuelo"
                        className="rounded p-1.5 text-muted hover:bg-[#fff4ef] hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
