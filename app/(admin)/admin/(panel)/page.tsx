export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Panel de administración
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Gestión troncal de vuelos y reportes de control de ocupación.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {[
          {
            titulo: "Vuelos y rutas",
            detalle: "Alta y modificación de rutas, horarios, días de operación y vigencia anual.",
          },
          {
            titulo: "Capacidades y precios",
            detalle: "Configuración de cupos y tarifas por clase (Economy y Primera).",
          },
          {
            titulo: "Control de ocupación",
            detalle: "Reportes de pasajes emitidos frente a la capacidad de cada vuelo.",
          },
          {
            titulo: "Gestión de usuarios",
            detalle: "Administración de perfiles y roles del sistema.",
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
        Placeholder: la interfaz completa de administración se implementará en
        una iteración posterior.
      </p>
    </div>
  );
}
