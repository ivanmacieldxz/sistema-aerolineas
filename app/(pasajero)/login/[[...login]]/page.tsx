import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Sistema de aerolínea
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
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
