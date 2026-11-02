"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/sw.js";
const SERVICE_WORKER_ENABLED =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_PWA_DEV === "true";

/**
 * Registra el service worker que habilita la instalación y la página offline.
 *
 * En desarrollo queda deshabilitado por defecto para evitar que el caché de
 * assets interfiera con el hot reload. Se puede activar con
 * NEXT_PUBLIC_PWA_DEV="true".
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!SERVICE_WORKER_ENABLED) {
      return;
    }

    if (
      typeof window === "undefined" ||
      !window.isSecureContext ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register(SERVICE_WORKER_PATH, {
          scope: "/",
          updateViaCache: "none",
        })
        .catch((error: unknown) => {
          console.warn(
            "[PWA] No se pudo registrar el service worker:",
            error
          );
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
