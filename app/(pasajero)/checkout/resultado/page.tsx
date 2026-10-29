import { ResultadoPago } from "@/modules/pasajes/components/ResultadoPago";
import { sincronizarPagoDesdeRetorno } from "@/modules/pagos/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aerolínea | Resultado del pago",
  description: "Estado de tu compra y pases de abordaje.",
};

type ResultadoPageProps = {
  searchParams: Promise<{
    transaccionId?: string;
    external_reference?: string;
    collection_id?: string;
    payment_id?: string;
    status?: string;
  }>;
};

export default async function ResultadoPage({
  searchParams: searchParamsPromise,
}: ResultadoPageProps) {
  const params = await searchParamsPromise;
  const transaccionId = params.transaccionId ?? params.external_reference ?? null;
  const paymentId = params.payment_id ?? params.collection_id ?? null;

  // En proyectos locales o sin webhook en la nube: si la transacción está pendiente,
  // la sincronizamos inmediatamente contra Mercado Pago al retornar a esta pantalla.
  if (transaccionId) {
    try {
      await sincronizarPagoDesdeRetorno({
        transaccionId,
        paymentId,
        status: params.status,
      });
    } catch (error) {
      console.warn(
        `[ResultadoPage] Falló la sincronización automática en retorno para #${transaccionId}:`,
        error
      );
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-page font-sans text-ink">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
        <ResultadoPago transaccionId={transaccionId} />
      </div>
    </main>
  );
}
