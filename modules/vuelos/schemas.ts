import { z } from "zod";

const dateTransformer = z
  .union([z.string(), z.date()], { error: "Ingresar una fecha válida" })
  .refine(
    (val) => {
      if (val instanceof Date) return !isNaN(val.getTime());
      if (typeof val === "string") return val.trim().length > 0 && !isNaN(Date.parse(val));
      return false;
    },
    { message: "Ingresar una fecha válida" }
  )
  .transform((val) => new Date(val));

const optionalNumber = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return 0;
  return Number(val);
}, z.number({ error: "Debe ser numérico" }).min(0, "No puede ser negativo"));

export const flightSchema = z
  .object({
    numeroVuelo: z
      .string({ error: "El número de vuelo es requerido" })
      .min(1, { message: "El número de vuelo es requerido" }),

    origenIata: z
      .string({ error: "El origen es requerido" })
      .length(3, { message: "El código IATA de origen debe tener\nexactamente 3 caracteres" })
      .toUpperCase(),

    destinoIata: z
      .string({ error: "El destino es requerido" })
      .length(3, { message: "El código IATA de destino debe tener\nexactamente 3 caracteres" })
      .toUpperCase(),

    horaSalida: z
      .string({ error: "La hora de salida es requerida" })
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "La hora de salida debe tener el formato HH:MM" }),

    horaLlegada: z
      .string({ error: "La hora de llegada es requerida" })
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "La hora de llegada debe tener el formato HH:MM" }),

    vigenciaDesde: dateTransformer,
    vigenciaHasta: dateTransformer,

    capacidadEconomy: optionalNumber,
    precioEconomy: optionalNumber,

    capacidadPrimera: optionalNumber,
    precioPrimera: optionalNumber,

    diasSemana: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, { message: "Debe seleccionar al menos un día de operación" }),
  })
  .refine((data) => data.origenIata !== data.destinoIata, {
    message: "El aeropuerto de origen y destino\nno pueden ser el mismo",
    path: ["destinoIata"],
  })
  .refine(
    (data) => {
      const hasta = new Date(data.vigenciaHasta);
      const desde = new Date(data.vigenciaDesde);

      if (!isNaN(hasta.getTime()) && !isNaN(desde.getTime())) {
        return hasta >= desde;
      }
      return true;
    },
    {
      message: "La fecha de fin no puede ser\nanterior a la fecha de inicio",
      path: ["vigenciaHasta"],
    }
  )
  .refine(
    (data) => {
      if (data.capacidadPrimera > 0 && data.precioPrimera <= 0) {
        return false;
      }
      return true;
    },
    {
      message: "Debes indicar un precio mayor a 0",
      path: ["precioPrimera"],
    }
  )
  .refine(
    (data) => {
      if (data.capacidadEconomy > 0 && data.precioEconomy <= 0) {
        return false;
      }
      return true;
    },
    {
      message: "Debes indicar un precio mayor a 0",
      path: ["precioEconomy"],
    }
  )
  .refine(
    (data) => {
      return data.capacidadEconomy > 0 || data.capacidadPrimera > 0;
    },
    {
      message: "El vuelo debe tener capacidad asignada\nen al menos una clase",
      path: ["capacidadEconomy"],
    }
  )
  .refine(
    (data) => {
      return data.capacidadEconomy > 0 || data.capacidadPrimera > 0;
    },
    {
      message: "El vuelo debe tener capacidad asignada\nen al menos una clase",
      path: ["capacidadPrimera"],
    }
  );

export type FlightFormValues = z.output<typeof flightSchema>;
export type FlightFormInput = z.input<typeof flightSchema>;

export const flightInstanceDateSchema = z.iso.date({ error: "Seleccioná una fecha válida." });

const airportCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Seleccioná un aeropuerto válido.");

export const flightSearchSchema = z
  .object({
    origen: airportCodeSchema,
    destino: airportCodeSchema,
    fecha: z.iso.date({ error: "Ingresá una fecha válida." }),
  })
  .refine((data) => data.origen !== data.destino, {
    message: "El origen y el destino deben ser distintos.",
    path: ["destino"],
  });

export type FlightSearchValues = z.infer<typeof flightSearchSchema>;

export const airportSchema = z.object({
  iataCode: z
    .string({ error: "El código IATA es requerido" })
    .trim()
    .length(3, { message: "El código IATA debe tener exactamente 3 caracteres" })
    .toUpperCase(),
  nombre: z
    .string({ error: "El nombre es requerido" })
    .trim()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  ciudad: z
    .string({ error: "La ciudad es requerida" })
    .trim()
    .min(2, { message: "La ciudad debe tener al menos 2 caracteres" }),
  provincia: z
    .string({ error: "La provincia es requerida" })
    .trim()
    .min(2, { message: "La provincia debe tener al menos 2 caracteres" }),
});

export type AirportFormValues = z.infer<typeof airportSchema>;
