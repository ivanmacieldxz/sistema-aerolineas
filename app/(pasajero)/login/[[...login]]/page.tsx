import { Plane } from "lucide-react";
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-page px-4 py-16 font-sans text-ink">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <span className="mx-auto grid size-10 w-fit place-items-center rounded-lg bg-brand text-white">
            <Plane size={20} aria-hidden="true" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Sistema de aerolínea
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Accedé para buscar vuelos, comprar pasajes y consultar tus pases de
            abordar.
          </p>
        </header>

        <div className="flex justify-center">
          <SignIn path="/login" routing="path" fallbackRedirectUrl="/" />
        </div>
      </div>
    </main>
  );
}
