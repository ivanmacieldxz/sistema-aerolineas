"use client";

import { useEffect, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Loader2,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";
import { iniciarCompra } from "@/modules/pagos/actions";
import {
  claseSchema,
  facturacionSchema,
  pasajerosSchema,
  preferenciaRequestSchema,
} from "@/modules/pagos/schemas";
import { formatDate, formatFare, formatTime } from "@/modules/vuelos/utils";
import type { InstanciaVueloDetalle } from "@/modules/vuelos/service";

const MAX_PASAJES = 9;
const MIN_PASAJES = 1;

/** Clave de `sessionStorage` para ofrecer el reintento desde el resultado. */
export const CLAVE_INSTANCIA_CHECKOUT = "checkout:instanciaId";

/**
 * Esquema del formulario web: reutiliza la validación de la compra
 * (`claseSchema`, `pasajerosSchema`, `facturacionSchema` y el email de contacto
 * del contrato REST), omitiendo el id de la instancia porque lo aporta el RSC.
 */
const checkoutFormSchema = z.object({
  clase: claseSchema,
  emailContacto: preferenciaRequestSchema.shape.emailContacto,
  pasajeros: pasajerosSchema,
  facturacion: facturacionSchema,
});

type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
type CheckoutFormValues = z.output<typeof checkoutFormSchema>;

/** Mensajes accionables por código de dominio; si no está, se usa el del servidor. */
const MENSAJES_POR_CODIGO: Record<string, string> = {
  SIN_CUPO:
    "No quedan plazas suficientes en la clase elegida. Probá con otra clase o salida.",
  VUELO_NO_DISPONIBLE: "El vuelo ya no está disponible para la venta.",
  INSTANCIA_CANCELADA: "La salida seleccionada fue cancelada.",
  INSTANCIA_NO_ENCONTRADA: "La salida seleccionada ya no existe.",
  PASAJEROS_INVALIDOS: "La cantidad de pasajes debe estar entre 1 y 9.",
  PAYMENT_GATEWAY_UNAVAILABLE:
    "El pago no está disponible en este momento. Intentá nuevamente en unos minutos.",
  PAYMENT_GATEWAY_NOT_CONFIGURED:
    "La pasarela de pagos no está configurada. Contactá a soporte.",
  INTERNAL_ERROR:
    "Ocurrió un error inesperado al iniciar la compra. Intentá nuevamente.",
};

const inputClass =
  "mt-1 block h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

function ErrorDeCampo({ mensaje }: { mensaje?: string }) {
  if (!mensaje) {
    return null;
  }
  return (
    <p role="alert" className="mt-1 text-xs leading-tight text-danger">
      {mensaje}
    </p>
  );
}

export function CheckoutForm({ detalle }: { detalle: InstanciaVueloDetalle }) {
  const [isPending, startTransition] = useTransition();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const hayEconomy =
    detalle.capacidadEconomy > 0 && detalle.plazasDisponiblesEconomy > 0;
  const hayPrimera =
    detalle.capacidadPrimera > 0 && detalle.plazasDisponiblesPrimera > 0;
  const hayDisponibilidad = hayEconomy || hayPrimera;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormInput, unknown, CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      clase: hayEconomy ? "ECONOMY" : "PRIMERA",
      emailContacto: "",
      pasajeros: [
        { nombre: "", apellido: "", documento: "", numeroAsiento: null },
      ],
      facturacion: {
        tipoFactura: "B",
        nombreRazonSocial: "",
        identificacionFiscal: "",
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "pasajeros",
  });

  const claseSeleccionada = useWatch({ control, name: "clase" });
  const plazasDeClase =
    claseSeleccionada === "PRIMERA"
      ? detalle.plazasDisponiblesPrimera
      : detalle.plazasDisponiblesEconomy;
  const maxPasajeros = Math.max(MIN_PASAJES, Math.min(MAX_PASAJES, plazasDeClase));

  // Si la clase cambia y quedan más filas que plazas, se recortan al máximo.
  const filasExcedentes = fields.length - maxPasajeros;
  useEffect(() => {
    if (filasExcedentes > 0) {
      remove(
        Array.from({ length: filasExcedentes }, (_, indice) => maxPasajeros + indice)
      );
    }
  }, [filasExcedentes, maxPasajeros, remove]);

  const precioUnitario =
    claseSeleccionada === "PRIMERA"
      ? detalle.precioPrimera
      : detalle.precioEconomy;
  const totalEstimado = precioUnitario * fields.length;

  const onSubmit = (data: CheckoutFormValues) => {
    setErrorServidor(null);

    startTransition(async () => {
      const resultado = await iniciarCompra({
        instanciaVueloId: detalle.id,
        clase: data.clase,
        emailContacto: data.emailContacto,
        pasajeros: data.pasajeros.map((pasajero) => ({
          nombre: pasajero.nombre,
          apellido: pasajero.apellido,
          documento: pasajero.documento,
          numeroAsiento: pasajero.numeroAsiento?.trim()
            ? pasajero.numeroAsiento.trim()
            : null,
        })),
        facturacion: data.facturacion,
      });

      if (resultado.ok) {
        // Conserva el id para ofrecer "Reintentar compra" si el pago se rechaza.
        try {
          window.sessionStorage.setItem(CLAVE_INSTANCIA_CHECKOUT, detalle.id);
        } catch {
          // Almacenamiento no disponible (modo privado): el resultado ofrece
          // volver a la búsqueda de vuelos.
        }
        window.location.assign(resultado.initPoint);
        return;
      }

      setErrorServidor(
        MENSAJES_POR_CODIGO[resultado.code] ?? resultado.message
      );
    });
  };

  const clases = [
    {
      value: "ECONOMY" as const,
      etiqueta: "Economy",
      precio: detalle.precioEconomy,
      plazas: detalle.plazasDisponiblesEconomy,
      capacidad: detalle.capacidadEconomy,
      disponible: hayEconomy,
    },
    {
      value: "PRIMERA" as const,
      etiqueta: "Primera clase",
      precio: detalle.precioPrimera,
      plazas: detalle.plazasDisponiblesPrimera,
      capacidad: detalle.capacidadPrimera,
      disponible: hayPrimera,
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Resumen de la salida elegida */}
      <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-muted">
              VUELO {detalle.numeroVuelo}
            </p>
            <h2 className="mt-1 text-lg font-semibold capitalize text-ink">
              {formatDate(detalle.fechaSalida)}
            </h2>
          </div>
          <span className="rounded bg-soft px-2.5 py-1 text-xs font-semibold text-accent">
            {detalle.estado}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted sm:gap-6">
          <p className="font-medium tabular-nums text-ink">
            {formatTime(detalle.horaSalida)} · {detalle.origen.ciudad} (
            {detalle.origen.iataCode})
          </p>
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
          <p className="font-medium tabular-nums text-ink">
            {formatTime(detalle.horaLlegada)} · {detalle.destino.ciudad} (
            {detalle.destino.iataCode})
          </p>
        </div>
      </section>

      {!hayDisponibilidad && (
        <p
          role="alert"
          className="rounded-lg border border-[#e9c7bc] bg-[#fff4ef] px-4 py-3 text-sm text-danger"
        >
          Esta salida no tiene plazas disponibles. Volvé a la búsqueda para
          elegir otro vuelo.
        </p>
      )}

      {/* Contexto de invitado */}
      <p className="flex items-start gap-2 rounded-lg border border-line bg-soft/60 px-4 py-3 text-xs leading-5 text-muted">
        <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        Podés completar la compra como invitado. Si iniciás sesión, la reserva
        quedará asociada a tu cuenta.
      </p>

      {/* Clase */}
      <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-base font-semibold text-ink">Clase de cabina</h3>
        <div role="radiogroup" aria-label="Clase de cabina" className="mt-4 grid gap-3 sm:grid-cols-2">
          {clases.map((opcion) => (
            <label
              key={opcion.value}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-line-strong bg-surface p-4 transition has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="radio"
                    value={opcion.value}
                    disabled={!opcion.disponible}
                    className="sr-only"
                    {...register("clase")}
                  />
                  {opcion.etiqueta}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {opcion.capacidad === 0
                    ? "No disponible"
                    : opcion.plazas > 0
                      ? `${opcion.plazas} plazas libres`
                      : "Agotado"}
                </span>
              </span>
              <span className="text-right text-sm font-semibold tabular-nums text-ink">
                {formatFare(opcion.precio)}
              </span>
            </label>
          ))}
        </div>
        <ErrorDeCampo mensaje={errors.clase?.message?.toString()} />
      </section>

      {/* Pasajeros */}
      <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">Pasajeros</h3>
            <p className="mt-1 text-xs text-muted">
              Entre 1 y {maxPasajeros} {maxPasajeros === 1 ? "pasaje" : "pasajes"} para
              esta clase.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              append({ nombre: "", apellido: "", documento: "", numeroAsiento: null })
            }
            disabled={fields.length >= maxPasajeros}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-xs font-semibold text-accent transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} aria-hidden="true" />
            Agregar pasajero
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="rounded-md border border-line p-4"
            >
              <legend className="px-1 text-xs font-semibold tracking-[0.08em] text-muted">
                PASAJERO {index + 1}
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink">
                  Nombre
                  <input
                    {...register(`pasajeros.${index}.nombre`)}
                    className={inputClass}
                    autoComplete="given-name"
                  />
                  <ErrorDeCampo
                    mensaje={errors.pasajeros?.[index]?.nombre?.message?.toString()}
                  />
                </label>

                <label className="block text-sm font-medium text-ink">
                  Apellido
                  <input
                    {...register(`pasajeros.${index}.apellido`)}
                    className={inputClass}
                    autoComplete="family-name"
                  />
                  <ErrorDeCampo
                    mensaje={errors.pasajeros?.[index]?.apellido?.message?.toString()}
                  />
                </label>

                <label className="block text-sm font-medium text-ink">
                  Documento
                  <input
                    {...register(`pasajeros.${index}.documento`)}
                    className={inputClass}
                  />
                  <ErrorDeCampo
                    mensaje={errors.pasajeros?.[index]?.documento?.message?.toString()}
                  />
                </label>

                <label className="block text-sm font-medium text-ink">
                  Asiento <span className="font-normal text-muted">(opcional)</span>
                  <input
                    {...register(`pasajeros.${index}.numeroAsiento`, {
                      setValueAs: (valor) =>
                        typeof valor === "string" && valor.trim() === ""
                          ? null
                          : valor,
                    })}
                    className={inputClass}
                    placeholder="Ej: 12A"
                  />
                  <ErrorDeCampo
                    mensaje={errors.pasajeros?.[index]?.numeroAsiento?.message?.toString()}
                  />
                </label>
              </div>

              {fields.length > MIN_PASAJES && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-danger transition hover:underline"
                >
                  <Minus size={14} aria-hidden="true" />
                  Quitar pasajero
                </button>
              )}
            </fieldset>
          ))}
        </div>
      </section>

      {/* Contacto y facturación */}
      <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-base font-semibold text-ink">
          Contacto y facturación
        </h3>

        <label className="mt-4 block text-sm font-medium text-ink">
          Email de contacto
          <input
            type="email"
            {...register("emailContacto")}
            className={inputClass}
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
          />
          <ErrorDeCampo mensaje={errors.emailContacto?.message?.toString()} />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
          <label className="block text-sm font-medium text-ink">
            Tipo de factura
            <select {...register("facturacion.tipoFactura")} className={inputClass}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
            <ErrorDeCampo
              mensaje={errors.facturacion?.tipoFactura?.message?.toString()}
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Nombre o razón social
            <input
              {...register("facturacion.nombreRazonSocial")}
              className={inputClass}
            />
            <ErrorDeCampo
              mensaje={errors.facturacion?.nombreRazonSocial?.message?.toString()}
            />
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium text-ink">
          Identificación fiscal
          <input
            {...register("facturacion.identificacionFiscal")}
            className={inputClass}
            placeholder="CUIT / CUIL / DNI"
          />
          <ErrorDeCampo
            mensaje={errors.facturacion?.identificacionFiscal?.message?.toString()}
          />
        </label>
      </section>

      {/* Total y confirmación */}
      <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-muted">
              TOTAL A PAGAR
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {formatFare(totalEstimado)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {fields.length}{" "}
              {fields.length === 1 ? "pasaje" : "pasajes"} ×{" "}
              {formatFare(precioUnitario)}
            </p>
          </div>
        </div>

        {errorServidor && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-[#e9c7bc] bg-[#fff4ef] px-4 py-3 text-sm text-danger"
          >
            {errorServidor}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !hayDisponibilidad}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-action px-6 text-sm font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isPending ? (
            <Loader2 size={18} aria-hidden="true" className="animate-spin" />
          ) : (
            <Ticket size={18} aria-hidden="true" />
          )}
          {isPending ? "Iniciando el pago..." : "Continuar al pago"}
        </button>
      </section>
    </form>
  );
}
