import { requireRole } from "@/modules/usuarios/auth";

export default async function MostradorPanelLayout({
  children,
}: LayoutProps<"/mostrador">) {
  await requireRole("mostrador");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-black dark:text-zinc-50">
            Terminal de mostrador
          </span>
          <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
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
