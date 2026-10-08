import { requireRole } from "@/modules/usuarios/auth";

export default async function MostradorPanelLayout({
  children,
}: LayoutProps<"/mostrador">) {
  await requireRole("mostrador");

  return (
    <div className="flex flex-1 flex-col bg-page font-sans text-ink">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight">
            Terminal de mostrador
          </span>
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Mostrador
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
