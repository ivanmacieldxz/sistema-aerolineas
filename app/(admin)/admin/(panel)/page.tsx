export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.12em] text-muted">
          ADMINISTRACIÓN
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Panel de administración
        </h1>
        <p className="mt-1 text-sm text-muted">
          Gestión troncal de vuelos y reportes de control de ocupación.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {[
          {
            titulo: "Vuelos y rutas",
            detalle:
              "Alta y modificación de rutas, horarios, días de operación y vigencia anual.",
          },
          {
            titulo: "Capacidades y precios",
            detalle:
              "Configuración de cupos y tarifas por clase (Economy y Primera).",
          },
          {
            titulo: "Control de ocupación",
            detalle:
              "Reportes de pasajes emitidos frente a la capacidad de cada vuelo.",
          },
          {
            titulo: "Gestión de usuarios",
            detalle: "Administración de perfiles y roles del sistema.",
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
        Placeholder: la interfaz completa de administración se implementará en
        una iteración posterior.
      </p>
    </div>
  );
}
