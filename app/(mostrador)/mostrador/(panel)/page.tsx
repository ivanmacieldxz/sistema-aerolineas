export default function MostradorPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.12em] text-muted">
          TERMINAL DE MOSTRADOR
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Terminal de check-in
        </h1>
        <p className="mt-1 text-sm text-muted">
          Operación en aeropuerto: búsqueda de pasajeros y reasignación de
          asientos.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {[
          {
            titulo: "Búsqueda de pasajeros",
            detalle:
              "Localización por documento de identidad o código de pasaje.",
          },
          {
            titulo: "Check-in",
            detalle:
              "Emisión de pase de abordar y confirmación de asiento asignado.",
          },
          {
            titulo: "Reasignación de asientos",
            detalle:
              "Cambio de butaca dentro de la misma clase sujeta a cupo.",
          },
          {
            titulo: "Estado de abordaje",
            detalle:
              "Seguimiento del estado de cada pasajero de la instancia de vuelo.",
          },
        ].map((tarjeta) => (
          <li
            key={tarjeta.titulo}
            className="rounded-lg border border-line bg-surface p-5"
          >
            <h2 className="text-sm font-semibold">{tarjeta.titulo}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {tarjeta.detalle}
            </p>
          </li>
        ))}
      </ul>

      <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-muted">
        Placeholder: la terminal de mostrador completa se implementará en una
        iteración posterior.
      </p>
    </div>
  );
}
