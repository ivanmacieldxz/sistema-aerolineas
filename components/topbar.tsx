import Link from "next/link";
import { Plane } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";

export function Topbar() {
  return (
    <div className="w-full bg-[#f1f3ed] dark:bg-[#102e27]">
      <header className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 text-[#19332d] sm:px-8 dark:text-[#ededed]">
        <Link
          href="/vuelos"
          className="flex items-center gap-3"
          aria-label="Vuelos, inicio"
        >
          <span className="grid size-10 place-items-center rounded-lg bg-[#174b3f] text-white">
            <Plane size={20} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-[0.08em]">AEROLÍNEA</span>
        </Link>

        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <Link
              href="/login"
              className="text-sm font-medium text-[#27715e] transition-colors hover:text-[#174b3f] dark:text-[#b7d6c7] dark:hover:text-white"
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
