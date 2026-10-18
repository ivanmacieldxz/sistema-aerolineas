import { ResultadoPago } from "@/modules/pasajes/components/ResultadoPago";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aerolínea | Resultado del pago",
  description: "Estado de tu compra y pases de abordaje.",
};

type ResultadoPageProps = {
  searchParams: Promise<{ transaccionId?: string }>;
};

export default async function ResultadoPage({
  searchParams: searchParamsPromise,
}: ResultadoPageProps) {
  const { transaccionId } = await searchParamsPromise;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-page font-sans text-ink">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
        <ResultadoPago transaccionId={transaccionId ?? null} />
      </div>
    </main>
  );
}
