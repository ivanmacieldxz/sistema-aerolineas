import { z } from "zod";

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