"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Plane } from "lucide-react";
import { flightSchema, type FlightFormValues, type FlightFormInput, type AirportFormValues } from "../schemas";
import { createFlight } from "../actions";
import { AirportForm } from "./AirportForm";

const diasSemanaMap = [
  { id: 1, name: "Lunes" },
  { id: 2, name: "Martes" },
  { id: 3, name: "Miércoles" },
  { id: 4, name: "Jueves" },
  { id: 5, name: "Viernes" },
  { id: 6, name: "Sábado" },
  { id: 7, name: "Domingo" },
];

type FlightFormProps = {
  initialAirports?: { iataCode: string; nombre: string; ciudad: string }[];
  onFlightCreated?: () => void;
};

export function FlightForm({ initialAirports = [], onFlightCreated }: FlightFormProps) {
  const [airports, setAirports] = useState(initialAirports);
  const [showAddAirport, setShowAddAirport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FlightFormInput, unknown, FlightFormValues>({
    resolver: zodResolver(flightSchema),
    defaultValues: {
      diasSemana: [],
    },
  });

  const capacidadPrimeraValue = useWatch({ control, name: "capacidadPrimera" });
  const isPrimeraEnabled = Number(capacidadPrimeraValue || 0) > 0;

  const capacidadEconomyValue = useWatch({ control, name: "capacidadEconomy" });
  const isEconomyEnabled = Number(capacidadEconomyValue || 0) > 0;

  useEffect(() => {
    if (!isPrimeraEnabled) {
      setValue("precioPrimera", "");
    }
  }, [isPrimeraEnabled, setValue]);

  useEffect(() => {
    if (!isEconomyEnabled) {
      setValue("precioEconomy", "");
    }
  }, [isEconomyEnabled, setValue]);

  const handleAirportCreated = (newAirport: AirportFormValues) => {
    setAirports((prev) => [
      ...prev,
      {
        iataCode: newAirport.iataCode,
        nombre: newAirport.nombre,
        ciudad: newAirport.ciudad,
      },
    ]);
    setShowAddAirport(false);
  };

  const onSubmit = async (data: FlightFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    setServerSuccess(null);

    const result = await createFlight(data);

    if (result.success) {
      setServerSuccess(result.message);
      reset();
      if (onFlightCreated) {
        onFlightCreated();
      }
    } else {
      setServerError(result.message);
    }

    setIsSubmitting(false);
  };

  const inputClass =
    "mt-1 block h-12 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const disabledInputClass =
    "mt-1 block h-12 w-full cursor-not-allowed rounded-md border border-line bg-soft px-3 text-sm text-muted outline-none";

  return (
    <div className="space-y-6">
      {/* Sección para registrar aeropuertos si falta alguno */}
      <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-4">
        <div>
          <p className="text-sm font-semibold text-ink">Aeropuertos Registrados</p>
          <p className="text-xs text-muted">
            {airports.length} aeropuertos disponibles para asignar rutas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddAirport(!showAddAirport)}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-xs font-semibold text-accent hover:bg-soft"
        >
          <Plus size={14} />
          {showAddAirport ? "Ocultar formulario" : "Registrar nuevo aeropuerto"}
        </button>
      </div>

      {showAddAirport && (
        <AirportForm
          onAirportCreated={handleAirportCreated}
          onCancel={() => setShowAddAirport(false)}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Número de Vuelo */}
        <div>
          <label className="block text-sm font-medium text-ink">Número de Vuelo</label>
          <input
            {...register("numeroVuelo")}
            className={inputClass}
            placeholder="Ej: AR1023"
          />
          <div className="h-6 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">
              {errors.numeroVuelo?.message?.toString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Origen */}
          <div>
            <label className="block text-sm font-medium text-ink">Aeropuerto de Origen</label>
            {airports.length > 0 ? (
              <select {...register("origenIata")} className={inputClass}>
                <option value="">Seleccioná un aeropuerto</option>
                {airports.map((ap) => (
                  <option key={ap.iataCode} value={ap.iataCode}>
                    {ap.ciudad} · {ap.iataCode} ({ap.nombre})
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...register("origenIata")}
                className={inputClass}
                placeholder="Código IATA (ej: EZE)"
                maxLength={3}
              />
            )}
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.origenIata?.message?.toString()}
              </p>
            </div>
          </div>

          {/* Destino */}
          <div>
            <label className="block text-sm font-medium text-ink">Aeropuerto de Destino</label>
            {airports.length > 0 ? (
              <select {...register("destinoIata")} className={inputClass}>
                <option value="">Seleccioná un aeropuerto</option>
                {airports.map((ap) => (
                  <option key={ap.iataCode} value={ap.iataCode}>
                    {ap.ciudad} · {ap.iataCode} ({ap.nombre})
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...register("destinoIata")}
                className={inputClass}
                placeholder="Código IATA (ej: COR)"
                maxLength={3}
              />
            )}
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.destinoIata?.message?.toString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hora Salida */}
          <div>
            <label className="block text-sm font-medium text-ink">Hora de Salida</label>
            <input
              type="time"
              {...register("horaSalida")}
              className={inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.horaSalida?.message?.toString()}
              </p>
            </div>
          </div>

          {/* Hora Llegada */}
          <div>
            <label className="block text-sm font-medium text-ink">Hora de Llegada</label>
            <input
              type="time"
              {...register("horaLlegada")}
              className={inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.horaLlegada?.message?.toString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vigencia Desde */}
          <div>
            <label className="block text-sm font-medium text-ink">Vigencia Desde</label>
            <input
              type="date"
              {...register("vigenciaDesde")}
              className={inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.vigenciaDesde?.message?.toString()}
              </p>
            </div>
          </div>

          {/* Vigencia Hasta */}
          <div>
            <label className="block text-sm font-medium text-ink">Vigencia Hasta</label>
            <input
              type="date"
              {...register("vigenciaHasta")}
              className={inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.vigenciaHasta?.message?.toString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Capacidad Economy */}
          <div>
            <label className="block text-sm font-medium text-ink">Capacidad Economy</label>
            <input
              type="number"
              min="0"
              {...register("capacidadEconomy")}
              className={inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.capacidadEconomy?.message?.toString()}
              </p>
            </div>
          </div>

          {/* Precio Economy */}
          <div>
            <label className={`block text-sm font-medium ${!isEconomyEnabled ? "text-muted" : "text-ink"}`}>
              Precio Economy ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={!isEconomyEnabled}
              {...register("precioEconomy")}
              className={!isEconomyEnabled ? disabledInputClass : inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.precioEconomy?.message?.toString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Capacidad Primera */}
          <div>
            <label className="block text-sm font-medium text-ink">Capacidad Primera Clase</label>
            <input
              type="number"
              min="0"
              {...register("capacidadPrimera")}
              className={inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.capacidadPrimera?.message?.toString()}
              </p>
            </div>
          </div>

          {/* Precio Primera */}
          <div>
            <label className={`block text-sm font-medium ${!isPrimeraEnabled ? "text-muted" : "text-ink"}`}>
              Precio Primera Clase ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={!isPrimeraEnabled}
              {...register("precioPrimera")}
              className={!isPrimeraEnabled ? disabledInputClass : inputClass}
            />
            <div className="h-6 mt-1">
              <p className="text-danger text-xs leading-tight whitespace-pre-line">
                {errors.precioPrimera?.message?.toString()}
              </p>
            </div>
          </div>
        </div>

        {/* Días de la semana */}
        <div>
          <label className="block text-sm font-medium text-ink mb-2">Días de Operación</label>
          <div className="flex flex-wrap gap-4">
            {diasSemanaMap.map((dia) => (
              <label key={dia.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={dia.id}
                  {...register("diasSemana")}
                  className="h-4 w-4 rounded border-line-strong bg-surface text-accent focus:ring-accent"
                />
                <span className="text-sm text-ink transition-colors hover:text-accent">{dia.name}</span>
              </label>
            ))}
          </div>
          <div className="h-6 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">
              {errors.diasSemana?.message?.toString()}
            </p>
          </div>
        </div>

        {/* Mensajes de feedback */}
        <div>
          {serverError && (
            <div className="rounded-lg border border-[#e9c7bc] bg-[#fff4ef] p-4 text-sm text-danger">
              {serverError}
            </div>
          )}

          {serverSuccess && (
            <div className="rounded-lg border border-[#bcd8cb] bg-[#eaf4ee] p-4 text-sm text-accent">
              {serverSuccess}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end border-t border-line pt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action px-6 text-sm font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50"
          >
            <Plane size={18} />
            {isSubmitting ? "Creando y programando salidas..." : "Crear Vuelo y Generar Salidas"}
          </button>
        </div>
      </form>
    </div>
  );
}
