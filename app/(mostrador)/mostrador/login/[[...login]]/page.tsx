import { Plane } from "lucide-react";
import { SignIn } from "@clerk/nextjs";

export default function MostradorLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-page px-4 py-16 font-sans text-ink">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <span className="mx-auto grid size-10 w-fit place-items-center rounded-lg bg-brand text-white">
            <Plane size={20} aria-hidden="true" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Terminal de mostrador
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Acceso de empleados
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Inicia sesión con tu cuenta corporativa para operar el check-in en
            el aeropuerto.
          </p>
        </header>

        <div className="flex justify-center">
          <SignIn
            path="/mostrador/login"
            routing="path"
            withSignUp={false}
            fallbackRedirectUrl="/mostrador"
          />
        </div>
      </div>
    </main>
  );
}
