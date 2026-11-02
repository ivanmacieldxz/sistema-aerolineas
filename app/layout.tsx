import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { Topbar } from "@/components/topbar";
import { AuthSync } from "@/modules/usuarios/components/AuthSync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aerolínea | Búsqueda de vuelos",
  description: "Buscá vuelos programados por origen, destino y fecha.",
  applicationName: "Aerolínea",
  appleWebApp: {
    capable: true,
    title: "Aerolínea",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    // Next 16 emite "mobile-web-app-capable"; iOS sigue usando la variante
    // con prefijo apple para abrir la PWA en modo standalone.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#174b3f",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#27715e",
              colorForeground: "#19332d",
              colorMutedForeground: "#64766f",
              colorBorder: "#dce2da",
              borderRadius: "0.375rem",
            },
          }}
        >
          <AuthSync />
          <ServiceWorkerRegistrar />
          <OfflineBanner />
          <Topbar />
          <div className="flex flex-1 flex-col">{children}</div>
          <InstallPrompt />
        </ClerkProvider>
      </body>
    </html>
  );
}
