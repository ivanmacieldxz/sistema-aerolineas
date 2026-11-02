import type { MetadataRoute } from "next";

/**
 * Manifiesto instalable de la PWA.
 *
 * Alcance: shell público + experiencia de instalación. La aplicación sigue
 * siendo server-authoritative: búsquedas, pagos y check-in requieren conexión.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aerolínea | Vuelos y pasajes",
    short_name: "Aerolínea",
    description:
      "Buscá vuelos, comprá pasajes para todo el grupo y consultá tu pase de abordar.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f1f3ed",
    theme_color: "#174b3f",
    lang: "es-AR",
    dir: "ltr",
    categories: ["travel", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Buscar vuelos",
        short_name: "Vuelos",
        description: "Consultá salidas disponibles por origen, destino y fecha.",
        url: "/vuelos",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
