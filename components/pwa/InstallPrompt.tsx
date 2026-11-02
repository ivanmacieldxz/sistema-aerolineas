"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Plane, X } from "lucide-react";

/**
 * Evento no estándar de Chromium para abrir el instalador de la PWA.
 * No forma parte de la lib DOM de TypeScript.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type IosNavigator = Navigator & {
  standalone?: boolean;
};

const DISMISS_KEY = "aerolinea:pwa-install-dismissed-at";
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function isPassengerRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/vuelos") ||
    pathname.startsWith("/checkout")
  );
}

function wasDismissedRecently() {
  try {
    const rawValue = window.localStorage.getItem(DISMISS_KEY);

    if (!rawValue) {
      return false;
    }

    const dismissedAt = Number(rawValue);

    return (
      Number.isFinite(dismissedAt) &&
      Date.now() - dismissedAt < DISMISS_WINDOW_MS
    );
  } catch {
    // localStorage puede no estar disponible en modo privado.
    return false;
  }
}

function subscribeToStandalone(onStoreChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");

  displayMode.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);

  return () => {
    displayMode.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  const iosStandalone = (navigator as IosNavigator).standalone === true;

  return (
    window.matchMedia("(display-mode: standalone)").matches || iosStandalone
  );
}

function getIosSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  // iPadOS 13+ se presenta como macOS; se detecta por el soporte táctil.
  const isIpadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return (
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || isIpadOs) &&
    !("MSStream" in window)
  );
}

const getServerSnapshot = () => false;
const subscribeNever = () => () => {};

/**
 * Invitación a instalar la PWA en las rutas del pasajero.
 *
 * - Chromium/Android: usa beforeinstallprompt con un botón propio.
 * - iOS Safari: muestra las instrucciones de "Agregar a inicio", ya que
 *   Safari no expone beforeinstallprompt.
 * - Se oculta si la app ya se abrió en modo standalone o si se descartó
 *   en los últimos 30 días.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const standaloneSnapshot = useSyncExternalStore(
    subscribeToStandalone,
    getStandaloneSnapshot,
    getServerSnapshot
  );
  const isIos = useSyncExternalStore(
    subscribeNever,
    getIosSnapshot,
    getServerSnapshot
  );
  const [wasInstalled, setWasInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() =>
    typeof window === "undefined" ? false : wasDismissedRecently()
  );
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  const isStandalone = standaloneSnapshot || wasInstalled;

  useEffect(() => {
    if (isDismissed) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setPromptEvent(null);
      setWasInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [isDismissed]);

  function handleDismiss() {
    setIsDismissed(true);
    setPromptEvent(null);

    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Si localStorage no está disponible, la invitación solo se oculta
      // durante esta sesión.
    }
  }

  async function handleInstall() {
    if (!promptEvent) {
      return;
    }

    setIsInstalling(true);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === "dismissed") {
        handleDismiss();
      }
    } catch (error: unknown) {
      console.warn("[PWA] No se pudo abrir el instalador:", error);
    } finally {
      setPromptEvent(null);
      setIsInstalling(false);
    }
  }

  const canShow =
    !isStandalone &&
    !isDismissed &&
    isPassengerRoute(pathname) &&
    (promptEvent !== null || isIos);

  if (!canShow) {
    return null;
  }

  return (
    <aside
      aria-label="Instalar la aplicación"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-line bg-surface p-4 shadow-[0_20px_60px_-20px_rgba(16,46,39,0.45)] sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white">
          <Plane size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            Instalá la app de Aerolínea
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {isIos
              ? "Tocá Compartir y después Agregar a inicio para abrirla como una app."
              : "Accedé a tus vuelos desde la pantalla de inicio, sin abrir el navegador."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {promptEvent ? (
              <button
                type="button"
                onClick={handleInstall}
                disabled={isInstalling}
                className="inline-flex h-9 items-center justify-center rounded-md bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInstalling ? "Instalando…" : "Instalar app"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-9 items-center justify-center rounded-md border border-line-strong px-3 text-xs font-semibold text-ink transition-colors hover:bg-soft"
            >
              {isIos ? "Entendido" : "Ahora no"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
