import { SignIn } from "@clerk/nextjs";

export default function MostradorLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Terminal de mostrador
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Acceso de empleados
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
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
