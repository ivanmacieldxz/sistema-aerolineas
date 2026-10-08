import { Plane } from "lucide-react";
import { SignUp } from "@clerk/nextjs";

export default function RegistroPage() {
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
            Crear cuenta
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Registrarte como pasajero te permite comprar pasajes y consultar el
            estado de tus vuelos. El registro es únicamente para pasajeros.
          </p>
        </header>

        <div className="flex justify-center">
          <SignUp path="/registro" routing="path" fallbackRedirectUrl="/" />
        </div>
      </div>
    </main>
  );
}
