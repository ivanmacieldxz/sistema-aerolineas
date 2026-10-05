import { z } from "zod";

const dateTransformer = z
  .union([z.string(), z.date()], { errorMap: () => ({ message: "Ingresar una fecha valida" }) })
  .refine((val) => {
    if (val instanceof Date) return !isNaN(val.getTime());
    if (typeof val === "string") return val.trim().length > 0 && !isNaN(Date.parse(val));
    return false;
  }, { message: "Ingresar una fecha valida" })
  .transform((val) => new Date(val));

const optionalNumber = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return 0;
  return Number(val);
}, z.number({ errorMap: () => ({ message: "Debe ser numérico" }) }).min(0, "No puede ser negativo"));

export const flightSchema = z.object({
  numeroVuelo: z
    .string({ errorMap: () => ({ message: "El número de vuelo es requerido" }) })
    .min(1, { message: "El número de vuelo es requerido" }),
    
  origenIata: z
    .string({ errorMap: () => ({ message: "El origen es requerido" }) })
    .length(3, { message: "El código IATA de origen debe tener\nexactamente 3 caracteres" })
    .toUpperCase(),
    
  destinoIata: z
    .string({ errorMap: () => ({ message: "El destino es requerido" }) })
    .length(3, { message: "El código IATA de destino debe tener\nexactamente 3 caracteres" })
    .toUpperCase(),

  horaSalida: z
    .string({ errorMap: () => ({ message: "La hora de salida es requerida" }) })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "La hora de salida debe tener el formato HH:MM" }),
    
  horaLlegada: z
    .string({ errorMap: () => ({ message: "La hora de llegada es requerida" }) })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "La hora de llegada debe tener el formato HH:MM" }),

  vigenciaDesde: dateTransformer,
  vigenciaHasta: dateTransformer,

  capacidadEconomy: optionalNumber,
  precioEconomy: optionalNumber,

  capacidadPrimera: optionalNumber,
  precioPrimera: optionalNumber,

  diasSemana: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, { message: "Debe seleccionar al menos un día de operación" }),
})
.refine((data) => data.origenIata !== data.destinoIata, {
  message: "El aeropuerto de origen y destino\nno pueden ser el mismo",
  path: ["destinoIata"],
})
.refine((data) => {
  const hasta = new Date(data.vigenciaHasta);
  const desde = new Date(data.vigenciaDesde);
  
  if (!isNaN(hasta.getTime()) && !isNaN(desde.getTime())) {
    return hasta >= desde;
  }
  return true;
}, {
  message: "La fecha de fin no puede ser\nanterior a la fecha de inicio",
  path: ["vigenciaHasta"],
})
.refine((data) => {
  if (data.capacidadPrimera > 0 && data.precioPrimera <= 0) {
    return false;
  }
  return true;
}, {
  message: "Debes indicar un precio mayor a 0",
  path: ["precioPrimera"]
})
.refine((data) => {
  if (data.capacidadEconomy > 0 && data.precioEconomy <= 0) {
    return false;
  }
  return true;
}, {
  message: "Debes indicar un precio mayor a 0",
  path: ["precioEconomy"]
})
.refine((data) => {
  return (data.capacidadEconomy > 0 || data.capacidadPrimera > 0);
}, {
  message: "El vuelo debe tener capacidad asignada\nen al menos una clase",
  path: ["capacidadEconomy"]
})
.refine((data) => {
  return (data.capacidadEconomy > 0 || data.capacidadPrimera > 0);
}, {
  message: "El vuelo debe tener capacidad asignada\nen al menos una clase",
  path: ["capacidadPrimera"]
});

export type FlightFormValues = z.output<typeof flightSchema>;
export type FlightFormInput = z.input<typeof flightSchema>;
