"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Aviso global de conectividad.
 *
 * No reintenta Server Actions automáticamente: una compra o un check-in
 * reintentado a ciegas podría duplicar una transacción. La persona usuaria
 * decide cuándo volver a intentar.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-danger px-4 py-2 text-center text-sm font-medium text-white"
    >
      <WifiOff size={16} aria-hidden="true" />
      <span>Sin conexión. Algunas funciones no están disponibles.</span>
    </div>
  );
}
