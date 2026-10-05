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
  } = useForm<FlightFormInput>({
    resolver: zodResolver(flightSchema) as any,
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

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setServerError(null);
    setServerSuccess(null);

    const validData = data as FlightFormValues;
    const result = await createFlight(validData);

    if (result.success) {
      setServerSuccess("¡Vuelo creado exitosamente!");
      reset(); 
    } else {
      setServerError(result.message);
    }
    
    setIsSubmitting(false);
  };

  const inputClass = "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500 bg-neutral-800 border-neutral-700 text-white placeholder-gray-500";
  const disabledInputClass = "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500 bg-neutral-900 border-neutral-800 text-gray-500 cursor-not-allowed";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
      {/* Número de Vuelo */}
      <div>
        <label className="block text-sm font-medium text-gray-200">Número de Vuelo</label>
        <input
          {...register("numeroVuelo")}
          className={inputClass}
          placeholder="Ej: AR1023"
        />
        <div className="h-8 mt-1">
          <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.numeroVuelo?.message?.toString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Origen */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Origen (IATA)</label>
          <input
            {...register("origenIata")}
            className={inputClass}
            placeholder="EZE"
            maxLength={3}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.origenIata?.message?.toString()}</p>
          </div>
        </div>

        {/* Destino */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Destino (IATA)</label>
          <input
            {...register("destinoIata")}
            className={inputClass}
            placeholder="MIA"
            maxLength={3}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.destinoIata?.message?.toString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hora Salida */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Hora de Salida</label>
          <input
            type="time"
            {...register("horaSalida")}
            className={inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.horaSalida?.message?.toString()}</p>
          </div>
        </div>

        {/* Hora Llegada */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Hora de Llegada</label>
          <input
            type="time"
            {...register("horaLlegada")}
            className={inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.horaLlegada?.message?.toString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vigencia Desde */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Vigencia Desde</label>
          <input
            type="date"
            {...register("vigenciaDesde")}
            className={inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.vigenciaDesde?.message?.toString()}</p>
          </div>
        </div>

        {/* Vigencia Hasta */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Vigencia Hasta</label>
          <input
            type="date"
            {...register("vigenciaHasta")}
            className={inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.vigenciaHasta?.message?.toString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Capacidad Economy */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Capacidad Economy</label>
          <input
            type="number"
            min="0"
            {...register("capacidadEconomy")}
            className={inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.capacidadEconomy?.message?.toString()}</p>
          </div>
        </div>

        {/* Precio Economy */}
        <div>
          <label className={`block text-sm font-medium ${!isEconomyEnabled ? 'text-gray-500' : 'text-gray-200'}`}>Precio Economy ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={!isEconomyEnabled}
            {...register("precioEconomy")}
            className={!isEconomyEnabled ? disabledInputClass : inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.precioEconomy?.message?.toString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Capacidad Primera */}
        <div>
          <label className="block text-sm font-medium text-gray-200">Capacidad Primera Clase</label>
          <input
            type="number"
            min="0"
            {...register("capacidadPrimera")}
            className={inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.capacidadPrimera?.message?.toString()}</p>
          </div>
        </div>

        {/* Precio Primera */}
        <div>
          <label className={`block text-sm font-medium ${!isPrimeraEnabled ? 'text-gray-500' : 'text-gray-200'}`}>Precio Primera Clase ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={!isPrimeraEnabled}
            {...register("precioPrimera")}
            className={!isPrimeraEnabled ? disabledInputClass : inputClass}
          />
          <div className="h-8 mt-1">
            <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.precioPrimera?.message?.toString()}</p>
          </div>
        </div>
      </div>

      {/* Días de la semana */}
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">Días de Operación</label>
        <div className="flex flex-wrap gap-4">
          {diasSemanaMap.map((dia) => (
            <label key={dia.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                value={dia.id}
                {...register("diasSemana")}
                className="rounded border-neutral-700 bg-neutral-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-neutral-900"
              />
              <span className="text-sm text-gray-300 hover:text-white transition-colors">{dia.name}</span>
            </label>
          ))}
        </div>
        <div className="h-8 mt-1">
          <p className="text-red-400 text-xs leading-tight whitespace-pre-line">{errors.diasSemana?.message?.toString()}</p>
        </div>
      </div>

      {/* Mensajes de feedback (Exito o Error) */}
      <div className="h-20">
        {serverError && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
            {serverError}
          </div>
        )}

        {serverSuccess && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg">
            {serverSuccess}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-6 border-t border-neutral-800">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-lg border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Creando..." : "Crear Vuelo"}
        </button>
      </div>
    </form>
  );
}
