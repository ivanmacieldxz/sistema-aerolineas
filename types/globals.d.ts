export {};

declare global {
  /**
   * Claims personalizados del session token de Clerk.
   * Se configuran en Dashboard -> Sessions -> Customize session token -> Claims editor:
   * `{ "role": "{{user.public_metadata.role}}" }`
   *
   * Si el claim no existe (usuarios creados por sign-up público), el rol
   * efectivo es `pasajero`.
   */
  interface CustomJwtSessionClaims {
    role?: "pasajero" | "mostrador" | "admin";
  }
}
