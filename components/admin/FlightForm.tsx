"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { flightSchema, FlightFormValues, FlightFormInput } from "@/lib/schemas/flight";
import { createFlight } from "@/app/actions/flight";
import { useState, useEffect } from "react";

const diasSemanaMap = [
  { id: 1, name: "Lunes" },
  { id: 2, name: "Martes" },
  { id: 3, name: "Miércoles" },
  { id: 4, name: "Jueves" },
  { id: 5, name: "Viernes" },
  { id: 6, name: "Sábado" },
  { id: 7, name: "Domingo" },
];

export function FlightForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FlightFormInput, unknown, FlightFormValues>({
    resolver: zodResolver(flightSchema),
    defaultValues: {
      diasSemana: [],
    },
  });

  const capacidadPrimeraValue = watch("capacidadPrimera");
  const isPrimeraEnabled = Number(capacidadPrimeraValue || 0) > 0;

  const capacidadEconomyValue = watch("capacidadEconomy");
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

  const onSubmit = async (data: FlightFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    setServerSuccess(null);

    const result = await createFlight(data);

    if (result.success) {
      setServerSuccess("¡Vuelo creado exitosamente!");
      reset(); 
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
      {/* Número de Vuelo */}
      <div>
        <label className="block text-sm font-medium text-ink">Número de Vuelo</label>
        <input
          {...register("numeroVuelo")}
          className={inputClass}
          placeholder="Ej: AR1023"
        />
        <div className="h-8 mt-1">
          <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.numeroVuelo?.message?.toString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Origen */}
        <div>
          <label className="block text-sm font-medium text-ink">Origen (IATA)</label>
          <input
            {...register("origenIata")}
            className={inputClass}
            placeholder="EZE"
            maxLength={3}
          />
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.origenIata?.message?.toString()}</p>
          </div>
        </div>

        {/* Destino */}
        <div>
          <label className="block text-sm font-medium text-ink">Destino (IATA)</label>
          <input
            {...register("destinoIata")}
            className={inputClass}
            placeholder="MIA"
            maxLength={3}
          />
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.destinoIata?.message?.toString()}</p>
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
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.horaSalida?.message?.toString()}</p>
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
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.horaLlegada?.message?.toString()}</p>
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
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.vigenciaDesde?.message?.toString()}</p>
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
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.vigenciaHasta?.message?.toString()}</p>
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
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.capacidadEconomy?.message?.toString()}</p>
          </div>
        </div>

        {/* Precio Economy */}
        <div>
          <label className={`block text-sm font-medium ${!isEconomyEnabled ? 'text-muted' : 'text-ink'}`}>Precio Economy ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={!isEconomyEnabled}
            {...register("precioEconomy")}
            className={!isEconomyEnabled ? disabledInputClass : inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.precioEconomy?.message?.toString()}</p>
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
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.capacidadPrimera?.message?.toString()}</p>
          </div>
        </div>

        {/* Precio Primera */}
        <div>
          <label className={`block text-sm font-medium ${!isPrimeraEnabled ? 'text-muted' : 'text-ink'}`}>Precio Primera Clase ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={!isPrimeraEnabled}
            {...register("precioPrimera")}
            className={!isPrimeraEnabled ? disabledInputClass : inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.precioPrimera?.message?.toString()}</p>
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
        <div className="h-8 mt-1">
          <p className="text-danger text-xs leading-tight whitespace-pre-line">{errors.diasSemana?.message?.toString()}</p>
        </div>
      </div>

      {/* Mensajes de feedback (Exito o Error) */}
      <div className="h-20">
        {serverError && (
          <div className="mt-6 rounded-lg border border-[#e9c7bc] bg-[#fff4ef] p-4 text-sm text-danger">
            {serverError}
          </div>
        )}

        {serverSuccess && (
          <div className="mt-6 rounded-lg border border-[#bcd8cb] bg-[#eaf4ee] p-4 text-sm text-accent">
            {serverSuccess}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end border-t border-line pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-12 items-center justify-center rounded-md bg-action px-6 text-sm font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50"
        >
          {isSubmitting ? "Creando..." : "Crear Vuelo"}
        </button>
      </div>
    </form>
  );
}
