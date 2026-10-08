import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { HOME_POR_ROL, normalizarRol } from "@/modules/usuarios/roles";

const esRutaPublica = createRouteMatcher([
  "/",
  "/login(.*)",
  "/registro(.*)",
  "/mostrador/login(.*)",
  "/admin/login(.*)",
  "/api/v1(.*)",
]);

const esLoginPasajero = createRouteMatcher(["/login(.*)", "/registro(.*)"]);
const esLoginMostrador = createRouteMatcher(["/mostrador/login(.*)"]);
const esLoginAdmin = createRouteMatcher(["/admin/login(.*)"]);
const esAreaMostrador = createRouteMatcher(["/mostrador(.*)"]);
const esAreaAdmin = createRouteMatcher(["/admin(.*)"]);

export const proxy = clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();
  const rol = normalizarRol(sessionClaims?.role);

  // Sin sesión: sólo se dejan pasar las rutas públicas de cada área.
  if (!userId) {
    if (esRutaPublica(request)) {
      return;
    }
    if (esAreaAdmin(request)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (esAreaMostrador(request)) {
      return NextResponse.redirect(new URL("/mostrador/login", request.url));
    }
    return;
  }

  const home = HOME_POR_ROL[rol];

  // Con sesión: cualquier página de login/registro redirige al home del rol
  // (incluida la propia, para evitar bucles de redirección).
  if (
    esLoginPasajero(request) ||
    esLoginMostrador(request) ||
    esLoginAdmin(request)
  ) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Un rol intenta entrar al área que no le corresponde.
  if (esAreaAdmin(request) && rol !== "admin") {
    return NextResponse.redirect(new URL(home, request.url));
  }
  if (esAreaMostrador(request) && rol !== "mostrador") {
    return NextResponse.redirect(new URL(home, request.url));
  }
});

export const config = {
  matcher: [
    // Rutas de página excluyendo estáticos de Next.js e imágenes/fuentes.
    "/((?!_next/|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|map|woff2?)$).*)",
    // API REST (app móvil) y trpc.
    "/(api|trpc)(.*)",
    // Endpoint interno de Clerk (recursos del <ClerkProvider>).
    "/__clerk/(.*)",
  ],
};
