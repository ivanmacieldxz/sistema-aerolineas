export default function MostradorPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Terminal de check-in
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Operación en aeropuerto: búsqueda de pasajeros y reasignación de
          asientos.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {[
          {
            titulo: "Búsqueda de pasajeros",
            detalle: "Localización por documento de identidad o código de pasaje.",
          },
          {
            titulo: "Check-in",
            detalle: "Emisión de pase de abordar y confirmación de asiento asignado.",
          },
          {
            titulo: "Reasignación de asientos",
            detalle: "Cambio de butaca dentro de la misma clase sujeta a cupo.",
          },
          {
            titulo: "Estado de abordaje",
            detalle: "Seguimiento del estado de cada pasajero de la instancia de vuelo.",
          },
        ].map((tarjeta) => (
          <li
            key={tarjeta.titulo}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
              {tarjeta.titulo}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {tarjeta.detalle}
            </p>
          </li>
        ))}
      </ul>

      <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Placeholder: la terminal de mostrador completa se implementará en una
        iteración posterior.
      </p>
    </div>
  );
}
