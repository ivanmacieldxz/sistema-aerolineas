"use client";

import { useState } from "react";
import { Ban, Plane } from "lucide-react";
import { cancelFlightInstanceAction } from "../actions";
import { formatDate, formatTime } from "../utils";
import type { AdminFlightInstance } from "../service";

export function FlightDepartureList({
  departures,
}: {
  departures: AdminFlightInstance[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCancel = async (departure: AdminFlightInstance) => {
    if (
      !confirm(
        `¿Cancelar la salida ${departure.numeroVuelo} del ${formatDate(departure.fechaSalida)}? Se marcarán como cancelados ${departure.pasajesActivos} pasajes activos.`,
      )
    ) {
      return;
    }

    setLoadingId(departure.id);
    setFeedback(null);
    const result = await cancelFlightInstanceAction(departure.id);
    setFeedback(result.message);
    setLoadingId(null);
  };

  if (departures.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
        No hay salidas registradas para esta fecha.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <p role="status" className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink">
          {feedback}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm text-ink">
          <thead className="border-b border-line bg-soft text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Salida</th>
              <th className="px-4 py-3">Ruta</th>
              <th className="px-4 py-3">Horario</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Pasajes activos</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {departures.map((departure) => {
              const isLoading = loadingId === departure.id;
              const isCancelled = departure.estado === "CANCELADO";

              return (
                <tr key={departure.id} className="hover:bg-soft/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-brand">
                      <Plane size={15} aria-hidden="true" />
                      {departure.numeroVuelo}
                    </div>
                    <p className="mt-1 text-xs text-muted">{formatDate(departure.fechaSalida)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{departure.origenIata}</span>
                    {" → "}
                    <span className="font-medium">{departure.destinoIata}</span>
                    <p className="mt-1 text-xs text-muted">
                      {departure.origenCiudad} a {departure.destinoCiudad}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatTime(departure.horaSalida)} - {formatTime(departure.horaLlegada)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isCancelled
                          ? "bg-[#fff4ef] text-danger"
                          : departure.estado === "FINALIZADO"
                            ? "bg-soft text-muted"
                            : "bg-[#eaf4ee] text-accent"
                      }`}
                    >
                      {departure.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">{departure.pasajesActivos}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={!departure.cancelable || isLoading}
                      onClick={() => handleCancel(departure)}
                      title={isCancelled ? "Salida cancelada" : "Cancelar salida"}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/30 px-3 py-2 text-xs font-semibold text-danger transition hover:bg-[#fff4ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Ban size={15} aria-hidden="true" />
                      {isLoading ? "Cancelando..." : "Cancelar salida"}
                    </button>
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