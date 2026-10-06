import Link from "next/link";
import { Plane } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";

export function Topbar() {
  return (
    <div className="w-full bg-page">
      <header className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 text-ink sm:px-8">
        <Link
          href="/vuelos"
          className="flex items-center gap-3"
          aria-label="Vuelos, inicio"
        >
          <span className="grid size-10 place-items-center rounded-lg bg-brand text-white">
            <Plane size={20} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-[0.08em]">AEROLÍNEA</span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted sm:block">
            Vuelos nacionales e internacionales
          </span>
          <Show when="signed-out">
            <Link
              href="/login"
              className="text-sm font-medium text-accent transition-colors hover:text-brand"
            >
              Iniciar sesión
            </Link>
          </Show>
          <UserButton />
        </div>
      </header>
    </div>
  );
}
