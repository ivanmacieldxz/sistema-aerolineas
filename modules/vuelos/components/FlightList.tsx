"use client";

import { useState } from "react";
import { Plane, Power, Trash2 } from "lucide-react";
import { toggleFlightStatusAction, deleteFlightAction } from "../actions";
import { formatTime, formatDate, formatFare } from "../utils";

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

export function FlightList({ flights }: { flights: FlightItem[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
  );
}
