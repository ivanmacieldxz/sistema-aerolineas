"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { airportSchema, type AirportFormValues } from "../schemas";
import { createAirportAction } from "../actions";

type AirportFormProps = {
  onAirportCreated?: (airport: AirportFormValues) => void;
  onCancel?: () => void;
};

export function AirportForm({ onAirportCreated, onCancel }: AirportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AirportFormValues>({
    resolver: zodResolver(airportSchema),
  });

  const onSubmit = async (data: AirportFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    setServerSuccess(null);

    const result = await createAirportAction(data);

    if (result.success) {
      setServerSuccess(result.message);
      reset();
      if (onAirportCreated) {
        onAirportCreated(data);
      }
    } else {
      setServerError(result.message);
    }

    setIsSubmitting(false);
  };

  const inputClass =
    "mt-1 block h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-accent/30 bg-accent/5 p-5">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h3 className="text-base font-semibold text-ink">Registrar Nuevo Aeropuerto</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-medium text-muted hover:text-ink"
          >
            Cerrar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-ink">Código IATA (3 letras)</label>
          <input
            {...register("iataCode")}
            className={inputClass}
            placeholder="Ej: COR"
            maxLength={3}
          />
          {errors.iataCode && (
            <p className="mt-1 text-xs text-danger">{errors.iataCode.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-ink">Nombre del Aeropuerto</label>
          <input
            {...register("nombre")}
            className={inputClass}
            placeholder="Ej: Aeropuerto Intl. Taravella"
          />
          {errors.nombre && (
            <p className="mt-1 text-xs text-danger">{errors.nombre.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-ink">Ciudad</label>
          <input
            {...register("ciudad")}
            className={inputClass}
            placeholder="Ej: Córdoba"
          />
          {errors.ciudad && (
            <p className="mt-1 text-xs text-danger">{errors.ciudad.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-ink">Provincia</label>
          <input
            {...register("provincia")}
            className={inputClass}
            placeholder="Ej: Córdoba"
          />
          {errors.provincia && (
            <p className="mt-1 text-xs text-danger">{errors.provincia.message}</p>
          )}
        </div>
      </div>

      {serverError && (
        <div className="rounded-md border border-[#e9c7bc] bg-[#fff4ef] p-3 text-xs text-danger">
          {serverError}
        </div>
      )}

      {serverSuccess && (
        <div className="rounded-md border border-[#bcd8cb] bg-[#eaf4ee] p-3 text-xs text-accent">
          {serverSuccess}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-surface"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-brand disabled:opacity-50"
        >
          {isSubmitting ? "Guardando..." : "Guardar Aeropuerto"}
        </button>
      </div>
    </form>
  );
}
